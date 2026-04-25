/**
 * ServiciosEspecialesFacade — RF-037 (Módulo 6).
 * Punto de venta de servicios complementarios conectado a Supabase.
 * Patrón SWR: primera visita con skeleton, re-visitas refrescan en background.
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { ServiceCatalog } from '@core/models/dto/service-catalog.model';
import type { SpecialServiceSale } from '@core/models/dto/special-service-sale.model';
import type {
  NuevoServicioFormData,
  ServicioEspecial,
  ServiciosEspecialesKpis,
  VentaFormData,
  VentaServicio,
} from '@core/models/ui/servicios-especiales.model';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

/** Mapea el nombre del servicio a ícono y color de UI. */
function getServiceUiMeta(name: string): {
  icono: string;
  color: 'indigo' | 'orange' | 'green';
} {
  const n = name.toLowerCase();
  if (n.includes('psicot') || n.includes('cerebro') || n.includes('aptitud')) {
    return { icono: 'brain', color: 'indigo' };
  }
  if (
    n.includes('maquinaria') ||
    n.includes('camion') ||
    n.includes('pesad') ||
    n.includes('truck')
  ) {
    return { icono: 'truck', color: 'orange' };
  }
  if (n.includes('informe') || n.includes('documento') || n.includes('certificado')) {
    return { icono: 'file-text', color: 'green' };
  }
  return { icono: 'receipt', color: 'indigo' };
}

function mapCatalogDto(dto: ServiceCatalog): ServicioEspecial {
  const { icono, color } = getServiceUiMeta(dto.name);
  return {
    id: dto.id,
    nombre: dto.name,
    descripcion: dto.description ?? '',
    precio: dto.base_price,
    icono,
    color,
    activo: dto.active,
  };
}

function mapVentaDto(
  dto: SpecialServiceSale & { service_catalog: { name: string } | null },
): VentaServicio {
  const resultado = (dto.metadata?.['resultado'] as string | undefined) ?? null;
  return {
    id: dto.id,
    cliente: dto.client_name ?? '—',
    rut: dto.client_rut ?? '—',
    esAlumno: dto.is_student,
    servicio: dto.service_catalog?.name ?? '—',
    servicioId: dto.service_id,
    precio: dto.price,
    fecha: dto.sale_date,
    estado: dto.status === 'completed' ? 'completado' : 'pendiente',
    resultado,
    cobrado: dto.paid,
  };
}

