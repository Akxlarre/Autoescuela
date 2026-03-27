import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { toISODate } from '@core/utils/date.utils';
import type {
  IngresoRow,
  EgresoRow,
  CierrePayload,
  EgresoFormData,
} from '@core/models/ui/cuadratura.model';
import type { Payment } from '@core/models/dto/payment.model';
import type { Expense } from '@core/models/dto/expense.model';
import type { InstructorAdvance } from '@core/models/dto/instructor-advance.model';
import type { CashClosing } from '@core/models/dto/cash-closing.model';

// ─── Helpers puros ────────────────────────────────────────────────────────────

function mapPaymentToIngreso(p: Payment): IngresoRow {
  return {
    id: p.id,
    enrollmentId: p.enrollment_id ?? null,
    nBoleta: p.document_number ?? null,
    glosa: p.type ?? '—',
    claseB: p.cash_amount,
    claseA: p.transfer_amount,
    sence: p.voucher_amount,
    otros: p.card_amount,
    total: p.total_amount,
  };
}

function mapExpenseToEgreso(e: Expense): EgresoRow {
  return {
    id: e.id,
    tipo: 'expense',
    descripcion: e.description,
    monto: e.amount,
  };
}

function mapAdvanceToEgreso(a: InstructorAdvance): EgresoRow {
  return {
    id: a.id,
    tipo: 'advance',
    descripcion: a.reason ?? a.description ?? 'Anticipo instructor',
    monto: a.amount,
  };
}

