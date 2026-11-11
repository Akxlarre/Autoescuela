import { Injectable, signal, computed, inject } from '@angular/core';
import { InstructorProfileFacade } from './instructor-profile.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { LayoutDrawerService } from '@core/services/ui/layout-drawer.service';
import type { Type } from '@angular/core';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { assertReadOk } from '@core/utils/db-error.utils';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import type {
  InstructorStudentCard,
  InstructorStudentDetail,
} from '@core/models/ui/instructor-portal.model';

@Injectable({
  providedIn: 'root',
})
export class InstructorAlumnosFacade {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private profileFacade = inject(InstructorProfileFacade);
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private layoutDrawer = inject(LayoutDrawerService);

  showSuccess(summary: string, detail?: string): void {
    this.toast.success(summary, detail);
  }

  showError(summary: string, detail?: string): void {
    this.toast.error(summary, detail);
  }

  openDrawer(component: Type<any>, title: string, icon?: string): void {
    this.layoutDrawer.open(component, title, icon);
  }

  closeDrawer(): void {
    this.layoutDrawer.close();
  }

  private _students = signal<InstructorStudentCard[]>([]);
  private _studentDetail = signal<InstructorStudentDetail | null>(null);
  /** Alumno seleccionado actualmente para detalle (Drawer) */
  private _activeStudent = signal<InstructorStudentCard | null>(null);

  private _isLoading = signal<boolean>(false);
  private _detailLoading = signal<boolean>(false);
  private _error = signal<string | null>(null);
  private _detailError = signal<string | null>(null);
  private _refreshFailed = signal<boolean>(false);
  private _initialized = false;

  private readonly listGuard = createRequestGuard();
  private readonly studentDetailGuard = createRequestGuard();

  readonly students = this._students.asReadonly();
  readonly studentDetail = this._studentDetail.asReadonly();
  readonly activeStudent = this._activeStudent.asReadonly();

  readonly isLoading = this._isLoading.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly detailError = this._detailError.asReadonly();
  readonly refreshFailed = this._refreshFailed.asReadonly();

  readonly kpis = computed(() => {
    const s = this._students();
    const activos = s.filter((x) => x.status === 'active').length;
    const completed = s.filter((x) => x.status === 'completed').length;
    const totalProg = s.reduce((acc, curr) => acc + curr.practicePercent, 0);
    const avgProg = s.length ? Math.round(totalProg / s.length) : 0;

    const porCertificar = s.filter((x) => x.practicePercent >= 100).length;

    return {
      totalAlumnos: s.length,
      activos: activos,
      completados: completed,
      promedioProgreso: avgProg,
      porCertificar,
    };
  });

  setActiveStudent(student: InstructorStudentCard | null): void {
    this._activeStudent.set(student);
  }

  async initialize(): Promise<void> {
    if (this._initialized) {
      await this.refreshSilently();
      return;
    }

    const requestToken = this.listGuard.next();
    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchStudents(requestToken);
      if (!this.listGuard.isCurrent(requestToken)) return;
      this._initialized = true;
    } catch {
      if (!this.listGuard.isCurrent(requestToken)) return;
      this._students.set([]);
      this._error.set('No se pudo cargar la lista de alumnos.');
    } finally {
      if (this.listGuard.isCurrent(requestToken)) {
        this._isLoading.set(false);
      }
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
    await this.initialize();
  }

  async refreshSilently(): Promise<void> {
    const requestToken = this.listGuard.next();
    try {
      await this.fetchStudents(requestToken);
      if (!this.listGuard.isCurrent(requestToken)) return;
      this._refreshFailed.set(false);
      this._error.set(null);
    } catch {
      if (!this.listGuard.isCurrent(requestToken)) return;
      this._refreshFailed.set(true);
    } finally {
      if (this.listGuard.isCurrent(requestToken)) {
        this._isLoading.set(false);
      }
    }
  }

