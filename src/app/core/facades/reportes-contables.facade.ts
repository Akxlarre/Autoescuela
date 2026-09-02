import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import type { FixedExpense } from '@core/models/dto/fixed-expense.model';
import type {
  FiltrosReporte,
  GastoFijoRow,
  RegistrarGastoFijoPayload,
  ReporteContable,
} from '@core/models/ui/reportes-contables.model';
import { GASTO_FIJO_CATEGORIES, computeDateRange } from '@core/models/ui/reportes-contables.model';
import type { ClassCountsByGroup } from '@core/models/ui/reportes-contables.model';
import { createRequestGuard } from '@core/utils/request-guard.utils';
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

  /** Guard anti respuestas fuera de orden para `fetchReporte()` (regla facades §7). */
  private readonly reporteGuard = createRequestGuard();

  /**
   * Las promociones Clase Profesional viven siempre en la sede 2 (Conductores
   * Chillán) — invariante del proyecto (`auto-create-next-promotions`,
   * `auth_can_enroll_course_type`). Se usa para no contar sesiones profesionales
   * cuando el reporte está filtrado por otra sede.
   */
  private static readonly PROFESSIONAL_BRANCH_ID = 2;

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
  public readonly rentabilidadCursos = computed(() => this._reporte()?.rentabilidadCursos ?? []);
  public readonly diasConMovimientos = computed(() => this._reporte()?.diasConMovimientos ?? 0);
  public readonly escuela = computed(() => this._reporte()?.escuela ?? '');

  /**
   * Sede efectiva para filtrar queries:
   * - Secretaria → usa su `branchId` fijo desde AuthFacade.
   * - Admin/Owner → usa la selección de BranchFacade (null = todas las sedes).
   */
  private readonly _effectiveBranchId = computed<number | null>(() => {
    const user = this.authFacade.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  });

  /** Etiqueta de escuela para el banner del reporte. */
  private readonly _escuelaLabel = computed<string>(() => {
    const user = this.authFacade.currentUser();
    if (!user) return '';
    // Secretaria SIN grant → su sede fija. Con grant (o admin) → la sede del selector (hotfix-017).
    if (user.role === 'secretaria' && !user.canAccessBothBranches) {
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

  /**
   * Aplica nuevos filtros y recarga el reporte.
   * SWR: si ya hay datos en pantalla, el refresco es silencioso (los datos previos
   * quedan visibles hasta que llegan los nuevos — no se muestra skeleton ni se
   * desmonta nada). El skeleton completo solo en la primera carga (`initialize()`).
   */
  async aplicarFiltros(filtros: FiltrosReporte): Promise<void> {
    this._filtros.set(filtros);

    if (this._reporte() !== null) {
      await this.refreshSilently();
      return;
    }

    this._isLoading.set(true);
    try {
      await this.fetchReporte();
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Refresca el reporte sin tocar `_isLoading` (SWR / post-acción). */
  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchReporte();
    } catch {
      // Fail silencioso — los datos stale siguen visibles.
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
    const requestToken = this.reporteGuard.next();
    const { desde, hasta } = this._filtros();
    const branchId = this._effectiveBranchId();

    try {
      const [paymentsResult, singularsResult, expensesResult, fixedResult, classCounts] =
        await Promise.all([
          this.queryPayments(desde, hasta),
          this.querySingularSales(desde, hasta),
          this.queryExpenses(desde, hasta, branchId),
          this.queryFixedExpenses(desde, hasta, branchId),
          this.queryClassCounts(desde, hasta, branchId),
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

      // El tipado de supabase-js infiere `enrollments` como array porque el cliente
      // no usa el `Database` generado (sin codegen no puede saber la cardinalidad real
      // de la FK) — en runtime es un objeto (fix-056). Se castea vía `unknown` a propósito.
      const payments = filterPaymentsByBranch(
        [...((paymentsResult.data ?? []) as unknown as PaymentRow[]), ...singularRows],
        branchId,
      );
      const operationalExpenses = (expensesResult.data ?? []) as ExpenseRow[];

      const fixedRaw = (fixedResult.data ?? []) as Pick<
        FixedExpense,
        'id' | 'category' | 'description' | 'amount' | 'date'
      >[];

      // Si ya se disparó una fetch más reciente mientras esta esperaba, descartar
      // (guard anti respuestas fuera de orden — regla facades §7).
      if (!this.reporteGuard.isCurrent(requestToken)) return;

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

      // Concatenar para buildReporte (los fixed se tratan igual que operacionales
      // para KPIs / categorías / evolución). La estimación de rentabilidad por curso
      // usa SOLO `operationalExpenses` (sin fijos) — se pasa aparte.
      const allExpenses: ExpenseRow[] = [
        ...operationalExpenses,
        ...fixedRaw.map((r) => ({ amount: r.amount, category: r.category, date: r.date })),
      ];

      this._reporte.set(
        buildReporte(
          payments,
          allExpenses,
          this._escuelaLabel(),
          branchId,
          classCounts,
          operationalExpenses,
        ),
      );
      this._error.set(null);
    } catch (err) {
      const msg =
        err instanceof Error
          ? this.sanitizer.sanitize(err).message
          : 'Error al cargar el reporte contable.';
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

  /**
   * Cuenta clases prácticas completadas por tipo de curso en el rango — insumo para
   * el prorrateo de gastos directos de la pestaña Rentabilidad (fix-237-m).
   * Best-effort: si falla, devuelve `{}` y el prorrateo cae al fallback por ingresos.
   */
  private async queryClassCounts(
    desde: string,
    hasta: string,
    branchId: number | null,
  ): Promise<ClassCountsByGroup> {
    const counts: ClassCountsByGroup = {};
    try {
      // Clase B: sesiones completadas en el rango (join a enrollments para la sede).
      let classB = this.supabase.client
        .from('class_b_sessions')
        .select('id, enrollments!inner(branch_id)', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('scheduled_at', `${desde}T00:00:00`)
        .lte('scheduled_at', `${hasta}T23:59:59`);
      if (branchId !== null) {
        classB = classB.eq('enrollments.branch_id', branchId);
      }
      const { count: classBCount } = await classB;
      counts['class_b'] = classBCount ?? 0;

      // Profesional: las promociones viven siempre en la sede 2. Si el reporte
      // filtra otra sede, no hay clases profesionales que contar.
      if (branchId === null || branchId === ReportesContablesFacade.PROFESSIONAL_BRANCH_ID) {
        const { count: profCount } = await this.supabase.client
          .from('professional_practice_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed')
          .gte('date', desde)
          .lte('date', hasta);
        counts['professional'] = profCount ?? 0;
      } else {
        counts['professional'] = 0;
      }
    } catch {
      // best-effort — sin conteo, el prorrateo de vehículo usa el fallback por ingresos.
    }
    return counts;
  }
}
