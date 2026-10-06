import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { MODULE_COUNT } from '@core/utils/professional-modules';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import { fetchConvalidationMap } from '@core/utils/convalidation.utils';
import { downloadExcel } from '@core/utils/excel.utils';
import { downloadBlob } from '@core/utils/file-download.utils';
import { formatDayMonthYear, todayIso } from '@core/utils/date.utils';
import {
  ALUMNOS_PROFESIONAL_PDF_COLUMN_WEIGHTS,
  buildAlumnosProfesionalExcelTable,
  buildAlumnosProfesionalPdfTable,
} from '@core/utils/alumnos-profesional-export.utils';
import type { AlumnoStatus } from '@core/models/ui/alumno-table-row.model';
import { buildFutureClassesBlockMessage } from '@core/utils/archive-confirmation.utils';
import type {
  AlumnoProfesionalTableRow,
  SemaforoAsistencia,
} from '@core/models/ui/alumno-profesional-table-row.model';

// ─── Tipos de la respuesta cruda de Supabase ────────────────────────────────

interface RawProUser {
  id: number;
  rut: string;
  first_names: string;
  paternal_last_name: string;
  maternal_last_name: string;
  email: string;
  phone: string | null;
  branch_id: number | null;
}

interface RawProEnrollment {
  id: number;
  number: string | null;
  status: string | null;
  pending_balance: number | null;
  branch_id: number | null;
  students: { id: number; status: string | null; users: RawProUser };
  /** Curso de la matrícula: de aquí sale la categoría (A2–A5), tenga o no promoción. */
  courses: { license_class: string | null } | null;
  promotion_courses: {
    id: number;
    professional_promotions: { code: string | null; start_date: string | null } | null;
  } | null;
}

/**
 * Etiqueta de la columna "Promoción" (fix-330-m, D11): el número de la promoción; si no tiene,
 * su fecha de inicio; sin promoción, "—".
 */
function promocionLabel(
  promo: { code: string | null; start_date: string | null } | null | undefined,
): string {
  if (!promo) return '—';
  if (promo.code) return `Promoción ${promo.code}`;
  if (promo.start_date) {
    const [y, m, d] = promo.start_date.split('-');
    return `Promoción del ${d}-${m}-${y}`;
  }
  return '—';
}

// ─── Facade ──────────────────────────────────────────────────────────────────

/**
 * Estados de matrícula considerados "matriculados" en la Base Profesional.
 * 'completed' queda fuera: esos alumnos ya son Ex-Alumnos y solo se listan ahí.
 * Solo 'active': ningún flujo deja una matrícula Profesional en 'inactive', 'withdrawn' ni
 * 'cancelled' (fix-329-m, D2). Cuando se modele al desertor se define dónde se ve.
 */
const ENROLLED_STATUSES = ['active'];

