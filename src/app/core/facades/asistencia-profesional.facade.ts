import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthFacade } from '@core/facades/auth.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import type {
  SesionProfesional,
  SesionAlumnoAsistencia,
  ResumenAlumnoAsistencia,
  PromocionOption,
  CursoOption,
  WeekDay,
  SesionTipo,
  SesionStatus,
  AsistenciaStatus,
  AlumnoFirmaSemana,
} from '@core/models/ui/sesion-profesional.model';

@Injectable({ providedIn: 'root' })
export class AsistenciaProfesionalFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthFacade);
  private readonly confirmModal = inject(ConfirmModalService);

  async confirm(config: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    severity?: 'info' | 'warn' | 'success' | 'danger' | 'secondary';
  }): Promise<boolean> {
    return this.confirmModal.confirm(config);
  }

  // ── Estado privado ──────────────────────────────────────────────────────────
  private readonly _promociones = signal<PromocionOption[]>([]);
  private readonly _cursos = signal<CursoOption[]>([]);
  private readonly _sesiones = signal<SesionProfesional[]>([]);
  private readonly _selectedPromocionId = signal<number | null>(null);
  private readonly _selectedCursoId = signal<number | null>(null);
  private readonly _weekOffset = signal(0);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Drawer state
  private readonly _selectedSesion = signal<SesionProfesional | null>(null);
  private readonly _asistenciaAlumnos = signal<SesionAlumnoAsistencia[]>([]);
  private readonly _isLoadingAsistencia = signal(false);
  private readonly _isSaving = signal(false);

  // Resumen general de asistencia por alumno
  private readonly _resumenAlumnos = signal<ResumenAlumnoAsistencia[]>([]);
  private readonly _isLoadingResumen = signal(false);

  // Firma semanal
  private readonly _firmasSemana = signal<AlumnoFirmaSemana[]>([]);
  private readonly _isLoadingFirmas = signal(false);

  private _initialized = false;

  // ── Estado público ──────────────────────────────────────────────────────────
  readonly promociones = this._promociones.asReadonly();
  readonly cursos = this._cursos.asReadonly();
  readonly sesiones = this._sesiones.asReadonly();
  readonly selectedPromocionId = this._selectedPromocionId.asReadonly();
  readonly selectedCursoId = this._selectedCursoId.asReadonly();
  readonly weekOffset = this._weekOffset.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selectedSesion = this._selectedSesion.asReadonly();
  readonly asistenciaAlumnos = this._asistenciaAlumnos.asReadonly();
  readonly isLoadingAsistencia = this._isLoadingAsistencia.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly resumenAlumnos = this._resumenAlumnos.asReadonly();
  readonly isLoadingResumen = this._isLoadingResumen.asReadonly();
  readonly firmasSemana = this._firmasSemana.asReadonly();
  readonly isLoadingFirmas = this._isLoadingFirmas.asReadonly();

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  private readonly sesionesSemanales = computed(() => {
    const days = this.weekDays();
    const allSessions: import('@core/models/ui/sesion-profesional.model').SesionProfesional[] = [];
    for (const day of days) {
      if (day.theory) allSessions.push(day.theory);
      if (day.practice) allSessions.push(day.practice);
    }
    return allSessions;
  });

  /** Alumnos inscritos en el curso seleccionado */
  readonly alumnosMatriculados = computed(() => {
    const s = this._sesiones();
    return s.length > 0 ? s[0].enrolledCount : 0;
  });

  /** % asistencia de la semana visible (solo sesiones completadas) */
  readonly pctAsistenciaSemanal = computed(() => {
    const completadas = this.sesionesSemanales().filter((s) => s.status === 'completed');
    const enrolled = this.alumnosMatriculados();
    if (completadas.length === 0 || enrolled === 0) return 0;
    const totalAtt = completadas.reduce((sum, s) => sum + s.attendanceCount, 0);
    return Math.round((totalAtt / (completadas.length * enrolled)) * 100);
  });

  /** % asistencia acumulada total del curso (solo sesiones completadas) */
  readonly pctAsistenciaTotal = computed(() => {
    const completadas = this._sesiones().filter((s) => s.status === 'completed');
    const enrolled = this.alumnosMatriculados();
    if (completadas.length === 0 || enrolled === 0) return 0;
    const totalAtt = completadas.reduce((sum, s) => sum + s.attendanceCount, 0);
    return Math.round((totalAtt / (completadas.length * enrolled)) * 100);
  });

  /** Total de sesiones canceladas (feriados u otras razones) */
  readonly sesionesCanceladas = computed(
    () => this._sesiones().filter((s) => s.status === 'cancelled').length,
  );

  // ── Semana actual ───────────────────────────────────────────────────────────
  readonly weekDays = computed<WeekDay[]>(() => {
    const sesiones = this._sesiones();
    const monday = this.getMondayForOffset(this._weekOffset());
    const today = this.formatDateIso(new Date());
    const days: WeekDay[] = [];

    for (let i = 0; i < 6; i++) {
      // Lun-Sáb
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const dateStr = this.formatDateIso(d);
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const monthNames = [
        'Ene',
        'Feb',
        'Mar',
        'Abr',
        'May',
        'Jun',
        'Jul',
        'Ago',
        'Sep',
        'Oct',
        'Nov',
        'Dic',
      ];

      days.push({
        date: dateStr,
        label: `${d.getDate()} ${monthNames[d.getMonth()]}`,
        dayLabel: dayNames[d.getDay()],
        isToday: dateStr === today,
        theory: sesiones.find((s) => s.date === dateStr && s.tipo === 'theory') ?? null,
        practice: sesiones.find((s) => s.date === dateStr && s.tipo === 'practice') ?? null,
      });
    }
    return days;
  });

  readonly isCurrentWeek = computed(() => this._weekOffset() === 0);

  /** Fecha ISO del lunes de la semana visible (usado para firma semanal) */
  readonly weekStartDate = computed(() => this.weekDays()[0]?.date ?? null);

  /** Cuántos alumnos firmaron sobre el total matriculado en la semana visible */
  readonly firmasSemanaCount = computed(() => ({
    firmaron: this._firmasSemana().filter((a) => a.signatureId !== null).length,
    total: this._firmasSemana().length,
  }));

  readonly weekLabel = computed(() => {
    const days = this.weekDays();
    if (days.length === 0) return '';
    return `${days[0].label} – ${days[days.length - 1].label}`;
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
      await this.loadPromociones();
    } finally {
      this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.loadPromociones();
      if (this._selectedPromocionId() && this._selectedCursoId()) {
        await this.fetchSesiones();
      }
    } catch {
      // datos stale siguen visibles
    }
  }

  // ── Carga de promociones ────────────────────────────────────────────────────
  private async loadPromociones(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('professional_promotions')
      .select('id, name, code, status')
      .in('status', ['in_progress', 'planned'])
      .order('start_date', { ascending: false });

    if (error) throw error;
    this._promociones.set(
      (data ?? []).map((p) => ({
        id: p.id,
        name: p.name ?? '',
        code: p.code ?? '',
        status: p.status ?? '',
      })),
    );

    // Auto-select first in_progress or first available
    if (!this._selectedPromocionId() && data && data.length > 0) {
      const active = data.find((p) => p.status === 'in_progress') ?? data[0];
      await this.selectPromocion(active.id);
    }
  }

  // ── Selección de promoción → cargar cursos ────────────────────────────────
  async selectPromocion(promoId: number): Promise<void> {
    this._selectedPromocionId.set(promoId);
    this._selectedCursoId.set(null);
    this._sesiones.set([]);
    this._cursos.set([]);

    const { data, error } = await this.supabase.client
      .from('promotion_courses')
      .select('id, course_id, courses!inner ( code, name )')
      .eq('promotion_id', promoId)
      .order('course_id');

    if (error) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cursos = (data as any[]).map((pc) => ({
      id: pc.id,
      courseCode: this.extractLicenseCode(pc.courses.code),
      courseName: pc.courses.name,
    }));
    this._cursos.set(cursos);

    // Auto-select first course
    if (cursos.length > 0) {
      await this.selectCurso(cursos[0].id);
    }
  }

  // ── Selección de curso → cargar sesiones + resumen ───────────────────────
  async selectCurso(cursoId: number): Promise<void> {
    this._selectedCursoId.set(cursoId);
    this._resumenAlumnos.set([]);
    this._firmasSemana.set([]);
    this._isLoading.set(true);
    try {
      await this.fetchSesiones();
      void this.fetchResumenAlumnos(cursoId);
      void this.fetchFirmasSemana();
    } finally {
      this._isLoading.set(false);
    }
  }

  // ── Navegación semanal ──────────────────────────────────────────────────────
  nextWeek(): void {
    this._weekOffset.update((v) => v + 1);
  }

  prevWeek(): void {
    this._weekOffset.update((v) => v - 1);
  }

  goToCurrentWeek(): void {
    this._weekOffset.set(0);
  }

  // ── Fetch sesiones ──────────────────────────────────────────────────────────
  private async fetchSesiones(): Promise<void> {
    const cursoId = this._selectedCursoId();
    if (!cursoId) return;

    // Fetch theory + practice sessions in parallel
    const [theoryRes, practiceRes] = await Promise.all([
      this.supabase.client
        .from('professional_theory_sessions')
        .select('id, date, status, notes, zoom_link')
        .eq('promotion_course_id', cursoId)
        .order('date'),
      this.supabase.client
        .from('professional_practice_sessions')
        .select('id, date, status, notes')
        .eq('promotion_course_id', cursoId)
        .order('date'),
    ]);

    if (theoryRes.error || practiceRes.error) {
      this._error.set('Error al cargar sesiones');
      return;
    }

    // Count attendance per session in parallel
    const theoryIds = (theoryRes.data ?? []).map((s) => s.id);
    const practiceIds = (practiceRes.data ?? []).map((s) => s.id);

    const [theoryAttRes, practiceAttRes, enrolledRes] = await Promise.all([
      theoryIds.length > 0
        ? this.supabase.client
            .from('professional_theory_attendance')
            .select('theory_session_prof_id')
            .in('theory_session_prof_id', theoryIds)
        : Promise.resolve({ data: [], error: null }),
      practiceIds.length > 0
        ? this.supabase.client
            .from('professional_practice_attendance')
            .select('session_id')
            .in('session_id', practiceIds)
        : Promise.resolve({ data: [], error: null }),
      this.supabase.client
        .from('enrollments')
        .select('id')
        .eq('promotion_course_id', cursoId)
        .not('status', 'in', '("cancelled","draft")'),
    ]);

    const enrolledCount = enrolledRes.data?.length ?? 0;

    // Count attendance per theory session
    const theoryAttCounts: Record<number, number> = {};
    for (const row of (theoryAttRes.data ?? []) as any[]) {
      theoryAttCounts[row.theory_session_prof_id] =
        (theoryAttCounts[row.theory_session_prof_id] ?? 0) + 1;
    }

    // Count attendance per practice session
    const practiceAttCounts: Record<number, number> = {};
    for (const row of (practiceAttRes.data ?? []) as any[]) {
      practiceAttCounts[row.session_id] = (practiceAttCounts[row.session_id] ?? 0) + 1;
    }

    const cursoCode = this._cursos().find((c) => c.id === cursoId)?.courseCode ?? '';

    const sesiones: SesionProfesional[] = [
      ...(theoryRes.data ?? []).map((s) =>
        this.mapSesion(s, 'theory', cursoId, cursoCode, theoryAttCounts[s.id] ?? 0, enrolledCount),
      ),
      ...(practiceRes.data ?? []).map((s) =>
        this.mapSesion(
          s,
          'practice',
          cursoId,
          cursoCode,
          practiceAttCounts[s.id] ?? 0,
          enrolledCount,
        ),
      ),
    ];

    this._sesiones.set(sesiones);
  }

  // ── Seleccionar sesión → cargar asistencia ────────────────────────────────
  async selectSesion(sesion: SesionProfesional): Promise<void> {
    this._selectedSesion.set(sesion);
    this._asistenciaAlumnos.set([]);
    this._isLoadingAsistencia.set(true);

    try {
      // Get enrolled students for this course
      const { data: enrollments, error: enrollError } = await this.supabase.client
        .from('enrollments')
        .select(
          `id, student_id,
           students!inner (
             id,
             users!inner ( first_names, paternal_last_name, maternal_last_name, rut )
           )`,
        )
        .eq('promotion_course_id', sesion.promotionCourseId)
        .not('status', 'in', '("cancelled","draft")');

      if (enrollError) throw enrollError;

      // Get existing attendance records for this session
      let existingAttendance: Record<
        number,
        { id: number; status: string; justification: string | null }
      > = {};

      if (sesion.tipo === 'theory') {
        const { data: att } = await this.supabase.client
          .from('professional_theory_attendance')
          .select('id, enrollment_id, status, justification')
          .eq('theory_session_prof_id', sesion.id);
        for (const row of (att ?? []) as any[]) {
          existingAttendance[row.enrollment_id] = {
            id: row.id,
            status: row.status,
            justification: row.justification,
          };
        }
      } else {
        const { data: att } = await this.supabase.client
          .from('professional_practice_attendance')
          .select('id, enrollment_id, status, justification')
          .eq('session_id', sesion.id);
        for (const row of (att ?? []) as any[]) {
          existingAttendance[row.enrollment_id] = {
            id: row.id,
            status: row.status,
            justification: row.justification,
          };
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const alumnos: SesionAlumnoAsistencia[] = (enrollments as any[]).map((e) => {
        const u = e.students?.users;
        const nombre = [u?.paternal_last_name, u?.maternal_last_name, u?.first_names]
          .filter(Boolean)
          .join(' ');
        const parts = nombre.trim().split(' ');
        const initials = parts
          .filter((_: string, i: number) => i === 0 || i === parts.length - 1)
          .map((p: string) => p[0]?.toUpperCase() ?? '')
          .join('');
        const att = existingAttendance[e.id];

        return {
          attendanceId: att?.id ?? null,
          enrollmentId: e.id,
          studentId: e.student_id,
          nombre,
          rut: u?.rut ?? '',
          initials: initials || '?',
          status: (att?.status as AsistenciaStatus) ?? null,
          justification: att?.justification ?? null,
        };
      });

      this._asistenciaAlumnos.set(alumnos.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch {
      this._asistenciaAlumnos.set([]);
      this.toast.error('Error al cargar asistencia');
    } finally {
      this._isLoadingAsistencia.set(false);
    }
  }

  clearSelectedSesion(): void {
    this._selectedSesion.set(null);
    this._asistenciaAlumnos.set([]);
  }

  // ── Guardar asistencia ──────────────────────────────────────────────────────
  async guardarAsistencia(
    registros: {
      enrollmentId: number;
      studentId: number;
      status: AsistenciaStatus;
      attendanceId: number | null;
    }[],
  ): Promise<boolean> {
    const sesion = this._selectedSesion();
    if (!sesion) return false;

    this._isSaving.set(true);
    try {
      const toInsert = registros.filter((r) => !r.attendanceId);
      const toUpdate = registros.filter((r) => r.attendanceId);

      if (sesion.tipo === 'theory') {
        if (toInsert.length > 0) {
          const { error } = await this.supabase.client
            .from('professional_theory_attendance')
            .insert(
              toInsert.map((r) => ({
                theory_session_prof_id: sesion.id,
                enrollment_id: r.enrollmentId,
                status: r.status,
              })),
            );
          if (error) throw error;
        }
        for (const r of toUpdate) {
          const { error } = await this.supabase.client
            .from('professional_theory_attendance')
            .update({ status: r.status })
            .eq('id', r.attendanceId!);
          if (error) throw error;
        }
      } else {
        if (toInsert.length > 0) {
          const { error } = await this.supabase.client
            .from('professional_practice_attendance')
            .insert(
              toInsert.map((r) => ({
                session_id: sesion.id,
                enrollment_id: r.enrollmentId,
                status: r.status,
                block_percentage: 100,
              })),
            );
          if (error) throw error;
        }
        for (const r of toUpdate) {
          const { error } = await this.supabase.client
            .from('professional_practice_attendance')
            .update({ status: r.status })
            .eq('id', r.attendanceId!);
          if (error) throw error;
        }
      }

      // Auto-completar sesión si estaba programada y se está registrando asistencia
      if (sesion.status === 'scheduled') {
        const table =
          sesion.tipo === 'theory'
            ? 'professional_theory_sessions'
            : 'professional_practice_sessions';
        await this.supabase.client.from(table).update({ status: 'completed' }).eq('id', sesion.id);
      }

      this.toast.success('Asistencia guardada correctamente');
      const cursoId = this._selectedCursoId()!;
      await Promise.all([this.fetchSesiones(), this.fetchResumenAlumnos(cursoId)]);
      await this.selectSesion(sesion);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar asistencia';
      this.toast.error(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  // ── Editar sesión (cambiar fecha o status) ────────────────────────────────
  async editarSesion(
    sesion: SesionProfesional,
    payload: { date?: string; status?: SesionStatus; notes?: string },
  ): Promise<boolean> {
    this._isSaving.set(true);
    try {
      const table =
        sesion.tipo === 'theory'
          ? 'professional_theory_sessions'
          : 'professional_practice_sessions';

      const updateData: Record<string, unknown> = {};
      if (payload.date !== undefined) updateData['date'] = payload.date;
      if (payload.status !== undefined) updateData['status'] = payload.status;
      if (payload.notes !== undefined) updateData['notes'] = payload.notes;

      const { error } = await this.supabase.client
        .from(table)
        .update(updateData)
        .eq('id', sesion.id);

      if (error) throw error;

      // Al cancelar, eliminar registros de asistencia para que no distorsionen estadísticas
      if (payload.status === 'cancelled') {
        const attTable =
          sesion.tipo === 'theory'
            ? 'professional_theory_attendance'
            : 'professional_practice_attendance';
        const fkCol = sesion.tipo === 'theory' ? 'theory_session_prof_id' : 'session_id';
        await this.supabase.client.from(attTable).delete().eq(fkCol, sesion.id);
      }

      this.toast.success('Sesión actualizada');
      const cursoId = this._selectedCursoId();
      await this.fetchSesiones();
      if (cursoId) await this.fetchResumenAlumnos(cursoId);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al editar sesión';
      this.toast.error(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  // ── Resumen de asistencia por alumno ─────────────────────────────────────
  async fetchResumenAlumnos(cursoId: number): Promise<void> {
    this._isLoadingResumen.set(true);
    try {
      // 1. Alumnos inscritos
      const { data: enrollments, error: enrollError } = await this.supabase.client
        .from('enrollments')
        .select(
          `id, student_id,
           students!inner (
             id,
             users!inner ( first_names, paternal_last_name, maternal_last_name, rut )
           )`,
        )
        .eq('promotion_course_id', cursoId)
        .not('status', 'in', '("cancelled","draft")');

      if (enrollError) throw enrollError;

      // 2. Sesiones completadas del curso
      const [theoryRes, practiceRes] = await Promise.all([
        this.supabase.client
          .from('professional_theory_sessions')
          .select('id')
          .eq('promotion_course_id', cursoId)
          .eq('status', 'completed'),
        this.supabase.client
          .from('professional_practice_sessions')
          .select('id')
          .eq('promotion_course_id', cursoId)
          .eq('status', 'completed'),
      ]);

      const theoryIds = (theoryRes.data ?? []).map((s: any) => s.id);
      const practiceIds = (practiceRes.data ?? []).map((s: any) => s.id);

      // 3. Registros de asistencia (solo sesiones completadas)
      const [theoryAttRes, practiceAttRes] = await Promise.all([
        theoryIds.length > 0
          ? this.supabase.client
              .from('professional_theory_attendance')
              .select('enrollment_id, status')
              .in('theory_session_prof_id', theoryIds)
          : Promise.resolve({ data: [], error: null }),
        practiceIds.length > 0
          ? this.supabase.client
              .from('professional_practice_attendance')
              .select('enrollment_id, status')
              .in('session_id', practiceIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      // 4. Contar presentes por alumno (via enrollment_id)
      const countPresent = (rows: any[], enrollmentId: number): number =>
        (rows ?? []).filter((r) => r.enrollment_id === enrollmentId && r.status === 'present')
          .length;

      const resumen: ResumenAlumnoAsistencia[] = (enrollments as any[]).map((e) => {
        const u = e.students?.users;
        const nombre = [u?.paternal_last_name, u?.maternal_last_name, u?.first_names]
          .filter(Boolean)
          .join(' ');
        const parts = nombre.trim().split(' ');
        const initials = parts
          .filter((_: string, i: number) => i === 0 || i === parts.length - 1)
          .map((p: string) => p[0]?.toUpperCase() ?? '')
          .join('');

        const teoriaAsistida = countPresent(theoryAttRes.data as any[], e.id);
        const practicaAsistida = countPresent(practiceAttRes.data as any[], e.id);
        const totalAsistida = teoriaAsistida + practicaAsistida;
        const totalSesiones = theoryIds.length + practiceIds.length;
        const pctTeoria =
          theoryIds.length > 0 ? Math.round((teoriaAsistida / theoryIds.length) * 100) : 0;
        const pctPractica =
          practiceIds.length > 0 ? Math.round((practicaAsistida / practiceIds.length) * 100) : 0;
        const pctAsistencia =
          totalSesiones > 0 ? Math.round((totalAsistida / totalSesiones) * 100) : 0;

        return {
          studentId: e.student_id,
          nombre,
          rut: u?.rut ?? '',
          initials: initials || '?',
          teoriaAsistida,
          teoriaTotal: theoryIds.length,
          practicaAsistida,
          practicaTotal: practiceIds.length,
          totalAsistida,
          totalSesiones,
          pctTeoria,
          pctPractica,
          pctAsistencia,
        };
      });

      this._resumenAlumnos.set(resumen.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch {
      this._resumenAlumnos.set([]);
    } finally {
      this._isLoadingResumen.set(false);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private extractLicenseCode(code: string): string {
    const m = code.match(/[Aa]([2-5])/);
    return m ? `A${m[1]}` : code.slice(0, 4).toUpperCase();
  }

  private getStatusLabel(status: string | null): string {
    const labels: Record<string, string> = {
      scheduled: 'Programada',
      in_progress: 'En curso',
      completed: 'Completada',
      cancelled: 'Cancelada',
    };
    return labels[status ?? ''] ?? 'Sin estado';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapSesion(
    s: any,
    tipo: SesionTipo,
    promotionCourseId: number,
    courseCode: string,
    attendanceCount: number,
    enrolledCount: number,
  ): SesionProfesional {
    return {
      id: s.id,
      tipo,
      date: s.date,
      status: (s.status as SesionStatus) ?? 'scheduled',
      statusLabel: this.getStatusLabel(s.status),
      promotionCourseId,
      courseCode,
      attendanceCount,
      enrolledCount,
      notes: s.notes ?? null,
      zoomLink: s.zoom_link ?? null,
    };
  }

  private getMondayForOffset(offset: number): Date {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff + offset * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  private formatDateIso(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  // ── Firma semanal ───────────────────────────────────────────────────────────

  async fetchFirmasSemana(): Promise<void> {
    const cursoId = this._selectedCursoId();
    const weekStart = this.weekStartDate();
    if (!cursoId || !weekStart) return;

    const weekDays = this.weekDays();
    const weekEnd = weekDays[weekDays.length - 1]?.date ?? weekStart;

    this._isLoadingFirmas.set(true);
    try {
      const [enrollRes, sigRes, theorySessionsRes] = await Promise.all([
        this.supabase.client
          .from('enrollments')
          .select(
            `id, student_id,
             students!inner (
               id,
               users!inner ( first_names, paternal_last_name, maternal_last_name, rut )
             )`,
          )
          .eq('promotion_course_id', cursoId)
          .not('status', 'in', '("cancelled","draft")'),

        this.supabase.client
          .from('professional_weekly_signatures')
          .select('id, enrollment_id, signed_at')
          .eq('promotion_course_id', cursoId)
          .eq('week_start_date', weekStart),

        this.supabase.client
          .from('professional_theory_sessions')
          .select('id')
          .eq('promotion_course_id', cursoId)
          .gte('date', weekStart)
          .lte('date', weekEnd)
          .eq('status', 'completed'),
      ]);

      const theoryIds = (theorySessionsRes.data ?? []).map((s: any) => s.id);

      const theoryAttData =
        theoryIds.length > 0
          ? ((
              await this.supabase.client
                .from('professional_theory_attendance')
                .select('enrollment_id, status')
                .in('theory_session_prof_id', theoryIds)
            ).data ?? [])
          : [];

      // Mapa: enrollment_id → firma
      const sigMap: Record<number, { id: number; signedAt: string }> = {};
      for (const sig of (sigRes.data ?? []) as any[]) {
        sigMap[sig.enrollment_id] = { id: sig.id, signedAt: sig.signed_at };
      }

      const result: AlumnoFirmaSemana[] = ((enrollRes.data ?? []) as any[]).map((e) => {
        const u = e.students?.users;
        const nombre = [u?.paternal_last_name, u?.maternal_last_name, u?.first_names]
          .filter(Boolean)
          .join(' ');
        const parts = nombre.trim().split(' ');
        const initials = parts
          .filter((_: string, i: number) => i === 0 || i === parts.length - 1)
          .map((p: string) => p[0]?.toUpperCase() ?? '')
          .join('');

        const presentThisWeek = (theoryAttData as any[]).filter(
          (r) => r.enrollment_id === e.id && r.status === 'present',
        ).length;
        const pctTeoriaSemana =
          theoryIds.length > 0 ? Math.round((presentThisWeek / theoryIds.length) * 100) : 0;

        const sig = sigMap[e.id];
        return {
          enrollmentId: e.id,
          studentId: e.student_id,
          nombre,
          rut: u?.rut ?? '',
          initials: initials || '?',
          signatureId: sig?.id ?? null,
          signedAt: sig?.signedAt ?? null,
          pctTeoriaSemana,
        };
      });

      this._firmasSemana.set(result.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch {
      this._firmasSemana.set([]);
    } finally {
      this._isLoadingFirmas.set(false);
    }
  }

  async registrarFirmas(enrollmentIds: number[]): Promise<boolean> {
    const cursoId = this._selectedCursoId();
    const weekStart = this.weekStartDate();
    if (!cursoId || !weekStart || enrollmentIds.length === 0) return false;

    const recordedBy = this.auth.currentUser()?.dbId;
    if (!recordedBy) {
      this.toast.error('No se pudo identificar al usuario actual');
      return false;
    }

    this._isSaving.set(true);
    try {
      const { error } = await this.supabase.client.from('professional_weekly_signatures').insert(
        enrollmentIds.map((eid) => ({
          promotion_course_id: cursoId,
          enrollment_id: eid,
          week_start_date: weekStart,
          recorded_by: recordedBy,
        })),
      );

      if (error) throw error;

      this.toast.success(
        `${enrollmentIds.length} firma${enrollmentIds.length > 1 ? 's' : ''} registrada${enrollmentIds.length > 1 ? 's' : ''}`,
      );
      await this.fetchFirmasSemana();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar firmas';
      this.toast.error(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }
}
