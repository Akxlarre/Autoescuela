import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import { assertReadOk, toFriendlyDbMessage } from '@core/utils/db-error.utils';
import type {
  AlumnoDeudor,
  EstadoCuentaHistorialItem,
  EstadoCuentaResumen,
  MetodoPago,
  PagoReciente,
} from '@core/models/ui/pagos.model';
import { chileToday, endOfMonthIso, startOfMonthIso } from '@core/utils/chile-time.utils';
import { formatCLP } from '@core/utils/date.utils';
import { roundPercentagesTo100 } from '@core/utils/percentage.utils';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { buildStudentDisplayName } from '@core/utils/student-name.util';
import { mapConcepto } from '@core/utils/payment-concept.utils';
import {
  mapAnulacionPago,
  PAYMENT_ANULACION_SELECT,
  PAYMENT_STATUS_ANULADO,
  PAYMENT_STATUSES_QUE_SUMAN,
} from '@core/utils/payment-status.utils';

// ─── Helpers puros ────────────────────────────────────────────────────────────

export function mapEstado(status: string | null): string | null {
  if (!status) return null;
  switch (status.toLowerCase()) {
    case 'paid':
      return 'completado';
    case PAYMENT_STATUS_ANULADO:
      return 'anulado';
    case 'partial':
    case 'pending':
      return 'pendiente';
    default:
      return 'pendiente';
  }
}

function resolveMetodo(row: {
  transfer_amount: number;
  cash_amount: number;
  card_amount: number;
  voucher_amount: number;
}): { metodo: string; icono: string } {
  const activos = [
    (row.transfer_amount ?? 0) > 0 && { metodo: 'Transferencia', icono: 'landmark' },
    (row.cash_amount ?? 0) > 0 && { metodo: 'Efectivo', icono: 'banknote' },
    (row.card_amount ?? 0) > 0 && { metodo: 'Débito/Crédito', icono: 'credit-card' },
    (row.voucher_amount ?? 0) > 0 && { metodo: 'WebPay', icono: 'monitor' },
  ].filter(Boolean) as { metodo: string; icono: string }[];

  if (activos.length === 0) return { metodo: '—', icono: 'dollar-sign' };
  if (activos.length === 1) return activos[0];
  return { metodo: 'Mixto', icono: 'dollar-sign' };
}

const METODOS_CONFIG: { key: string; metodo: string; color: string; icono: string }[] = [
  {
    key: 'transfer_amount',
    metodo: 'Transferencia',
    color: 'var(--color-primary)',
    icono: 'landmark',
  },
  { key: 'cash_amount', metodo: 'Efectivo', color: 'var(--state-success)', icono: 'banknote' },
  {
    key: 'card_amount',
    metodo: 'Débito/Crédito',
    color: 'var(--state-info)',
    icono: 'credit-card',
  },
  { key: 'voucher_amount', metodo: 'WebPay', color: 'var(--state-warning)', icono: 'monitor' },
];

@Injectable({ providedIn: 'root' })
export class PagosFacade {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly notifications = inject(NotificationsFacade);
  private readonly toast = inject(ToastService);

  showSuccess(summary: string, detail?: string): void {
    this.toast.success(summary, detail);
  }

  showError(summary: string, detail?: string): void {
    this.toast.error(summary, detail);
  }

