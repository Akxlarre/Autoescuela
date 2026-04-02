import { Injectable, signal, computed, inject } from '@angular/core';
import { InstructorProfileFacade } from './instructor-profile.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type {
  InstructorStudentCard,
  InstructorStudentDetail,
  ExamScoreRow,
  RegisterExamPayload,
} from '@core/models/ui/instructor-portal.model';

@Injectable({
  providedIn: 'root',
})
export class InstructorAlumnosFacade {
  private profileFacade = inject(InstructorProfileFacade);
  private supabase = inject(SupabaseService);

  private _students = signal<InstructorStudentCard[]>([]);
  private _studentDetail = signal<InstructorStudentDetail | null>(null);
  /** Alumno seleccionado actualmente para detalle (Drawer) */
  private _activeStudent = signal<InstructorStudentCard | null>(null);
  
  private _examScores = signal<ExamScoreRow[]>([]);

  private _isLoading = signal<boolean>(false);
  private _detailLoading = signal<boolean>(false);
  private _examLoading = signal<boolean>(false);
  private _error = signal<string | null>(null);
  private _initialized = false;

  readonly students = this._students.asReadonly();
  readonly studentDetail = this._studentDetail.asReadonly();
  readonly activeStudent = this._activeStudent.asReadonly();
  readonly examScores = this._examScores.asReadonly();

  readonly isLoading = this._isLoading.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly examLoading = this._examLoading.asReadonly();
  readonly error = this._error.asReadonly();

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