@Injectable({ providedIn: 'root' })
export class ServiciosEspecialesFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Estado privado ──────────────────────────────────────────────────────────
  private readonly _catalogo = signal<ServicioEspecial[]>([]);
  private readonly _ventas = signal<VentaServicio[]>([]);
  private readonly _selectedServicio = signal<ServicioEspecial | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;

  // ── Estado expuesto ─────────────────────────────────────────────────────────
  public readonly catalogo = this._catalogo.asReadonly();
  public readonly ventas = this._ventas.asReadonly();
  public readonly selectedServicio = this._selectedServicio.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly error = this._error.asReadonly();

  public readonly kpis = computed<ServiciosEspecialesKpis>(() => {
    const ventas = this._ventas();
    const mesActual = new Date().toISOString().slice(0, 7);
    const cobradas = ventas.filter((v) => v.cobrado);
    const sinCobrar = ventas.filter((v) => !v.cobrado);
    return {
      ventasMes: ventas.filter((v) => v.fecha.startsWith(mesActual)).length,
      totalCobrado: cobradas.reduce((s, v) => s + v.precio, 0),
      pendientesCobro: sinCobrar.reduce((s, v) => s + v.precio, 0),
      totalRegistros: ventas.length,
      ventasCobradas: cobradas.length,
      ventasSinCobrar: sinCobrar.length,
    };
  });

  // ── SWR ─────────────────────────────────────────────────────────────────────
  async initialize(): Promise<void> {
    const branchId = this.getActiveBranchId();

    if (this._initialized && branchId === this._lastBranchId) {
      void this.refreshSilently();
      return;
    }

    this._initialized = true;
    this._lastBranchId = branchId;
    this._isLoading.set(true);
    try {
      await this.fetchData();
    } finally {
      this._isLoading.set(false);
    }
  }

  private getActiveBranchId(forceSpecific = false): number | null {
    const user = this.auth.currentUser();
    const selected = this.branchFacade.selectedBranchId();

    if (user?.role === 'admin') {
      // Si forceSpecific es true (para INSERTs), y no hay selección, usamos la sede del usuario admin
      if (forceSpecific && selected === null) return user.branchId ?? null;
      return selected;
    }
    return user?.branchId ?? null;
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchData();
    } catch {
      // Datos stale siguen visibles
    }
  }

  private async fetchData(): Promise<void> {
    const branchId = this.getActiveBranchId();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ventasQuery: any = this.supabase.client
      .from('special_service_sales')
      .select('*, service_catalog(name)')
      .order('sale_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200);

    if (branchId !== null) ventasQuery = ventasQuery.eq('branch_id', branchId);

    const [catalogoResult, ventasResult] = await Promise.all([
      this.supabase.client
        .from('service_catalog')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: true }),

      ventasQuery,
    ]);

    if (catalogoResult.error) throw catalogoResult.error;
    if (ventasResult.error) throw ventasResult.error;

    this._catalogo.set((catalogoResult.data as ServiceCatalog[]).map(mapCatalogDto));
    this._ventas.set(
      (
        ventasResult.data as (SpecialServiceSale & {
          service_catalog: { name: string } | null;
        })[]
      ).map(mapVentaDto),
    );
    this._error.set(null);
  }

  // ── Métodos de acción ────────────────────────────────────────────────────────
  openRegistrarVentaDrawer(servicio?: ServicioEspecial): void {
    this._selectedServicio.set(servicio ?? null);
    import('../../shared/components/servicios-especiales-content/drawers/registrar-venta-drawer.component').then(
      (m) => {
        this.layoutDrawer.open(
          m.RegistrarVentaDrawerComponent,
          'Registrar Venta de Servicio',
          'receipt',
        );
      },
    );
  }

  openAgregarServicioDrawer(): void {
    import('../../shared/components/servicios-especiales-content/drawers/agregar-servicio-drawer.component').then(
      (m) => {
        this.layoutDrawer.open(m.AgregarServicioDrawerComponent, 'Agregar Nuevo Servicio', 'plus');
      },
    );
  }

  async registrarVenta(data: VentaFormData): Promise<boolean> {
    const registeredBy = this.auth.currentUser()?.dbId ?? null;
    const { error } = await this.supabase.client.from('special_service_sales').insert({
      service_id: data.servicioId,
      student_id: null,
      is_student: data.esAlumno,
      client_name: data.nombre,
      client_rut: data.rut,
      sale_date: data.fecha,
      price: data.precio,
      paid: data.cobrado,
      status: 'pending',
      registered_by: registeredBy,
      branch_id: this.getActiveBranchId(true),
      metadata: null,
    });

    if (error) {
      this._error.set(error.message);
      return false;
    }

    await this.refreshSilently();
    return true;
  }

  async agregarServicio(data: NuevoServicioFormData): Promise<boolean> {
    const { error } = await this.supabase.client.from('service_catalog').insert({
      name: data.nombre,
      description: data.descripcion,
      base_price: data.precio,
      active: true,
    });

    if (error) {
      this._error.set(error.message);
      return false;
    }

    await this.refreshSilently();
    return true;
  }

  async registrarCobro(id: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('special_service_sales')
      .update({ paid: true })
      .eq('id', id);

    if (error) {
      this._error.set(error.message);
      return;
    }

    // Optimistic update
    this._ventas.update((prev) => prev.map((v) => (v.id === id ? { ...v, cobrado: true } : v)));
  }
}
