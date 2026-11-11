import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import { fetchConvalidationMap } from '@core/utils/convalidation.utils';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { buildStudentDisplayName } from '@core/utils/student-name.util';
import { ToastService } from '@core/services/ui/toast.service';
import { downloadExcel } from '@core/utils/excel.utils';
import { downloadBlob } from '@core/utils/file-download.utils';
import { chileYear, toChileDate } from '@core/utils/chile-time.utils';
import { formatDayMonthYear, todayIso } from '@core/utils/date.utils';
import {
  EGRESADOS_PDF_COLUMN_WEIGHTS,
  buildEgresadosExcelTable,
  buildEgresadosPdfTable,
} from '@core/utils/egresados-export.utils';

// ── Tipos internos (DTO de Supabase) ──────────────────────────────────────────

interface UserRow {
  first_names: string;
  paternal_last_name: string;
  maternal_last_name: string | null;
  rut: string | null;
  email: string | null;
}

interface StudentRow {
  id: number;
  /** 'archived' = el alumno está en la Papelera y no se lista como egresado (fix-276-m). */
  status?: string | null;
  users: UserRow | null;
}

interface CourseRow {
  name: string;
  code: string;
}

interface BranchRow {
  id: number;
  name: string;
}

interface EgresadoRow {
  id: number;
  number: string | null;
  pending_balance: number | null;
  /** Fecha de egreso real: cuándo la matrícula pasó a `completed` (fix-266-m). */
  completed_at: string | null;
  license_group: string | null;
  courses: CourseRow | null;
  branches: BranchRow | null;
  students: StudentRow | null;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ExAlumnosFacade {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly toast = inject(ToastService);

  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;
  private _hasStats = false;
  private _hasSurveys = false;

  // ── Estado privado ───────────────────────────────────────────────────────────
  private readonly _egresados = signal<EgresadoTableRow[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _refreshFailed = signal<boolean>(false);
  private readonly _statsError = signal<string | null>(null);
  private readonly _statsRefreshFailed = signal<boolean>(false);
  private readonly _surveysError = signal<string | null>(null);
  private readonly _surveysRefreshFailed = signal<boolean>(false);
  private readonly _isExporting = signal<boolean>(false);

  // ── Estado público ───────────────────────────────────────────────────────────
  readonly egresados = this._egresados.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly refreshFailed = this._refreshFailed.asReadonly();
  readonly statsError = this._statsError.asReadonly();
  readonly statsRefreshFailed = this._statsRefreshFailed.asReadonly();
  readonly surveysError = this._surveysError.asReadonly();
  readonly surveysRefreshFailed = this._surveysRefreshFailed.asReadonly();
  readonly isExporting = this._isExporting.asReadonly();

  // ── Estadísticas — Totales ──
  readonly totalEgresados = computed<number>(() => this._egresados().length);
  // Listas filtradas por grupo (spec 0016 — split Ex-Alumnos B / Profesional)
  readonly egresadosClaseBList = computed<EgresadoTableRow[]>(() =>
    this._egresados().filter((e) => e.licenseGroup === 'class_b'),
  );
  readonly egresadosProfesionalList = computed<EgresadoTableRow[]>(() =>
    this._egresados().filter((e) => e.licenseGroup === 'professional'),
  );
  readonly egresadosClaseB = computed<number>(() => this.egresadosClaseBList().length);
  readonly egresadosProfesional = computed<number>(() => this.egresadosProfesionalList().length);
  readonly conAbonoPendiente = computed<number>(
    () => this._egresados().filter((e: EgresadoTableRow) => e.saldoPendiente > 0).length,
  );

  // ── Estadísticas — Tasas de Aprobación ──
  readonly municipalApprovalRate = signal<number>(0);
  readonly psychoApprovalRate = signal<number>(0);
  readonly totalExamenes = signal<number>(0);

  // ── Estadísticas — Balance General del Año (Académico) ──
  readonly annualEgresadosTotal = signal<number>(0);
  readonly annualLicensesTotal = signal<number>(0);
  readonly successConversionRate = signal<number>(0); // % de egresados que sacan licencia

  // ── Estadísticas — Encuestas (Post-Curso) ──
  readonly avgSatisfaction = signal<number>(0);
  readonly licenseSuccessRate = signal<number>(0);
  readonly _surveys = signal<any[]>([]);
  readonly surveys = this._surveys.asReadonly();

  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }

  /**
   * fix-195-b (spec 0005-m): un solo guard para la carga completa y el refresco SWR. La llamada
   * que sigue vigente al terminar aplica los datos y apaga `isLoading`; una respuesta de una sede
   * anterior no toca nada (antes dejaba la pantalla en "A" con los egresados de "B").
   */
  private readonly egresadosGuard = createRequestGuard();
  private readonly statsGuard = createRequestGuard();
  private readonly surveysGuard = createRequestGuard();

  // ── Acción principal ─────────────────────────────────────────────────────────
  async loadEgresados(): Promise<void> {
    const branchId = this.getActiveBranchId();

    if (this._initialized && branchId === this._lastBranchId) {
      await this.refreshSilently();
      return;
    }

    const token = this.egresadosGuard.next();
    const statsToken = this.statsGuard.next();
    const surveysToken = this.surveysGuard.next();
    // Caso A (primera carga o cambio de sede): limpiamos datos y estadísticas previas para no
    // mezclar la sede anterior ni dejar KPIs de otra sede visibles si esta carga falla.
    // `_lastBranchId` y `_initialized` se actualizan tras completar o en catch para respetar el
    // refresco SWR si el usuario vuelve a la sede previa mientras esta carga sigue en vuelo.
    this._egresados.set([]);
    this._hasStats = false;
    this.resetStatisticsSignals();
    this._hasSurveys = false;
    this._surveys.set([]);
    this.avgSatisfaction.set(0);
    this.licenseSuccessRate.set(0);

    this._isLoading.set(true);
    this._error.set(null);
    this._refreshFailed.set(false);
    this._statsError.set(null);
    this._statsRefreshFailed.set(false);
    this._surveysError.set(null);
    this._surveysRefreshFailed.set(false);
    try {
      await this.fetchAll(token, false, statsToken, surveysToken);
      if (!this.egresadosGuard.isCurrent(token)) return;
      this._initialized = true;
      this._lastBranchId = branchId;
    } catch (err) {
      if (!this.egresadosGuard.isCurrent(token)) return;
      this._egresados.set([]);
      // fix-287-m: una carga fallida no cuenta como hecha; reintentar vuelve a cargar completo.
      this._initialized = false;
      this._lastBranchId = branchId;
      this._error.set(
        err instanceof Error
          ? this.sanitizer.sanitize(err).message
          : 'Error al cargar los egresados.',
      );
    } finally {
      if (this.egresadosGuard.isCurrent(token)) this._isLoading.set(false);
    }
  }

  async reintentar(): Promise<void> {
    if (this._refreshFailed()) {
      await this.refreshSilently();
      return;
    }
    this._error.set(null);
    this._refreshFailed.set(false);
    this._initialized = false;
    await this.loadEgresados();
  }

  async reintentarStats(): Promise<void> {
    const statsToken = this.statsGuard.next();
    if (this._statsRefreshFailed()) {
      await this.loadStatistics(-1, true, statsToken);
      return;
    }
    this._statsError.set(null);
    this._statsRefreshFailed.set(false);
    await this.loadStatistics(-1, false, statsToken);
  }

  async reintentarSurveys(): Promise<void> {
    const surveysToken = this.surveysGuard.next();
    if (this._surveysRefreshFailed()) {
      await this.loadSurveys(-1, true, surveysToken);
      return;
    }
    this._surveysError.set(null);
    this._surveysRefreshFailed.set(false);
    await this.loadSurveys(-1, false, surveysToken);
  }

  private async refreshSilently(): Promise<void> {
    const token = this.egresadosGuard.next();
    const statsToken = this.statsGuard.next();
    const surveysToken = this.surveysGuard.next();
    const branchId = this.getActiveBranchId();
    try {
      await this.fetchAll(token, true, statsToken, surveysToken);
      if (!this.egresadosGuard.isCurrent(token)) return;
      this._lastBranchId = branchId;
      this._refreshFailed.set(false);
      this._error.set(null);
    } catch {
      if (!this.egresadosGuard.isCurrent(token)) return;
      // Regla 2 (caso B): mantener egresados visibles y avisar sin pisar error() de caso A.
      this._refreshFailed.set(true);
    } finally {
      // Si este refresco reemplazó a una carga completa de otra sede, el skeleton es suyo.
      if (this.egresadosGuard.isCurrent(token)) this._isLoading.set(false);
    }
  }

  private fetchAll(
    token: number,
    isSilentRefresh: boolean,
    statsToken: number,
    surveysToken: number,
  ): Promise<unknown> {
    return Promise.all([
      this.loadEgresadosList(token),
      this.loadStatistics(token, isSilentRefresh, statsToken),
      this.loadSurveys(token, isSilentRefresh, surveysToken),
    ]);
  }

  private async loadEgresadosList(token: number): Promise<void> {
    const branchId = this.getActiveBranchId();
    let query: any = this.supabase.client
      .from('enrollments')
      .select(
        `
        id,
        number,
        pending_balance,
        completed_at,
        license_group,
        courses!inner ( name, code ),
        branches ( id, name ),
        students!inner (
          id,
          status,
          users!inner (
            first_names,
            paternal_last_name,
            maternal_last_name,
            rut,
            email
          )
        )
      `,
      )
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });
    if (branchId !== null) query = query.eq('branch_id', branchId);
    const { data, error } = await query;
    if (error) throw error;
    if (!this.egresadosGuard.isCurrent(token)) return;

