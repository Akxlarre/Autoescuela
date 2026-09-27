import { Injectable, computed, inject, signal } from '@angular/core';
import { BranchFacade } from '@core/facades/branch.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import type {
  ExecInstructorHoursRowDto,
  ExecKpisDto,
  ExecMonthlySeriesRowDto,
  ExecReceivablesRowDto,
  ExecTodayOpsDto,
} from '@core/models/dto/executive-dashboard.model';
import type {
  ExecDateRange,
  ExecKpiSummary,
  ExecMonthlySeries,
  ExecPeriodPreset,
  ExecSection,
  InstructorHoursRow,
  ReceivablesSummary,
  StudentStageCounts,
  TodayOpsSummary,
} from '@core/models/ui/executive-dashboard.model';
import {
  buildMonthlySeries,
  chileTodayIso,
  mapInstructorHours,
  mapKpiSummary,
  mapReceivables,
  mapStageCounts,
  mapTodayOps,
  previousRange,
  resolvePresetRange,
  seriesCurrentMonth,
  yoyRange,
} from '@core/utils/executive-dashboard.utils';

const SECTION_ERROR = 'No se pudo cargar esta sección.';

/**
 * Dashboard Ejecutivo de Admin (spec 0044-b).
 *
 * Llama a las funciones SQL `exec_dashboard_*` (solo admin) y mapea sus DTOs a modelos UI.
 * - Branch-scoped: lee `BranchFacade.selectedBranchId()` en cada fetch (null = todas).
 *   La recarga al cambiar de sede la dispara el Smart Component con un `effect()`.
 * - SWR: skeleton solo en la primera carga; cambios de filtro/sede refrescan en silencio.
 * - Sin Realtime: es una vista analítica, se refresca al entrar y al cambiar filtros.
 * - Cada sección puede fallar sola (AC-E2): los errores se exponen por sección.
 *
 * Es independiente de `DashboardFacade` a propósito: ese Facade también lo usa el
 * dashboard de secretaría, que no debe cambiar (AC21).
 */
