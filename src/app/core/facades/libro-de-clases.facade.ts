import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { BranchFacade } from '@core/facades/branch.facade';
import type { PromocionOption, CursoOption } from '@core/models/ui/sesion-profesional.model';
import type {
  LibroCabecera,
  ProfesorModulo,
  AlumnoLibro,
  SemanaAsistencia,
  AlumnoAsistenciaSemanal,
  FilaEvaluacionLibro,
  ResumenAsistenciaLibro,
  ClaseCalendario,
} from '@core/models/ui/libro-de-clases.model';
import type { AsistenciaStatus } from '@core/models/ui/sesion-profesional.model';
import { getModuleNames, calcAverage, MODULE_COUNT } from '@core/utils/professional-modules';

@Injectable({ providedIn: 'root' })
export class LibroDeClasesFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly branchFacade = inject(BranchFacade);

  // ── Estado privado ──────────────────────────────────────────────────────────
  private readonly _promociones = signal<PromocionOption[]>([]);
  private readonly _cursos = signal<CursoOption[]>([]);
  private readonly _selectedPromocionId = signal<number | null>(null);
  private readonly _selectedCursoId = signal<number | null>(null);
  private readonly _cabecera = signal<LibroCabecera | null>(null);
  private readonly _profesores = signal<ProfesorModulo[]>([]);
  private readonly _alumnos = signal<AlumnoLibro[]>([]);
  private readonly _asistenciaSemanal = signal<SemanaAsistencia[]>([]);
  private readonly _evaluaciones = signal<FilaEvaluacionLibro[]>([]);
  private readonly _resumenAsistencia = signal<ResumenAsistenciaLibro[]>([]);
  private readonly _calendario = signal<ClaseCalendario[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isLoadingSections = signal(false);
  private readonly _isSaving = signal(false);
  private readonly _isExporting = signal(false);
  private readonly _error = signal<string | null>(null);

  private _initialized = false;

  // ── Estado público ──────────────────────────────────────────────────────────
  readonly promociones = this._promociones.asReadonly();
  readonly cursos = this._cursos.asReadonly();
  readonly selectedPromocionId = this._selectedPromocionId.asReadonly();
  readonly selectedCursoId = this._selectedCursoId.asReadonly();
  readonly cabecera = this._cabecera.asReadonly();
  readonly profesores = this._profesores.asReadonly();
  readonly alumnos = this._alumnos.asReadonly();
  readonly asistenciaSemanal = this._asistenciaSemanal.asReadonly();
  readonly evaluaciones = this._evaluaciones.asReadonly();
  readonly resumenAsistencia = this._resumenAsistencia.asReadonly();
  readonly calendario = this._calendario.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isLoadingSections = this._isLoadingSections.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly isExporting = this._isExporting.asReadonly();
  readonly error = this._error.asReadonly();

  /** Indica si hay un curso seleccionado y tiene datos cargados */
  readonly hasDatos = computed(() => this._cabecera() !== null);

  /** Total de alumnos inscritos */
  readonly totalAlumnos = computed(() => this._alumnos().length);

  // ── SWR ─────────────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this._initialized) {
      void this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    try {
      await this.loadPromociones();
    } finally {
      this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.loadPromociones();
      if (this._selectedCursoId()) {
        await this.loadAllSections(this._selectedCursoId()!);
      }
    } catch {
      // datos stale siguen visibles
    }
  }

  // ── Carga de promociones ────────────────────────────────────────────────────

  private async loadPromociones(): Promise<void> {
    const branchId = this.branchFacade.selectedBranchId();

    let query = this.supabase.client
      .from('professional_promotions')
      .select('id, name, code, status')
      .in('status', ['in_progress', 'planned', 'finished'])
      .order('start_date', { ascending: false });

    if (branchId !== null) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) {
      this._error.set('Error cargando promociones');
      return;
    }

    this._promociones.set(
      (data ?? []).map((p) => ({
        id: p.id,
        name: p.name ?? p.code ?? `Promoción #${p.id}`,
        code: p.code ?? '',
        status: p.status ?? '',
      })),
    );

    // Auto-select active promotion
    if (!this._selectedPromocionId() && data && data.length > 0) {
      const active = data.find((p) => p.status === 'in_progress') ?? data[0];
      await this.selectPromocion(active.id);
    }
  }

  // ── Selección de promoción → cursos ─────────────────────────────────────────

  async selectPromocion(promoId: number): Promise<void> {
    this._selectedPromocionId.set(promoId);
    this._selectedCursoId.set(null);
    this._cursos.set([]);
    this.clearSections();

    const { data, error } = await this.supabase.client
      .from('promotion_courses')
      .select('id, courses!inner(code, name, license_class)')
      .eq('promotion_id', promoId)
      .order('course_id');

    if (error) return;

    const cursos = (data as any[]).map((pc) => ({
      id: pc.id,
      courseCode: this.extractLicenseCode(pc.courses.code),
      courseName: pc.courses.name,
    }));
    this._cursos.set(cursos);

    if (cursos.length > 0) {
      await this.selectCurso(cursos[0].id);
    }
  }

  // ── Selección de curso → cargar TODAS las secciones ────────────────────────

  async selectCurso(promotionCourseId: number): Promise<void> {
    this._selectedCursoId.set(promotionCourseId);
    this._isLoadingSections.set(true);
    this._error.set(null);

    try {
      await this.loadAllSections(promotionCourseId);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Error cargando libro de clases');
    } finally {
      this._isLoadingSections.set(false);
    }
  }

  private async loadAllSections(promotionCourseId: number): Promise<void> {
    // Cabecera + alumnos primero (evaluaciones y resumen dependen de _alumnos)
    await this.loadCabecera(promotionCourseId);
    const licenseClass = this._cabecera()?.licenseClass ?? 'A2';
    await this.loadAlumnos(promotionCourseId, licenseClass);

    // Cargar el resto en paralelo (ya tienen _alumnos disponible)
    await Promise.all([
      this.loadProfesores(promotionCourseId, licenseClass),
      this.loadAsistenciaSemanal(promotionCourseId),
      this.loadEvaluaciones(promotionCourseId, licenseClass),
      this.loadResumenAsistencia(promotionCourseId),
      this.loadCalendario(promotionCourseId),
    ]);
  }

  // ── Cabecera ────────────────────────────────────────────────────────────────

  private async loadCabecera(promotionCourseId: number): Promise<void> {
    // Cargar datos del curso y del libro en paralelo
    const [pcRes, cbRes] = await Promise.all([
      this.supabase.client
        .from('promotion_courses')
        .select(
          `id,
           courses!inner(name, code, license_class),
           professional_promotions!inner(name, code, start_date, end_date, status,
             branches(name, address)
           )`,
        )
        .eq('id', promotionCourseId)
        .single(),
      this.supabase.client
        .from('class_book')
        .select('id, sence_code, horario')
        .eq('promotion_course_id', promotionCourseId)
        .maybeSingle(),
    ]);

    if (pcRes.error || !pcRes.data) throw new Error('Curso no encontrado');

    const course = (pcRes.data as any).courses;
    const promo = (pcRes.data as any).professional_promotions;
    const branch = promo.branches;
    const classBook = cbRes.data;

    this._cabecera.set({
      promotionName: promo.name ?? promo.code,
      promotionCode: promo.code ?? '',
      courseName: course.name,
      courseCode: course.code,
      licenseClass: course.license_class,
      startDate: promo.start_date,
      endDate: promo.end_date ?? '',
      branchName: branch?.name ?? '',
      branchAddress: branch?.address ?? '',
      status: promo.status ?? '',
      classBookId: classBook?.id ?? null,
      senceCode: classBook?.sence_code ?? '',
      horario: classBook?.horario ?? '',
    });
  }

  // ── Profesores por módulo ───────────────────────────────────────────────────

  private async loadProfesores(promotionCourseId: number, licenseClass: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('promotion_course_lecturers')
      .select('lecturer_id, role, lecturers!inner(first_names, paternal_last_name)')
      .eq('promotion_course_id', promotionCourseId);

    if (error) return;

    const moduleNames = getModuleNames(licenseClass);

    // Map lecturers — en el PDF hay 8 módulos (1-7 + Conducción separada),
    // pero en la BD hay 7 módulos. Los relatores se asignan por curso, no por módulo.
    // Mostramos la lista de módulos con los relatores disponibles.
    const lecturers = (data as any[]).map((row) => ({
      name: `${row.lecturers.first_names} ${row.lecturers.paternal_last_name}`,
      role: row.role as string | null,
    }));

    const profesores: ProfesorModulo[] = moduleNames.map((modName, i) => ({
      moduleNumber: i + 1,
      moduleName: modName,
      lecturerName: this.pickLecturerForModule(lecturers, i + 1),
    }));

    this._profesores.set(profesores);
  }

  /**
   * Asigna el relator más apropiado al módulo según su rol.
   * Módulo 6 (Conducción) → prefiere 'practice'; resto → prefiere 'theory' o 'both'.
   */
  private pickLecturerForModule(
    lecturers: { name: string; role: string | null }[],
    moduleNumber: number,
  ): string {
    if (lecturers.length === 0) return '—';
    if (lecturers.length === 1) return lecturers[0].name;

    const preferredRole = moduleNumber === 6 ? 'practice' : 'theory';
    const match =
      lecturers.find((l) => l.role === preferredRole) ??
      lecturers.find((l) => l.role === 'both') ??
      lecturers[0];

    return match.name;
  }

  // ── Lista de alumnos ────────────────────────────────────────────────────────

  private async loadAlumnos(promotionCourseId: number, licenseClass: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('enrollments')
      .select(
        `id,
         students!inner(
           users!inner(first_names, paternal_last_name, maternal_last_name, rut, phone)
         )`,
      )
      .eq('promotion_course_id', promotionCourseId)
      .not('status', 'in', '("cancelled","draft")')
      .order('id');

    if (error) return;

    const alumnos: AlumnoLibro[] = (data as any[]).map((e) => {
      const u = e.students.users;
      const nombre = [u.paternal_last_name, u.maternal_last_name, u.first_names]
        .filter(Boolean)
        .join(' ');

      return {
        numero: 0,
        enrollmentId: e.id,
        nombre,
        rut: u.rut ?? '',
        telefono: u.phone ?? '',
        licenciaPostulada: licenseClass,
      };
    });

    alumnos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    alumnos.forEach((a, i) => (a.numero = i + 1));

    this._alumnos.set(alumnos);
  }

  // ── Asistencia semanal ──────────────────────────────────────────────────────

  private async loadAsistenciaSemanal(promotionCourseId: number): Promise<void> {
    // 1. Sesiones teóricas del curso (todas)
    const { data: sesiones, error: sesError } = await this.supabase.client
      .from('professional_theory_sessions')
      .select('id, date')
      .eq('promotion_course_id', promotionCourseId)
      .order('date');

    if (sesError || !sesiones || sesiones.length === 0) {
      this._asistenciaSemanal.set([]);
      return;
    }

    const sessionIds = sesiones.map((s) => s.id);

    // 2. Asistencia + firmas en paralelo
    const [attRes, firmasRes] = await Promise.all([
      this.supabase.client
        .from('professional_theory_attendance')
        .select('theory_session_prof_id, enrollment_id, status')
        .in('theory_session_prof_id', sessionIds),
      this.supabase.client
        .from('professional_weekly_signatures')
        .select('enrollment_id, week_start_date, signed_at')
        .eq('promotion_course_id', promotionCourseId),
    ]);

    // Build attendance map: sessionId → enrollmentId → status
    const attMap = new Map<string, AsistenciaStatus>();
    for (const row of (attRes.data ?? []) as any[]) {
      attMap.set(`${row.theory_session_prof_id}-${row.enrollment_id}`, row.status);
    }

    // Build signatures set: "enrollmentId-weekStartDate"
    const sigSet = new Set<string>();
    for (const row of (firmasRes.data ?? []) as any[]) {
      if (row.signed_at) sigSet.add(`${row.enrollment_id}-${row.week_start_date}`);
    }

    // 3. Agrupar sesiones por semana (lunes a sábado)
    const alumnos = this._alumnos();
    const weekMap = new Map<string, { sessions: typeof sesiones; monday: string }>();

    for (const s of sesiones) {
      const monday = this.getMondayForDate(s.date);
      if (!weekMap.has(monday)) {
        weekMap.set(monday, { sessions: [], monday });
      }
      weekMap.get(monday)!.sessions.push(s);
    }

    const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const semanas: SemanaAsistencia[] = [];
    let weekNum = 0;

    for (const [monday, { sessions }] of weekMap) {
      weekNum++;

      // Generate 6 days (Mon-Sat)
      const dias: { date: string; dayLabel: string }[] = [];
      for (let i = 0; i < 6; i++) {
        const d = new Date(monday + 'T12:00:00');
        d.setDate(d.getDate() + i);
        dias.push({
          date: this.formatDateIso(d),
          dayLabel: dayLabels[i],
        });
      }

      const alumnosAsistencia: AlumnoAsistenciaSemanal[] = alumnos.map((a) => {
        const asistenciaDias: (AsistenciaStatus | null)[] = dias.map((dia) => {
          const session = sessions.find((s) => s.date === dia.date);
          if (!session) return null;
          return attMap.get(`${session.id}-${a.enrollmentId}`) ?? null;
        });

        return {
          enrollmentId: a.enrollmentId,
          nombre: a.nombre,
          asistenciaDias,
          firmaSemanal: sigSet.has(`${a.enrollmentId}-${monday}`),
        };
      });

      const lastDay = dias[dias.length - 1];
      semanas.push({
        weekNumber: weekNum,
        weekLabel: `Semana ${weekNum} (${this.formatShortDate(monday)} – ${this.formatShortDate(lastDay.date)})`,
        weekStartDate: monday,
        dias,
        alumnos: alumnosAsistencia,
      });
    }

    this._asistenciaSemanal.set(semanas);
  }

  // ── Evaluaciones ────────────────────────────────────────────────────────────

  private async loadEvaluaciones(promotionCourseId: number, licenseClass: string): Promise<void> {
    const alumnos = this._alumnos();
    const enrollmentIds = alumnos.map((a) => a.enrollmentId);
    if (enrollmentIds.length === 0) {
      this._evaluaciones.set([]);
      return;
    }

    const { data, error } = await this.supabase.client
      .from('professional_module_grades')
      .select('enrollment_id, module_number, grade, passed, status')
      .in('enrollment_id', enrollmentIds);

    if (error) {
      this._evaluaciones.set([]);
      return;
    }

    // Agrupar notas por enrollment
    const gradesMap = new Map<number, Map<number, number | null>>();
    for (const row of (data ?? []) as any[]) {
      if (!gradesMap.has(row.enrollment_id)) {
        gradesMap.set(row.enrollment_id, new Map());
      }
      gradesMap.get(row.enrollment_id)!.set(row.module_number, row.grade);
    }

    const filas: FilaEvaluacionLibro[] = alumnos.map((a) => {
      const grades = gradesMap.get(a.enrollmentId);
      const notas: (number | null)[] = Array.from(
        { length: MODULE_COUNT },
        (_, i) => grades?.get(i + 1) ?? null,
      );
      const notaFinal = calcAverage(notas);

      return {
        nombre: a.nombre,
        rut: a.rut,
        notas,
        notaFinal,
        aprobado: notaFinal !== null && notaFinal >= 75,
      };
    });

    this._evaluaciones.set(filas);
  }

  // ── Resumen de asistencia ───────────────────────────────────────────────────

  private async loadResumenAsistencia(promotionCourseId: number): Promise<void> {
    const alumnos = this._alumnos();
    if (alumnos.length === 0) {
      this._resumenAsistencia.set([]);
      return;
    }

    // Sesiones completadas del curso
    const [theoryRes, practiceRes] = await Promise.all([
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

    const theoryIds = (theoryRes.data ?? []).map((s: any) => s.id);
    const practiceIds = (practiceRes.data ?? []).map((s: any) => s.id);

    // Registros de asistencia
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

    const countPresent = (rows: any[], enrollmentId: number): number =>
      (rows ?? []).filter((r) => r.enrollment_id === enrollmentId && r.status === 'present').length;

    const resumen: ResumenAsistenciaLibro[] = alumnos.map((a) => {
      const teoriaAsistida = countPresent(theoryAttRes.data as any[], a.enrollmentId);
      const practicaAsistida = countPresent(practiceAttRes.data as any[], a.enrollmentId);
      const pctTeoria =
        theoryIds.length > 0 ? Math.round((teoriaAsistida / theoryIds.length) * 100) : 0;
      const pctPractica =
        practiceIds.length > 0 ? Math.round((practicaAsistida / practiceIds.length) * 100) : 0;

      return { nombre: a.nombre, pctPractica, pctTeorica: pctTeoria };
    });

    this._resumenAsistencia.set(resumen);
  }

  // ── Calendario de clases ────────────────────────────────────────────────────

  private async loadCalendario(promotionCourseId: number): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('professional_theory_sessions')
      .select('id, date, status')
      .eq('promotion_course_id', promotionCourseId)
      .order('date');

    if (error || !data) {
      this._calendario.set([]);
      return;
    }

    // Los relatores ya están cargados en _profesores
    const profesores = this._profesores();
    const defaultProfesor = profesores.length > 0 ? profesores[0].lecturerName : '—';

    const calendario: ClaseCalendario[] = data
      .filter((s) => s.status !== 'cancelled')
      .map((s, i) => ({
        numero: i + 1,
        fecha: s.date,
        asignatura: 'Clase Teórica',
        horas: 5,
        profesor: defaultProfesor,
      }));

    this._calendario.set(calendario);
  }

  // ── Campos editables (Código SENCE, Horario) ────────────────────────────────

  async saveClassBookFields(senceCode: string, horario: string): Promise<boolean> {
    const cabecera = this._cabecera();
    const promotionCourseId = this._selectedCursoId();
    if (!cabecera || !promotionCourseId) return false;

    this._isSaving.set(true);
    try {
      if (cabecera.classBookId) {
        // UPDATE existente
        const { error } = await this.supabase.client
          .from('class_book')
          .update({ sence_code: senceCode, horario })
          .eq('id', cabecera.classBookId);
        if (error) throw error;
      } else {
        // INSERT nuevo registro
        const branchId = this.branchFacade.selectedBranchId();
        const { data, error } = await this.supabase.client
          .from('class_book')
          .insert({
            branch_id: branchId,
            promotion_course_id: promotionCourseId,
            period: cabecera.promotionCode,
            status: 'draft',
            sence_code: senceCode,
            horario,
          })
          .select('id')
          .single();
        if (error) throw error;

        // Actualizar cabecera con el nuevo ID
        this._cabecera.set({ ...cabecera, classBookId: data.id, senceCode, horario });
        this.toast.success('Datos del libro guardados');
        return true;
      }

      // Actualizar cabecera local
      this._cabecera.set({ ...cabecera, senceCode, horario });
      this.toast.success('Datos del libro guardados');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      this.toast.error(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  // ── Exportar PDF ─────────────────────────────────────────────────────────────

  async exportPdf(): Promise<string | null> {
    const promotionCourseId = this._selectedCursoId();
    if (!promotionCourseId) return null;

    this._isExporting.set(true);
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 45_000);
    try {
      const { data, error } = await this.supabase.client.functions.invoke(
        'generate-class-book-pdf',
        { body: { promotion_course_id: promotionCourseId }, signal: abort.signal },
      );

      if (error) {
        const msg = error instanceof Error ? error.message : JSON.stringify(error);
        this.toast.error(`Error al generar PDF: ${msg}`);
        return null;
      }

      const pdfUrl = (data as { pdfUrl?: string } | null)?.pdfUrl ?? null;
      if (!pdfUrl) {
        const serverErr = (data as { error?: string } | null)?.error;
        this.toast.error(
          serverErr ? `Error del servidor: ${serverErr}` : 'El servidor no devolvió una URL de PDF',
        );
        return null;
      }

      const cabecera = this._cabecera();
      const promo = (cabecera?.promotionName ?? 'Promocion')
        .replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '')
        .trim();
      const curso = (cabecera?.courseName ?? 'Curso').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim();
      const fileName = `LibroDeClases_${promo}_${curso}.pdf`;

      const blob = await fetch(pdfUrl, { cache: 'no-store' }).then((r) => r.blob());
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(objectUrl);
      this.toast.success('PDF generado correctamente');
      return pdfUrl;
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      this.toast.error(
        isAbort
          ? 'La generación del PDF tardó demasiado. Intenta nuevamente.'
          : `Error inesperado: ${err instanceof Error ? err.message : 'desconocido'}`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
      this._isExporting.set(false);
    }
  }

  // ── Reset ───────────────────────────────────────────────────────────────────

  reset(): void {
    this._initialized = false;
    this._promociones.set([]);
    this._cursos.set([]);
    this._selectedPromocionId.set(null);
    this._selectedCursoId.set(null);
    this.clearSections();
  }

  private clearSections(): void {
    this._cabecera.set(null);
    this._profesores.set([]);
    this._alumnos.set([]);
    this._asistenciaSemanal.set([]);
    this._evaluaciones.set([]);
    this._resumenAsistencia.set([]);
    this._calendario.set([]);
    this._error.set(null);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private extractLicenseCode(code: string): string {
    const m = code.match(/[Aa]([2-5])/);
    return m ? `A${m[1]}` : code.slice(0, 4).toUpperCase();
  }

  private getMondayForDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return this.formatDateIso(d);
  }

  private formatDateIso(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  private formatShortDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }
}