    // fix-276-m: un egresado archivado solo se ve en la Papelera de la Base de Alumnos.
    const rows = ((data as unknown as EgresadoRow[]) ?? []).filter(
      (r) => r.students?.status !== 'archived',
    );
    const convalidationMap = await fetchConvalidationMap(
      this.supabase.client,
      rows.map((r) => r.id),
    );
    if (!this.egresadosGuard.isCurrent(token)) return;
    this._egresados.set(rows.map((r: EgresadoRow) => this.mapRow(r, convalidationMap)));
  }

  // ── Helpers privados ─────────────────────────────────────────────────────────
  private mapRow(r: EgresadoRow, convalidationMap: Map<number, 'A4' | 'A3'>): EgresadoTableRow {
    const u = r.students?.users;

    const nombre: string = u
      ? buildStudentDisplayName({
          firstNames: u.first_names,
          paternalLastName: u.paternal_last_name,
          maternalLastName: u.maternal_last_name,
        })
      : '—';

    const rut: string = u?.rut ?? '—';
    const correo: string = u?.email ?? '—';
    const licencia: string = this.deriveLicencia(r.courses?.code ?? '', r.courses?.name ?? '');
    // fix-266-m: la fecha de egreso es completed_at. Antes se usaba updated_at, que no se
    // actualiza al marcar al ex-alumno y sí cambia con cada pago posterior.
    const anio: number | null = r.completed_at ? chileYear(new Date(r.completed_at)) : null;
    // fix-147-b: la ventana de período necesita precisión de día, no solo el año.
    // fix-297-m: el día en hora de Chile, como el año. Cortar el texto (UTC) dejaba a un egresado
    // del 31-dic de noche con año 2025 en la columna y fuera del período 2025 en el filtro.
    const fechaEgreso: string | null = r.completed_at ? toChileDate(r.completed_at) : null;
    const sede: string = r.branches?.name ?? '—';
    const branchId: number | null = r.branches?.id ?? null;

    return {
      id: r.id,
      studentId: String(r.students?.id ?? ''),
      nombre,
      rut,
      correo,
      nroExpediente: r.number,
      licencia,
      licenseGroup: r.license_group === 'professional' ? 'professional' : 'class_b',
      anio,
      fechaEgreso,
      sede,
      branchId,
      nroCertificado: null,
      saldoPendiente: r.pending_balance ?? 0,
      convalidatedLicense: convalidationMap.get(r.id) ?? null,
    };
  }

  private resetStatisticsSignals(): void {
    this.municipalApprovalRate.set(0);
    this.psychoApprovalRate.set(0);
    this.totalExamenes.set(0);
    this.annualEgresadosTotal.set(0);
    this.annualLicensesTotal.set(0);
    this.successConversionRate.set(0);
  }

  private isStatsCurrent(token: number, statsToken?: number): boolean {
    if (token >= 0 && !this.egresadosGuard.isCurrent(token)) return false;
    if (statsToken !== undefined && !this.statsGuard.isCurrent(statsToken)) return false;
    return true;
  }

  private isSurveysCurrent(token: number, surveysToken?: number): boolean {
    if (token >= 0 && !this.egresadosGuard.isCurrent(token)) return false;
    if (surveysToken !== undefined && !this.surveysGuard.isCurrent(surveysToken)) return false;
    return true;
  }

  private async loadStatistics(
    token: number,
    isSilentRefresh = false,
    statsToken?: number,
  ): Promise<void> {
    try {
      const year = chileYear();
      const startOfYear = `${year}-01-01`;

      // 1. Cargar exámenes para tasas de aprobación
      const { data: exams, error } = await this.supabase.client
        .from('class_b_exam_scores')
        .select('passed'); // Eliminamos exam_type por ahora ya que no existe en BD

      if (error) throw error;

      // 2. Balance Real del Año (Egresados vs Licencias)
      // Contar egresados (enrollments completed este año) — mismo criterio que
      // loadEgresadosList() (fix-005-i): solo Clase B y scope de sede, para que
      // ambos números de la página coincidan (antes: 2 vs 16, H-003).
      const branchId = this.getActiveBranchId();
      let egresadosCountQuery: any = this.supabase.client
        .from('enrollments')
        .select('id, students!inner(status)', { count: 'exact', head: true })
        .eq('status', 'completed')
        .eq('license_group', 'class_b')
        // fix-276-m: mismo criterio que la lista — los archivados no cuentan.
        .neq('students.status', 'archived')
        .gte('completed_at', startOfYear);
      if (branchId !== null) egresadosCountQuery = egresadosCountQuery.eq('branch_id', branchId);
      const { count: egresadosCount, error: countErr } = await egresadosCountQuery;

      if (countErr) throw countErr;

      // Contar licencias (surveys with obtained_license = true este año)
      const { count: licensesCount, error: licErr } = await this.supabase.client
        .from('student_surveys')
        .select('*', { count: 'exact', head: true })
        .eq('obtained_license', true)
        .gte('created_at', startOfYear);

      if (licErr) throw licErr;
      if (!this.isStatsCurrent(token, statsToken)) return;

      const approvalRate = exams ? this.calculateRate(exams) : 0;
      const totalExamsCount = exams ? exams.length : 0;
      const egrTotal = egresadosCount || 0;
      const licTotal = licensesCount || 0;

      // Como no hay exam_type en BD todavía, mostramos la tasa general para ambos por ahora
      this.municipalApprovalRate.set(approvalRate);
      this.psychoApprovalRate.set(approvalRate);
      this.totalExamenes.set(totalExamsCount);
      this.annualEgresadosTotal.set(egrTotal);
      this.annualLicensesTotal.set(licTotal);
      this.successConversionRate.set(egrTotal > 0 ? Math.round((licTotal / egrTotal) * 100) : 0);

      this._hasStats = true;
      this._statsError.set(null);
      this._statsRefreshFailed.set(false);
    } catch {
      if (!this.isStatsCurrent(token, statsToken)) return;
      if (isSilentRefresh && this._hasStats) {
        this._statsRefreshFailed.set(true);
      } else {
        this._hasStats = false;
        this.resetStatisticsSignals();
        this._statsRefreshFailed.set(false);
        this._statsError.set('No se pudieron cargar las tasas de aprobación.');
      }
    }
  }

  private async loadSurveys(
    token = -1,
    isSilentRefresh = false,
    surveysToken?: number,
  ): Promise<void> {
    try {
      const { data, error } = await this.supabase.client.from('student_surveys').select(`
          id,
          satisfaction_rating,
          comments,
          obtained_license,
          enrollments!inner(
            students!inner(
              users!inner(first_names, paternal_last_name)
            )
          )
        `);

      if (error) throw error;
      if (!this.isSurveysCurrent(token, surveysToken)) return;

      const rows = (data as any[]) ?? [];
      const total = rows.length;
      if (total > 0) {
        const sumRating = rows.reduce((acc, s) => acc + s.satisfaction_rating, 0);
        const licenseSuccess = rows.filter((s) => s.obtained_license).length;

        this.avgSatisfaction.set(Number((sumRating / total).toFixed(1)));
        this.licenseSuccessRate.set(Math.round((licenseSuccess / total) * 100));

        // Mapear para la UI con tipado seguro
        const mappedSurveys = rows.map((s) => {
          const user = s.enrollments?.students?.users;
          return {
            nombre: user ? `${user.first_names} ${user.paternal_last_name}` : 'Alumno Anónimo',
            rating: s.satisfaction_rating,
            texto: s.comments || 'Sin comentario',
            iniciales: user ? user.first_names[0] + user.paternal_last_name[0] : 'AA',
          };
        });
        this._surveys.set(mappedSurveys);
      } else {
        this.avgSatisfaction.set(0);
        this.licenseSuccessRate.set(0);
        this._surveys.set([]);
      }

      this._hasSurveys = true;
      this._surveysError.set(null);
      this._surveysRefreshFailed.set(false);
    } catch {
      if (!this.isSurveysCurrent(token, surveysToken)) return;
      if (isSilentRefresh && this._hasSurveys) {
        this._surveysRefreshFailed.set(true);
      } else {
        this._hasSurveys = false;
        this._surveys.set([]);
        this.avgSatisfaction.set(0);
        this.licenseSuccessRate.set(0);
        this._surveysRefreshFailed.set(false);
        this._surveysError.set('No se pudieron cargar las opiniones de egresados.');
      }
    }
  }

  private calculateRate(exams: any[]): number {
    if (exams.length === 0) return 0;
    const passed = exams.filter((e) => e.passed === true).length;
    return Math.round((passed / exams.length) * 100);
  }

  /**
   * Exporta la lista de Ex-Alumnos (spec 0021-m; Profesional desde la spec 0023-m). Recibe las
   * filas que la pantalla ya filtró y ordenó: el archivo trae exactamente lo que se ve, sin
   * volver a consultar ni a filtrar.
   */
  async exportEgresados(
    format: 'excel' | 'pdf',
    rows: EgresadoTableRow[],
    group: 'class_b' | 'professional' = 'class_b',
  ): Promise<void> {
    if (this._isExporting()) return;
    this._isExporting.set(true);
    const isPro = group === 'professional';
    try {
      const filename = `${isPro ? 'ex-alumnos-profesional' : 'ex-alumnos-b'}_${todayIso()}`;
      if (format === 'excel') {
        const table = buildEgresadosExcelTable(rows, isPro ? 'Nº Matrícula' : 'Nº Expediente');
        downloadExcel(
          isPro ? 'Ex-Alumnos Profesional' : 'Ex-Alumnos B',
          table.headers,
          table.rows,
          filename,
        );
        return;
      }

      const table = buildEgresadosPdfTable(rows, isPro ? 'Nº Mat.' : 'Nº Exp.');
      const { data, error } = await this.supabase.client.functions.invoke('export-table-pdf', {
        body: {
          title: isPro ? 'Ex-Alumnos Clase Profesional' : 'Ex-Alumnos Clase B',
          subtitle: `Generado: ${formatDayMonthYear(todayIso())}`,
          headers: table.headers,
          rows: table.rows,
          columnWeights: EGRESADOS_PDF_COLUMN_WEIGHTS,
          footer: `Total: ${rows.length} egresado${rows.length === 1 ? '' : 's'}`,
        },
      });
      if (error) throw error;
      const bytes = data instanceof Blob ? await data.arrayBuffer() : data;
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${filename}.pdf`);
    } catch {
      this.toast.error('No se pudo exportar la lista. Inténtalo de nuevo.');
    } finally {
      this._isExporting.set(false);
    }
  }

  private deriveLicencia(code: string, name: string): string {
    const upper = (code + ' ' + name).toUpperCase();
    if (upper.includes('CLASE B') || upper.includes('CLASS B')) return 'Clase B';
    if (upper.includes('A1')) return 'A1';
    if (upper.includes('A2')) return 'A2';
    if (upper.includes('A3')) return 'A3';
    if (upper.includes('A4')) return 'A4';
    if (upper.includes('A5')) return 'A5';
    return name || code || '—';
  }
}
