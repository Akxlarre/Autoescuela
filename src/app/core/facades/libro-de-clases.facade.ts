import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import type { PromocionOption, CursoOption } from '@core/models/ui/sesion-profesional.model';
import type {
  ConvalidationLicense,
  LibroCabecera,
  LibroOption,
  ProfesorModulo,
  AlumnoLibro,
  SemanaAsistencia,
  AlumnoAsistenciaSemanal,
  FilaEvaluacionLibro,
  ResumenAsistenciaLibro,
  ClaseCalendario,
} from '@core/models/ui/libro-de-clases.model';
import type { AsistenciaStatus } from '@core/models/ui/sesion-profesional.model';
import { getModuleNames } from '@core/utils/professional-modules';
import {
  CONVALIDATION_BOOKS,
  buildBookOptions,
  buildConvalidationBookId,
  getConvalidationBookName,
  getConvalidationModuleNames,
  parseBookKey,
  selectConvalidationDates,
} from '@core/utils/convalidation-book.utils';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

/** Sesión teórica del curso: solo fecha + status (define la grilla, nunca contenido). */
type SesionTeorica = { id: number; date: string; status: string | null };

@Injectable({ providedIn: 'root' })
export class LibroDeClasesFacade {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly branchFacade = inject(BranchFacade);
  private readonly auth = inject(AuthFacade);