  async fetchStudents(requestToken?: number): Promise<void> {
    const token = requestToken ?? this.listGuard.next();
    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return;

    const sessionRes = await this.supabase.client
      .from('class_b_sessions')
      .select('enrollment_id')
      .eq('instructor_id', instructorId);

    const sessionRows = assertReadOk(sessionRes);

    const enrollmentIds = [...new Set((sessionRows || []).map((r) => r.enrollment_id))];
    if (enrollmentIds.length === 0) {
      if (!this.listGuard.isCurrent(token)) return;
      this._students.set([]);
      return;
    }

    const [enrollmentResult, progressResult] = await Promise.all([
      this.supabase.client
        .from('enrollments')
        .select(
          `
          id, number, status, courses!inner(name, code),
          students!inner(
            id, users!inner(first_names, paternal_last_name, maternal_last_name, rut, email, phone)
          ),
          class_b_sessions(id, status, scheduled_at, class_number)
        `,
        )
        .in('id', enrollmentIds)
        .in('status', ['active', 'in_progress', 'completed']),
      this.supabase.client
        .from('v_student_progress_b')
        .select('enrollment_id, completed_practices')
        .in('enrollment_id', enrollmentIds),
    ]);

    const enrollmentRows = assertReadOk(enrollmentResult);
    const progressRows = assertReadOk(progressResult);

    const progressMap = new Map<number, { completed: number }>();
    for (const p of progressRows || []) {
      progressMap.set(p.enrollment_id, {
        completed: p.completed_practices || 0,
      });
    }

    const mappedStudents: InstructorStudentCard[] = [];

    for (const row of enrollmentRows || []) {
      const sessions = row.class_b_sessions || [];
      const progress = progressMap.get(row.id);
      const completed =
        progress?.completed ?? sessions.filter((s: any) => s.status === 'completed').length;
      const total = 12;
      const nextSession = sessions
        .filter((s: any) => s.status === 'scheduled')
        .sort(
          (a: any, b: any) =>
            new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
        )[0];

      const user = (row.students as any)?.users;

      mappedStudents.push({
        studentId: (row.students as any)?.id,
        enrollmentId: row.id,
        enrollmentNumber: (row as any).number ?? null,
        name: user
          ? `${user.first_names} ${user.paternal_last_name} ${user.maternal_last_name || ''}`.trim()
          : 'Unknown',
        rut: user?.rut || '',
        email: user?.email || null,
        phone: user?.phone || null,
        courseName: (row.courses as any)?.name || '',
        courseCode: (row.courses as any)?.code || '',
        practiceProgress: completed,
        totalSessions: total,
        practicePercent: Math.round((completed / total) * 100),
        theoryPercent: 0, // Asistencia teórica eliminada (Spec 0001 — Ciclos Teóricos)
        nextClassDate: nextSession ? nextSession.scheduled_at : null,
        status: row.status as any,
        statusLabel:
          row.status === 'active'
            ? 'Activo'
            : row.status === 'completed'
              ? 'Completado'
              : 'Suspendido',
        statusColor:
          row.status === 'active' ? 'success' : row.status === 'completed' ? 'info' : 'warning',
      });
    }

    if (!this.listGuard.isCurrent(token)) return;
    this._students.set(mappedStudents);
  }

