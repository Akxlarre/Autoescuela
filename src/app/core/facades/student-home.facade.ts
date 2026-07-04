import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthFacade } from './auth.facade';
import { StudentEnrollmentContextFacade } from './student-enrollment-context.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import {
  computeAverageGrade,
  computeCertificateBlockingReason,
  computeOverallProgress,
  computeSemaphore,
  deriveCertificateState,
} from '@core/utils/student-home';
import type {
  StudentHomeAttendance,
  StudentHomeCertificate,
  StudentHomeGrades,
  StudentHomeProgress,
  StudentHomeSession,
  StudentHomeSnapshot,
  StudentHomeSideWidgets,
} from '@core/models/ui/student-home.model';

/** Snapshot completo de la home del alumno. */
@Injectable({ providedIn: 'root' })
export class StudentHomeFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly toast = inject(ToastService);
  readonly context = inject(StudentEnrollmentContextFacade);

  // ─── Estado reactivo privado ───────────────────────────────────────────────

  private _initialized = false;
  private readonly _snapshot = signal<StudentHomeSnapshot | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // ─── Estado público readonly ───────────────────────────────────────────────

  readonly snapshot = this._snapshot.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hero = computed(() => this._snapshot()?.hero ?? null);
  readonly progress = computed(() => this._snapshot()?.progress ?? null);
  readonly attendance = computed(() => this._snapshot()?.attendance ?? null);
  readonly grades = computed(() => this._snapshot()?.grades ?? null);
  readonly certificate = computed(() => this._snapshot()?.certificate ?? null);
  readonly side = computed(() => this._snapshot()?.side ?? null);
  readonly licenseGroup = computed(() => this._snapshot()?.hero.licenseGroup ?? null);

  // ─── Métodos de acción ─────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this._initialized) {
      void this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchSnapshot();
    } catch (e: unknown) {
      this._error.set(e instanceof Error ? e.message : 'Error al cargar los datos del alumno');
    } finally {
      this._isLoading.set(false);
    }
  }

  async downloadCertificate(): Promise<string | null> {
    const snap = this._snapshot();
    if (!snap?.certificate.pdfUrl) return null;
    try {
      const { data, error } = await this.supabase.client.storage
        .from('documents')
        .createSignedUrl(snap.certificate.pdfUrl, 3600);
      if (error || !data?.signedUrl) {
        this.toast.error('No se pudo generar el enlace de descarga. Intenta de nuevo.');
        return null;
      }
      return data.signedUrl;
    } catch {
      this.toast.error('Error al descargar el certificado.');
      return null;
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchSnapshot();
    } catch {
      // Fail silencioso — datos stale siguen visibles
    }
  }

  // ─── Fetch principal ───────────────────────────────────────────────────────

  private async fetchSnapshot(): Promise<void> {
    const dbId = this.auth.currentUser()?.dbId;
    if (!dbId) throw new Error('Usuario no autenticado');

    // 1. Asegurar contexto de enrollment inicializado
    await this.context.initialize(dbId);
    const activeId = this.context.activeEnrollmentId();
    if (!activeId) {
      this._snapshot.set(null);
      return;
    }

    // 2. Fetch del enrollment activo
    const { data: enrollmentRow, error: enrollmentError } = await this.supabase.client
      .from('enrollments')
      .select(
        `id, number, status, license_group, pending_balance, total_paid,
         certificate_enabled, certificate_b_pdf_url, certificate_professional_pdf_url,
         created_at, student_id, promotion_course_id,
         students!inner(id, users!inner(first_names, paternal_last_name)),
         courses!inner(code),
         branches!inner(name)`,
      )
      .eq('id', activeId)
      .maybeSingle();

    if (enrollmentError) throw enrollmentError;
    if (!enrollmentRow) {
      this._snapshot.set(null);
      return;
    }

    const e = enrollmentRow as any;
    const enrollmentId: number = e.id;
    const studentId: number = e.students.id;
    const licenseGroup: 'class_b' | 'professional' = e.license_group;
    const firstName: string = e.students.users.first_names?.split(' ')[0] ?? '';

    // 2. Queries paralelas según licenseGroup
    let snapshot: StudentHomeSnapshot;
    if (licenseGroup === 'class_b') {
      snapshot = await this.buildClassBSnapshot(e, enrollmentId, studentId, firstName);
    } else {
      snapshot = await this.buildProfessionalSnapshot(e, enrollmentId, firstName);
    }

    this._snapshot.set(snapshot);
  }

  // ─── Clase B ──────────────────────────────────────────────────────────────

  private async buildClassBSnapshot(
    e: any,
    enrollmentId: number,
    studentId: number,
    firstName: string,
  ): Promise<StudentHomeSnapshot> {
    const [progressResult, sessionsResult, examResult, certResult, nextClassResult] =
      await Promise.all([
        // Vista progreso
        this.supabase.client
          .from('v_student_progress_b')
          .select('completed_practices')
          .eq('enrollment_id', enrollmentId)
          .maybeSingle(),
        // Sesiones prácticas (para timeline y consecutivas)
        this.supabase.client
          .from('class_b_sessions')
          .select('id, scheduled_at, class_b_practice_attendance(status)')
          .eq('enrollment_id', enrollmentId)
          .order('scheduled_at', { ascending: false })
          .limit(12),
        // Nota examen final
        this.supabase.client
          .from('class_b_exam_scores')
          .select('grade, created_at')
          .eq('enrollment_id', enrollmentId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Certificado emitido
        this.supabase.client
          .from('certificates')
          .select('folio, created_at')
          .eq('enrollment_id', enrollmentId)
          .maybeSingle(),
        // Próxima clase
        this.supabase.client
          .from('class_b_sessions')
          .select('scheduled_at')
          .eq('enrollment_id', enrollmentId)
          .gt('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

    const PRACTICES_TOTAL = 12;
    const completedPractices: number = progressResult.data?.completed_practices ?? 0;
    const pctOverall = computeOverallProgress(completedPractices, PRACTICES_TOTAL);

    // Sessions ordenadas cronológicamente para la lista de 1..12
    const sessions = (sessionsResult.data ?? []).slice().reverse();
    const practices = sessions.map((s: any, i: number) => {
      const att = s.class_b_practice_attendance?.[0];
      const isCompleted = att?.status === 'present' || att?.status === 'late';
      return {
        number: i + 1,
        status: (isCompleted ? 'completed' : s.scheduled_at ? 'scheduled' : 'pending') as
          | 'completed'
          | 'scheduled'
          | 'pending',
        date: s.scheduled_at ?? null,
      };
    });
    // Rellenar hasta 12
    while (practices.length < PRACTICES_TOTAL) {
      practices.push({ number: practices.length + 1, status: 'pending' as const, date: null });
    }

    // Consecutive absences desde las últimas sesiones
    const recentSortedDesc = sessionsResult.data ?? [];
    let consecutiveAbsences = 0;
    for (const s of recentSortedDesc) {
      const att = s.class_b_practice_attendance?.[0];
      if (att?.status === 'absent') {
        consecutiveAbsences++;
      } else if (att) {
        break;
      }
    }

    const recentSessions: StudentHomeSession[] = [
      ...recentSortedDesc
        .filter((s: any) => s.class_b_practice_attendance?.[0] != null)
        .slice(0, 4)
        .map((s: any) => {
          const att = s.class_b_practice_attendance[0];
          const status: 'present' | 'absent' =
            att.status === 'present' || att.status === 'late' ? 'present' : 'absent';
          return {
            id: String(s.id),
            date: s.scheduled_at,
            kind: 'practice' as const,
            status,
            label: 'Práctica',
          };
        }),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);

    const progress: StudentHomeProgress = {
      practicesCompleted: completedPractices,
      practicesTotal: PRACTICES_TOTAL,
      pctTheoryAttendance: 0, // Asistencia teórica eliminada (Spec 0001 — Ciclos Teóricos)
      pctOverall,
      practices,
    };

    const attendance: StudentHomeAttendance = {
      consecutiveAbsences,
      semaphore: computeSemaphore(consecutiveAbsences),
      recentSessions,
    };

    const examGrade = examResult.data?.grade ? Number(examResult.data.grade) : null;
    const grades: StudentHomeGrades = {
      finalExamGrade: examGrade,
      finalExamDate: examResult.data?.created_at ?? null,
      passed: examGrade !== null ? examGrade >= 4 : null,
      modules: [],
      averageGrade: examGrade,
    };

    const certState = deriveCertificateState({
      certificateEnabled: Boolean(e.certificate_enabled),
      certificateIssued: Boolean(certResult.data),
    });

    const certificateSnapshot: StudentHomeSnapshot = {
      hero: {
        studentFirstName: firstName,
        enrollmentId: enrollmentId,
        enrollmentNumber: e.number ?? '',
        licenseGroup: 'class_b',
        branchName: e.branches?.name ?? null,
        courseStartDate: e.created_at ?? null,
        enrollmentStatus: e.status,
      },
      progress,
      attendance,
      grades,
      certificate: {
        state: certState,
        folio: null,
        issuedDate: null,
        pdfUrl: null,
        blockingReason: null,
      },
      side: {
        nextClass: nextClassResult.data
          ? {
              date: new Date(nextClassResult.data.scheduled_at).toLocaleDateString('es-CL', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
              }),
              time: new Date(nextClassResult.data.scheduled_at).toLocaleTimeString('es-CL', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              instructorName: '',
            }
          : null,
        pendingBalance: Number(e.pending_balance ?? 0),
        totalPaid: Number(e.total_paid ?? 0),
      },
    };

    // Ahora que tenemos el snapshot, calculamos blockingReason
    const cert: StudentHomeCertificate = {
      state: certState,
      folio: certResult.data?.folio ? String(certResult.data.folio) : null,
      issuedDate: null,
      pdfUrl: certState !== 'locked' ? (e.certificate_b_pdf_url ?? null) : null,
      blockingReason: null,
    };
    cert.blockingReason = computeCertificateBlockingReason({
      ...certificateSnapshot,
      certificate: cert,
    });

    return { ...certificateSnapshot, certificate: cert };
  }

  // ─── Profesional ──────────────────────────────────────────────────────────

  private async buildProfessionalSnapshot(
    e: any,
    enrollmentId: number,
    firstName: string,
  ): Promise<StudentHomeSnapshot> {
    const promotionCourseId: number | null = e.promotion_course_id ?? null;

    const [
      modulesResult,
      semaphoreResult,
      nextSessionResult,
      certResult,
      totalPracticeResult,
      attendedPracticeResult,
      totalTheoryResult,
      attendedTheoryResult,
    ] = await Promise.all([
      this.supabase.client
        .from('professional_module_grades')
        .select('module_number, module, grade, passed, status')
        .eq('enrollment_id', enrollmentId)
        .order('module_number', { ascending: true }),
      this.supabase.client
        .from('v_professional_attendance')
        .select('semaphore, consecutive_absences')
        .eq('enrollment_id', enrollmentId)
        .maybeSingle(),
      promotionCourseId
        ? this.supabase.client
            .from('professional_practice_sessions')
            .select('date')
            .eq('promotion_course_id', promotionCourseId)
            .gt('date', new Date().toISOString().split('T')[0])
            .order('date', { ascending: true })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      this.supabase.client
        .from('certificates')
        .select('folio, created_at')
        .eq('enrollment_id', enrollmentId)
        .maybeSingle(),
      // Total sesiones prácticas del curso de promoción
      promotionCourseId
        ? this.supabase.client
            .from('professional_practice_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('promotion_course_id', promotionCourseId)
        : Promise.resolve({ count: 0 }),
      // Sesiones prácticas asistidas por este enrollment
      this.supabase.client
        .from('professional_practice_attendance')
        .select('id', { count: 'exact', head: true })
        .eq('enrollment_id', enrollmentId)
        .in('status', ['present', 'late']),
      // Total sesiones teóricas del curso de promoción
      promotionCourseId
        ? this.supabase.client
            .from('professional_theory_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('promotion_course_id', promotionCourseId)
        : Promise.resolve({ count: 0 }),
      // Sesiones teóricas asistidas por este enrollment
      this.supabase.client
        .from('professional_theory_attendance')
        .select('id', { count: 'exact', head: true })
        .eq('enrollment_id', enrollmentId)
        .in('status', ['present', 'late']),
    ]);

    const modules = (modulesResult.data ?? []).map((m: any) => ({
      number: m.module_number,
      name: m.module ?? `Módulo ${m.module_number}`,
      grade: m.grade !== null && m.grade !== undefined ? Number(m.grade) : null,
      passed: m.passed ?? null,
      status: m.status as 'draft' | 'confirmed',
    }));

    const avgGrade = computeAverageGrade(modules);
    const consecutiveAbsences = Number(semaphoreResult.data?.consecutive_absences ?? 0);
    const semaphore =
      (semaphoreResult.data?.semaphore as any) ?? computeSemaphore(consecutiveAbsences);

    const grades: StudentHomeGrades = {
      finalExamGrade: null,
      finalExamDate: null,
      passed: null,
      modules,
      averageGrade: avgGrade,
    };

    const certState = deriveCertificateState({
      certificateEnabled: Boolean(e.certificate_enabled),
      certificateIssued: Boolean(certResult.data),
    });

    const practicesTotal = Number((totalPracticeResult as any).count ?? 0);
    const practicesCompleted = Number((attendedPracticeResult as any).count ?? 0);
    const theoryTotal = Number((totalTheoryResult as any).count ?? 0);
    const theoryAttended = Number((attendedTheoryResult as any).count ?? 0);
    const pctTheoryAttendance =
      theoryTotal > 0 ? Math.round((theoryAttended / theoryTotal) * 100) : 0;
    const pctOverall = computeOverallProgress(
      practicesCompleted,
      practicesTotal || 1,
      pctTheoryAttendance,
    );

    const progress: StudentHomeProgress = {
      practicesCompleted,
      practicesTotal: practicesTotal || 0,
      pctTheoryAttendance,
      pctOverall,
      practices: Array.from({ length: practicesTotal || 0 }, (_, i) => ({
        number: i + 1,
        status: (i < practicesCompleted ? 'completed' : 'pending') as 'completed' | 'pending',
        date: null,
      })),
    };

    const snapshot: StudentHomeSnapshot = {
      hero: {
        studentFirstName: firstName,
        enrollmentId: enrollmentId,
        enrollmentNumber: e.number ?? '',
        licenseGroup: 'professional',
        branchName: e.branches?.name ?? null,
        courseStartDate: e.created_at ?? null,
        enrollmentStatus: e.status,
      },
      progress,
      attendance: {
        consecutiveAbsences,
        semaphore,
        recentSessions: [],
      },
      grades,
      certificate: {
        state: certState,
        folio: null,
        issuedDate: null,
        pdfUrl: null,
        blockingReason: null,
      },
      side: {
        nextClass: nextSessionResult.data
          ? {
              date: new Date(nextSessionResult.data.date + 'T00:00:00').toLocaleDateString(
                'es-CL',
                {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                },
              ),
              time: '',
              instructorName: '',
            }
          : null,
        pendingBalance: Number(e.pending_balance ?? 0),
        totalPaid: Number(e.total_paid ?? 0),
      },
    };

    const cert: StudentHomeCertificate = {
      state: certState,
      folio: certResult.data?.folio ? String(certResult.data.folio) : null,
      issuedDate: certResult.data?.created_at ?? null,
      pdfUrl: certState !== 'locked' ? (e.certificate_professional_pdf_url ?? null) : null,
      blockingReason: computeCertificateBlockingReason(snapshot),
    };

    return { ...snapshot, certificate: cert };
  }
}