  // ── Estado privado ──────────────────────────────────────────────────────────
  private readonly _promociones = signal<PromocionOption[]>([]);
  private readonly _cursos = signal<CursoOption[]>([]);
  private readonly _selectedPromocionId = signal<number | null>(null);
  private readonly _selectedCursoId = signal<number | null>(null);
  /** spec 0018-m: libro de convalidación seleccionado (null = libro normal del curso). */
  private readonly _selectedConvalidation = signal<ConvalidationLicense | null>(null);
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
  /** promotion_course del libro seleccionado (en convalidación, el del curso madre). */
  readonly selectedCursoId = this._selectedCursoId.asReadonly();
  readonly selectedConvalidation = this._selectedConvalidation.asReadonly();
  /** spec 0018-m: los libros del selector — cursos de la promoción + Conv. A-3 / Conv. A-4. */
  readonly libros = computed<LibroOption[]>(() => buildBookOptions(this._cursos()));
  /** Clave del libro seleccionado (`LibroOption.key`), o null. */
  readonly selectedLibroKey = computed<string | null>(() => {
    const id = this._selectedCursoId();
    if (id === null) return null;
    const conv = this._selectedConvalidation();
    return conv ? `${id}:${conv}` : String(id);
  });
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

  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }

  private async loadPromociones(): Promise<void> {
    const branchId = this.getActiveBranchId();

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
    this._selectedConvalidation.set(null);
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

  /** Libro normal de un curso. Equivale a `selectLibro(String(promotionCourseId))`. */
  async selectCurso(promotionCourseId: number): Promise<void> {
    await this.selectLibro(String(promotionCourseId));
  }

  /**
   * spec 0018-m: selecciona un libro por su `LibroOption.key` — un curso (`"12"`) o un libro de
   * convalidación colgado de su curso madre (`"12:A4"`). Una clave inválida no cambia nada.
   */
  async selectLibro(key: string): Promise<void> {
    const parsed = parseBookKey(key);
    if (!parsed) return;
    const { promotionCourseId, convalidation } = parsed;

    this._selectedCursoId.set(promotionCourseId);
    this._selectedConvalidation.set(convalidation);
    this._isLoadingSections.set(true);
    this._error.set(null);

    try {
      await this.loadAllSections(promotionCourseId);
    } catch (err) {
      this._error.set(
        err instanceof Error
          ? this.sanitizer.sanitize(err).message
          : 'Error cargando libro de clases',
      );
    } finally {
      this._isLoadingSections.set(false);
    }
  }

  private async loadAllSections(promotionCourseId: number): Promise<void> {
    const conv = this._selectedConvalidation();

    // Sesiones teóricas del curso (en convalidación, las del curso madre). Solo definen la
    // grilla de semanas/días y el calendario; en convalidación se acotan al tramo final
    // (spec 0018-m: últimas N fechas activas).
    const sesiones = await this.fetchSesionesTeoricas(promotionCourseId);
    const tramo = conv
      ? selectConvalidationDates(sesiones, CONVALIDATION_BOOKS[conv].sessionDays)
      : null;
    const sesionesLibro =
      tramo === null
        ? sesiones
        : tramo.length === 0
          ? []
          : sesiones.filter((s) => s.date >= tramo[0] && s.date <= tramo[tramo.length - 1]);

    // Cabecera + alumnos primero (evaluaciones y resumen dependen de _alumnos)
    await this.loadCabecera(promotionCourseId, conv, tramo);
    const licenseClass = this._cabecera()?.licenseClass ?? 'A2';
    await this.loadAlumnos(promotionCourseId, licenseClass, conv);

    // Cargar el resto en paralelo (ya tienen _alumnos disponible)
    this.loadEvaluaciones();
    this.loadResumenAsistencia();
    this.loadAsistenciaSemanal(sesionesLibro);
    await this.loadProfesores(promotionCourseId, conv);
    this.loadCalendario(sesionesLibro);
  }

  private async fetchSesionesTeoricas(promotionCourseId: number): Promise<SesionTeorica[]> {
    const { data, error } = await this.supabase.client
      .from('professional_theory_sessions')
      .select('id, date, status')
      .eq('promotion_course_id', promotionCourseId)
      .order('date');
    if (error || !data) return [];
    return data as SesionTeorica[];
  }

  // ── Cabecera ────────────────────────────────────────────────────────────────

  private async loadCabecera(
    promotionCourseId: number,
    conv: ConvalidationLicense | null,
    tramo: string[] | null,
  ): Promise<void> {
    // spec 0018-m: cada libro (normal o de convalidación) tiene su propia fila en class_book.
    const classBookQuery = this.supabase.client
      .from('class_book')
      .select(
        `id, sence_code, sence_code_updated_at,
         sence_code_updater:users!class_book_sence_code_updated_by_fkey(first_names, paternal_last_name)`,
      )
      .eq('promotion_course_id', promotionCourseId);
    const classBookByBook = conv
      ? classBookQuery.eq('convalidation_license', conv)
      : classBookQuery.is('convalidation_license', null);

    // Cargar datos del curso y del libro en paralelo
    const [pcRes, cbRes] = await Promise.all([
      this.supabase.client
        .from('promotion_courses')
        .select(
          `id, code,
           courses!inner(name, code, license_class),
           professional_promotions!inner(name, code, start_date, end_date, status,
             branches(name, address)
           )`,
        )
        .eq('id', promotionCourseId)
        .single(),
      classBookByBook.maybeSingle(),
    ]);

    if (pcRes.error || !pcRes.data) throw new Error('Curso no encontrado');

    const course = (pcRes.data as any).courses;
    const promo = (pcRes.data as any).professional_promotions;
    const branch = promo.branches;
    const classBook = cbRes.data as any;
    const updater = classBook?.sence_code_updater;
    const promotionCode: string = promo.code ?? '';

    // spec 0018-m: el libro de convalidación tiene su propio nombre, ID (código de la promoción
    // + sufijo .6/.7), clase (la licencia que se convalida), 5 asignaturas y fechas del tramo.
    this._cabecera.set({
      convalidation: conv,
      moduleNames: conv ? getConvalidationModuleNames(conv) : getModuleNames(course.license_class),
      promotionName: promo.name ?? promo.code,
      promotionCode,
      courseName: conv ? getConvalidationBookName(conv) : course.name,
      bookId: conv
        ? buildConvalidationBookId(promotionCode, conv)
        : ((pcRes.data as any).code ?? ''),
      licenseClass: conv ?? course.license_class,
      startDate: tramo ? (tramo[0] ?? '') : promo.start_date,
      endDate: tramo ? (tramo[tramo.length - 1] ?? '') : (promo.end_date ?? ''),
      branchName: branch?.name ?? '',
      branchAddress: branch?.address ?? '',
      status: promo.status ?? '',
      classBookId: classBook?.id ?? null,
      senceCode: classBook?.sence_code ?? '',
      senceCodeUpdatedByName: updater
        ? `${updater.first_names} ${updater.paternal_last_name}`
        : null,
      senceCodeUpdatedAt: classBook?.sence_code_updated_at ?? null,
    });
  }

  // ── Profesores por módulo ───────────────────────────────────────────────────

  private async loadProfesores(
    promotionCourseId: number,
    conv: ConvalidationLicense | null,
  ): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('promotion_course_lecturers')
      .select('lecturer_id, role, lecturers!inner(first_names, paternal_last_name)')
      .eq('promotion_course_id', promotionCourseId);

    if (error) return;

    const moduleNames = this._cabecera()?.moduleNames ?? [];
    // Número de módulo real de cada asignatura (Conducción = 6 también en convalidación).
    const moduleNumbers = conv
      ? CONVALIDATION_BOOKS[conv].moduleIndexes.map((i) => i + 1)
      : moduleNames.map((_, i) => i + 1);

    // Map lecturers — en el PDF hay 8 módulos (1-7 + Conducción separada),
    // pero en la BD hay 7 módulos. Los relatores se asignan por curso, no por módulo.
    // Mostramos la lista de módulos con los relatores disponibles.
    const lecturers = (data as any[]).map((row) => ({
      name: `${row.lecturers.first_names} ${row.lecturers.paternal_last_name}`,
      role: row.role as string | null,
    }));

    const profesores: ProfesorModulo[] = moduleNames.map((modName, i) => ({
      moduleNumber: moduleNumbers[i],
      moduleName: modName,
      lecturerName: this.pickLecturerForModule(lecturers, moduleNumbers[i]),
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

  private async loadAlumnos(
    promotionCourseId: number,
    licenseClass: string,
    conv: ConvalidationLicense | null,
  ): Promise<void> {
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

    // spec 0018-m: en el libro de convalidación solo van los alumnos del curso madre que
    // convalidan esa licencia. En el libro normal siguen apareciendo todos (AC3).
    let rows = data as any[];
    if (conv && rows.length > 0) {
      const { data: lv, error: lvError } = await this.supabase.client
        .from('license_validations')
        .select('enrollment_id')
        .eq('convalidated_license', conv)
        .in(
          'enrollment_id',
          rows.map((e) => e.id),
        );
      if (lvError) throw new Error('Error cargando convalidaciones');
      const convIds = new Set(((lv ?? []) as { enrollment_id: number }[]).map((r) => r.enrollment_id));
      rows = rows.filter((e) => convIds.has(e.id));
    }

    const alumnos: AlumnoLibro[] = rows.map((e) => {
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
  // fix-250-m: el Libro de Clases es una plantilla imprimible, no un reflejo de la
  // asistencia ya registrada en la vista digital — la grilla de semanas/días se arma
  // desde las sesiones (para el layout de impresión), pero las marcas de asistencia y
  // la firma semanal NO se precargan desde professional_theory_attendance /
  // professional_weekly_signatures (quedan vacías para llenarse a mano tras imprimir).

  /** `sesiones`: las del libro (en convalidación, solo las del tramo — spec 0018-m). */
  private loadAsistenciaSemanal(sesiones: SesionTeorica[]): void {
    if (sesiones.length === 0) {
      this._asistenciaSemanal.set([]);
      return;
    }

    // Agrupar sesiones por semana (lunes a sábado)
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

    for (const [monday] of weekMap) {
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

      // Cada día de la semana queda vacío (null = a llenar a mano tras imprimir).
      const alumnosAsistencia: AlumnoAsistenciaSemanal[] = alumnos.map((a) => {
        const asistenciaDias: (AsistenciaStatus | null)[] = dias.map(() => null);

        return {
          enrollmentId: a.enrollmentId,
          nombre: a.nombre,
          asistenciaDias,
          firmaSemanal: false,
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

  // fix-250-m: no se precargan notas desde professional_module_grades — el Libro de
  // Clases solo trae los nombres de alumnos, notas vacías para llenarse a mano.
  private loadEvaluaciones(): void {
    const alumnos = this._alumnos();
    // 7 asignaturas en un libro normal, 5 en convalidación (spec 0018-m).
    const moduleCount = this._cabecera()?.moduleNames.length ?? 0;
    const notasVacias: (number | null)[] = Array.from({ length: moduleCount }, () => null);

    const filas: FilaEvaluacionLibro[] = alumnos.map((a) => ({
      nombre: a.nombre,
      rut: a.rut,
      notas: [...notasVacias],
      notaFinal: null,
      aprobado: false,
    }));

    this._evaluaciones.set(filas);
  }

  // ── Resumen de asistencia ───────────────────────────────────────────────────

  // fix-250-m: no se precargan porcentajes desde professional_theory_attendance /
  // professional_practice_attendance — solo los nombres, listos para completarse a mano.
  private loadResumenAsistencia(): void {
    const resumen: ResumenAsistenciaLibro[] = this._alumnos().map((a) => ({
      nombre: a.nombre,
      pctPractica: null,
      pctTeorica: null,
    }));

    this._resumenAsistencia.set(resumen);
  }

  // ── Calendario de clases ────────────────────────────────────────────────────

  /** `sesiones`: las del libro (en convalidación, solo las del tramo — spec 0018-m). */
  private loadCalendario(sesiones: SesionTeorica[]): void {
    // Los relatores ya están cargados en _profesores
    const profesores = this._profesores();
    const defaultProfesor = profesores.length > 0 ? profesores[0].lecturerName : '—';

    const calendario: ClaseCalendario[] = sesiones
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

  // ── Campos editables (Código SENCE) ─────────────────────────────────────────

  async saveClassBookFields(senceCode: string): Promise<boolean> {
    const cabecera = this._cabecera();
    const promotionCourseId = this._selectedCursoId();
    if (!cabecera || !promotionCourseId) return false;

    // El código SENCE es un dato oficial fiscalizable (RF-103): registrar quién lo cambió
    // y cuándo, pero solo si efectivamente cambió.
    const codeChanged = senceCode !== cabecera.senceCode;
    const updatedByDbId = this.auth.currentUser()?.dbId ?? null;
    const nowIso = new Date().toISOString();
    const auditFields = codeChanged
      ? { sence_code_updated_by: updatedByDbId, sence_code_updated_at: nowIso }
      : {};
    const auditPatch = codeChanged
      ? {
          senceCodeUpdatedByName: this.auth.currentUser()?.name ?? null,
          senceCodeUpdatedAt: nowIso,
        }
      : {};

    this._isSaving.set(true);
    try {
      if (cabecera.classBookId) {
        // UPDATE existente
        const { error } = await this.supabase.client
          .from('class_book')
          .update({ sence_code: senceCode, ...auditFields })
          .eq('id', cabecera.classBookId);
        if (error) throw error;
      } else {
        // INSERT nuevo registro
        const branchId = this.getActiveBranchId();
        const { data, error } = await this.supabase.client
          .from('class_book')
          .insert({
            branch_id: branchId,
            promotion_course_id: promotionCourseId,
            // spec 0018-m: fila propia por libro (null = libro normal del curso).
            convalidation_license: cabecera.convalidation,
            period: cabecera.promotionCode,
            status: 'draft',
            sence_code: senceCode,
            ...auditFields,
          })
          .select('id')
          .single();
        if (error) throw error;

        // Actualizar cabecera con el nuevo ID
        this._cabecera.set({
          ...cabecera,
          classBookId: data.id,
          senceCode,
          ...auditPatch,
        });
        this.toast.success('Datos del libro guardados');
        return true;
      }

      // Actualizar cabecera local
      this._cabecera.set({ ...cabecera, senceCode, ...auditPatch });
      this.toast.success('Datos del libro guardados');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? this.sanitizer.sanitize(err).message : 'Error al guardar';
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
        {
          // spec 0018-m: en convalidación va el curso madre + la licencia convalidada.
          body: {
            promotion_course_id: promotionCourseId,
            convalidation: this._selectedConvalidation(),
          },
          signal: abort.signal,
        },
      );

      if (error) {
        const msg =
          error instanceof Error ? this.sanitizer.sanitize(error).message : JSON.stringify(error);
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
          : `Error inesperado: ${err instanceof Error ? this.sanitizer.sanitize(err).message : 'desconocido'}`,
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
    this._selectedConvalidation.set(null);
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
