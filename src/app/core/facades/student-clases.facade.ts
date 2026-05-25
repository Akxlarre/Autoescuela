import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthFacade } from './auth.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { toISODate, to24hTime } from '@core/utils/date.utils';
import type {
  StudentClasesData,
  StudentClasesKpis,
  StudentPracticeSessionRow,
  StudentProfSessionRow,
  StudentSessionStatus,
  StudentTheorySessionRow,
} from '@core/models/ui/student-clases.model';

// ─── Tipos crudos de Supabase ────────────────────────────────────────────────

interface RawPracticeSession {
  id: number;
  class_number: number | null;
  scheduled_at: string;
  duration_min: number | null;
  status: string;
  class_b_practice_attendance: { status: string }[];
}

interface RawTheoryAttendance {
  status: string;
  class_b_theory_sessions: { id: number; scheduled_at: string } | null;
}

interface RawProfTheoryAttendance {
  status: string;
  professional_theory_sessions: { id: number; date: string } | null;
}

interface RawProfPracticeAttendance {
  status: string;
  professional_practice_sessions: { id: number; date: string } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function derivePracticeStatus(raw: RawPracticeSession): StudentSessionStatus {
  const sessionStatus = (raw.status ?? '').toLowerCase();
  if (sessionStatus === 'cancelled') return 'cancelled';
  if (sessionStatus === 'in_progress') return 'in_progress';

  const att = raw.class_b_practice_attendance?.[0];
  if (!att) {
    const isPast = new Date(raw.scheduled_at) < new Date();
    return isPast ? 'no_show' : 'scheduled';
  }
  if (att.status === 'present' || att.status === 'late') return 'completed';
  if (att.status === 'absent') return 'absent';
  return 'scheduled';
}

function mapAttendanceStatus(s: string): 'present' | 'absent' | 'late' | 'justified' {
  if (s === 'late') return 'late';
  if (s === 'justified') return 'justified';
  if (s === 'absent') return 'absent';
  return 'present';
}

// ─── Facade ──────────────────────────────────────────────────────────────────

/**
 * Historial completo de clases del alumno (prácticas + teoría).
 * SWR: primera visita con skeleton, revisitas con refresh silencioso.
 * Sin evaluaciones — el alumno no puede ver evaluation_grade ni checklist.
 */
@Injectable({ providedIn: 'root' })
export class StudentClasesFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);

  private _initialized = false;

  // ─── Estado privado ────────────────────────────────────────────────────────
  private readonly _data = signal<StudentClasesData | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // ─── Estado público ────────────────────────────────────────────────────────
  readonly data = this._data.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly licenseGroup = computed(() => this._data()?.licenseGroup ?? null);
  readonly kpis = computed(() => this._data()?.kpis ?? null);
  readonly practiceSessions = computed(() => this._data()?.practiceSessions ?? []);
  readonly theorySessions = computed(() => this._data()?.theorySessions ?? []);
  readonly profSessions = computed(() => this._data()?.profSessions ?? []);

  // ─── Métodos de acción ────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this._initialized) {
      void this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchData();
    } catch (e: unknown) {
      this._error.set(e instanceof Error ? e.message : 'Error al cargar las clases');
    } finally {
      this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchData();
    } catch {
      // Datos stale siguen visibles
    }
  }

  // ─── Fetch ────────────────────────────────────────────────────────────────

  private async fetchData(): Promise<void> {
    const dbId = this.auth.currentUser()?.dbId;
    if (!dbId) throw new Error('Usuario no autenticado');

    // Enrollment activo
    const { data: enrollment, error: enrollmentError } = await this.supabase.client
      .from('enrollments')
      .select('id, license_group, student_id, promotion_course_id, students!inner(id)')
      .eq('students.user_id', dbId)
      .in('status', ['active', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (enrollmentError) throw enrollmentError;
    if (!enrollment) {
      this._data.set(null);
      return;
    }

    const enrollmentId: number = (enrollment as any).id;
    const studentId: number = (enrollment as any).student_id;
    const licenseGroup: 'class_b' | 'professional' = (enrollment as any).license_group;
    const promotionCourseId: number | null = (enrollment as any).promotion_course_id;

    if (licenseGroup === 'class_b') {
      await this.fetchClassBData(enrollmentId, studentId);
    } else {
      await this.fetchProfessionalData(enrollmentId, promotionCourseId);
    }
  }

  // ─── Clase B ─────────────────────────────────────────────────────────────

  private async fetchClassBData(enrollmentId: number, studentId: number): Promise<void> {
    const [practiceResult, theoryResult, progressResult] = await Promise.all([
      this.supabase.client
        .from('class_b_sessions')
        .select(
          `id, class_number, scheduled_at, duration_min, status,
           class_b_practice_attendance(status)`,
        )
        .eq('enrollment_id', enrollmentId)
        .order('scheduled_at', { ascending: true }),

      this.supabase.client
        .from('class_b_theory_attendance')
        .select('status, class_b_theory_sessions!inner(id, scheduled_at)')
        .eq('student_id', studentId)
        .order('scheduled_at', { referencedTable: 'class_b_theory_sessions', ascending: false }),

      this.supabase.client
        .from('v_student_progress_b')
        .select('completed_practices, pct_theory_attendance')
        .eq('enrollment_id', enrollmentId)
        .maybeSingle(),
    ]);

    const rawSessions = (practiceResult.data ?? []) as unknown as RawPracticeSession[];
    const now = new Date();

    const practiceSessions: StudentPracticeSessionRow[] = rawSessions.map((s, i) => {
      const dt = new Date(s.scheduled_at);
      return {
        id: s.id,
        classNumber: s.class_number ?? i + 1,
        scheduledAt: s.scheduled_at,
        date: toISODate(dt),
        time: to24hTime(s.scheduled_at),
        durationMin: s.duration_min ?? 45,
        status: derivePracticeStatus(s),
        isPast: dt < now,
      };
    });

    const rawTheory = (theoryResult.data ?? []) as unknown as RawTheoryAttendance[];
    const theorySessions: StudentTheorySessionRow[] = rawTheory
      .filter((t) => t.class_b_theory_sessions != null)
      .map((t) => {
        const ts = t.class_b_theory_sessions!;
        const dt = new Date(ts.scheduled_at);
        return {
          id: `t-${ts.id}`,
          scheduledAt: ts.scheduled_at,
          date: toISODate(dt),
          time: to24hTime(ts.scheduled_at),
          attendanceStatus: mapAttendanceStatus(t.status),
        };
      });

    const completed = progressResult.data?.completed_practices ?? 0;
    const theoryPct = Number(progressResult.data?.pct_theory_attendance ?? 0);
    const upcoming = practiceSessions.filter(
      (s) => s.status === 'scheduled' || s.status === 'in_progress',
    ).length;

    const kpis: StudentClasesKpis = {
      completedPractices: completed,
      totalPractices: 12,
      scheduledUpcoming: upcoming,
      theoryPct,
    };

    this._data.set({
      licenseGroup: 'class_b',
      kpis,
      practiceSessions,
      theorySessions,
      profSessions: [],
    });
  }

  // ─── Profesional ─────────────────────────────────────────────────────────

  private async fetchProfessionalData(
    enrollmentId: number,
    promotionCourseId: number | null,
  ): Promise<void> {
    if (!promotionCourseId) {
      this._data.set({
        licenseGroup: 'professional',
        kpis: {
          completedPractices: 0,
          totalPractices: 0,
          scheduledUpcoming: 0,
          theoryPct: 0,
        },
        practiceSessions: [],
        theorySessions: [],
        profSessions: [],
      });
      return;
    }

    const [theoryAttResult, practiceAttResult] = await Promise.all([
      this.supabase.client
        .from('professional_theory_attendance')
        .select('status, professional_theory_sessions!inner(id, date)')
        .eq('enrollment_id', enrollmentId)
        .order('date', { referencedTable: 'professional_theory_sessions', ascending: false }),

      this.supabase.client
        .from('professional_practice_attendance')
        .select('status, professional_practice_sessions!inner(id, date)')
        .eq('enrollment_id', enrollmentId)
        .order('date', { referencedTable: 'professional_practice_sessions', ascending: false }),
    ]);

    const rawTheory = (theoryAttResult.data ?? []) as unknown as RawProfTheoryAttendance[];
    const rawPractice = (practiceAttResult.data ?? []) as unknown as RawProfPracticeAttendance[];

    const profSessions: StudentProfSessionRow[] = [
      ...rawTheory
        .filter((t) => t.professional_theory_sessions != null)
        .map((t) => ({
          id: `pt-${t.professional_theory_sessions!.id}`,
          date: t.professional_theory_sessions!.date,
          kind: 'theory' as const,
          attendanceStatus: mapAttendanceStatus(t.status),
        })),
      ...rawPractice
        .filter((p) => p.professional_practice_sessions != null)
        .map((p) => ({
          id: `pp-${p.professional_practice_sessions!.id}`,
          date: p.professional_practice_sessions!.date,
          kind: 'practice' as const,
          attendanceStatus: mapAttendanceStatus(p.status),
        })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    const presentTheory = rawTheory.filter(
      (t) => t.status === 'present' || t.status === 'late',
    ).length;
    const theoryPct =
      rawTheory.length > 0 ? Math.round((presentTheory / rawTheory.length) * 100) : 0;
    const presentPractice = rawPractice.filter(
      (p) => p.status === 'present' || p.status === 'late',
    ).length;

    const kpis: StudentClasesKpis = {
      completedPractices: presentPractice,
      totalPractices: rawPractice.length,
      scheduledUpcoming: 0,
      theoryPct,
    };

    this._data.set({
      licenseGroup: 'professional',
      kpis,
      practiceSessions: [],
      theorySessions: [],
      profSessions,
    });
  }
}
