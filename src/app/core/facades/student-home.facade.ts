import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthFacade } from './auth.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
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
      const { data } = await this.supabase.client.storage
        .from('documents')
        .createSignedUrl(snap.certificate.pdfUrl, 3600);
      return data?.signedUrl ?? null;
    } catch {
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

    // 1. Enrollment activo + info hero
    const { data: enrollmentRow, error: enrollmentError } = await this.supabase.client
      .from('enrollments')
      .select(
        `id, number, status, license_group, pending_balance, total_paid,
         certificate_enabled, certificate_b_pdf_url, certificate_professional_pdf_url,
         created_at, student_id,
         students!inner(id, users!inner(first_names, paternal_last_name)),
         courses!inner(code),
         branches!inner(name)`,
      )
      .eq('students.user_id', dbId)
      .in('status', ['active', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
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
          .select('completed_practices, pct_theory_attendance')
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

    // Theory attendance via student_id
    const { data: theoryRows } = await this.supabase.client
      .from('class_b_theory_attendance')
      .select('status, class_b_theory_sessions!inner(scheduled_at)')
      .eq('student_id', studentId)
      .order('class_b_theory_sessions.scheduled_at', { ascending: false })
      .limit(4);

    const PRACTICES_TOTAL = 12;
    const completedPractices: number = progressResult.data?.completed_practices ?? 0;
    const pctTheory: number = Number(progressResult.data?.pct_theory_attendance ?? 0);
    const pctOverall = computeOverallProgress(completedPractices, PRACTICES_TOTAL, pctTheory);

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
      ...recentSortedDesc.slice(0, 4).map((s: any) => {
        const att = s.class_b_practice_attendance?.[0];
        const status: 'present' | 'absent' | 'late' =
          att?.status === 'present' || att?.status === 'late'
            ? 'present'
            : att?.status === 'absent'
              ? 'absent'
              : 'present';
        return {
          id: String(s.id),
          date: s.scheduled_at,
          kind: 'practice' as const,
          status,
          label: 'Práctica',
        };
      }),
      ...(theoryRows ?? []).slice(0, 4).map((t: any) => ({
        id: `t-${t.class_b_theory_sessions.scheduled_at}`,
        date: t.class_b_theory_sessions.scheduled_at,
        kind: 'theory' as const,
        status: (t.status === 'present' || t.status === 'late' ? 'present' : 'absent') as
          | 'present'
          | 'absent',
        label: 'Teoría',
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);

    const progress: StudentHomeProgress = {
      practicesCompleted: completedPractices,
      practicesTotal: PRACTICES_TOTAL,
      pctTheoryAttendance: pctTheory,
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
      folio: certResult.data ? String(certResult.data) : null,
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
    const [modulesResult, semaphoreResult, nextSessionResult, certResult] = await Promise.all([
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
      this.supabase.client
        .from('professional_practice_sessions')
        .select('date')
        .eq('promotion_course_id', e.promotion_course_id)
        .gt('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle(),
      this.supabase.client
        .from('certificates')
        .select('folio, created_at')
        .eq('enrollment_id', enrollmentId)
        .maybeSingle(),
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

    // For professional we don't have a progress view — approximate from modules
    const completedModules = modules.filter((m) => m.passed === true).length;
    const practicesTotal = 7;
    const pctOverall = computeOverallProgress(completedModules, practicesTotal, 0);

    const progress: StudentHomeProgress = {
      practicesCompleted: completedModules,
      practicesTotal,
      pctTheoryAttendance: 0,
      pctOverall,
      practices: modules.map((m) => ({
        number: m.number,
        status: m.passed === true ? 'completed' : m.grade !== null ? 'scheduled' : 'pending',
        date: null,
      })),
    };

    const snapshot: StudentHomeSnapshot = {
      hero: {
        studentFirstName: firstName,
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
