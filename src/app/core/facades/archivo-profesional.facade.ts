import { Injectable, computed, inject, signal } from '@angular/core';
import { BranchFacade } from '@core/facades/branch.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { formatRut } from '@core/utils/rut.utils';
import { calcAverage, getModuleNames, MODULE_COUNT } from '@core/utils/professional-modules';
import type {
  ArchivoAlumnoRow,
  ArchivoCursoOption,
  ArchivoKpis,
  ArchivoNotaModulo,
  ArchivoPromocionOption,
} from '@core/models/ui/archivo-profesional.model';

const NOTA_PASS = 75;
const PCT_TEORIA_MIN = 75;

/**
 * ArchivoFacade — Historial de promociones finalizadas de Clase Profesional.
 *
 * Flujo en cascada:
 *   initialize() → carga lista de promociones con status='finished'.
 *   selectPromocion(id) → carga cursos de esa promoción.
 *   selectCurso(id) → carga alumnos con asistencia + notas consolidadas.
 *
 * Solo lectura. No modifica datos.
 */
@Injectable({ providedIn: 'root' })
export class ArchivoFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly branchFacade = inject(BranchFacade);
  private readonly toast = inject(ToastService);

  // ── Estado privado ──────────────────────────────────────────────────────────
  private readonly _promociones = signal<ArchivoPromocionOption[]>([]);
  private readonly _cursos = signal<ArchivoCursoOption[]>([]);
  private readonly _selectedPromocionId = signal<number | null>(null);
  private readonly _selectedCursoId = signal<number | null>(null);
  private readonly _alumnos = signal<ArchivoAlumnoRow[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isLoadingAlumnos = signal(false);
  private readonly _error = signal<string | null>(null);
  private _initialized = false;

  // ── Estado público ──────────────────────────────────────────────────────────
  public readonly promociones = this._promociones.asReadonly();
  public readonly cursos = this._cursos.asReadonly();
  public readonly selectedPromocionId = this._selectedPromocionId.asReadonly();
  public readonly selectedCursoId = this._selectedCursoId.asReadonly();
  public readonly alumnos = this._alumnos.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly isLoadingAlumnos = this._isLoadingAlumnos.asReadonly();
  public readonly error = this._error.asReadonly();

  // ── Computed KPIs ────────────────────────────────────────────────────────────
  public readonly kpis = computed<ArchivoKpis>(() => {
    const rows = this._alumnos();
    const aprobados = rows.filter((r) => r.aprobado).length;
    const reprobados = rows.length - aprobados;
    const pctAprobacion = rows.length > 0 ? Math.round((aprobados / rows.length) * 100) : 0;
    return { totalAlumnos: rows.length, aprobados, reprobados, pctAprobacion };
  });

  /** Módulos del curso activo para el encabezado de la tabla */
  public readonly moduleNames = computed<string[]>(() => {
    const cursoId = this._selectedCursoId();
    if (!cursoId) return [];
    const curso = this._cursos().find((c) => c.id === cursoId);
    if (!curso) return [];
    return getModuleNames(curso.licenseClass);
  });

  // ── SWR: initialize ─────────────────────────────────────────────────────────
  async initialize(): Promise<void> {
    if (this._initialized) {
      void this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    try {
      await this.fetchPromociones();
    } catch {
      this._error.set('Error al cargar el archivo de promociones');
      this.toast.error('Error al cargar el archivo de clase profesional');
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Recarga completa al cambiar sede. Limpia selección. */
  async reload(): Promise<void> {
    this._initialized = false;
    this._selectedPromocionId.set(null);
    this._selectedCursoId.set(null);
    this._cursos.set([]);
    this._alumnos.set([]);
    await this.initialize();
  }

  /** Selecciona promoción → carga sus cursos. null = deseleccionar. */
  async selectPromocion(promoId: number | null): Promise<void> {
    this._selectedPromocionId.set(promoId);
    this._selectedCursoId.set(null);
    this._cursos.set([]);
    this._alumnos.set([]);
    if (promoId !== null) {
      await this.fetchCursos(promoId);
    }
  }

  /** Selecciona curso → carga alumnos con asistencia + notas. null = deseleccionar. */
  async selectCurso(cursoId: number | null): Promise<void> {
    this._selectedCursoId.set(cursoId);
    this._alumnos.set([]);
    if (cursoId === null) return;
    this._isLoadingAlumnos.set(true);
    try {
      await this.fetchAlumnos(cursoId);
    } catch (err) {
      this._error.set('Error al cargar alumnos del curso');
      this.toast.error('Error al cargar los datos del archivo');
    } finally {
      this._isLoadingAlumnos.set(false);
    }
  }

  // ── Fetch privados ──────────────────────────────────────────────────────────

  private async fetchPromociones(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('professional_promotions')
      .select('id, name, code, start_date, end_date, status')
      .eq('status', 'finished')
      .order('start_date', { ascending: false });

    if (error) {
      this._error.set('Error cargando promociones archivadas');
      return;
    }

    const opts: ArchivoPromocionOption[] = (data ?? []).map((p: any) => ({
      id: p.id as number,
      code: p.code as string,
      name: p.name as string,
      startDate: p.start_date as string,
      endDate: p.end_date as string | null,
      label: `${p.code} — ${p.name}`,
    }));

    this._promociones.set(opts);
  }

  private async fetchCursos(promoId: number): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('promotion_courses')
      .select('id, courses!inner(name, license_class)')
      .eq('promotion_id', promoId);

    if (error) {
      this.toast.error('Error cargando cursos de la promoción');
      return;
    }

    const opts: ArchivoCursoOption[] = (data ?? []).map((pc: any) => ({
      id: pc.id as number,
      courseName: pc.courses?.name ?? 'Curso',
      licenseClass: pc.courses?.license_class ?? 'A4',
      label: `${pc.courses?.name ?? 'Curso'} (${pc.courses?.license_class ?? ''})`,
    }));

    this._cursos.set(opts);
  }

  private async fetchAlumnos(promotionCourseId: number): Promise<void> {
    const branchId = this.branchFacade.selectedBranchId();

    // Step 1: Enrollments del curso
    let enrollmentQuery = this.supabase.client
      .from('enrollments')
      .select(
        `id, branch_id,
         students!inner(
           id,
           users!inner(first_names, paternal_last_name, maternal_last_name, rut)
         )`,
      )
      .eq('promotion_course_id', promotionCourseId)
      .eq('license_group', 'professional')
      .in('status', ['active', 'completed'])
      .order('id');

    if (branchId !== null) {
      enrollmentQuery = enrollmentQuery.eq('branch_id', branchId);
    }

    const { data: enrollments, error: enrollmentError } = await enrollmentQuery;
    if (enrollmentError) throw enrollmentError;
    if (!enrollments || enrollments.length === 0) {
      this._alumnos.set([]);
      return;
    }

    const enrollmentIds = (enrollments as any[]).map((e) => e.id as number);

    // Step 2: Sesiones completadas (para denominadores de asistencia)
    const [theorySessionsRes, practiceSessionsRes] = await Promise.all([
      this.supabase.client
        .from('professional_theory_sessions')
        .select('id')
        .eq('promotion_course_id', promotionCourseId)
        .eq('status', 'completed'),
      this.supabase.client
        .from('professional_practice_sessions')
        .select('id')
        .eq('promotion_course_id', promotionCourseId)
        .eq('status', 'completed'),
    ]);

    const theoryIds: number[] = (theorySessionsRes.data ?? []).map((s: any) => s.id as number);
    const practiceIds: number[] = (practiceSessionsRes.data ?? []).map((s: any) => s.id as number);

    // Step 3: Asistencia
    const [theoryAttRes, practiceAttRes] = await Promise.all([
      theoryIds.length > 0
        ? this.supabase.client
            .from('professional_theory_attendance')
            .select('enrollment_id, status')
            .in('theory_session_prof_id', theoryIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      practiceIds.length > 0
        ? this.supabase.client
            .from('professional_practice_attendance')
            .select('enrollment_id, status')
            .in('session_id', practiceIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    const theoryAtt: any[] = theoryAttRes.data ?? [];
    const practiceAtt: any[] = practiceAttRes.data ?? [];

    // Step 4: Notas de módulos (con module_number para indexar)
    const { data: moduleGradesData } = await this.supabase.client
      .from('professional_module_grades')
      .select('enrollment_id, module_number, grade, passed')
      .in('enrollment_id', enrollmentIds);

    // Map: enrollmentId → Map<moduleNumber, { grade, passed }>
    const gradesMap = new Map<
      number,
      Map<number, { grade: number | null; passed: boolean | null }>
    >();
    for (const g of (moduleGradesData ?? []) as any[]) {
      if (!gradesMap.has(g.enrollment_id)) {
        gradesMap.set(g.enrollment_id, new Map());
      }
      gradesMap.get(g.enrollment_id)!.set(g.module_number, {
        grade: g.grade !== null ? Number(g.grade) : null,
        passed: g.passed ?? null,
      });
    }

    // Step 5: Map DTO → ArchivoAlumnoRow
    const countPresent = (att: any[], enrollmentId: number): number =>
      att.filter((r) => r.enrollment_id === enrollmentId && r.status === 'present').length;

    const rows: ArchivoAlumnoRow[] = (enrollments as any[]).map((e) => {
      const student = e.students;
      const user = student.users;

      const nombre = [user.paternal_last_name, user.maternal_last_name, user.first_names]
        .filter(Boolean)
        .join(' ');

      const initials = nombre
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w: string) => w[0].toUpperCase())
        .join('');

      // Asistencia
      const teoriaAsistida = countPresent(theoryAtt, e.id);
      const practicaAsistida = countPresent(practiceAtt, e.id);
      const pctTeoria =
        theoryIds.length > 0 ? Math.round((teoriaAsistida / theoryIds.length) * 100) : null;
      const pctPractica =
        practiceIds.length > 0 ? Math.round((practicaAsistida / practiceIds.length) * 100) : null;

      // Notas por módulo
      const moduleGradeMap = gradesMap.get(e.id) ?? new Map();
      const notas: ArchivoNotaModulo[] = Array.from({ length: MODULE_COUNT }, (_, i) => {
        const mn = i + 1;
        const g = moduleGradeMap.get(mn);
        return {
          moduleNumber: mn,
          grade: g?.grade ?? null,
          passed: g?.passed ?? null,
        };
      });

      const gradeValues = notas.map((n) => n.grade);
      const notaPromedio = calcAverage(gradeValues);
      const promedioAprobado = notaPromedio !== null ? notaPromedio >= NOTA_PASS : null;

      const teoriaOk = pctTeoria !== null && pctTeoria >= PCT_TEORIA_MIN;
      const notaOk = promedioAprobado === true;
      const aprobado = teoriaOk && notaOk;

      return {
        enrollmentId: e.id,
        studentId: student.id,
        nombre,
        initials,
        rut: formatRut(user.rut ?? ''),
        teoriaAsistida,
        teoriaTotal: theoryIds.length,
        pctTeoria,
        practicaAsistida,
        practicaTotal: practiceIds.length,
        pctPractica,
        notas,
        notaPromedio,
        promedioAprobado,
        aprobado,
      };
    });

    rows.sort((a, b) => a.nombre.localeCompare(b.nombre));
    this._alumnos.set(rows);
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchPromociones();
    } catch {
      // datos stale siguen visibles
    }
  }
}
