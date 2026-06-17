import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import type { FixedExpense } from '@core/models/dto/fixed-expense.model';
import type {
  FiltrosReporte,
  GastoFijoRow,
  RegistrarGastoFijoPayload,
  ReporteContable,
} from '@core/models/ui/reportes-contables.model';
import { GASTO_FIJO_CATEGORIES, computeDateRange } from '@core/models/ui/reportes-contables.model';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { downloadExcel } from '@core/utils/excel.utils';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import {
  buildReporte,
  filterPaymentsByBranch,
  mapSingularSaleToPaymentRow,
  type ExpenseRow,
  type PaymentRow,
} from '@core/utils/reportes-contables.utils';

@Injectable({ providedIn: 'root' })
export class ReportesContablesFacade {
    private readonly sanitizer = inject(ErrorSanitizerService);
private readonly supabase = inject(SupabaseService);
  private readonly authFacade = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly toast = inject(ToastService);

  // ── 1. Estado privado ──────────────────────────────────────────────────────
  private readonly _isLoading = signal(false);
  private readonly _isExporting = signal(false);
  private readonly _isRegistrando = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _reporte = signal<ReporteContable | null>(null);
  private readonly _gastosFijos = signal<GastoFijoRow[]>([]);
  private readonly _filtros = signal<FiltrosReporte>(
    (() => {
      const [desde, hasta] = computeDateRange('mes_actual');
      return { rango: 'mes_actual', desde, hasta };
    })(),
  );
  private _initialized = false;

  // ── 2. Estado público (readonly) ───────────────────────────────────────────
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly isExporting = this._isExporting.asReadonly();
  public readonly isRegistrando = this._isRegistrando.asReadonly();
  public readonly error = this._error.asReadonly();
  public readonly filtros = this._filtros.asReadonly();
  public readonly gastosFijos = this._gastosFijos.asReadonly();

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

  /** Registra un gasto fijo en `fixed_expenses` y recarga el reporte. */
  async registrarGastoFijo(payload: RegistrarGastoFijoPayload): Promise<boolean> {
    this._isRegistrando.set(true);
    try {
      const branchId = this._effectiveBranchId();
      const user = this.authFacade.currentUser();
      const { error } = await this.supabase.client.from('fixed_expenses').insert({
        branch_id: branchId,
        category: payload.category,
        description: payload.description,
        amount: payload.amount,
        date: payload.date,
        created_by: user?.dbId ?? null,
      });
      if (error) throw error;
      this.toast.success('Gasto fijo registrado correctamente.');
      await this.fetchReporte();
      return true;
    } catch {
      this.toast.error('No se pudo registrar el gasto. Inténtalo de nuevo.');
      return false;
    } finally {
      this._isRegistrando.set(false);
    }
  }

  async exportar(format: 'excel' | 'pdf'): Promise<void> {
    this._isExporting.set(true);
    try {
      const { desde, hasta } = this._filtros();
      const branchId = this._effectiveBranchId();

      const { data, error } = await this.supabase.client.functions.invoke(
        'generate-financial-report',
        { body: { format, desde, hasta, branch_id: branchId } },
      );
      if (error) throw error;

      const fileDate = `${desde.replace(/-/g, '')}_${hasta.replace(/-/g, '')}`;
      if (format === 'excel') {
        const { sheetName, rows, filename } = data as {
          sheetName: string;
          rows: (string | number)[][];
          filename: string;
        };
        downloadExcel(sheetName, [], rows, filename ?? `ReporteContable_${fileDate}`);
      } else {
        const rawBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
        const blob = new Blob([rawBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ReporteContable_${fileDate}.pdf`;
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

  // ── Privado ───────────────────────────────────────────────────────────────

  private async fetchReporte(): Promise<void> {
    const { desde, hasta } = this._filtros();
    const branchId = this._effectiveBranchId();

    try {
      const [paymentsResult, singularsResult, expensesResult, fixedResult] = await Promise.all([
        this.queryPayments(desde, hasta),
        this.querySingularSales(desde, hasta),
        this.queryExpenses(desde, hasta, branchId),
        this.queryFixedExpenses(desde, hasta, branchId),
      ]);

      if (paymentsResult.error) throw paymentsResult.error;
      if (singularsResult.error) throw singularsResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (fixedResult.error) throw fixedResult.error;

      // Cobros de cursos singulares normalizados a PaymentRow (fix-016):
      // participan de KPIs, categorías y evolución como categoría 'standalone'.
      const singularRows: PaymentRow[] = ((singularsResult.data ?? []) as any[]).map((s) =>
        mapSingularSaleToPaymentRow({
          amount_paid: s.amount_paid,
          paid_at: s.paid_at,
          branch_id: s.standalone_courses?.branch_id ?? 0,
        }),
      );

      const payments = filterPaymentsByBranch(
        [...((paymentsResult.data ?? []) as PaymentRow[]), ...singularRows],
        branchId,
      );
      const operationalExpenses = (expensesResult.data ?? []) as ExpenseRow[];

      const fixedRaw = (fixedResult.data ?? []) as Pick<
        FixedExpense,
        'id' | 'category' | 'description' | 'amount' | 'date'
      >[];

      // Mapear a GastoFijoRow para display
      const labelMap = Object.fromEntries(GASTO_FIJO_CATEGORIES.map((c) => [c.value, c.label]));
      this._gastosFijos.set(
        fixedRaw.map((r) => ({
          id: r.id,
          category: r.category,
          categoryLabel: labelMap[r.category] ?? r.category,
          description: r.description,
          amount: r.amount,
          date: r.date,
        })),
      );

      // Concatenar para buildReporte (los fixed se tratan igual que operacionales)
      const allExpenses: ExpenseRow[] = [
        ...operationalExpenses,
        ...fixedRaw.map((r) => ({ amount: r.amount, category: r.category, date: r.date })),
      ];

      this._reporte.set(buildReporte(payments, allExpenses, this._escuelaLabel(), branchId));
      this._error.set(null);
    } catch (err) {
      const msg = err instanceof Error ? this.sanitizer.sanitize(err).message : 'Error al cargar el reporte contable.';
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
   * Cobros de cursos singulares pagados en el rango (fix-016).
   * Viven en standalone_course_enrollments.paid_at — no existen en `payments`.
   * El filtro de sede se aplica client-side junto al de payments
   * (filterPaymentsByBranch) usando standalone_courses.branch_id.
   */
  private querySingularSales(desde: string, hasta: string) {
    return this.supabase.client
      .from('standalone_course_enrollments')
      .select('amount_paid, paid_at, standalone_courses!inner(branch_id)')
      .eq('payment_status', 'paid')
      .gte('paid_at', `${desde}T00:00:00`)
      .lte('paid_at', `${hasta}T23:59:59`);
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

  /** Consulta gastos fijos (admin-only) en el rango de fechas. */
  private queryFixedExpenses(desde: string, hasta: string, branchId: number | null) {
    let query = this.supabase.client
      .from('fixed_expenses')
      .select('id, category, description, amount, date')
      .gte('date', desde)
      .lte('date', hasta)
      .order('date', { ascending: false });

    if (branchId !== null) {
      query = query.eq('branch_id', branchId);
    }

    return query;
  }
}
