import { Injectable, signal, computed, inject } from '@angular/core';
import { InstructorProfileFacade } from './instructor-profile.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type {
  MonthlyHoursRow,
  LiquidacionKpis,
  SessionDetailRow,
  ScheduleBlock,
  WeekSchedule,
} from '@core/models/ui/instructor-portal.model';

@Injectable({
  providedIn: 'root',
})
export class InstructorHorasFacade {
  private profileFacade = inject(InstructorProfileFacade);
  private supabase = inject(SupabaseService);

  // ── Estado privado ─────────────────────────────────────────────────────────
  private _monthlyHours = signal<MonthlyHoursRow[]>([]);
  private _sessionDetails = signal<SessionDetailRow[]>([]);
  private _weeklySchedule = signal<WeekSchedule | null>(null);
  private _monthlyTarget = signal<{
    completedHours: number;
    targetHours: number;
    projectedHours: number;
    breakdown: { categoria: string; horas: number }[];
  } | null>(null);
  private _sessionsLog = signal<
    {
      date: string;
      category: string;
      categoryLabel: string;
      quantity: number;
      hours: number;
    }[]
  >([]);

  private _isLoading = signal<boolean>(false);
  private _error = signal<string | null>(null);
  private _initialized = false;

  // ── Estado público ─────────────────────────────────────────────────────────
  readonly monthlyHours = this._monthlyHours.asReadonly();
  readonly sessionDetails = this._sessionDetails.asReadonly();
  readonly weeklySchedule = this._weeklySchedule.asReadonly();
  readonly monthlyTarget = this._monthlyTarget.asReadonly();
  readonly sessionsLog = this._sessionsLog.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly liquidacionKpis = computed<LiquidacionKpis>(() => {
    const currentMonthData = this._monthlyHours()[0]; // sorted DESC
    return {
      horasTeoriaMes: currentMonthData?.theoryHours || 0,
      horasPracticaMes: currentMonthData?.practicalHours || 0,
      totalHorasMes: currentMonthData?.totalEquivalentHours || 0,
    };
  });

