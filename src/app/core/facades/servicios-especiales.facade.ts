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
    // fix-024-i: prioriza el snapshot service_name — sobrevive a un borrado definitivo del
    // catálogo (el join service_catalog.name da null si ya no existe la fila).
    servicio: dto.service_name ?? dto.service_catalog?.name ?? '—',
    servicioId: dto.service_id,
    precio: dto.price,
    fecha: dto.sale_date,
    // fix-023-i: "Estado" se fusiona con "Cobro" — dto.status nunca se actualizaba a
    // 'completed' en ningún flujo, así que quedaba en "Pendiente" para siempre. paid ya
    // refleja lo mismo que el usuario espera ver acá.
    estado: dto.paid ? 'completado' : 'pendiente',
    resultado,
    cobrado: dto.paid,
    studentUserId: student?.user_id ?? null,
    branchId: dto.branch_id,
    documentNumber: dto.document_number,
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
      // fix-023-i: trae TODO el catálogo (activos e inactivos) — el toggle "Mostrar
      // inactivos" filtra client-side; el dropdown de venta filtra .activo aparte.
      this.supabase.client
        .from('service_catalog')
        .select('*')
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
    // fix-024-i: snapshot del nombre — el Historial lo sigue mostrando aunque el servicio
    // se borre definitivamente del catálogo más tarde (service_id queda en null).
    const servicioNombre = this._catalogo().find((s) => s.id === data.servicioId)?.nombre ?? null;

    const { error } = await this.supabase.client.from('special_service_sales').insert({
      service_id: data.servicioId,
      service_name: servicioNombre,
      student_id: null,
      is_student: data.esAlumno,
      client_name: data.nombre,
      client_rut: data.rut,
      sale_date: data.fecha,
      price: data.precio,
      // fix-025-i: toda venta se cobra al momento de registrarse — ya no existe un flujo de
      // "pendiente de cobro" para servicios especiales (decisión de negocio 2026-08-13).
      paid: true,
      status: 'completed',
      document_number: data.documentNumber ?? null,
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
      .update({ paid: true, status: 'completed' })
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

  /**
   * Borra una venta de Servicio Especial (fix-022-i, ASG-b-050).
   *
   * Borrado duro (DELETE real, sin estado "anulada") — pero bloqueado si el día de la
   * venta (`sale_date`) ya tiene una fila en `cash_closings` para su sede. La cuadratura
   * guarda `total_income` como snapshot congelado al cerrar; borrar hacia atrás una venta
   * de un día ya cerrado descuadraría ese número en silencio (mismo criterio que ASG-b-037).
   */
  async borrarVenta(id: number): Promise<{ success: boolean; blockedReason?: string }> {
    const venta = this._ventas().find((v) => v.id === id);
    if (!venta) return { success: false };

    let closedQuery = this.supabase.client
      .from('cash_closings')
      .select('id')
      .eq('date', venta.fecha)
      .eq('closed', true)
      .limit(1);
    if (venta.branchId !== null) closedQuery = closedQuery.eq('branch_id', venta.branchId);

    const { data: closedData, error: closedError } = await closedQuery;
    if (closedError) {
      this._error.set(this.sanitizer.sanitize(closedError).message);
      return { success: false };
    }
    if (closedData && closedData.length > 0) {
      return {
        success: false,
        blockedReason: `No se puede borrar: la caja del ${venta.fecha} ya está cerrada.`,
      };
    }

    const { error } = await this.supabase.client
      .from('special_service_sales')
      .delete()
      .eq('id', id);

    if (error) {
      this._error.set(this.sanitizer.sanitize(error).message);
      return { success: false };
    }

    await this.refreshSilently();
    return { success: true };
  }

  /**
   * Borra un servicio del catálogo (fix-022-i, ASG-b-050 — alcance real de la asignación,
   * corregido tras confusión con `borrarVenta`).
   *
   * Intenta DELETE duro primero. `special_service_sales.service_id` referencia esta tabla
   * SIN `ON DELETE CASCADE`: si el servicio tiene ventas asociadas, Postgres rechaza el DELETE
   * con una violación de FK (código `23503`). En ese caso, en vez de mostrar el error crudo,
   * hace fallback automático a `active = false` (desactivar) — dejar de ofrecerlo para nuevas
   * ventas sin romper el historial ya existente.
   */
  async borrarServicio(id: number): Promise<{ success: boolean; deactivated: boolean }> {
    const { error: deleteError } = await this.supabase.client
      .from('service_catalog')
      .delete()
      .eq('id', id);

    if (!deleteError) {
      await this.refreshSilently();
      return { success: true, deactivated: false };
    }

    if (deleteError.code !== '23503') {
      this._error.set(this.sanitizer.sanitize(deleteError).message);
      return { success: false, deactivated: false };
    }

    const { error: updateError } = await this.supabase.client
      .from('service_catalog')
      .update({ active: false })
      .eq('id', id);

    if (updateError) {
      this._error.set(this.sanitizer.sanitize(updateError).message);
      return { success: false, deactivated: false };
    }

    await this.refreshSilently();
    return { success: true, deactivated: true };
  }

  /** Reactiva un servicio del catálogo previamente desactivado (fix-023-i). */
  async reactivarServicio(id: number): Promise<{ success: boolean }> {
    const { error } = await this.supabase.client
      .from('service_catalog')
      .update({ active: true })
      .eq('id', id);

    if (error) {
      this._error.set(this.sanitizer.sanitize(error).message);
      return { success: false };
    }

    await this.refreshSilently();
    return { success: true };
  }

  /**
   * Borra un servicio del catálogo de forma DEFINITIVA (fix-024-i) — a diferencia de
   * `borrarServicio()`, no hay fallback: se usa solo desde la tarjeta ya Inactiva, con
   * confirmación explícita del usuario (escribir "ELIMINAR").
   *
   * Las ventas asociadas NO se borran — se desvinculan (`service_id = NULL`) para liberar la
   * FK. El nombre del servicio ya quedó guardado en `service_name` al momento de la venta
   * (`registrarVenta()`), así que el Historial no pierde esa información.
   */
  async borrarServicioDefinitivo(id: number): Promise<{ success: boolean }> {
    const { error: unlinkError } = await this.supabase.client
      .from('special_service_sales')
      .update({ service_id: null })
      .eq('service_id', id);

    if (unlinkError) {
      this._error.set(this.sanitizer.sanitize(unlinkError).message);
      return { success: false };
    }

    const { error: deleteError } = await this.supabase.client
      .from('service_catalog')
      .delete()
      .eq('id', id);

    if (deleteError) {
      this._error.set(this.sanitizer.sanitize(deleteError).message);
      return { success: false };
    }

    await this.refreshSilently();
    return { success: true };
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