  async loadStudentDetail(studentId: number): Promise<void> {
    // Caso A al cambiar de alumno: limpiar al inicio para nunca mostrar datos del alumno anterior
    this._studentDetail.set(null);
    this._detailError.set(null);
    this._detailLoading.set(true);

    const requestToken = this.studentDetailGuard.next();

    try {
      // `courses!inner` + el filtro por tipo: la Ficha Técnica del instructor son las 12
      // clases prácticas de Clase B, así que la pregunta no es "cuál es la matrícula
      // vigente del alumno" sino "cuál es su matrícula de Clase B" (fix-170-b).
      //
      // Sin el filtro tomaba la de id más alto: en un alumno que terminó Clase B y después
      // tomó Profesional —camino normal, la app tiene "Re-matricular"— agarraba la de
      // Profesional y pintaba las 12 clases B en blanco. El listado decía 3/12 y la ficha
      // del mismo alumno, 0%.
      //
      // El `order` se mantiene: entre varias matrículas de Clase B sigue ganando la más
      // reciente, que es el criterio que ya había.
      const enrollmentRes = await this.supabase.client
        .from('enrollments')
        .select(
          `
          id, status, courses!inner(name, code, type),
          students!inner(
            id, users!inner(first_names, paternal_last_name, rut, email, phone)
          )
        `,
        )
        .eq('student_id', studentId)
        .eq('courses.type', 'class_b')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      const enrollmentData = assertReadOk(enrollmentRes);

      if (enrollmentData) {
        const sessionsRes = await this.supabase.client
          .from('class_b_sessions')
          .select(
            `
            id, status, scheduled_at, class_number, evaluation_grade, km_start, km_end, notes,
            instructors!class_b_sessions_instructor_id_fkey(users(first_names, paternal_last_name)),
            vehicles(license_plate)
          `,
          )
          .eq('enrollment_id', enrollmentData.id)
          .order('class_number', { ascending: true });

        const sessions = assertReadOk(sessionsRes);

        const topicsRes = await this.supabase.client
          .from('class_b_topics')
          .select('*')
          .order('class_number', { ascending: true });

        const classTopicsResult = assertReadOk(topicsRes);
        const classTopics = (classTopicsResult ?? []) as any[];

        const user = (enrollmentData.students as any)?.users;
        const completed = (sessions || []).filter((s) => s.status === 'completed').length;

        const fichaData: any[] = [];
        for (let i = 1; i <= 12; i++) {
          const s = (sessions || []).find((x) => x.class_number === i);
          let instructorName = '';
          const inst = s ? (s.instructors as any) : null;
          if (inst && inst.users) {
            instructorName = `${inst.users.first_names} ${inst.users.paternal_last_name}`;
          }

          fichaData.push({
            sessionId: s ? s.id : 0,
            classNumber: i,
            date: s ? s.scheduled_at : null,
            status: s ? s.status : 'pending',
            grade: s ? s.evaluation_grade : null,
            kmStart: s ? s.km_start : null,
            kmEnd: s ? s.km_end : null,
            topic: (classTopics as any[]).find((t) => Number(t.class_number) === i)?.topic,
            instructorName,
            vehiclePlate: s?.vehicles ? (s.vehicles as any).license_plate : '',
            notes: s ? s.notes : null,
            canEvaluate: s ? s.status === 'completed' && !s.evaluation_grade : false,
          });
        }

        if (!this.studentDetailGuard.isCurrent(requestToken)) return;

        this._studentDetail.set({
          studentId: studentId,
          enrollmentId: enrollmentData.id,
          name: user ? `${user.first_names} ${user.paternal_last_name}` : 'Unknown',
          rut: user?.rut || '',
          phone: user?.phone || null,
          email: user?.email || null,
          courseCode: (enrollmentData.courses as any)?.code || '',
          courseName: (enrollmentData.courses as any)?.name || '',
          practiceProgress: completed,
          totalSessions: 12,
          theoryPercent: 0, // Asistencia teórica eliminada (Spec 0001 — Ciclos Teóricos)
          fichaTecnica: fichaData,
        });
      } else {
        if (!this.studentDetailGuard.isCurrent(requestToken)) return;
        this._studentDetail.set(null);
      }
    } catch {
      if (!this.studentDetailGuard.isCurrent(requestToken)) return;
      this._studentDetail.set(null);
      this._detailError.set('No se pudo cargar la ficha del alumno.');
    } finally {
      if (this.studentDetailGuard.isCurrent(requestToken)) {
        this._detailLoading.set(false);
      }
    }
  }
}