@Injectable({ providedIn: 'root' })
export class AdminAlumnosProfesionalFacade {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);
  private readonly branchFacade = inject(BranchFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly toast = inject(ToastService);

  // ── 1. ESTADO PRIVADO ────────────────────────────────────────────────────
  private readonly _alumnos = signal<AlumnoProfesionalTableRow[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _trashView = signal(false);
  private readonly _isArchiving = signal(false);
  private readonly _isExporting = signal(false);

  private _initialized = false;
  private _lastBranchId: number | null = null;
  private _realtimeChannel: any | null = null;

  // ── 2. ESTADO PÚBLICO (solo lectura) ─────────────────────────────────────
  readonly alumnos = this._alumnos.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly trashView = this._trashView.asReadonly();
  readonly isArchiving = this._isArchiving.asReadonly();
  readonly isExporting = this._isExporting.asReadonly();

  readonly totalAlumnos = computed(() => this._alumnos().length);
  readonly activos = computed(() => this._alumnos().filter((a) => a.estado === 'Activo').length);
  readonly conDeuda = computed(() => this._alumnos().filter((a) => a.saldo > 0).length);
  readonly enRiesgo = computed(() => this._alumnos().filter((a) => a.semaforo === 'red').length);

  // ── 3. MÉTODOS DE ACCIÓN ─────────────────────────────────────────────────

  setupRealtime(): void {
    if (this._realtimeChannel) return;
    this._realtimeChannel = this.supabase.client
      .channel('alumnos-profesional-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'enrollments' },
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

  dispose(): void {
    this.destroyRealtime();
  }

  /** SWR Initialization */
  /**
   * Sede activa para el scope de queries (fix-027).
   * admin → respeta el selector; secretaria → su sede (misconfig → ninguna fila).
   */
  private getActiveBranchId(): number | null {
    const user = this.authFacade.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }

  async initialize(): Promise<void> {
    const currentBranchId = this.getActiveBranchId();
    this.setupRealtime();

    if (this._initialized && currentBranchId === this._lastBranchId) {
      void this.refreshSilently();
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchData(currentBranchId);
      this._initialized = true;
      this._lastBranchId = currentBranchId;
    } catch {
      this._error.set('Error al cargar alumnos profesionales');
    } finally {
      this._isLoading.set(false);
    }
  }

  async loadAlumnos(): Promise<void> {
    return this.initialize();
  }

  /**
   * Carga la lista para el buscador global (fix-337-m), **sin** Realtime: el buscador no tiene un
   * ciclo de vida que cierre el canal (swr-pattern.md). No consulta si ya hay datos de la sede
   * vigente; si falla, el buscador sigue con lo que tenga.
   */
  async loadForSearch(): Promise<void> {
    const branchId = this.getActiveBranchId();
    if (this._initialized && branchId === this._lastBranchId) return;
    try {
      await this.fetchData(branchId);
      this._initialized = true;
      this._lastBranchId = branchId;
    } catch {
      // fetchData ya dejó el error en su signal; la búsqueda no debe romperse por esto.
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      const currentBranchId = this.getActiveBranchId();
      await this.fetchData(currentBranchId);
      this._lastBranchId = currentBranchId;
    } catch {
      // Fail silencioso — datos stale siguen visibles
    }
  }

  /**
   * Sale de la Papelera al abandonar la pantalla (fix-339-m, mismo caso que hotfix-112-m en la
   * Base B). El facade es un singleton: sin esto, al volver a la Base Profesional se abría la
   * Papelera. No consulta (la pantalla ya no existe): invalida la caché para que la próxima
   * entrada cargue la lista activa.
   */
  leaveTrashView(): void {
    if (!this._trashView()) return;
    this._trashView.set(false);
    this._alumnos.set([]);
    this._initialized = false;
  }

  async setTrashView(value: boolean): Promise<void> {
    if (this._trashView() === value) return;
    this._trashView.set(value);
    this._initialized = false;
    await this.initialize();
  }

  /**
   * Verifica si un alumno profesional tiene historial de pagos o asistencia
   * (teórica/práctica). Homologa la regla de `AdminAlumnosFacade.checkHistorial`
   * (Clase B) — misma forma: enrollments no-draft del alumno → cuenta pagos +
   * actividad académica asociada. Se usa para decidir qué modal de confirmación
   * mostrar antes de archivar (`EliminarAlumnoModalComponent`).
   */
  async checkHistorial(
    studentId: number,
  ): Promise<{ hasHistory: boolean; hasClaseB: boolean; clasesFuturas: number }> {
    const { data: enrollmentRows } = await this.supabase.client
      .from('enrollments')
      .select('id, license_group, status')
      .eq('student_id', studentId)
      .neq('status', 'draft');

    const rows = (enrollmentRows ?? []) as {
      id: number;
      license_group: string | null;
      status: string | null;
    }[];
    const enrollmentIds = rows.map((e) => e.id);
    // fix-333-m (D8): archivar desde aquí archiva a la persona completa; si también está en
    // Clase B, sale de esa base. Vigente = activa o con el pago en curso.
    const hasClaseB = rows.some(
      (e) =>
        e.license_group === 'class_b' && (e.status === 'active' || e.status === 'pending_payment'),
    );

    if (enrollmentIds.length === 0) return { hasHistory: false, hasClaseB, clasesFuturas: 0 };

    const [paymentsResult, theoryResult, practiceResult, futureClassesResult] = await Promise.all([
      this.supabase.client
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .in('enrollment_id', enrollmentIds),
      this.supabase.client
        .from('professional_theory_attendance')
        .select('id', { count: 'exact', head: true })
        .in('enrollment_id', enrollmentIds),
      this.supabase.client
        .from('professional_practice_attendance')
        .select('id', { count: 'exact', head: true })
        .in('enrollment_id', enrollmentIds),
      // fix-333-m: misma regla que la Base B (fix-277-m) — clases de Clase B por dictarse.
      this.supabase.client
        .from('class_b_sessions')
        .select('id', { count: 'exact', head: true })
        .in('enrollment_id', enrollmentIds)
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString()),
    ]);

    return {
      hasHistory:
        (paymentsResult.count ?? 0) > 0 ||
        (theoryResult.count ?? 0) > 0 ||
        (practiceResult.count ?? 0) > 0,
      hasClaseB,
      clasesFuturas: futureClassesResult.count ?? 0,
    };
  }

  /**
   * Paso previo a archivar (fix-333-m). Archivar desde la Base Profesional archiva a la persona
   * completa (D8), así que aplica la misma regla de la Base B (fix-277-m): con clases agendadas a
   * futuro no se puede (toast). Si se puede, dice qué modal mostrar y si avisar de la Clase B.
   */
  async prepararArchivado(
    studentId: number,
  ): Promise<{ permitido: boolean; hasHistory: boolean; hasClaseB: boolean }> {
    const { hasHistory, hasClaseB, clasesFuturas } = await this.checkHistorial(studentId);
    if (clasesFuturas > 0) {
      this.toast.error('No se puede archivar', buildFutureClassesBlockMessage(clasesFuturas));
      return { permitido: false, hasHistory, hasClaseB };
    }
    return { permitido: true, hasHistory, hasClaseB };
  }

  /** true si se archivó. Si falla, avisa por toast y devuelve false (fix-333-m: ya no lanza). */
  async archivarAlumno(studentId: number): Promise<boolean> {
    this._isArchiving.set(true);
    try {
      const { error } = await this.supabase.client
        .from('students')
        .update({ status: 'archived' })
        .eq('id', studentId);
      if (error) throw error;
      this.toast.success('Alumno archivado correctamente.');
      await this.refreshSilently();
      return true;
    } catch {
      this.toast.error('No se pudo archivar al alumno. Inténtalo de nuevo.');
      return false;
    } finally {
      this._isArchiving.set(false);
    }
  }

  async restaurarAlumno(studentId: number): Promise<void> {
    this._isArchiving.set(true);
    try {
      const { error } = await this.supabase.client
        .from('students')
        .update({ status: 'active' })
        .eq('id', studentId);
      if (error) throw error;
      this.toast.success('Alumno restaurado correctamente.');
      await this.refreshSilently();
    } catch {
      this.toast.error('No se pudo restaurar al alumno. Inténtalo de nuevo.');
      throw new Error('restaurar_failed');
    } finally {
      this._isArchiving.set(false);
    }
  }

  /**
   * Exporta la Base de Alumnos Profesional (spec 0023-m). Recibe las filas que la pantalla ya
   * filtró y ordenó (lista normal o Papelera): el archivo trae exactamente lo que se ve, sin
   * volver a consultar. Mismo esquema que `AdminAlumnosFacade.exportAlumnos` (Clase B).
   */
  async exportAlumnos(format: 'excel' | 'pdf', rows: AlumnoProfesionalTableRow[]): Promise<void> {
    if (this._isExporting()) return;
    this._isExporting.set(true);
    try {
      const filename = `alumnos-profesional_${todayIso()}`;
      if (format === 'excel') {
        const table = buildAlumnosProfesionalExcelTable(rows);
        downloadExcel('Alumnos Profesional', table.headers, table.rows, filename);
        return;
      }

      const table = buildAlumnosProfesionalPdfTable(rows);
      const { data, error } = await this.supabase.client.functions.invoke('export-table-pdf', {
        body: {
          title: 'Base de Alumnos Profesional',
          subtitle: `Generado: ${formatDayMonthYear(todayIso())}`,
          headers: table.headers,
          rows: table.rows,
          columnWeights: ALUMNOS_PROFESIONAL_PDF_COLUMN_WEIGHTS,
          footer: `Total: ${rows.length} alumno${rows.length === 1 ? '' : 's'}`,
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

  clearError(): void {
    this._error.set(null);
  }

  // ── Fetch + mapeo ─────────────────────────────────────────────────────────

  private async fetchData(branchId: number | null): Promise<void> {
    try {
      let query: any = this.supabase.client
        .from('enrollments')
        .select(
          `
          id, number, status, pending_balance, branch_id,
          students!inner(id, status, users!inner(id, rut, first_names, paternal_last_name, maternal_last_name, email, phone, branch_id)),
          courses(license_class),
          promotion_courses(id, professional_promotions(code, start_date))
        `,
        )
        .eq('license_group', 'professional')
        .in('status', ENROLLED_STATUSES);

      if (branchId !== null) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query.order('id', { ascending: false });
      if (error) throw error;

      const enrollments = (data ?? []) as unknown as RawProEnrollment[];

      // Papelera: filtrar por estado del alumno (soft-delete a nivel persona)
      const filtered = enrollments.filter((e) =>
        this._trashView() ? e.students.status === 'archived' : e.students.status !== 'archived',
      );

      if (filtered.length === 0) {
        this._alumnos.set([]);
        return;
      }

      const enrollmentIds = filtered.map((e) => e.id);

      const [attRes, gradesRes, convalidationMap] = await Promise.all([
        this.supabase.client
          .from('v_professional_attendance')
          .select('enrollment_id, attendance_flag')
          .in('enrollment_id', enrollmentIds),
        this.supabase.client
          .from('professional_module_grades')
          .select('enrollment_id, passed')
          .in('enrollment_id', enrollmentIds),
        fetchConvalidationMap(this.supabase.client, enrollmentIds),
      ]);

      const flagMap = new Map<number, SemaforoAsistencia>();
      for (const r of (attRes.data ?? []) as {
        enrollment_id: number;
        attendance_flag: string | null;
      }[]) {
        if (r.attendance_flag)
          flagMap.set(r.enrollment_id, r.attendance_flag as SemaforoAsistencia);
      }

      const passedMap = new Map<number, number>();
      for (const g of (gradesRes.data ?? []) as {
        enrollment_id: number;
        passed: boolean | null;
      }[]) {
        if (g.passed === true) {
          passedMap.set(g.enrollment_id, (passedMap.get(g.enrollment_id) ?? 0) + 1);
        }
      }

      const rows = filtered.map((e) => this.mapRow(e, flagMap, passedMap, convalidationMap));
      this._alumnos.set(rows);
    } catch (err) {
      this._error.set(
        err instanceof Error
          ? this.sanitizer.sanitize(err).message
          : 'Error al cargar alumnos profesionales',
      );
      throw err;
    }
  }

  private mapRow(
    e: RawProEnrollment,
    flagMap: Map<number, SemaforoAsistencia>,
    passedMap: Map<number, number>,
    convalidationMap: Map<number, 'A4' | 'A3'>,
  ): AlumnoProfesionalTableRow {
    const u = e.students.users;
    return {
      id: String(e.students.id),
      nombre: u.first_names,
      apellido: `${u.paternal_last_name} ${u.maternal_last_name}`.trim(),
      rut: u.rut,
      email: u.email,
      celular: u.phone ?? '',
      nroMatricula: e.number ?? '—',
      promocion: promocionLabel(e.promotion_courses?.professional_promotions),
      licenseClass: e.courses?.license_class ?? '',
      semaforo: flagMap.get(e.id) ?? null,
      modulosAprobados: passedMap.get(e.id) ?? 0,
      modulosTotal: MODULE_COUNT,
      estado: this.deriveStatus(e.status),
      saldo: e.pending_balance ?? 0,
      enrollmentId: e.id,
      convalidatedLicense: convalidationMap.get(e.id) ?? null,
    };
  }

  private deriveStatus(status: string | null): AlumnoStatus {
    switch (status) {
      case 'active':
        return 'Activo';
      case 'completed':
        return 'Finalizado';
      default:
        return 'Pre-inscrito';
    }
  }
}
