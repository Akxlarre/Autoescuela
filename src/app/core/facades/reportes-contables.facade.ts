import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import type { FiltrosReporte, ReporteContable } from '@core/models/ui/reportes-contables.model';
import { computeDateRange } from '@core/models/ui/reportes-contables.model';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import {
  buildReporte,
  filterPaymentsByBranch,
  type ExpenseRow,
  type PaymentRow,
} from '@core/utils/reportes-contables.utils';

@Injectable({ providedIn: 'root' })
export class ReportesContablesFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly authFacade = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly toast = inject(ToastService);

  // ── 1. Estado privado ──────────────────────────────────────────────────────
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _reporte = signal<ReporteContable | null>(null);
  private readonly _filtros = signal<FiltrosReporte>(
    (() => {
      const [desde, hasta] = computeDateRange('mes_anterior');
      return { rango: 'mes_anterior', desde, hasta };
    })(),
  );
  private _initialized = false;

  // ── 2. Estado público (readonly) ───────────────────────────────────────────
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly error = this._error.asReadonly();
  public readonly filtros = this._filtros.asReadonly();

  public readonly kpis = computed(() => this._reporte()?.kpis ?? null);
  public readonly ingresosCategoria = computed(() => this._reporte()?.ingresosCategoria ?? []);
  public readonly gastosCategoria = computed(() => this._reporte()?.gastosCategoria ?? []);
  public readonly evolucionMensual = computed(() => this._reporte()?.evolucionMensual ?? []);
  public readonly detalleDiario = computed(() => this._reporte()?.detalleDiario ?? []);
  public readonly diasConMovimientos = computed(() => this._reporte()?.diasConMovimientos ?? 0);
  public readonly escuela = computed(() => this._reporte()?.escuela ?? '');

  /**
   * Sede efectiva para filtrar queries:
   * - Secretaria → usa su `branchId` fijo desde AuthFacade.
   * - Admin/Owner → usa la selección de BranchFacade (null = todas las sedes).
   */
  private readonly _effectiveBranchId = computed<number | null>(() => {
    const user = this.authFacade.currentUser();
    if (!user) return null;
    if (user.role === 'secretaria') return user.branchId ?? null;
    return this.branchFacade.selectedBranchId();
  });

  /** Etiqueta de escuela para el banner del reporte. */
  private readonly _escuelaLabel = computed<string>(() => {
    const user = this.authFacade.currentUser();
    if (!user) return '';
    if (user.role === 'secretaria') {
      const branchId = user.branchId;
      const branch = this.branchFacade.branches().find((b) => b.id === branchId);
      return branch?.name ?? 'Mi escuela';
    }
    const branchId = this.branchFacade.selectedBranchId();
    if (branchId === null) return 'Ambas escuelas';
    return this.branchFacade.selectedBranchLabel();
  });

  // ── 3. Acciones ───────────────────────────────────────────────────────────

  /** SWR: primera carga con skeleton; revisitas refrescan en background. */
  async initialize(): Promise<void> {
    if (this._initialized) {
      void this.fetchReporte();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    try {
      await this.fetchReporte();
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Aplica nuevos filtros y recarga el reporte mostrando skeleton. */
  async aplicarFiltros(filtros: FiltrosReporte): Promise<void> {
    this._filtros.set(filtros);
    this._isLoading.set(true);
    try {
      await this.fetchReporte();
    } finally {
      this._isLoading.set(false);
    }
  }

  exportarExcel(): void {
    // TODO: implementar exportación a Excel (Edge Function o librería cliente)
  }

  exportarPDF(): void {
    // TODO: implementar exportación a PDF (Edge Function o librería cliente)
  }

  // ── Privado ───────────────────────────────────────────────────────────────

  private async fetchReporte(): Promise<void> {
    const { desde, hasta } = this._filtros();
    const branchId = this._effectiveBranchId();

    try {
      const [paymentsResult, expensesResult] = await Promise.all([
        this.queryPayments(desde, hasta),
        this.queryExpenses(desde, hasta, branchId),
      ]);

      if (paymentsResult.error) throw paymentsResult.error;
      if (expensesResult.error) throw expensesResult.error;

      const payments = filterPaymentsByBranch(
        (paymentsResult.data ?? []) as PaymentRow[],
        branchId,
      );
      const expenses = (expensesResult.data ?? []) as ExpenseRow[];

      this._reporte.set(buildReporte(payments, expenses, this._escuelaLabel(), branchId));
      this._error.set(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar el reporte contable.';
      this._error.set(msg);
      this.toast.error('Error en reportes', msg);
    }
  }

  /** Consulta pagos en el rango de fechas con join a enrollments para branch y license_group. */
  private queryPayments(desde: string, hasta: string) {
    return this.supabase.client
      .from('payments')
      .select('total_amount, type, payment_date, enrollments!inner(branch_id, license_group)')
      .gte('payment_date', desde)
      .lte('payment_date', hasta);
  }

  /**
   * Consulta gastos en el rango de fechas.
   * Aplica filtro directo de branch_id cuando la sede está determinada.
   */
  private queryExpenses(desde: string, hasta: string, branchId: number | null) {
    let query = this.supabase.client
      .from('expenses')
      .select('amount, category, date')
      .gte('date', desde)
      .lte('date', hasta);

    if (branchId !== null) {
      query = query.eq('branch_id', branchId);
    }

    return query;
  }
}
