import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type { AlumnoDeudor, MetodoPago, PagoReciente } from '@core/models/ui/pagos.model';
import { toISODate } from '@core/utils/date.utils';

// ─── Helpers puros ────────────────────────────────────────────────────────────

/** Determina el método de pago a partir de los montos parciales. */
function resolveMetodo(row: {
  transfer_amount: number;
  cash_amount: number;
  card_amount: number;
  voucher_amount: number;
}): { metodo: string; icono: string } {
  const activos = [
    row.transfer_amount > 0 && { metodo: 'Transferencia', icono: 'landmark' },
    row.cash_amount > 0 && { metodo: 'Efectivo', icono: 'banknote' },
    row.card_amount > 0 && { metodo: 'Débito/Crédito', icono: 'credit-card' },
    row.voucher_amount > 0 && { metodo: 'WebPay', icono: 'monitor' },
  ].filter(Boolean) as { metodo: string; icono: string }[];

  if (activos.length === 0) return { metodo: '—', icono: 'dollar-sign' };
  if (activos.length === 1) return activos[0];
  return { metodo: 'Mixto', icono: 'dollar-sign' };
}

/** Config de métodos para el cálculo de distribución mensual. */
const METODOS_CONFIG: { key: keyof MontosRow; metodo: string; color: string; icono: string }[] = [
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
    color: 'var(--color-purple)',
    icono: 'credit-card',
  },
  { key: 'voucher_amount', metodo: 'WebPay', color: 'var(--state-warning)', icono: 'monitor' },
];

interface MontosRow {
  transfer_amount: number;
  cash_amount: number;
  card_amount: number;
  voucher_amount: number;
}