  // ── Ciclo de vida SWR ──────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this._initialized) {
      await this.refreshSilently();
      return;
    }

    this._isLoading.set(true);
    try {
      await Promise.all([
        this.fetchMonthlyHours(),
        this.fetchMonthlyTarget(),
        this.fetchSessionsLog(),
      ]);
    } finally {
      this._isLoading.set(false);
      this._initialized = true;
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await Promise.all([
        this.fetchMonthlyHours(),
        this.fetchMonthlyTarget(),
        this.fetchSessionsLog(),
      ]);
    } catch {
      // Fail silencioso — datos stale siguen visibles
    }
  }

  // ── Queries privadas ───────────────────────────────────────────────────────

  private async fetchMonthlyTarget(): Promise<void> {
    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return;

    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const { data: sessions, error: sessionsError } = await this.supabase.client
        .from('class_b_sessions')
        .select('id, status, duration_min')
        .eq('instructor_id', instructorId)
        .gte('scheduled_at', start)
        .lte('scheduled_at', end);

      if (sessionsError) throw sessionsError;

      const allSessions = sessions || [];
      const completed = allSessions.filter((s) => s.status === 'completed');
      const nonCancelled = allSessions.filter((s) => s.status !== 'cancelled');

      const completedHours = completed.reduce((sum, s) => sum + (s.duration_min || 45) / 60, 0);
      const targetHours = nonCancelled.reduce((sum, s) => sum + (s.duration_min || 45) / 60, 0);

      // Proyección lineal: (horas completadas / día actual) × días del mes
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const projectedHours =
        dayOfMonth > 0 ? Math.round((completedHours / dayOfMonth) * daysInMonth * 10) / 10 : 0;

      this._monthlyTarget.set({
        completedHours: Math.round(completedHours * 10) / 10,
        targetHours: Math.round(targetHours * 10) / 10,
        projectedHours,
        breakdown: [{ categoria: 'practica', horas: Math.round(completedHours * 10) / 10 }],
      });
    } catch (err: any) {
      console.error('Error fetching monthly target:', err);
      this._error.set(err.message || 'Error al cargar meta mensual');
    }
  }

  private async fetchSessionsLog(): Promise<void> {
    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return;

    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { data, error } = await this.supabase.client
        .from('class_b_sessions')
        .select('id, scheduled_at, duration_min, status')
        .eq('instructor_id', instructorId)
        .eq('status', 'completed')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;

      const byDate = new Map<string, { quantity: number; totalMin: number }>();
      for (const row of data || []) {
        const dateKey = (row.scheduled_at as string).split('T')[0];
        const entry = byDate.get(dateKey) || { quantity: 0, totalMin: 0 };
        entry.quantity++;
        entry.totalMin += row.duration_min || 45;
        byDate.set(dateKey, entry);
      }

      const log = Array.from(byDate.entries()).map(([date, info]) => {
        const hours = Math.round((info.totalMin / 60) * 10) / 10;
        return {
          date,
          category: 'practica',
          categoryLabel: 'Clase Práctica',
          quantity: info.quantity,
          hours,
        };
      });

      this._sessionsLog.set(log);
    } catch (err: any) {
      console.error('Error fetching sessions log:', err);
      this._error.set(err.message || 'Error al cargar registro de sesiones');
    }
  }

  // ── Queries públicas (llamadas bajo demanda desde el componente) ────────────

  async fetchMonthlyHours(): Promise<void> {
    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return;

    this._error.set(null);
    try {
      const { data, error } = await this.supabase.client
        .from('instructor_monthly_hours')
        .select('*')
        .eq('instructor_id', instructorId)
        .order('period', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((row) => ({
        period: row.period,
        periodLabel: this.formatPeriod(row.period),
        theorySessions: 0, // instructor_monthly_hours no expone conteo de sesiones teóricas
        practicalSessions: row.practical_sessions || 0,
        totalEquivalentHours: row.total_equivalent || 0,
        theoryHours: row.theory_hours || 0,
        practicalHours: (row.practical_sessions || 0) * 0.75,
      }));

      this._monthlyHours.set(mapped);
    } catch (err: any) {
      console.error('Error fetching monthly hours:', err);
      this._error.set(err.message || 'Error al cargar horas mensuales');
    }
  }

  async fetchSessionDetailsForPeriod(period: string): Promise<void> {
    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return;

    this._isLoading.set(true);
    this._error.set(null);
    try {
      const [year, month] = period.split('-');
      const start = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
      const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).toISOString();

      const { data, error } = await this.supabase.client
        .from('class_b_sessions')
        .select(
          `
          id, scheduled_at, start_time, end_time, duration_min, status,
          enrollments(students(users(first_names, paternal_last_name)))
        `,
        )
        .eq('instructor_id', instructorId)
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((row) => {
        const u = (row.enrollments as any)?.students?.users;
        const dt = new Date(row.scheduled_at);

        return {
          sessionId: row.id,
          date: row.scheduled_at,
          type: 'practica' as const,
          typeLabel: 'Práctica',
          startTime: row.start_time || dt.toISOString().split('T')[1].substring(0, 5),
          endTime: row.end_time || '',
          durationMin: row.duration_min,
          studentName: u ? `${u.first_names} ${u.paternal_last_name}` : '',
          status: row.status,
          statusLabel: row.status === 'completed' ? 'Completado' : row.status,
        };
      });

      this._sessionDetails.set(mapped);
    } catch (err: any) {
      console.error('Error fetching session details:', err);
      this._error.set(err.message || 'Error al cargar detalle de sesiones');
    } finally {
      this._isLoading.set(false);
    }
  }

  async fetchWeeklySchedule(dateInWeek: string): Promise<void> {
    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      // Calcular inicio y fin de la semana (lunes a domingo)
      const date = new Date(dateInWeek);
      const day = date.getDay();
      const diffToMonday = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date.setDate(diffToMonday));
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const { data, error } = await this.supabase.client
        .from('class_b_sessions')
        .select(
          `
          id, scheduled_at, start_time, end_time, duration_min, status,
          enrollments(students(users(first_names, paternal_last_name))),
          vehicles(license_plate)
        `,
        )
        .eq('instructor_id', instructorId)
        .gte('scheduled_at', monday.toISOString())
        .lte('scheduled_at', sunday.toISOString())
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      const padTime = (h: number, m: number) =>
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      const blocks: ScheduleBlock[] = (data || []).map((row) => {
        const dt = new Date(row.scheduled_at);
        const jsDay = dt.getDay(); // 0=Dom, 1=Lun...6=Sáb
        const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // 0=Lun, 6=Dom
        const hour = dt.getHours();
        const minuteStart = dt.getMinutes();
        const durationMin = row.duration_min || 45;

        const startTime = row.start_time || padTime(hour, minuteStart);
        const endDt = new Date(dt.getTime() + durationMin * 60_000);
        const endTime = row.end_time || padTime(endDt.getHours(), endDt.getMinutes());

        const u = (row.enrollments as any)?.students?.users;
        const v = row.vehicles as any;

        return {
          sessionId: row.id,
          dayOfWeek,
          hour,
          minuteStart,
          durationMin,
          status: row.status as ScheduleBlock['status'],
          studentName: u ? `${u.first_names} ${u.paternal_last_name}` : '—',
          vehiclePlate: v?.license_plate || null,
          classNumber: null,
          startTime,
          endTime,
        };
      });

      // Construir array de días (Lun–Dom)
      const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const today = new Date();
      const days = dayNames.map((name, i) => {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        return {
          name,
          date: d.toISOString().split('T')[0],
          dayNumber: d.getDate(),
          isToday: d.toLocaleDateString() === today.toLocaleDateString(),
        };
      });

      const kpis = {
        clasesAgendadas: blocks.filter((b) => b.status === 'scheduled').length,
        clasesCompletadas: blocks.filter((b) => b.status === 'completed').length,
        horasSemana: Math.round(blocks.reduce((sum, b) => sum + b.durationMin / 60, 0) * 10) / 10,
        clasesHoy: blocks.filter((b) => days[b.dayOfWeek]?.isToday).length,
      };

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
      const weekLabel = `${monday.getDate()} ${monthNames[monday.getMonth()]} - ${sunday.getDate()} ${monthNames[sunday.getMonth()]} ${sunday.getFullYear()}`;

      this._weeklySchedule.set({
        weekLabel,
        weekStart: monday.toISOString(),
        blocks,
        kpis,
        days,
      });
    } catch (err: any) {
      console.error('Error fetching weekly schedule:', err);
      this._error.set(err.message || 'Error al cargar el horario');
    } finally {
      this._isLoading.set(false);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private formatPeriod(period: string): string {
    const [yearStr, monthStr] = period.split('-');
    const monthNames = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    if (yearStr && monthStr) {
      const monthIndex = parseInt(monthStr, 10) - 1;
      return `${monthNames[monthIndex]} ${yearStr}`;
    }
    return period;
  }
}