// ─── Facade ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CuadraturaFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly toast = inject(ToastService);

  // ── Constante de negocio ──────────────────────────────────────────────────
  /** Fondo inicial fijo de caja. */
  readonly fondoInicial = signal<number>(50_000);

  // ── Estado privado ────────────────────────────────────────────────────────
  private readonly _pagosHoy = signal<IngresoRow[]>([]);
  private readonly _gastosHoy = signal<EgresoRow[]>([]);
  private readonly _cajaYaCerrada = signal<boolean>(false);
  private readonly _cierreHoy = signal<CashClosing | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private _initialized = false;

  // ── Estado público ────────────────────────────────────────────────────────
  readonly pagosHoy = this._pagosHoy.asReadonly();
  readonly gastosHoy = this._gastosHoy.asReadonly();
  readonly cajaYaCerrada = this._cajaYaCerrada.asReadonly();
  readonly cierreHoy = this._cierreHoy.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();

  // ── Computed: ingresos ────────────────────────────────────────────────────

  /** Suma de cash_amount en payments de hoy. */
  readonly ingresosEfectivoHoy = computed(() =>
    this._pagosHoy().reduce((sum, p) => sum + p.claseB, 0),
  );

  /** Suma de transfer + card en payments de hoy. */
  readonly otrosIngresosHoy = computed(() =>
    this._pagosHoy().reduce((sum, p) => sum + p.claseA + p.otros, 0),
  );

  /** Total de todos los pagos del día (todos los métodos). */
  readonly totalIngresosHoy = computed(() => this._pagosHoy().reduce((sum, p) => sum + p.total, 0));

  // ── Computed: egresos ─────────────────────────────────────────────────────

  readonly totalEgresosHoy = computed(() => this._gastosHoy().reduce((sum, e) => sum + e.monto, 0));

  // ── Computed: saldo teórico ───────────────────────────────────────────────

  /**
   * Efectivo que DEBE haber en caja:
   * fondoInicial + ingresosEfectivo - totalEgresos
   */
  readonly saldoTeoricoEfectivo = computed(
    () => this.fondoInicial() + this.ingresosEfectivoHoy() - this.totalEgresosHoy(),
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this._initialized) {
      this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    try {
      await this.fetchAll();
    } catch {
      this._error.set('Error al cargar datos de cuadratura.');
    } finally {
      this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchAll();
    } catch {
      // fail silencioso — datos stale siguen visibles
    }
  }

  // ── Fetch de datos ────────────────────────────────────────────────────────

  private async fetchAll(): Promise<void> {
    const today = toISODate(new Date());
    const branchId = this.auth.currentUser()?.branchId ?? null;

    await Promise.all([
      this.fetchPayments(today, branchId),
      this.fetchExpensesAndAdvances(today, branchId),
      this.checkCajaStatus(today, branchId),
    ]);
  }

  private async fetchPayments(today: string, branchId: number | null): Promise<void> {
    let query = this.supabase.client
      .from('payments')
      .select('*')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .order('created_at', { ascending: true });

    // Si hay branch, filtra por pagos de matrículas de esa sede
    if (branchId) {
      query = query.eq('enrollments.branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;
    this._pagosHoy.set((data ?? []).map(mapPaymentToIngreso));
  }

  private async fetchExpensesAndAdvances(today: string, branchId: number | null): Promise<void> {
    const [expRes, advRes] = await Promise.all([
      this.supabase.client
        .from('expenses')
        .select('*')
        .eq('date', today)
        .then((r) => r),

      this.supabase.client
        .from('instructor_advances')
        .select('*')
        .eq('date', today)
        .then((r) => r),
    ]);

    if (expRes.error) throw expRes.error;
    if (advRes.error) throw advRes.error;

    let gastos = (expRes.data ?? []).map(mapExpenseToEgreso);
    let anticipos = (advRes.data ?? []).map(mapAdvanceToEgreso);

    // Filtrar por branch si aplica
    if (branchId) {
      const expBranch = await this.supabase.client
        .from('expenses')
        .select('*')
        .eq('date', today)
        .eq('branch_id', branchId);
      if (!expBranch.error) {
        gastos = (expBranch.data ?? []).map(mapExpenseToEgreso);
      }
    }

    this._gastosHoy.set([...gastos, ...anticipos]);
  }

  private async checkCajaStatus(today: string, branchId: number | null): Promise<void> {
    let query = this.supabase.client
      .from('cash_closings')
      .select('*')
      .eq('date', today)
      .eq('closed', true)
      .maybeSingle();

    if (branchId) {
      query = this.supabase.client
        .from('cash_closings')
        .select('*')
        .eq('date', today)
        .eq('branch_id', branchId)
        .eq('closed', true)
        .maybeSingle();
    }

    const { data } = await query;
    this._cajaYaCerrada.set(data !== null);
    this._cierreHoy.set(data);
  }

  // ── Mutaciones ────────────────────────────────────────────────────────────

  async eliminarIngreso(row: IngresoRow): Promise<boolean> {
    this._isSaving.set(true);
    this._error.set(null);

    try {
      // Paso A: revertir saldos en enrollment si el pago está vinculado
      if (row.enrollmentId !== null) {
        const { error: enrollErr } = await this.supabase.client.rpc(
          'revert_payment_on_enrollment',
          { p_enrollment_id: row.enrollmentId, p_amount: row.total },
        );

        // Si el RPC no existe, usamos UPDATE directo como fallback seguro
        if (enrollErr) {
          const { data: enr } = await this.supabase.client
            .from('enrollments')
            .select('total_paid, pending_balance')
            .eq('id', row.enrollmentId)
            .maybeSingle();

          if (enr) {
            await this.supabase.client
              .from('enrollments')
              .update({
                total_paid: Math.max(0, (enr.total_paid ?? 0) - row.total),
                pending_balance: (enr.pending_balance ?? 0) + row.total,
              })
              .eq('id', row.enrollmentId);
          }
        }
      }

      // Paso B: eliminar el pago
      const { error } = await this.supabase.client.from('payments').delete().eq('id', row.id);

      if (error) throw error;

      this.toast.success('Movimiento eliminado y saldos revertidos.');
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar el ingreso.';
      this._error.set(msg);
      this.toast.error(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  async eliminarEgreso(row: EgresoRow): Promise<boolean> {
    this._isSaving.set(true);
    this._error.set(null);

    try {
      const tabla = row.tipo === 'expense' ? 'expenses' : 'instructor_advances';
      const { error } = await this.supabase.client.from(tabla).delete().eq('id', row.id);

      if (error) throw error;

      this.toast.success('Egreso eliminado correctamente.');
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar el egreso.';
      this._error.set(msg);
      this.toast.error(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  /** Recarga silenciosa pública — para llamar desde Smart Components tras eventos externos. */
  async refresh(): Promise<void> {
    await this.refreshSilently();
  }

  async registrarEgreso(datos: EgresoFormData): Promise<boolean> {
    const user = this.auth.currentUser();
    if (!user) {
      this.toast.error('No hay sesión activa.');
      return false;
    }

    this._isSaving.set(true);
    this._error.set(null);

    try {
      const today = toISODate(new Date());
      const branchId = user.branchId ?? null;
      const registeredBy = user.dbId ?? null;

      if (datos.tipo === 'gasto') {
        const { error } = await this.supabase.client.from('expenses').insert({
          date: today,
          amount: datos.monto,
          description: datos.descripcion,
          branch_id: branchId,
          registered_by: registeredBy,
        });
        if (error) throw error;
      } else {
        const { error } = await this.supabase.client.from('instructor_advances').insert({
          date: today,
          amount: datos.monto,
          reason: datos.descripcion,
          instructor_id: null,
          registered_by: registeredBy,
        });
        if (error) throw error;
      }

      this.toast.success('Egreso registrado correctamente.');
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar el egreso.';
      this._error.set(msg);
      this.toast.error(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  async cerrarCaja(payload: CierrePayload): Promise<boolean> {
    const user = this.auth.currentUser();
    if (!user) {
      this.toast.error('No hay sesión activa.');
      return false;
    }

    this._isSaving.set(true);
    this._error.set(null);

    try {
      const today = toISODate(new Date());
      const branchId = user.branchId ?? null;

      // Sumas de pagos por método
      const pagos = this._pagosHoy();
      const cashTotal = pagos.reduce((s, p) => s + p.claseB, 0);
      const transferTotal = pagos.reduce((s, p) => s + p.claseA, 0);
      const cardTotal = pagos.reduce((s, p) => s + p.otros, 0);
      const voucherTotal = pagos.reduce((s, p) => s + p.sence, 0);

      const { error } = await this.supabase.client.from('cash_closings').insert({
        date: today,
        branch_id: branchId,
        closed_by: user.dbId ?? null,
        closed_at: new Date().toISOString(),
        status: 'closed',
        closed: true,
        cash_amount: cashTotal,
        transfer_amount: transferTotal,
        card_amount: cardTotal,
        voucher_amount: voucherTotal,
        total_income: this.totalIngresosHoy(),
        total_expenses: this.totalEgresosHoy(),
        balance: this.saldoTeoricoEfectivo(),
        payments_count: pagos.length,
        arqueo_amount: payload.arqueoTotal,
        difference: payload.arqueoTotal - this.saldoTeoricoEfectivo(),
        qty_bill_20000: payload.bill20000,
        qty_bill_10000: payload.bill10000,
        qty_bill_5000: payload.bill5000,
        qty_bill_2000: payload.bill2000,
        qty_bill_1000: payload.bill1000,
        qty_coin_500: payload.coin500,
        qty_coin_100: payload.coin100,
        qty_coin_50: payload.coin50,
        qty_coin_10: payload.coin10,
        notes: payload.notes || null,
      });

      if (error) throw error;

      this.toast.success('Caja cerrada y guardada correctamente.');
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cerrar la caja.';
      this._error.set(msg);
      this.toast.error(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }
}
