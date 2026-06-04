import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthFacade } from './auth.facade';
import { StudentEnrollmentContextFacade } from './student-enrollment-context.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { toISODate, to24hTime, buildDayLabel, capitalize } from '@core/utils/date.utils';
import type {
  StudentHorarioDay,
  StudentHorarioSessionItem,
  StudentHorarioWeekMeta,
} from '@core/models/ui/student-horario.model';

// ─── Tipos crudos de Supabase ────────────────────────────────────────────────

interface RawPracticeSession {
  id: number;
  class_number: number | null;
  scheduled_at: string;
  status: string;
  class_b_practice_attendance: { status: string }[];
}

interface RawProfTheorySession {
  id: number;
  date: string;
  professional_theory_attendance: { status: string }[];
}

interface RawProfPracticeSession {
  id: number;
  date: string;
  professional_practice_attendance: { status: string; enrollment_id: number }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMondayOfWeek(dateStr?: string): string {
  const ref = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const day = ref.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  ref.setDate(ref.getDate() + diff);
  return toISODate(ref);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function buildWeekLabel(weekStart: string, weekEnd: string): string {
  const s = new Date(weekStart + 'T12:00:00');
  const e = new Date(weekEnd + 'T12:00:00');
  const sDay = s.toLocaleDateString('es-CL', { day: 'numeric' });
  const eDay = e.toLocaleDateString('es-CL', { day: 'numeric' });
  const month = capitalize(e.toLocaleDateString('es-CL', { month: 'short' }).replace('.', ''));
  return `${sDay}–${eDay} ${month}`;
}

function deriveSessionStatus(raw: RawPracticeSession): string {
  const sessionStatus = (raw.status ?? '').toLowerCase();
  if (sessionStatus === 'cancelled') return 'cancelled';
  if (sessionStatus === 'in_progress') return 'in_progress';
  const att = raw.class_b_practice_attendance?.[0];
  if (!att) return new Date(raw.scheduled_at) < new Date() ? 'no_show' : 'scheduled';
  if (att.status === 'present' || att.status === 'late') return 'completed';
  if (att.status === 'absent') return 'absent';
  return 'scheduled';
}

function deriveProfAttStatus(statuses: { status: string }[]): string | null {
  if (!statuses.length) return null;
  const s = statuses[0].status;
  if (s === 'present' || s === 'late') return 'completed';
  if (s === 'absent') return 'absent';
  return 'scheduled';
}

// ─── Facade ──────────────────────────────────────────────────────────────────

/**
 * Horario semanal del alumno (read-only).
 * Carga TODAS las sesiones una sola vez y navega por semanas client-side.
 * SWR: primera visita con skeleton, revisitas con refresh silencioso.
 */
@Injectable({ providedIn: 'root' })
export class StudentHorarioFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  readonly context = inject(StudentEnrollmentContextFacade);

  private _initialized = false;
  /** Todas las sesiones (sin filtrar por semana) — permite navegación sin re-fetch. */
  private readonly _allSessions = signal<StudentHorarioSessionItem[]>([]);
  private readonly _weekStart = signal<string>(getMondayOfWeek());
  private readonly _licenseGroup = signal<'class_b' | 'professional' | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // ─── Estado público ────────────────────────────────────────────────────────

  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly licenseGroup = this._licenseGroup.asReadonly();

  readonly weekMeta = computed((): StudentHorarioWeekMeta => {
    const start = this._weekStart();
    const end = addDays(start, 6);
    return { weekStart: start, weekEnd: end, weekLabel: buildWeekLabel(start, end) };
  });

  readonly isCurrentWeek = computed(() => {
    const today = toISODate(new Date());
    const { weekStart, weekEnd } = this.weekMeta();
    return today >= weekStart && today <= weekEnd;
  });

  /** Días de la semana actual con sus sesiones filtradas. */
  readonly weekDays = computed((): StudentHorarioDay[] => {
    const { weekStart } = this.weekMeta();
    const today = toISODate(new Date());
    const all = this._allSessions();

    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const sessions = all.filter((s) => s.date === date).map((s) => ({ ...s }));

      return {
        date,
        label: buildDayLabel(date),
        isToday: date === today,
        isPast: date < today,
        sessions,
      };
    });
  });

  /** Primera sesión futura (próxima clase), independiente de la semana mostrada. */
  readonly nextSession = computed((): StudentHorarioSessionItem | null => {
    return this._allSessions().find((s) => s.isNext) ?? null;
  });

  /** True si el alumno Clase B tiene sesiones futuras sin agendar (puede ir a /agendar). */
  readonly hasRemainingToSchedule = computed((): boolean => {
    if (this._licenseGroup() !== 'class_b') return false;
    const scheduled = this._allSessions().filter(
      (s) => s.status === 'scheduled' || s.status === 'in_progress',
    ).length;
    const completed = this._allSessions().filter((s) => s.status === 'completed').length;
    return completed + scheduled < 12;
  });

  // ─── Navegación ───────────────────────────────────────────────────────────

  goToNextWeek(): void {
    this._weekStart.set(addDays(this._weekStart(), 7));
  }

  goToPrevWeek(): void {
    this._weekStart.set(addDays(this._weekStart(), -7));
  }

  goToToday(): void {
    this._weekStart.set(getMondayOfWeek());
  }

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
      this._error.set(e instanceof Error ? e.message : 'Error al cargar el horario');
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

    await this.context.initialize(dbId);
    const activeId = this.context.activeEnrollmentId();
    if (!activeId) {
      this._allSessions.set([]);
      return;
    }

    const { data: enrollment, error: enrollmentError } = await this.supabase.client
      .from('enrollments')
      .select('id, license_group, student_id, promotion_course_id, students!inner(id)')
      .eq('id', activeId)
      .maybeSingle();

    if (enrollmentError) throw enrollmentError;
    if (!enrollment) {
      this._allSessions.set([]);
      return;
    }

    const enrollmentId: number = (enrollment as any).id;
    const licenseGroup: 'class_b' | 'professional' = (enrollment as any).license_group;
    const promotionCourseId: number | null = (enrollment as any).promotion_course_id;

    this._licenseGroup.set(licenseGroup);

    if (licenseGroup === 'class_b') {
      await this.fetchClassBSessions(enrollmentId);
    } else {
      await this.fetchProfessionalSessions(enrollmentId, promotionCourseId);
    }
  }

  // ─── Clase B ─────────────────────────────────────────────────────────────

  private async fetchClassBSessions(enrollmentId: number): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('class_b_sessions')
      .select(
        `id, class_number, scheduled_at, status,
         class_b_practice_attendance(status)`,
      )
      .eq('enrollment_id', enrollmentId)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;

    const now = new Date();
    const todayStr = toISODate(now);
    const rawSessions = (data ?? []) as unknown as RawPracticeSession[];

    // Encontrar la primera sesión futura
    const nextIdx = rawSessions.findIndex((s) => {
      const status = (s.status ?? '').toLowerCase();
      return new Date(s.scheduled_at) > now && status !== 'cancelled';
    });

    const items: StudentHorarioSessionItem[] = rawSessions.map((s, i) => {
      const dt = new Date(s.scheduled_at);
      const dateStr = toISODate(dt);
      return {
        id: String(s.id),
        kind: 'practice' as const,
        classNumber: s.class_number ?? i + 1,
        date: dateStr,
        startTime: to24hTime(s.scheduled_at),
        status: deriveSessionStatus(s),
        isPast: dt < now,
        isNext: i === nextIdx,
      };
    });

    this._allSessions.set(items);
  }

  // ─── Profesional ─────────────────────────────────────────────────────────

  private async fetchProfessionalSessions(
    enrollmentId: number,
    promotionCourseId: number | null,
  ): Promise<void> {
    if (!promotionCourseId) {
      this._allSessions.set([]);
      return;
    }

    const [theoryResult, practiceResult] = await Promise.all([
      this.supabase.client
        .from('professional_theory_sessions')
        .select(
          `id, date,
           professional_theory_attendance!left(status, enrollment_id)`,
        )
        .eq('promotion_course_id', promotionCourseId)
        .order('date', { ascending: true }),

      this.supabase.client
        .from('professional_practice_sessions')
        .select(
          `id, date,
           professional_practice_attendance!left(status, enrollment_id)`,
        )
        .eq('promotion_course_id', promotionCourseId)
        .order('date', { ascending: true }),
    ]);

    if (theoryResult.error) throw theoryResult.error;
    if (practiceResult.error) throw practiceResult.error;

    const todayStr = toISODate(new Date());
    const rawTheory = (theoryResult.data ?? []) as RawProfTheorySession[];
    const rawPractice = (practiceResult.data ?? []) as RawProfPracticeSession[];

    // Encontrar primera sesión futura (teoría o práctica)
    const allDates = [...rawTheory.map((t) => t.date), ...rawPractice.map((p) => p.date)].sort();
    const nextDate = allDates.find((d) => d > todayStr) ?? null;

    const theoryItems: StudentHorarioSessionItem[] = rawTheory.map((t) => {
      // Filtrar asistencia de este enrollment
      const myAtt = ((t.professional_theory_attendance as any[]) ?? []).filter(
        (a: any) => a.enrollment_id === enrollmentId,
      );
      const status = deriveProfAttStatus(myAtt) ?? (t.date < todayStr ? 'no_show' : 'scheduled');
      return {
        id: `pt-${t.id}`,
        kind: 'prof_theory' as const,
        date: t.date,
        startTime: '',
        status,
        isPast: t.date < todayStr,
        isNext: t.date === nextDate,
      };
    });

    const practiceItems: StudentHorarioSessionItem[] = rawPractice.map((p) => {
      const myAtt = ((p.professional_practice_attendance as any[]) ?? []).filter(
        (a: any) => a.enrollment_id === enrollmentId,
      );
      const status = deriveProfAttStatus(myAtt) ?? (p.date < todayStr ? 'no_show' : 'scheduled');
      return {
        id: `pp-${p.id}`,
        kind: 'prof_practice' as const,
        date: p.date,
        startTime: '',
        status,
        isPast: p.date < todayStr,
        isNext: p.date === nextDate && theoryItems.every((t) => t.date !== nextDate),
      };
    });

    const all = [...theoryItems, ...practiceItems].sort((a, b) => a.date.localeCompare(b.date));
    this._allSessions.set(all);
  }
}