// ─── Facade ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PagosFacade {
  private readonly supabase = inject(SupabaseService);

  // ══════════════════════════════════════════════════════════════════════════════
  // 1. ESTADO REACTIVO (Privado)
  // ══════════════════════════════════════════════════════════════════════════════

  private readonly _ingresosHoy = signal<number>(0);
  private readonly _ingresosMes = signal<number>(0);
  private readonly _boletasMes = signal<number>(0);
  private readonly _pagosPendientesTotales = signal<number>(0);
  private readonly _alumnosConDeuda = signal<AlumnoDeudor[]>([]);
  private readonly _pagosRecientes = signal<PagoReciente[]>([]);
  private readonly _metodosPagoMes = signal<MetodoPago[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  /** SWR guard: evita re-fetch con skeleton en revisitas. */
  private _initialized = false;

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. ESTADO EXPUESTO (Público, solo lectura)
  // ══════════════════════════════════════════════════════════════════════════════

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

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN
  // ══════════════════════════════════════════════════════════════════════════════

  async initialize(): Promise<void> {
    if (this._initialized) {
      this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchAll();
    } catch {
      this._error.set('Error al cargar los datos de pagos.');
    } finally {
      this._isLoading.set(false);
    }
  }

  // ── Fetch compartido ─────────────────────────────────────────────────────────

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

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchAll();
    } catch {
      // Fail silencioso — datos stale siguen visibles
    }
  }

  // ── KPI: Ingresos hoy ────────────────────────────────────────────────────────

  private async fetchIngresosHoy(today: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('payments')
      .select('total_amount')
      .eq('payment_date', today);

    if (error) throw error;
    this._ingresosHoy.set((data ?? []).reduce((acc, r) => acc + (r.total_amount ?? 0), 0));
  }

  // ── KPI: Ingresos mes ────────────────────────────────────────────────────────

  private async fetchIngresosMes(first: string, last: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('payments')
      .select('total_amount')
      .gte('payment_date', first)
      .lte('payment_date', last);

    if (error) throw error;
    this._ingresosMes.set((data ?? []).reduce((acc, r) => acc + (r.total_amount ?? 0), 0));
  }

  // ── KPI: Boletas mes ─────────────────────────────────────────────────────────

  private async fetchBoletasMes(first: string, last: string): Promise<void> {
    const { count, error } = await this.supabase.client
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .gte('payment_date', first)
      .lte('payment_date', last);

    if (error) throw error;
    this._boletasMes.set(count ?? 0);
  }

  // ── KPI: Pagos pendientes ─────────────────────────────────────────────────────

  private async fetchPagosPendientes(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('enrollments')
      .select('pending_balance')
      .gt('pending_balance', 0)
      .neq('status', 'draft');

    if (error) throw error;
    this._pagosPendientesTotales.set(
      (data ?? []).reduce((acc, r) => acc + (r.pending_balance ?? 0), 0),
    );
  }

  // ── Alumnos con deuda ────────────────────────────────────────────────────────

  private async fetchAlumnosConDeuda(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('enrollments')
      .select(
        `id, base_price, discount, total_paid, pending_balance,
         students!inner(users!inner(first_names, paternal_last_name, rut))`,
      )
      .gt('pending_balance', 0)
      .neq('status', 'draft')
      .order('pending_balance', { ascending: false });

    if (error) throw error;

    this._alumnosConDeuda.set(
      (data ?? []).map((row: any) => {
        const user = row.students?.users;
        return {
          enrollmentId: row.id,
          alumno: user ? `${user.first_names ?? ''} ${user.paternal_last_name ?? ''}`.trim() : '—',
          rut: user?.rut ?? '—',
          totalAPagar: (row.base_price ?? 0) - (row.discount ?? 0),
          pagado: row.total_paid ?? 0,
          saldo: row.pending_balance ?? 0,
        };
      }),
    );
  }

  // ── Pagos recientes ───────────────────────────────────────────────────────────

  private async fetchPagosRecientes(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('payments')
      .select(
        `id, payment_date, type, total_amount,
         transfer_amount, cash_amount, card_amount, voucher_amount,
         document_number, status,
         enrollments(
           students(
             users(first_names, paternal_last_name)
           )
         )`,
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    this._pagosRecientes.set(
      (data ?? []).map((row: any) => {
        const user = row.enrollments?.students?.users;
        const { metodo, icono } = resolveMetodo({
          transfer_amount: row.transfer_amount ?? 0,
          cash_amount: row.cash_amount ?? 0,
          card_amount: row.card_amount ?? 0,
          voucher_amount: row.voucher_amount ?? 0,
        });
        return {
          id: row.id,
          fecha: row.payment_date ?? null,
          alumno: user ? `${user.first_names ?? ''} ${user.paternal_last_name ?? ''}`.trim() : '—',
          concepto: row.type ?? null,
          monto: row.total_amount ?? 0,
          metodo,
          metodoIcono: icono,
          nroDocumento: row.document_number ?? null,
          estado: row.status ?? null,
        };
      }),
    );
  }

  // ── Métodos de pago del mes ───────────────────────────────────────────────────

  private async fetchMetodosPagoMes(first: string, last: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('payments')
      .select('transfer_amount, cash_amount, card_amount, voucher_amount')
      .gte('payment_date', first)
      .lte('payment_date', last);

    if (error) throw error;

    const rows = data ?? [];

    const totals = METODOS_CONFIG.map((cfg) => ({
      ...cfg,
      total: rows.reduce((acc, r: any) => acc + (r[cfg.key] ?? 0), 0),
    }));

    const grandTotal = totals.reduce((acc, m) => acc + m.total, 0);

    this._metodosPagoMes.set(
      totals
        .filter((m) => m.total > 0)
        .map((m) => ({
          metodo: m.metodo,
          total: m.total,
          porcentaje: grandTotal > 0 ? Math.round((m.total / grandTotal) * 100) : 0,
          color: m.color,
          icono: m.icono,
        }))
        .sort((a, b) => b.porcentaje - a.porcentaje),
    );
  }

  // ── Registrar nuevo pago ──────────────────────────────────────────────────────

  /**
   * Registra un nuevo pago en Supabase de forma secuencial:
   *   Paso 1 — INSERT en `payments`
   *   Paso 2 — UPDATE en `enrollments` (total_paid, pending_balance, payment_status)
   *   Paso 3 — refreshSilently() para actualizar todos los Signals de la UI
   *
   * @param enrollmentId  Matrícula relacionada; null para pagos sin matrícula.
   * @param payload       Datos del formulario de pago.
   * @param montosActuales Valores actuales de la matrícula (para recalcular saldos).
   */
  async registrarNuevoPago(
    enrollmentId: number | null,
    payload: {
      payment_date: string;
      type: string;
      total_amount: number;
      cash_amount: number;
      transfer_amount: number;
      card_amount: number;
      voucher_amount: number;
      document_number: string | null;
    },
    montosActuales: { total_paid: number; pending_balance: number } | null,
  ): Promise<void> {
    // Paso 1: Insertar pago
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
      requires_receipt: false,
    });

    if (insertError) throw new Error(`Error al registrar pago: ${insertError.message}`);

    // Paso 2: Actualizar matrícula (solo si hay enrollment vinculado)
    if (enrollmentId !== null && montosActuales !== null) {
      const newTotalPaid = montosActuales.total_paid + payload.total_amount;
      const newPendingBalance = Math.max(0, montosActuales.pending_balance - payload.total_amount);
      const newPaymentStatus = newPendingBalance <= 0 ? 'paid' : 'partial';

      const { error: updateError } = await this.supabase.client
        .from('enrollments')
        .update({
          total_paid: newTotalPaid,
          pending_balance: newPendingBalance,
          payment_status: newPaymentStatus,
        })
        .eq('id', enrollmentId);

      if (updateError) throw new Error(`Error al actualizar matrícula: ${updateError.message}`);
    }

    // Paso 3: Refrescar todos los signals de forma silenciosa
    await this.refreshSilently();
  }
}