    this._isLoading.set(true);
    await this.fetchStudents();
    this._isLoading.set(false);
    this._initialized = true;
  }

  async fetchStudents(): Promise<void> {
    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return;

    this._error.set(null);
    try {
      const { data: sessionRows, error: sessionError } = await this.supabase.client
        .from('class_b_sessions')
        .select('enrollment_id')
        .eq('instructor_id', instructorId);

      if (sessionError) throw sessionError;

      const enrollmentIds = [...new Set((sessionRows || []).map((r) => r.enrollment_id))];
      if (enrollmentIds.length === 0) {
        this._students.set([]);
        return;
      }

      const [enrollmentResult, progressResult] = await Promise.all([
        this.supabase.client
          .from('enrollments')
          .select(
            `
            id, status, courses!inner(name, code),
            students!inner(
              id, users!inner(first_names, paternal_last_name, rut, email, phone)
            ),
            class_b_sessions(id, status, scheduled_at, class_number)
          `,
          )
          .in('id', enrollmentIds)
          .in('status', ['active', 'in_progress', 'completed']),
        this.supabase.client
          .from('v_student_progress_b')
          .select('enrollment_id, completed_practices, pct_theory_attendance')
          .in('enrollment_id', enrollmentIds),
      ]);

      if (enrollmentResult.error) throw enrollmentResult.error;

      const progressMap = new Map<number, { completed: number; theoryPct: number }>();
      for (const p of progressResult.data || []) {
        progressMap.set(p.enrollment_id, {
          completed: p.completed_practices || 0,
          theoryPct: p.pct_theory_attendance || 0,
        });
      }

      const mappedStudents: InstructorStudentCard[] = [];

      for (const row of enrollmentResult.data || []) {
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
          name: user ? `${user.first_names} ${user.paternal_last_name}` : 'Unknown',
          rut: user?.rut || '',
          email: user?.email || null,
          phone: user?.phone || null,
          courseName: (row.courses as any)?.name || '',
          courseCode: (row.courses as any)?.code || '',
          practiceProgress: completed,
          totalSessions: total,
          practicePercent: Math.round((completed / total) * 100),
          theoryPercent: progress?.theoryPct ?? 0,
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

      this._students.set(mappedStudents);
    } catch (err: any) {
      console.error('Error fetching students:', err);
      this._error.set(err.message || 'Error cargando alumnos');
    }
  }

  async loadStudentDetail(studentId: number): Promise<void> {
    this._error.set(null);
    this._detailLoading.set(true);

    try {
      const { data: enrollmentData, error: e1 } = await this.supabase.client
        .from('enrollments')
        .select(
          `
          id, status, courses(name, code),
          students!inner(
            id, users!inner(first_names, paternal_last_name, rut, email, phone)
          )
        `,
        )
        .eq('student_id', studentId)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (e1) throw e1;

      if (enrollmentData) {
        const { data: sessions, error: e2 } = await this.supabase.client
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

        if (e2) throw e2;

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
            instructorName,
            vehiclePlate: s?.vehicles ? (s.vehicles as any).license_plate : '',
            notes: s ? s.notes : null,
            canEvaluate: s ? s.status === 'completed' && !s.evaluation_grade : false,
          });
        }

        const { data: progressData } = await this.supabase.client
          .from('v_student_progress_b')
          .select('pct_theory_attendance')
          .eq('enrollment_id', enrollmentData.id)
          .maybeSingle();

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
          theoryPercent: progressData?.pct_theory_attendance ?? 0,
          fichaTecnica: fichaData,
        });
      } else {
        this._studentDetail.set(null);
      }
    } catch (err: any) {
      console.error(err);
      this._error.set(err.message || 'Error cargando detalle');
    } finally {
      this._detailLoading.set(false);
    }
  }

  async loadExamScores(): Promise<void> {
    this._error.set(null);
    this._examLoading.set(true);
    try {
      const enrollmentIds = this._students().map((s) => s.enrollmentId);
      if (enrollmentIds.length === 0) {
        this._examScores.set([]);
        this._examLoading.set(false);
        return;
      }

      const { data, error } = await this.supabase.client
        .from('class_b_exam_scores')
        .select(
          `
          id, score, date, passed,
          students!inner(id, users!inner(first_names, paternal_last_name, rut)),
          enrollments(id)
        `,
        )
        .in('enrollment_id', enrollmentIds)
        .order('date', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((row) => {
        const u = (row.students as any)?.users;
        return {
          id: row.id,
          studentName: u ? `${u.first_names} ${u.paternal_last_name}` : '',
          studentRut: u?.rut || '',
          enrollmentId: (row.enrollments as any)?.id || 0,
          date: row.date,
          score: row.score,
          passed: row.passed,
          passedLabel: row.passed ? 'Aprobado' : 'Reprobado',
          scoreColor: row.passed ? 'success' : 'error',
        } as ExamScoreRow;
      });

      this._examScores.set(mapped);
    } catch (err: any) {
      console.error(err);
      this._error.set(err.message || 'Error cargando ensayos');
    } finally {
      this._examLoading.set(false);
    }
  }

  async registerExamScore(payload: RegisterExamPayload): Promise<void> {
    try {
      const { error } = await this.supabase.client.from('class_b_exam_scores').insert({
        student_id: payload.studentId,
        enrollment_id: payload.enrollmentId,
        date: payload.date || new Date().toISOString(),
        score: payload.score,
        passed: payload.score >= 87,
      });

      if (error) throw error;
      await this.loadExamScores();
    } catch (err: any) {
      throw err;
    }
  }

  async refreshSilently(): Promise<void> {
    await this.fetchStudents();
  }

  async fetchTheoryAttendance(): Promise<any[]> {
    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return [];

    try {
      const { data, error } = await this.supabase.client
        .from('class_b_theory_attendance')
        .select(
          `
          id, status,
          class_b_theory_sessions!inner(id, scheduled_at, topic, instructor_id),
          students!inner(id, users!inner(first_names, paternal_last_name, rut))
        `,
        )
        .eq('class_b_theory_sessions.instructor_id', instructorId)
        .order('recorded_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((row) => {
        const session = row.class_b_theory_sessions as any;
        const user = (row.students as any)?.users;
        return {
          studentName: user ? `${user.first_names} ${user.paternal_last_name}` : 'Unknown',
          studentRut: user?.rut || '',
          attendance: row.status === 'present',
          sessionDate: session?.scheduled_at || null,
          topic: session?.topic || '',
        };
      });
    } catch (err: any) {
      console.error('Error fetching theory attendance:', err);
      return [];
    }
  }
}
