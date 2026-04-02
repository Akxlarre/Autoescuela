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

  private _monthlyHours = signal<MonthlyHoursRow[]>([]);
  private _sessionDetails = signal<SessionDetailRow[]>([]);
  private _weeklySchedule = signal<WeekSchedule | null>(null);
  private _monthlyTarget = signal<any | null>(null);
  private _sessionsLog = signal<any[]>([]);
  private _anticiposMes = signal<number>(0);

  private _isLoading = signal<boolean>(false);
  private _error = signal<string | null>(null);
  private _initialized = false;

  readonly monthlyHours = this._monthlyHours.asReadonly();
  readonly sessionDetails = this._sessionDetails.asReadonly();
  readonly weeklySchedule = this._weeklySchedule.asReadonly();
  readonly monthlyTarget = this._monthlyTarget.asReadonly();
  readonly sessionsLog = this._sessionsLog.asReadonly();

  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly liquidacionKpis = computed<LiquidacionKpis>(() => {
    const currentMonthData = this._monthlyHours()[0]; // assume sorted DESC
    return {
      horasTeoriaMes: currentMonthData?.theoryHours || 0,
      horasPracticaMes: currentMonthData?.practicalHours || 0,
      totalHorasMes: currentMonthData?.totalEquivalentHours || 0,
      anticiposMes: this._anticiposMes(),
    };
  });

  async initialize(): Promise<void> {
    if (this._initialized) {
      await this.refreshSilently();
      return;
    }

    this._isLoading.set(true);
    try {
      await Promise.all([this.fetchMonthlyHours(), this.fetchAdvancesTotal()]);
    } finally {
      this._isLoading.set(false);
    }
    this._initialized = true;
  }

  private async refreshSilently(): Promise<void> {
    try {
      await Promise.all([this.fetchMonthlyHours(), this.fetchAdvancesTotal()]);
    } catch {
      // Fail silently — stale data remains visible
    }
  }

  private async fetchAdvancesTotal(): Promise<void> {
    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return;

    try {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0];

      const { data, error } = await this.supabase.client
        .from('instructor_advances')
        .select('amount')
        .eq('instructor_id', instructorId)
        .eq('status', 'pending')
        .gte('date', firstOfMonth)
        .lte('date', lastOfMonth);

      if (error) throw error;

      const total = (data || []).reduce((sum, row) => sum + (row.amount || 0), 0);
      this._anticiposMes.set(total);
    } catch (err: any) {
      console.error('Error fetching advances:', err);
    }
  }

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
        theorySessions: 0,
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
      // Calculate week start and end
      const date = new Date(dateInWeek);
      const day = date.getDay(); // 0 is Sunday
      const diffToMonday = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date.setDate(diffToMonday));
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      // --- MOCK DATA --- 
      // Temporarily bypass Supabase for UI testing
      await new Promise(r => setTimeout(r, 600)); // Simulate network
      const todayMock = new Date();
      const currentDayOfWeek = todayMock.getDay() === 0 ? 6 : todayMock.getDay() - 1; // 0=Monday

      const blocks: ScheduleBlock[] = [
        {
          sessionId: 991,
          dayOfWeek: currentDayOfWeek, // Today
          hour: 8,
          minuteStart: 30,
          durationMin: 45,
          status: 'completed',
          studentName: 'Juan Pérez Díaz',
          vehiclePlate: 'LXRT-42',
          classNumber: 1,
          startTime: '08:30',
          endTime: '09:15',
        },
        {
          sessionId: 992,
          dayOfWeek: currentDayOfWeek, // Today
          hour: 9,
          minuteStart: 30,
          durationMin: 45,
          status: 'in_progress',
          studentName: 'Ana Gómez',
          vehiclePlate: 'LXRT-42',
          classNumber: 2,
          startTime: '09:30',
          endTime: '10:15',
        },
        {
          sessionId: 993,
          dayOfWeek: currentDayOfWeek, // Today
          hour: 11,
          minuteStart: 0,
          durationMin: 90,
          status: 'scheduled',
          studentName: 'Roberto Carlos',
          vehiclePlate: 'SDBB-19',
          classNumber: 3,
          startTime: '11:00',
          endTime: '12:30',
        },
        {
          sessionId: 994,
          dayOfWeek: currentDayOfWeek, // Today
          hour: 14,
          minuteStart: 30,
          durationMin: 45,
          status: 'scheduled',
          studentName: 'María Luisa',
          vehiclePlate: 'SDBB-19',
          classNumber: 4,
          startTime: '14:30',
          endTime: '15:15',
        },
        {
          sessionId: 995,
          dayOfWeek: (currentDayOfWeek + 1) % 6, // Tomorrow
          hour: 10,
          minuteStart: 0,
          durationMin: 45,
          status: 'scheduled',
          studentName: 'Carlos Santillana',
          vehiclePlate: 'LXRT-42',
          classNumber: 5,
          startTime: '10:00',
          endTime: '10:45',
        },
        {
          sessionId: 996,
          dayOfWeek: (currentDayOfWeek + 2) % 6, // Next day
          hour: 16,
          minuteStart: 0,
          durationMin: 45,
          status: 'cancelled',
          studentName: 'Luis Hernán',
          vehiclePlate: 'SDBB-19',
          classNumber: 6,
          startTime: '16:00',
          endTime: '16:45',
        }
      ];
      // -------------------

      // Calculate days
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

      // Calculate KPIs
      const kpis = {
        clasesAgendadas: blocks.filter((b) => b.status === 'scheduled').length,
        clasesCompletadas: blocks.filter((b) => b.status === 'completed').length,
        horasSemana: Math.round(blocks.reduce((sum, b) => sum + (b.durationMin / 60), 0) * 10) / 10,
        clasesHoy: blocks.filter((b) => {
          const d = days[b.dayOfWeek];
          return d.isToday;
        }).length,
      };

      const monthNames = [
        'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
        'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
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

  async fetchMonthlyTarget(): Promise<void> {
    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return;

    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const period = `${year}-${String(month + 1).padStart(2, '0')}`;

      const [sessionsResult, paymentResult] = await Promise.all([
        this.supabase.client
          .from('class_b_sessions')
          .select('id, status, duration_min')
          .eq('instructor_id', instructorId)
          .gte('scheduled_at', start)
          .lte('scheduled_at', end),
        this.supabase.client
          .from('instructor_monthly_payments')
          .select('base_salary')
          .eq('instructor_id', instructorId)
          .eq('period', period)
          .maybeSingle(),
      ]);

      const sessions = sessionsResult.data || [];
      const completed = sessions.filter((s) => s.status === 'completed');
      const completedHours = completed.reduce((sum, s) => sum + (s.duration_min || 45) / 60, 0);
      const targetHours = sessions.reduce((sum, s) => sum + (s.duration_min || 45) / 60, 0);

      this._monthlyTarget.set({
        totalAmount: paymentResult.data?.base_salary || 0,
        completedHours: Math.round(completedHours * 10) / 10,
        targetHours: Math.round(targetHours * 10) / 10,
        breakdown: [
          {
            categoria: 'practica',
            horas: Math.round(completedHours * 10) / 10,
          },
        ],
      });
    } catch (err: any) {
      console.error('Error fetching monthly target:', err);
      this._error.set(err.message || 'Error al cargar meta mensual');
    }
  }

  async fetchSessionsLog(): Promise<void> {
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

      const log = Array.from(byDate.entries()).map(([date, info]) => ({
        date,
        category: 'practica',
        categoryLabel: 'Clase Práctica',
        quantity: info.quantity,
        hours: Math.round((info.totalMin / 60) * 10) / 10,
        amount: 0,
      }));

      this._sessionsLog.set(log);
    } catch (err: any) {
      console.error('Error fetching sessions log:', err);
      this._error.set(err.message || 'Error al cargar registro de sesiones');
    }
  }
}
