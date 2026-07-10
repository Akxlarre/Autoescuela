/**
 * ServiciosEspecialesFacade — RF-037 (Módulo 6).
 * Punto de venta de servicios complementarios conectado a Supabase.
 * Patrón SWR: primera visita con skeleton, re-visitas refrescan en background.
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
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
import { downloadExcel } from '@core/utils/excel.utils';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

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
  dto: SpecialServiceSale & {
    service_catalog: { name: string } | null;
    students: { user_id: number } | { user_id: number }[] | null;
  },
): VentaServicio {
  const resultado = (dto.metadata?.['resultado'] as string | undefined) ?? null;
  const students = dto.students;
  const student = Array.isArray(students) ? students[0] : students;
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
    studentUserId: student?.user_id ?? null,
  };
}

@Injectable({ providedIn: 'root' })
export class ServiciosEspecialesFacade {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly notifications = inject(NotificationsFacade);

  // ── Estado privado ──────────────────────────────────────────────────────────
  private readonly _catalogo = signal<ServicioEspecial[]>([]);
  private readonly _ventas = signal<VentaServicio[]>([]);
  private readonly _selectedServicio = signal<ServicioEspecial | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _isExporting = signal(false);
  private readonly _error = signal<string | null>(null);
  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;

  // ── Estado expuesto ─────────────────────────────────────────────────────────
  public readonly catalogo = this._catalogo.asReadonly();
  public readonly ventas = this._ventas.asReadonly();
  public readonly selectedServicio = this._selectedServicio.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly isExporting = this._isExporting.asReadonly();
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
    const scope = resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
    // Para INSERTs: si el scope es "todas las sedes" (null), anclar a la sede propia
    // del usuario (no se puede insertar con branch_id null).
    if (forceSpecific && scope === null) return user?.branchId ?? null;
    return scope;
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
      .select('*, service_catalog(name), students(user_id)')
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
          students: { user_id: number } | { user_id: number }[] | null;
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
      this._error.set(this.sanitizer.sanitize(error).message);
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
      this._error.set(this.sanitizer.sanitize(error).message);
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
      this._error.set(this.sanitizer.sanitize(error).message);
      return;
    }

    // Optimistic update
    this._ventas.update((prev) => prev.map((v) => (v.id === id ? { ...v, cobrado: true } : v)));

    this.notifyPaymentRegistered(id);
  }

  /**
   * Notifica al alumno que se registró el cobro de su servicio (spec 0025, AC1, AC-E1).
   * `studentUserId` ya viene resuelto desde `fetchData()` — sin query extra.
   * Solo notifica si la venta es de un alumno (`studentUserId` no null); ventas a
   * clientes externos no tienen destinatario. Fire-and-forget.
   */
  private notifyPaymentRegistered(id: number): void {
    const venta = this._ventas().find((v) => v.id === id);
    if (!venta?.studentUserId) return;

    this.notifications
      .notifyUsers([venta.studentUserId], {
        subject: 'Pago registrado',
        message: `Se registró el cobro de tu servicio (${venta.servicio}).`,
        referenceType: 'payment',
      })
      .catch(() => {
        // Fallo de notificación no revierte el cobro ya registrado (AC-E1).
      });
  }

  async exportarHistorial(format: 'excel' | 'pdf'): Promise<void> {
    this._isExporting.set(true);
    try {
      const branchId = this.getActiveBranchId();
      const { data, error } = await this.supabase.client.functions.invoke(
        'export-special-services',
        {
          body: { format, branch_id: branchId },
        },
      );

      if (error) throw error;

      const fecha = new Date().toISOString().slice(0, 10);

      if (format === 'excel') {
        const { headers, rows } = data as { headers: string[]; rows: (string | number)[][] };
        downloadExcel('Ventas', headers, rows, `Historial_Ventas_${fecha}`);
      } else {
        const rawBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
        const blob = new Blob([rawBuffer], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Historial_Ventas_${fecha}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Error exportando historial:', err);
      this._error.set('No se pudo exportar el historial.');
    } finally {
      this._isExporting.set(false);
    }
  }
}
