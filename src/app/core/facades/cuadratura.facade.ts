import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { toISODate, getChileDateTimeRange } from '@core/utils/date.utils';
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
    claseB: p.cash_amount ?? 0,
    claseA: p.transfer_amount ?? 0,
    sence: p.voucher_amount ?? 0,
    otros: p.card_amount ?? 0,
    total: p.total_amount ?? 0,
  };
}

function mapExpenseToEgreso(e: Expense): EgresoRow {
  return { id: e.id, tipo: 'expense', descripcion: e.description, monto: e.amount };
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

  // ── 1. ESTADO REACTIVO (Privado) ────────────────────────────────────────────
  readonly fondoInicial = signal<number>(50_000);
  private readonly _pagosHoy = signal<IngresoRow[]>([]);
  private readonly _gastosHoy = signal<EgresoRow[]>([]);
  private readonly _cajaYaCerrada = signal<boolean>(false);
  private readonly _cierreHoy = signal<CashClosing | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  private _initialized = false;
  private _realtimeChannel: any | null = null;

  // ── 2. ESTADO EXPUESTO (Público) ──────────────────────────────────────────
  readonly pagosHoy = this._pagosHoy.asReadonly();
  readonly gastosHoy = this._gastosHoy.asReadonly();
  readonly cajaYaCerrada = this._cajaYaCerrada.asReadonly();
  readonly cierreHoy = this._cierreHoy.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();

  readonly ingresosEfectivoHoy = computed(() =>
    this._pagosHoy().reduce((sum, p) => sum + p.claseB, 0),
  );
  readonly otrosIngresosHoy = computed(() =>
    this._pagosHoy().reduce((sum, p) => sum + p.claseA + p.otros, 0),
  );
  readonly totalIngresosHoy = computed(() => this._pagosHoy().reduce((sum, p) => sum + p.total, 0));
  readonly totalEgresosHoy = computed(() => this._gastosHoy().reduce((sum, e) => sum + e.monto, 0));
  readonly saldoTeoricoEfectivo = computed(
    () => this.fondoInicial() + this.ingresosEfectivoHoy() - this.totalEgresosHoy(),
  );

  // ── 3. MÉTODOS DE ACCIÓN ─────────────────────────────────────────────────────

  setupRealtime(): void {
    if (this._realtimeChannel) return;
    this._realtimeChannel = this.supabase.client
      .channel('cuadratura-hoy-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'instructor_advances' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_closings' },
        () => void this.refreshSilently(),
      )
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
    try {
      await this.fetchAll();
      this._initialized = true;
    } catch {
      this._error.set('Error al cargar datos de cuadratura.');
    } finally {
      this._isLoading.set(false);
    }
  }

  async refreshSilently(): Promise<void> {
    try {
      await this.fetchAll();
    } catch {
      // Swallowed
    }
  }

  /** Public alias for refresh used by components */
  async refresh(): Promise<void> {
    return this.refreshSilently();
  }

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
    const { start, end } = getChileDateTimeRange(today);

    let query: any = this.supabase.client
      .from('payments')
      .select('*, enrollments!inner(branch_id)')
      .eq('status', 'paid')
      .gte('created_at', start)
      .lte('created_at', end);

    if (branchId) {
      query = query.eq('enrollments.branch_id', branchId);
    }

    // El ordenamiento y limitación siempre al final de la cadena de filtros
    const { data } = await query.order('created_at', { ascending: true });
    this._pagosHoy.set((data ?? []).map(mapPaymentToIngreso));
  }

  private async fetchExpensesAndAdvances(today: string, branchId: number | null): Promise<void> {
    let expQuery: any = this.supabase.client.from('expenses').select('*').eq('date', today);
    if (branchId) {
      expQuery = expQuery.eq('branch_id', branchId);
    }

    const [expRes, advRes] = await Promise.all([
      expQuery,
      this.supabase.client.from('instructor_advances').select('*').eq('date', today),
    ]);
    const gastos = (expRes.data ?? []).map(mapExpenseToEgreso);
    const anticipos = (advRes.data ?? []).map(mapAdvanceToEgreso);
    this._gastosHoy.set([...gastos, ...anticipos]);
  }

  private async checkCajaStatus(today: string, branchId: number | null): Promise<void> {
    let query: any = this.supabase.client
      .from('cash_closings')
      .select('*')
      .eq('date', today)
      .eq('closed', true);
    if (branchId) query = query.eq('branch_id', branchId);
    const { data } = await query.maybeSingle();
    this._cajaYaCerrada.set(data !== null);
    this._cierreHoy.set(data);
  }

  async eliminarIngreso(row: IngresoRow): Promise<boolean> {
    this._isSaving.set(true);
    try {
      if (row.enrollmentId !== null) {
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
      await this.supabase.client.from('payments').delete().eq('id', row.id);
      this.toast.success('Movimiento eliminado y saldos revertidos.');
      void this.refreshSilently();
      return true;
    } catch {
      this.toast.error('Error al eliminar el ingreso.');
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  async eliminarEgreso(row: EgresoRow): Promise<boolean> {
    this._isSaving.set(true);
    try {
      const tabla = row.tipo === 'expense' ? 'expenses' : 'instructor_advances';
      await this.supabase.client.from(tabla).delete().eq('id', row.id);
      this.toast.success('Egreso eliminado correctamente.');
      void this.refreshSilently();
      return true;
    } catch {
      this.toast.error('Error al eliminar el egreso.');
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  async registrarEgreso(datos: EgresoFormData): Promise<boolean> {
    const user = this.auth.currentUser();
    if (!user) return false;
    this._isSaving.set(true);
    try {
      const today = toISODate(new Date());
      if (datos.tipo === 'gasto') {
        await this.supabase.client.from('expenses').insert({
          date: today,
          amount: datos.monto,
          description: datos.descripcion,
          branch_id: user.branchId,
          registered_by: user.dbId,
        });
      } else {
        await this.supabase.client.from('instructor_advances').insert({
          date: today,
          amount: datos.monto,
          reason: datos.descripcion,
          registered_by: user.dbId,
        });
      }
      this.toast.success('Egreso registrado correctamente.');
      void this.refreshSilently();
      return true;
    } catch {
      this.toast.error('Error al registrar el egreso.');
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  async cerrarCaja(payload: CierrePayload): Promise<boolean> {
    const user = this.auth.currentUser();
    if (!user) return false;
    this._isSaving.set(true);
    try {
      const today = toISODate(new Date());
      const pagos = this._pagosHoy();
      await this.supabase.client.from('cash_closings').insert({
        date: today,
        branch_id: user.branchId,
        closed_by: user.dbId,
        closed_at: new Date().toISOString(),
        status: 'closed',
        closed: true,
        cash_amount: pagos.reduce((s, p) => s + p.claseB, 0),
        transfer_amount: pagos.reduce((s, p) => s + p.claseA, 0),
        card_amount: pagos.reduce((s, p) => s + p.otros, 0),
        voucher_amount: pagos.reduce((s, p) => s + p.sence, 0),
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
      this.toast.success('Caja cerrada correctamente.');
      void this.refreshSilently();
      return true;
    } catch {
      this.toast.error('Error al cerrar la caja.');
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }
}