@Injectable({ providedIn: 'root' })
export class ExecutiveDashboardFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly branchFacade = inject(BranchFacade);

  // ── 1. Estado privado ──────────────────────────────────────────────────────
  private readonly _preset = signal<ExecPeriodPreset>('this_month');
  private readonly _range = signal<ExecDateRange>(
    resolvePresetRange('this_month', chileTodayIso()),
  );
  private readonly _isLoading = signal(false);
  private readonly _kpis = signal<ExecKpiSummary | null>(null);
  private readonly _kpisRaw = signal<ExecKpisDto | null>(null);
  private readonly _series = signal<ExecMonthlySeries | null>(null);
  private readonly _instructorHours = signal<InstructorHoursRow[]>([]);
  private readonly _receivables = signal<ReceivablesSummary | null>(null);
  private readonly _todayOps = signal<TodayOpsSummary | null>(null);
  private readonly _errors = signal<Partial<Record<ExecSection, string>>>({});
  private _initialized = false;
  /** Número de la última carga con skeleton (ver `loadWithSkeleton`). */
  private _skeletonTicket = 0;

  /** Guard anti respuestas fuera de orden (facades.md §7, AC-E3). */
  private readonly fetchGuard = createRequestGuard();

  // ── 2. Estado público (readonly) ───────────────────────────────────────────
  public readonly preset = this._preset.asReadonly();
  public readonly range = this._range.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly kpis = this._kpis.asReadonly();
  public readonly series = this._series.asReadonly();
  public readonly instructorHours = this._instructorHours.asReadonly();
  public readonly receivables = this._receivables.asReadonly();
  public readonly todayOps = this._todayOps.asReadonly();
  public readonly errors = this._errors.asReadonly();

  public readonly stages = computed<StudentStageCounts | null>(() => {
    const raw = this._kpisRaw();
    if (!raw) return null;
    return mapStageCounts(raw, this._receivables()?.alumnos ?? 0);
  });

  public readonly hasData = computed(() => this._kpis() !== null);

  public sectionError(section: ExecSection): string | null {
    return this._errors()[section] ?? null;
  }

  // ── 3. Acciones ───────────────────────────────────────────────────────────

  /** Fija el rango sin cargar (útil antes de `initialize()`). */
  setRange(range: ExecDateRange, preset: ExecPeriodPreset): void {
    this._range.set(range);
    this._preset.set(preset);
  }

  /** SWR: primera carga con skeleton; re-entradas refrescan en silencio. */
  async initialize(): Promise<void> {
    if (this._initialized) {
      await this.refreshSilently();
      return;
    }
    this._initialized = true;
    await this.loadWithSkeleton();
  }

  /** Cambia el período y recarga (sin skeleton si ya hay datos — AC23). */
  async applyRange(range: ExecDateRange, preset: ExecPeriodPreset): Promise<void> {
    this.setRange(range, preset);
    await this.reload();
  }

  /** Recarga con los filtros vigentes (cambio de sede, reintento de una sección). */
  async reload(): Promise<void> {
    if (!this._initialized) {
      await this.initialize();
      return;
    }
    if (this.hasData()) {
      await this.refreshSilently();
      return;
    }
    await this.loadWithSkeleton();
  }

  /**
   * Carga con skeleton. Solo la carga más reciente apaga `_isLoading`: si se disparó otra
   * mientras esta esperaba, la vieja no debe dejar los paneles vacíos (fix-174-b).
   */
  private async loadWithSkeleton(): Promise<void> {
    const ticket = ++this._skeletonTicket;
    this._isLoading.set(true);
    try {
      await this.fetchAll();
    } finally {
      if (ticket === this._skeletonTicket) this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchAll();
    } catch {
      // Fail silencioso — los datos stale siguen visibles.
    }
  }

  private async fetchAll(): Promise<void> {
    const token = this.fetchGuard.next();
    // Un preset ("Este mes", …) se re-resuelve contra hoy en cada carga: el Facade es singleton
    // y la app puede quedar abierta al cambiar de mes (fix-175-b). Los rangos custom no se tocan.
    const preset = this._preset();
    if (preset !== 'custom') this._range.set(resolvePresetRange(preset, chileTodayIso()));
    const range = this._range();
    const seriesYear = Number(range.to.slice(0, 4));
    const results = await this.requestAll(range, seriesYear, this.branchFacade.selectedBranchId());

    // Una fetch más reciente ya se disparó: descartar este resultado (AC-E3).
    if (!this.fetchGuard.isCurrent(token)) return;

    this.applyResults(results, seriesYear, seriesCurrentMonth(seriesYear, chileTodayIso()));
  }

  /** Dispara las 7 RPC en paralelo; cada una puede fallar sola (AC-E2). */
  private requestAll(range: ExecDateRange, seriesYear: number, branchId: number | null) {
    const kpisOf = (r: ExecDateRange) =>
      this.rpc<ExecKpisDto>('exec_dashboard_kpis', {
        p_from: r.from,
        p_to: r.to,
        p_branch_id: branchId,
      });

    return Promise.allSettled([
      kpisOf(range),
      kpisOf(previousRange(range)),
      kpisOf(yoyRange(range)),
      this.rpc<ExecMonthlySeriesRowDto[]>('exec_dashboard_monthly_series', {
        p_year: seriesYear,
        p_branch_id: branchId,
      }),
      this.rpc<ExecInstructorHoursRowDto[]>('exec_dashboard_instructor_hours', {
        p_from: range.from,
        p_to: range.to,
        p_branch_id: branchId,
      }),
      this.rpc<ExecReceivablesRowDto[]>('exec_dashboard_receivables', { p_branch_id: branchId }),
      this.rpc<ExecTodayOpsDto>('exec_dashboard_today_ops', { p_branch_id: branchId }),
    ] as const);
  }

  /** Mapea cada respuesta a su signal; las que fallaron quedan marcadas por sección. */
  private applyResults(
    results: Awaited<ReturnType<ExecutiveDashboardFacade['requestAll']>>,
    seriesYear: number,
    currentMonth: number,
  ): void {
    const [curr, prevK, yoyK, series, hours, receivables, today_] = results;
    const errors: Partial<Record<ExecSection, string>> = {};

    if (
      curr.status === 'fulfilled' &&
      prevK.status === 'fulfilled' &&
      yoyK.status === 'fulfilled'
    ) {
      this._kpisRaw.set(curr.value);
      this._kpis.set(mapKpiSummary(curr.value, prevK.value, yoyK.value));
    } else {
      errors.kpis = SECTION_ERROR;
    }

    if (series.status === 'fulfilled') {
      this._series.set(buildMonthlySeries(series.value ?? [], seriesYear, currentMonth));
    } else {
      errors.series = SECTION_ERROR;
    }

    if (hours.status === 'fulfilled') {
      this._instructorHours.set(mapInstructorHours(hours.value ?? []));
    } else {
      errors.instructores = SECTION_ERROR;
    }

    if (receivables.status === 'fulfilled') {
      this._receivables.set(mapReceivables(receivables.value ?? []));
    } else {
      errors.cartera = SECTION_ERROR;
    }

    if (today_.status === 'fulfilled') {
      this._todayOps.set(mapTodayOps(today_.value));
    } else {
      errors.hoy = SECTION_ERROR;
    }

    this._errors.set(errors);
  }

  /** `supabase.rpc` no rechaza ante error de BD: lo convertimos en rechazo. */
  private async rpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.supabase.client.rpc(name, params);
    if (error) throw error;
    return data as T;
  }
}