  // ── 1. ESTADO REACTIVO (Privado) ────────────────────────────────────────────
  // KPIs en `null` mientras no haya una carga vigente (spec 0060-b): una carga fallida nunca se
  // muestra como $0.
  private readonly _ingresosHoy = signal<number | null>(null);
  private readonly _ingresosMes = signal<number | null>(null);
  private readonly _boletasMes = signal<number | null>(null);
  private readonly _pagosPendientesTotales = signal<number | null>(null);
  private readonly _alumnosConDeuda = signal<AlumnoDeudor[]>([]);
  private readonly _pagosRecientes = signal<PagoReciente[]>([]);
  private readonly _metodosPagoMes = signal<MetodoPago[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  /** Caso A: la carga de la sede vigente falló y no hay datos que mostrar. */
  private readonly _error = signal<string | null>(null);
  /** Caso B: lo visible es de la consulta vigente, pero el último refresco falló. */
  private readonly _refreshFailed = signal<boolean>(false);

  private readonly _enrollmentSeleccionado = signal<number | null>(null);
  private readonly _estadoCuentaResumen = signal<EstadoCuentaResumen | null>(null);
  private readonly _estadoCuentaHistorial = signal<EstadoCuentaHistorialItem[]>([]);
  private readonly _isLoadingDetalle = signal<boolean>(false);
  private readonly _errorDetalle = signal<string | null>(null);
  private readonly _detalleRefreshFailed = signal<boolean>(false);

  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;
  private _realtimeChannel: any | null = null;
  /**
   * fix-195-b (spec 0005-m): un solo guard para la carga completa, el refresco SWR y Realtime.
   * Solo la llamada vigente aplica sus 7 resultados; antes, A → B → A rápido dejaba "A" con los
   * deudores de B.
   */
  private readonly pagosGuard = createRequestGuard();
  /** fix-049-i: una carga del Estado de Cuenta de un alumno anterior no pisa la del actual. */
  private readonly estadoCuentaGuard = createRequestGuard();

  // ── 2. ESTADO EXPUESTO (Público) ──────────────────────────────────────────
  readonly ingresosHoy = this._ingresosHoy.asReadonly();
  readonly ingresosMes = this._ingresosMes.asReadonly();
  readonly boletasMes = this._boletasMes.asReadonly();
  readonly pagosPendientesTotales = this._pagosPendientesTotales.asReadonly();
  readonly alumnosConDeuda = this._alumnosConDeuda.asReadonly();
  readonly pagosRecientes = this._pagosRecientes.asReadonly();
  readonly metodosPagoMes = this._metodosPagoMes.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly refreshFailed = this._refreshFailed.asReadonly();
  readonly totalDeudores = computed(() => this._alumnosConDeuda().length);

  readonly enrollmentSeleccionado = this._enrollmentSeleccionado.asReadonly();
  readonly estadoCuentaResumen = this._estadoCuentaResumen.asReadonly();
  readonly estadoCuentaHistorial = this._estadoCuentaHistorial.asReadonly();
  readonly isLoadingDetalle = this._isLoadingDetalle.asReadonly();
  readonly errorDetalle = this._errorDetalle.asReadonly();
  readonly detalleRefreshFailed = this._detalleRefreshFailed.asReadonly();

  // ── 3. MÉTODOS DE ACCIÓN ─────────────────────────────────────────────────────

  setupRealtime(): void {
    if (this._realtimeChannel) return;
    this._realtimeChannel = this.supabase.client
      .channel('pagos-global-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        console.log('[PagosFacade] Realtime update: payments changed');
        void this.refreshSilently();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => {
        console.log('[PagosFacade] Realtime update: enrollments changed');
        void this.refreshSilently();
      })
      .subscribe();
  }

  destroyRealtime(): void {
    if (this._realtimeChannel) {
      void this.supabase.client.removeChannel(this._realtimeChannel);
      this._realtimeChannel = null;
    }
  }

  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }

  async initialize(): Promise<void> {
    this.setupRealtime();
    const branchId = this.getActiveBranchId();
    if (this._initialized && branchId === this._lastBranchId) {
      void this.refreshSilently();
      return;
    }
    await this.cargarCompleta(branchId);
  }

  /**
   * Reintento del botón "Reintentar" (spec 0060-b). Con datos vigentes de la misma sede es un
   * refresco sin skeleton (caso B); si no, una carga completa (caso A).
   */
  async reintentar(): Promise<void> {
    const branchId = this.getActiveBranchId();
    if (this._initialized && branchId === this._lastBranchId) {
      await this.refreshSilently();
      return;
    }
    await this.cargarCompleta(branchId);
  }

