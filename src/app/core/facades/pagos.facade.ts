import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import type {
  AlumnoDeudor,
  EstadoCuentaHistorialItem,
  EstadoCuentaResumen,
  MetodoPago,
  PagoReciente,
} from '@core/models/ui/pagos.model';
import { toISODate } from '@core/utils/date.utils';

// ─── Helpers puros ────────────────────────────────────────────────────────────

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
  { key: 'transfer_amount', metodo: 'Transferencia', color: 'var(--color-primary)', icono: 'landmark' },
  { key: 'cash_amount', metodo: 'Efectivo', color: 'var(--state-success)', icono: 'banknote' },
  { key: 'card_amount', metodo: 'Débito/Crédito', color: 'var(--color-purple)', icono: 'credit-card' },
  { key: 'voucher_amount', metodo: 'WebPay', color: 'var(--state-warning)', icono: 'monitor' },
];

@Injectable({ providedIn: 'root' })
export class PagosFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);

  showSuccess(summary: string, detail?: string): void {
    this.toast.success(summary, detail);
  }

  showError(summary: string, detail?: string): void {
    this.toast.error(summary, detail);
  }

  // ── 1. ESTADO REACTIVO (Privado) ────────────────────────────────────────────
  private readonly _ingresosHoy = signal<number>(0);
  private readonly _ingresosMes = signal<number>(0);
  private readonly _boletasMes = signal<number>(0);
  private readonly _pagosPendientesTotales = signal<number>(0);
  private readonly _alumnosConDeuda = signal<AlumnoDeudor[]>([]);
  private readonly _pagosRecientes = signal<PagoReciente[]>([]);
  private readonly _metodosPagoMes = signal<MetodoPago[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  private readonly _enrollmentSeleccionado = signal<number | null>(null);
  private readonly _estadoCuentaResumen = signal<EstadoCuentaResumen | null>(null);
  private readonly _estadoCuentaHistorial = signal<EstadoCuentaHistorialItem[]>([]);
  private readonly _isLoadingDetalle = signal<boolean>(false);

  private _initialized = false;
  private _realtimeChannel: any | null = null;

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
  readonly totalDeudores = computed(() => this._alumnosConDeuda().length);

  readonly enrollmentSeleccionado = this._enrollmentSeleccionado.asReadonly();
  readonly estadoCuentaResumen = this._estadoCuentaResumen.asReadonly();
  readonly estadoCuentaHistorial = this._estadoCuentaHistorial.asReadonly();
  readonly isLoadingDetalle = this._isLoadingDetalle.asReadonly();

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

  async initialize(): Promise<void> {
    this.setupRealtime();
    if (this._initialized) {
      void this.refreshSilently();
      return;
    }
    
    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchAll();
      this._initialized = true;
    } catch {
      this._error.set('Error al cargar datos financieros.');
    } finally {
      this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchAll();
    } catch {
      // Swallowed
    }
  }

  private async fetchAll(): Promise<void> {
    const today = toISODate(new Date());
    const [year, month] = today.split('-');
    const firstOfMonth = `${year}-${month}-01`;
    const lastOfMonth = toISODate(new Date(Number(year), Number(month), 0));

    await Promise.all([
      this.fetchIngresosHoy(today),
      this.fetchIngresosMes(firstOfMonth, lastOfMonth),
      this.fetchBoletasMes(firstOfMonth, lastOfMonth),
      this.fetchPagosPendientes(),
      this.fetchAlumnosConDeuda(),
      this.fetchPagosRecientes(),
      this.fetchMetodosPagoMes(firstOfMonth, lastOfMonth),
    ]);
  }

  private async fetchIngresosHoy(today: string): Promise<void> {
    const { data } = await this.supabase.client.from('payments').select('total_amount').eq('payment_date', today);
    this._ingresosHoy.set((data ?? []).reduce((acc, r) => acc + (r.total_amount ?? 0), 0));
  }

  private async fetchIngresosMes(first: string, last: string): Promise<void> {
    const { data } = await this.supabase.client.from('payments').select('total_amount').gte('payment_date', first).lte('payment_date', last);
    this._ingresosMes.set((data ?? []).reduce((acc, r) => acc + (r.total_amount ?? 0), 0));
  }

  private async fetchBoletasMes(first: string, last: string): Promise<void> {
    const { count } = await this.supabase.client.from('payments').select('id', { count: 'exact', head: true }).gte('payment_date', first).lte('payment_date', last);
    this._boletasMes.set(count ?? 0);
  }

  private async fetchPagosPendientes(): Promise<void> {
    const { data } = await this.supabase.client.from('enrollments').select('pending_balance').gt('pending_balance', 0).neq('status', 'draft');
    this._pagosPendientesTotales.set((data ?? []).reduce((acc, r) => acc + (r.pending_balance ?? 0), 0));
  }

  private async fetchAlumnosConDeuda(): Promise<void> {
    const { data } = await this.supabase.client
      .from('enrollments')
      .select('id, base_price, discount, total_paid, pending_balance, students!inner(users!inner(first_names, paternal_last_name, rut))')
      .gt('pending_balance', 0)
      .neq('status', 'draft')
      .order('pending_balance', { ascending: false });

    this._alumnosConDeuda.set((data ?? []).map((row: any) => ({
      enrollmentId: row.id,
      alumno: `${row.students?.users?.first_names ?? ''} ${row.students?.users?.paternal_last_name ?? ''}`.trim(),
      rut: row.students?.users?.rut ?? '—',
      totalAPagar: (row.base_price ?? 0) - (row.discount ?? 0),
      pagado: row.total_paid ?? 0,
      saldo: row.pending_balance ?? 0,
    })));
  }

  private async fetchPagosRecientes(): Promise<void> {
    const { data } = await this.supabase.client
      .from('payments')
      .select('id, payment_date, type, total_amount, transfer_amount, cash_amount, card_amount, voucher_amount, document_number, status, enrollments(students(users(first_names, paternal_last_name)))')
      .order('created_at', { ascending: false })
      .limit(50);

    this._pagosRecientes.set((data ?? []).map((row: any) => {
      const { metodo, icono } = resolveMetodo(row);
      return {
        id: row.id,
        fecha: row.payment_date,
        alumno: `${row.enrollments?.students?.users?.first_names ?? ''} ${row.enrollments?.students?.users?.paternal_last_name ?? ''}`.trim(),
        concepto: row.type,
        monto: row.total_amount ?? 0,
        metodo,
        metodoIcono: icono,
        nroDocumento: row.document_number,
        estado: row.status,
      };
    }));
  }

  private async fetchMetodosPagoMes(first: string, last: string): Promise<void> {
    const { data } = await this.supabase.client.from('payments').select('transfer_amount, cash_amount, card_amount, voucher_amount').gte('payment_date', first).lte('payment_date', last);
    const totals = METODOS_CONFIG.map(cfg => ({
      ...cfg,
      total: (data ?? []).reduce((acc, r: any) => acc + (r[cfg.key] ?? 0), 0)
    }));
    const grandTotal = totals.reduce((acc, m) => acc + m.total, 0);

    this._metodosPagoMes.set(totals.filter(m => m.total > 0).map(m => ({
      metodo: m.metodo,
      total: m.total,
      porcentaje: grandTotal > 0 ? Math.round((m.total / grandTotal) * 100) : 0,
      color: m.color,
      icono: m.icono,
    })).sort((a, b) => b.porcentaje - a.porcentaje));
  }

  async registrarNuevoPago(enrollmentId: number | null, payload: any, montosActuales: any): Promise<void> {
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
      status: 'completado',
    });
    if (insertError) throw insertError;

    if (enrollmentId !== null && montosActuales !== null) {
      await this.supabase.client.from('enrollments').update({
        total_paid: montosActuales.total_paid + payload.total_amount,
        pending_balance: Math.max(0, montosActuales.pending_balance - payload.total_amount),
        payment_status: (montosActuales.pending_balance - payload.total_amount) <= 0 ? 'paid' : 'partial'
      }).eq('id', enrollmentId);
      
      // Refrescamos los detalles del estado de cuenta específicos para este enrollment
      void this.cargarEstadoCuenta(enrollmentId);
    }
    void this.refreshSilently();
  }

  seleccionarEnrollment(enrollmentId: number): void { this._enrollmentSeleccionado.set(enrollmentId); }

  seleccionarParaPago(enrollmentId: number | null): void {
    this._enrollmentSeleccionado.set(enrollmentId);
    if (enrollmentId) {
      void this.cargarEstadoCuenta(enrollmentId);
    } else {
      this._estadoCuentaResumen.set(null);
    }
  }

  async cargarEstadoCuenta(enrollmentId: number): Promise<void> {
    this._isLoadingDetalle.set(true);
    try {
      await Promise.all([this.fetchEstadoCuentaResumen(enrollmentId), this.fetchEstadoCuentaHistorial(enrollmentId)]);
    } finally {
      this._isLoadingDetalle.set(false);
    }
  }

  private async fetchEstadoCuentaResumen(enrollmentId: number): Promise<void> {
    const { data } = await this.supabase.client.from('enrollments').select('id, base_price, discount, total_paid, pending_balance, payment_status, students!inner(users!inner(first_names, paternal_last_name, rut, email, phone)), courses!inner(name)').eq('id', enrollmentId).maybeSingle();
    if (!data) return;
    const user = (data as any).students?.users;
    this._estadoCuentaResumen.set({
      enrollmentId: data.id,
      alumno: `${user.first_names ?? ''} ${user.paternal_last_name ?? ''}`.trim(),
      rut: user?.rut ?? '—', email: user?.email, telefono: user?.phone, curso: (data as any).courses?.name,
      basePrice: data.base_price ?? 0, descuento: data.discount ?? 0, totalACurso: (data.base_price ?? 0) - (data.discount ?? 0),
      totalPagado: data.total_paid ?? 0, saldoPendiente: data.pending_balance ?? 0, paymentStatus: data.payment_status,
    });
  }

  private async fetchEstadoCuentaHistorial(enrollmentId: number): Promise<void> {
    const { data } = await this.supabase.client.from('payments').select('id, payment_date, type, total_amount, transfer_amount, cash_amount, card_amount, voucher_amount, document_number, status').eq('enrollment_id', enrollmentId).order('created_at', { ascending: false });
    this._estadoCuentaHistorial.set((data ?? []).map((row: any) => {
      const { metodo, icono } = resolveMetodo(row);
      return { id: row.id, fecha: row.payment_date, concepto: row.type, metodo, metodoIcono: icono, nroDocumento: row.document_number, monto: row.total_amount, estado: row.status };
    }));
  }
}
