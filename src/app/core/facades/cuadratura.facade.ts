import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { toISODate, getChileDateTimeRange } from '@core/utils/date.utils';
import { downloadExcel } from '@core/utils/excel.utils';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
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
    source: 'payment',
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

/** Cobro de curso singular (standalone_course_enrollments pagado hoy). */
export interface SingularSaleDto {
  id: number;
  amount_paid: number | null;
  payment_method: string | null;
  courseName: string;
  studentName: string;
}

/**
 * Mapea un cobro de curso singular a la fila de cuadratura.
 * Buckets por método de pago (mismas columnas legacy que payments):
 * efectivo → claseB (cash) · transferencia → claseA · tarjeta → otros · sence → sence.
 */
export function mapSingularSaleToIngreso(s: SingularSaleDto): IngresoRow {
  const monto = s.amount_paid ?? 0;
  const method = s.payment_method ?? 'efectivo';
  return {
    id: s.id,
    source: 'singular',
    enrollmentId: null,
    nBoleta: null,
    glosa: `Curso singular: ${s.courseName} — ${s.studentName}`,
    claseB: method === 'efectivo' ? monto : 0,
    claseA: method === 'transferencia' ? monto : 0,
    sence: method === 'sence' ? monto : 0,
    otros: method === 'tarjeta' ? monto : 0,
    total: monto,
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
  private readonly branchFacade = inject(BranchFacade);
  private readonly toast = inject(ToastService);

  // ── 1. ESTADO REACTIVO (Privado) ────────────────────────────────────────────
  readonly fondoInicial = signal<number>(50_000);
  private readonly _pagosHoy = signal<IngresoRow[]>([]);
  private readonly _gastosHoy = signal<EgresoRow[]>([]);
  private readonly _cajaYaCerrada = signal<boolean>(false);
  private readonly _cierreHoy = signal<CashClosing | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);
  private readonly _isExporting = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;
  private _realtimeChannel: any | null = null;

  // ── 2. ESTADO EXPUESTO (Público) ──────────────────────────────────────────
  readonly pagosHoy = this._pagosHoy.asReadonly();
  readonly gastosHoy = this._gastosHoy.asReadonly();
  readonly cajaYaCerrada = this._cajaYaCerrada.asReadonly();
  readonly cierreHoy = this._cierreHoy.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly isExporting = this._isExporting.asReadonly();
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'standalone_course_enrollments' },
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

    this._isLoading.set(true);
    try {
      await this.fetchAll();
      this._initialized = true;
      this._lastBranchId = branchId;
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
    const branchId = this.getActiveBranchId();
    await Promise.all([
      this.fetchPayments(today, branchId),
      this.fetchExpensesAndAdvances(today, branchId),
      this.checkCajaStatus(today, branchId),
    ]);
  }

  private async fetchPayments(today: string, branchId: number | null): Promise<void> {
    const start = `${today}T00:00:00`;
    const end = `${today}T23:59:59`;

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
    const [{ data }, singulares] = await Promise.all([
      query.order('created_at', { ascending: true }),
      this.fetchSingularSales(start, end, branchId),
    ]);
    this._pagosHoy.set([...(data ?? []).map(mapPaymentToIngreso), ...singulares]);
  }

  /**
   * Cobros de cursos singulares pagados hoy (RF-035 · fix-016 AC3).
   * Fuente: standalone_course_enrollments.paid_at — no existe fila en payments
   * para estas ventas, por eso se integran aquí como IngresoRow propios.
   */
  private async fetchSingularSales(
    start: string,
    end: string,
    branchId: number | null,
  ): Promise<IngresoRow[]> {
    let query: any = this.supabase.client
      .from('standalone_course_enrollments')
      .select(
        `
        id,
        amount_paid,
        payment_method,
        paid_at,
        standalone_courses!inner(name, branch_id),
        students!inner(users!inner(first_names, paternal_last_name))
      `,
      )
      .eq('payment_status', 'paid')
      .gte('paid_at', start)
      .lte('paid_at', end);

    if (branchId) {
      query = query.eq('standalone_courses.branch_id', branchId);
    }

    const { data, error } = await query.order('paid_at', { ascending: true });
    if (error) return [];

    return (data ?? []).map((row: any) =>
      mapSingularSaleToIngreso({
        id: row.id,
        amount_paid: row.amount_paid,
        payment_method: row.payment_method,
        courseName: row.standalone_courses?.name ?? 'Curso singular',
        studentName:
          `${row.students?.users?.first_names ?? ''} ${row.students?.users?.paternal_last_name ?? ''}`.trim(),
      }),
    );
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
      if (row.source === 'singular') {
        // Cobro de curso singular: no se borra la inscripción, se revierte
        // el pago a pendiente (la inscripción sigue vigente).
        await this.supabase.client
          .from('standalone_course_enrollments')
          .update({ payment_status: 'pending', amount_paid: 0, paid_at: null })
          .eq('id', row.id);
        this.toast.success('Cobro revertido: la inscripción quedó pendiente de pago.');
        void this.refreshSilently();
        return true;
      }

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
          branch_id: this.getActiveBranchId(),
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

  async exportar(format: 'excel' | 'pdf'): Promise<void> {
    this._isExporting.set(true);
    try {
      const today = toISODate(new Date());
      const branchId = this.getActiveBranchId();
      const { data, error } = await this.supabase.client.functions.invoke(
        'generate-cash-closing-report',
        { body: { format, date: today, branch_id: branchId } },
      );
      if (error) throw error;

      const fecha = today.replace(/-/g, '');
      if (format === 'excel') {
        const { sheetName, rows, filename } = data as {
          sheetName: string;
          rows: (string | number)[][];
          filename: string;
        };
        downloadExcel(sheetName, [], rows, filename ?? `Cuadratura_${fecha}`);
      } else {
        const rawBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
        const blob = new Blob([rawBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Cuadratura_${fecha}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
      this.toast.success('Reporte generado correctamente.');
    } catch {
      this.toast.error('No se pudo generar el reporte. Inténtalo de nuevo.');
    } finally {
      this._isExporting.set(false);
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
        branch_id: this.getActiveBranchId(),
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