  /** Carga con skeleton: primera visita, cambio de sede o reintento del caso A. */
  private async cargarCompleta(branchId: number | null): Promise<void> {
    const token = this.pagosGuard.next();
    this._initialized = false;
    this._lastBranchId = undefined;
    this._isLoading.set(true);
    this._error.set(null);
    this._refreshFailed.set(false);
    try {
      const applied = await this.fetchAll(token);
      if (!applied) return;
      this._initialized = true;
      this._lastBranchId = branchId;
    } catch (err) {
      if (!this.pagosGuard.isCurrent(token)) return;
      // Caso A: lo que hubiera en memoria es de otra consulta (u otra sede); no se muestra.
      this.resetDatos();
      this._error.set(toFriendlyDbMessage(err, 'No se pudieron cargar los pagos.'));
    } finally {
      if (this.pagosGuard.isCurrent(token)) this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    const token = this.pagosGuard.next();
    const branchId = this.getActiveBranchId();
    try {
      const applied = await this.fetchAll(token);
      if (!applied) return;
      this._initialized = true;
      this._lastBranchId = branchId;
      this._refreshFailed.set(false);
      this._error.set(null);
    } catch (err) {
      if (!this.pagosGuard.isCurrent(token)) return;
      if (this._initialized && branchId === this._lastBranchId) {
        // Caso B: lo visible responde a la misma consulta; se queda con el aviso.
        this._refreshFailed.set(true);
      } else {
        // Sin datos vigentes (este refresco reemplazó a una carga completa, o la anterior falló):
        // sigue siendo el caso A, nunca "sin deudores" con un aviso encima.
        this.resetDatos();
        this._error.set(toFriendlyDbMessage(err, 'No se pudieron cargar los pagos.'));
      }
    } finally {
      // Si este refresco reemplazó a una carga completa de otra sede, el skeleton es suyo.
      if (this.pagosGuard.isCurrent(token)) this._isLoading.set(false);
    }
  }

  private resetDatos(): void {
    this._ingresosHoy.set(null);
    this._ingresosMes.set(null);
    this._boletasMes.set(null);
    this._pagosPendientesTotales.set(null);
    this._alumnosConDeuda.set([]);
    this._pagosRecientes.set([]);
    this._metodosPagoMes.set([]);
  }

  /**
   * Las 7 lecturas de la pantalla. Se aplican juntas y solo si todas salieron bien (spec 0060-b,
   * regla de carga combinada): una que falla hace fallar la carga y ningún KPI queda armado con
   * una parte de los datos. Devuelve `false` si una carga más nueva la reemplazó.
   */
  private async fetchAll(token: number): Promise<boolean> {
    const today = chileToday();
    const firstOfMonth = startOfMonthIso(today);
    const lastOfMonth = endOfMonthIso(today);
    const branchId = this.getActiveBranchId();

    const [ingresosHoy, ingresosMes, boletas, pendientes, deudores, recientes, metodos] =
      await Promise.all([
        this.fetchIngresosHoy(today, branchId),
        this.fetchIngresosMes(firstOfMonth, lastOfMonth, branchId),
        this.fetchBoletasMes(firstOfMonth, lastOfMonth, branchId),
        this.fetchPagosPendientes(branchId),
        this.fetchAlumnosConDeuda(branchId),
        this.fetchPagosRecientes(branchId),
        this.fetchMetodosPagoMes(firstOfMonth, lastOfMonth, branchId),
      ]);
    if (!this.pagosGuard.isCurrent(token)) return false;

    this._ingresosHoy.set(ingresosHoy);
    this._ingresosMes.set(ingresosMes);
    this._boletasMes.set(boletas);
    this._pagosPendientesTotales.set(pendientes);
    this._alumnosConDeuda.set(deudores);
    this._pagosRecientes.set(recientes);
    this._metodosPagoMes.set(metodos);
    return true;
  }

  private async fetchIngresosHoy(today: string, branchId: number | null): Promise<number> {
    let q: any = this.supabase.client
      .from('payments')
      .select('total_amount, enrollments!inner(branch_id)')
      .in('status', [...PAYMENT_STATUSES_QUE_SUMAN])
      .eq('payment_date', today);
    if (branchId !== null) q = q.eq('enrollments.branch_id', branchId);
    const rows = assertReadOk(await q) as any[] | null;
    return (rows ?? []).reduce((acc: number, r: any) => acc + (r.total_amount ?? 0), 0);
  }

  private async fetchIngresosMes(
    first: string,
    last: string,
    branchId: number | null,
  ): Promise<number> {
    let q: any = this.supabase.client
      .from('payments')
      .select('total_amount, enrollments!inner(branch_id)')
      .in('status', [...PAYMENT_STATUSES_QUE_SUMAN])
      .gte('payment_date', first)
      .lte('payment_date', last);
    if (branchId !== null) q = q.eq('enrollments.branch_id', branchId);
    const rows = assertReadOk(await q) as any[] | null;
    return (rows ?? []).reduce((acc: number, r: any) => acc + (r.total_amount ?? 0), 0);
  }

  private async fetchBoletasMes(
    first: string,
    last: string,
    branchId: number | null,
  ): Promise<number> {
    let q: any = this.supabase.client
      .from('payments')
      .select('id, enrollments!inner(branch_id)', { count: 'exact', head: true })
      .in('status', [...PAYMENT_STATUSES_QUE_SUMAN])
      .gte('payment_date', first)
      .lte('payment_date', last);
    if (branchId !== null) q = q.eq('enrollments.branch_id', branchId);
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  }

  private async fetchPagosPendientes(branchId: number | null): Promise<number> {
    let q: any = this.supabase.client
      .from('enrollments')
      .select('pending_balance')
      .gt('pending_balance', 0)
      // Una matrícula cancelada no es deuda (fix-060-i): la limpieza nocturna cancela borradores
      // vencidos con consentimientos y las online vencidas sin pago quedan canceladas.
      .not('status', 'in', '("draft","cancelled")');
    if (branchId !== null) q = q.eq('branch_id', branchId);
    const rows = assertReadOk(await q) as any[] | null;
    return (rows ?? []).reduce((acc: number, r: any) => acc + (r.pending_balance ?? 0), 0);
  }

  private async fetchAlumnosConDeuda(branchId: number | null): Promise<AlumnoDeudor[]> {
    let q: any = this.supabase.client
      .from('enrollments')
      .select(
        'id, number, status, base_price, discount, total_paid, pending_balance, created_at, branch_id, students!inner(users!inner(first_names, paternal_last_name, maternal_last_name, rut)), courses!inner(type, name), branches!inner(name)',
      )
      .gt('pending_balance', 0)
      .not('status', 'in', '("draft","cancelled")')
      .order('pending_balance', { ascending: false })
      // Techo server-side (fix-147-b): sin esto la lista crece sin límite con el historial.
      // Mismo patrón que fetchPagosRecientes. Al venir ordenada por saldo descendente, el
      // recorte deja fuera a los deudores más chicos, que son los menos accionables.
      .limit(200);
    if (branchId !== null) q = q.eq('branch_id', branchId);
    const rows = assertReadOk(await q) as any[] | null;

    return (rows ?? []).map(
      (row: any): AlumnoDeudor => ({
        enrollmentId: row.id,
        alumno: buildStudentDisplayName({
          firstNames: row.students?.users?.first_names,
          paternalLastName: row.students?.users?.paternal_last_name,
          maternalLastName: row.students?.users?.maternal_last_name,
        }),
        rut: row.students?.users?.rut ?? '—',
        totalAPagar: (row.base_price ?? 0) - (row.discount ?? 0),
        pagado: row.total_paid ?? 0,
        saldo: row.pending_balance ?? 0,
        cursoTipo: row.courses?.type ?? null,
        cursoNombre: row.courses?.name ?? '—',
        fechaMatricula: row.created_at ?? null,
        numeroMatricula: row.number ?? null,
        estadoMatricula: row.status ?? null,
        sedeId: row.branch_id,
        sedeNombre: row.branches?.name ?? '—',
      }),
    );
  }

  private async fetchPagosRecientes(branchId: number | null): Promise<PagoReciente[]> {
    let q: any = this.supabase.client
      .from('payments')
      .select(
        `id, payment_date, type, total_amount, transfer_amount, cash_amount, card_amount, voucher_amount, document_number, status, enrollments!inner(branch_id, students(users(first_names, paternal_last_name, maternal_last_name))), ${PAYMENT_ANULACION_SELECT}`,
      )
      // Es un listado: los anulados vienen y se muestran tachados (spec 0025-m).
      // Excluye matrículas confirmadas con pago pendiente (fix-135-m): son placeholders con
      // $0 recibido para registrar la deuda, no pagos reales. Esos alumnos ya aparecen en
      // la lista de deudores vía fetchAlumnosConDeuda().
      .neq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    if (branchId !== null) q = q.eq('enrollments.branch_id', branchId);
    const rows = assertReadOk(await q) as any[] | null;

    return (rows ?? []).map((row: any): PagoReciente => {
      const { metodo, icono } = resolveMetodo(row);
      return {
        id: row.id,
        fecha: row.payment_date,
        alumno: buildStudentDisplayName({
          firstNames: row.enrollments?.students?.users?.first_names,
          paternalLastName: row.enrollments?.students?.users?.paternal_last_name,
          maternalLastName: row.enrollments?.students?.users?.maternal_last_name,
        }),
        concepto: mapConcepto(row.type),
        monto: row.total_amount ?? 0,
        metodo,
        metodoIcono: icono,
        nroDocumento: row.document_number,
        estado: mapEstado(row.status),
        anulacion: mapAnulacionPago(row),
      };
    });
  }

  private async fetchMetodosPagoMes(
    first: string,
    last: string,
    branchId: number | null,
  ): Promise<MetodoPago[]> {
    let q: any = this.supabase.client
      .from('payments')
      .select(
        'transfer_amount, cash_amount, card_amount, voucher_amount, enrollments!inner(branch_id)',
      )
      .in('status', [...PAYMENT_STATUSES_QUE_SUMAN])
      .gte('payment_date', first)
      .lte('payment_date', last);
    if (branchId !== null) q = q.eq('enrollments.branch_id', branchId);
    const rows = assertReadOk(await q) as any[] | null;
    const totals = METODOS_CONFIG.map((cfg) => ({
      ...cfg,
      total: (rows ?? []).reduce((acc: number, r: any) => acc + (r[cfg.key] ?? 0), 0),
    }));
    const porcentajes = roundPercentagesTo100(totals.map((m) => m.total));

    return totals
      .map((m, i) => ({
        metodo: m.metodo,
        total: m.total,
        porcentaje: porcentajes[i],
        color: m.color,
        icono: m.icono,
      }))
      .filter((m) => m.total > 0)
      .sort((a, b) => b.porcentaje - a.porcentaje);
  }

  /**
   * `enrollments.total_paid`/`pending_balance`/`payment_status` NO se escriben acá:
   * el trigger `trg_update_balance` (`recalculate_enrollment_balance()`) los recalcula
   * de forma atómica desde `SUM(payments.total_amount)` en cuanto el INSERT de abajo
   * confirma. Calcularlos en el cliente a partir de un snapshot pasado por parámetro
   * era la causa de un lost-update: doble submit o dos pestañas pisaban el saldo del
   * primer pago porque ambas escrituras partían del mismo snapshot desactualizado
   * (fix-114-m, ASG-b-063).
   */
  async registrarNuevoPago(enrollmentId: number | null, payload: any): Promise<void> {
    const { error: insertError } = await this.supabase.client.from('payments').insert({
      enrollment_id: enrollmentId,
      type: payload.type,
      total_amount: payload.total_amount,
      cash_amount: payload.cash_amount,
      transfer_amount: payload.transfer_amount,
      card_amount: payload.card_amount,
      voucher_amount: payload.voucher_amount,
      document_number: payload.document_number || null,
      payment_date: payload.payment_date,
      status: 'paid',
    });
    if (insertError) throw insertError;

    if (enrollmentId !== null) {
      // Refrescamos los detalles del estado de cuenta específicos para este enrollment
      void this.cargarEstadoCuenta(enrollmentId);

      this.notifyPaymentRegistered(enrollmentId, payload.total_amount);
    }
    void this.refreshSilently();
  }

  /**
   * Notifica al alumno que se registró su abono (spec 0025, AC1).
   * Fire-and-forget: un fallo nunca revierte el abono ya registrado.
   */
  private notifyPaymentRegistered(enrollmentId: number, amount: number): void {
    if (amount <= 0) return;

    this.resolveStudentUserIdByEnrollment(enrollmentId)
      .then((userId) => {
        if (!userId) return;
        this.notifications
          .notifyUsers([userId], {
            subject: 'Pago registrado',
            message: `Se registró un pago de ${formatCLP(amount)} en tu matrícula.`,
            referenceType: 'payment',
          })
          .catch(() => this.toast.warning('No se pudo notificar al alumno'));
      })
      .catch(() => {
        // Resolución de destinatario falló (red/RLS) — no rompe el registro (AC-E1).
      });
  }

  /** Resuelve `enrollments.student_id → students.user_id` para poder notificar al alumno. */
  private async resolveStudentUserIdByEnrollment(enrollmentId: number): Promise<number | null> {
    const { data, error } = await this.supabase.client
      .from('enrollments')
      .select('students!inner(user_id)')
      .eq('id', enrollmentId)
      .single();
    if (error || !data) return null;
    const students = (data as any).students;
    const student = Array.isArray(students) ? students[0] : students;
    return student?.user_id ?? null;
  }

  /**
   * Fija la matrícula del Estado de Cuenta y carga sus datos (fix-049-i). Antes solo cambiaba la
   * selección y la carga quedaba en el `ngOnInit()` del drawer: con el drawer ya abierto, "Ver
   * detalle" de otro alumno no lo re-crea, así que la pantalla seguía con el alumno anterior
   * mientras "Registrar Pago" guardaba en el nuevo.
   */
  seleccionarEnrollment(enrollmentId: number): void {
    this._enrollmentSeleccionado.set(enrollmentId);
    this._estadoCuentaResumen.set(null);
    this._estadoCuentaHistorial.set([]);
    void this.cargarEstadoCuenta(enrollmentId);
  }

  seleccionarParaPago(enrollmentId: number | null): void {
    this._enrollmentSeleccionado.set(enrollmentId);
    if (enrollmentId) {
      void this.cargarEstadoCuenta(enrollmentId);
    } else {
      this._estadoCuentaResumen.set(null);
      this._errorDetalle.set(null);
      this._detalleRefreshFailed.set(false);
    }
  }

  /**
   * Carga el Estado de Cuenta de una matrícula (spec 0060-b). Si ya se mostraba esa misma matrícula
   * y la recarga falla (p. ej. después de registrar un pago), lo visible se queda con el aviso
   * `detalleRefreshFailed` (caso B); si es otra matrícula, se retira y queda `errorDetalle` (caso A).
   */
  async cargarEstadoCuenta(enrollmentId: number): Promise<void> {
    // fix-049-i: si se elige otro alumno antes de que esta carga termine, su respuesta se descarta.
    const token = this.estadoCuentaGuard.next();
    const mismaMatricula = this._estadoCuentaResumen()?.enrollmentId === enrollmentId;
    this._isLoadingDetalle.set(true);
    this._errorDetalle.set(null);
    try {
      const [resumen, historial] = await Promise.all([
        this.fetchEstadoCuentaResumen(enrollmentId),
        this.fetchEstadoCuentaHistorial(enrollmentId),
      ]);
      if (!this.estadoCuentaGuard.isCurrent(token)) return;
      this._estadoCuentaResumen.set(resumen);
      this._estadoCuentaHistorial.set(historial);
      this._detalleRefreshFailed.set(false);
    } catch (err) {
      if (!this.estadoCuentaGuard.isCurrent(token)) return;
      if (mismaMatricula) {
        this._detalleRefreshFailed.set(true);
      } else {
        this._estadoCuentaResumen.set(null);
        this._estadoCuentaHistorial.set([]);
        this._detalleRefreshFailed.set(false);
        this._errorDetalle.set(toFriendlyDbMessage(err, 'No se pudo cargar el estado de cuenta.'));
      }
    } finally {
      if (this.estadoCuentaGuard.isCurrent(token)) this._isLoadingDetalle.set(false);
    }
  }

  /** "Reintentar" del Estado de Cuenta: recarga la matrícula seleccionada. */
  async reintentarEstadoCuenta(): Promise<void> {
    const enrollmentId = this._enrollmentSeleccionado();
    if (enrollmentId === null) return;
    await this.cargarEstadoCuenta(enrollmentId);
  }

  private async fetchEstadoCuentaResumen(
    enrollmentId: number,
  ): Promise<EstadoCuentaResumen | null> {
    const data = assertReadOk(
      await this.supabase.client
        .from('enrollments')
        .select(
          'id, base_price, discount, total_paid, pending_balance, payment_status, students!inner(users!inner(first_names, paternal_last_name, maternal_last_name, rut, email, phone)), courses!inner(name)',
        )
        .eq('id', enrollmentId)
        .maybeSingle(),
    ) as any;
    // Sin fila (borrada o fuera de la RLS): el drawer dice "No se encontró la matrícula".
    if (!data) return null;
    const user = data.students?.users;
    return {
      enrollmentId: data.id,
      alumno: buildStudentDisplayName({
        firstNames: user?.first_names,
        paternalLastName: user?.paternal_last_name,
        maternalLastName: user?.maternal_last_name,
      }),
      rut: user?.rut ?? '—',
      email: user?.email,
      telefono: user?.phone,
      curso: data.courses?.name,
      basePrice: data.base_price ?? 0,
      descuento: data.discount ?? 0,
      totalACurso: (data.base_price ?? 0) - (data.discount ?? 0),
      totalPagado: data.total_paid ?? 0,
      saldoPendiente: data.pending_balance ?? 0,
      paymentStatus: data.payment_status,
    };
  }

  private async fetchEstadoCuentaHistorial(
    enrollmentId: number,
  ): Promise<EstadoCuentaHistorialItem[]> {
    // payments-all-statuses: historial del estado de cuenta; los anulados se muestran tachados.
    const rows = assertReadOk(
      await this.supabase.client
        .from('payments')
        .select(
          `id, payment_date, type, total_amount, transfer_amount, cash_amount, card_amount, voucher_amount, document_number, status, ${PAYMENT_ANULACION_SELECT}`,
        )
        .eq('enrollment_id', enrollmentId)
        .order('created_at', { ascending: false }),
    ) as any[] | null;
    return (rows ?? []).map((row: any): EstadoCuentaHistorialItem => {
      const { metodo, icono } = resolveMetodo(row);
      return {
        id: row.id,
        fecha: row.payment_date,
        concepto: mapConcepto(row.type),
        metodo,
        metodoIcono: icono,
        nroDocumento: row.document_number,
        monto: row.total_amount,
        estado: mapEstado(row.status),
        anulacion: mapAnulacionPago(row),
      };
    });
  }

  // ── Generación de reporte PDF ────────────────────────────────────────────────

  private readonly _isGeneratingReport = signal<boolean>(false);
  readonly isGeneratingReport = this._isGeneratingReport.asReadonly();

  async generarReporte(params: {
    startDate: string;
    endDate: string;
    branchId: number | null;
  }): Promise<void> {
    this._isGeneratingReport.set(true);
    try {
      const { data, error } = await this.supabase.client.functions.invoke(
        'generate-payment-report',
        {
          body: {
            start_date: params.startDate,
            end_date: params.endDate,
            branch_id: params.branchId,
          },
        },
      );
      if (error) throw error;

      const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte_Pagos_${params.startDate}_${params.endDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      this.toast.success('Reporte generado', 'El PDF se descargó correctamente.');
    } catch (err) {
      this.toast.error(
        'Error al generar reporte',
        err instanceof Error ? this.sanitizer.sanitize(err).message : 'Inténtalo de nuevo.',
      );
    } finally {
      this._isGeneratingReport.set(false);
    }
  }
}
