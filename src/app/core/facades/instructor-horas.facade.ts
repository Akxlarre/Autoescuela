import { Injectable, signal, computed, inject } from '@angular/core';
import { InstructorProfileFacade } from './instructor-profile.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type { 
  MonthlyHoursRow, 
  LiquidacionKpis, 
  SessionDetailRow,
  ScheduleBlock,
  WeekSchedule
} from '@core/models/ui/instructor-portal.model';

@Injectable({
  providedIn: 'root'
})
export class InstructorHorasFacade {
  private profileFacade = inject(InstructorProfileFacade);
  private supabase = inject(SupabaseService);

  private _monthlyHours = signal<MonthlyHoursRow[]>([]);
  private _sessionDetails = signal<SessionDetailRow[]>([]);
  private _weeklySchedule = signal<WeekSchedule | null>(null);
  private _monthlyTarget = signal<any | null>(null);
  private _sessionsLog = signal<any[]>([]);
  
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
    // Current month KPIS logic
    const currentMonthData = this._monthlyHours()[0]; // assume sorted DESC
    return {
      horasTeoriaMes: currentMonthData?.theoryHours || 0,
      horasPracticaMes: currentMonthData?.practicalHours || 0,
      totalHorasMes: currentMonthData?.totalEquivalentHours || 0,
      anticiposMes: 0 // Mock, could fetch from advances table
    };
  });

  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }
    
    this._initialized = true;
  }

  async fetchMonthlyHours(): Promise<void> {
    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return;

    this._isLoading.set(true);
    this._error.set(null);
    try {
      // Mock logic: assuming we fetch actual data from an aggregation view or query
      const { data, error } = await this.supabase.client
        .from('instructor_monthly_hours')
        .select('*')
        .eq('instructor_id', instructorId)
        .order('period', { ascending: false });

      if (error) throw error;
      
      const mapped = (data || []).map(row => ({
          period: row.period,
          periodLabel: this.formatPeriod(row.period),
          theorySessions: row.theory_sessions || 0,
          practicalSessions: row.practical_sessions || 0,
          totalEquivalentHours: row.total_equivalent_hours || 0,
          theoryHours: (row.theory_sessions || 0) * 0.75, // Assuming 45 mins each
          practicalHours: (row.practical_sessions || 0) * 0.75,
      }));
      
      this._monthlyHours.set(mapped);
    } catch (err: any) {
      console.error('Error fetching monthly hours:', err);
      this._error.set(err.message || 'Error al cargar horas mensuales');
    } finally {
      this._isLoading.set(false);
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
        .select(`
          id, scheduled_at, start_time, end_time, duration_min, status,
          enrollments(students(users(first_names, paternal_last_name)))
        `)
        .eq('instructor_id', instructorId)
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;
      
      const mapped = (data || []).map(row => {
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
             statusLabel: row.status === 'completed' ? 'Completado' : row.status
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
        monday.setHours(0,0,0,0);
        
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        sunday.setHours(23,59,59,999);
        
        const { data, error } = await this.supabase.client
          .from('class_b_sessions')
          .select(`
            id, scheduled_at, status, enrollments(students(users(first_names, paternal_last_name)))
          `)
          .eq('instructor_id', instructorId)
          .gte('scheduled_at', monday.toISOString())
          .lte('scheduled_at', sunday.toISOString());
          
        if (error) throw error;
        
        const blocks: ScheduleBlock[] = (data || []).map(row => {
            const dt = new Date(row.scheduled_at);
            const u = (row.enrollments as any)?.students?.users;
            const statusColorMap: Record<string, string> = {
                'scheduled': 'info',
                'in_progress': 'warning',
                'completed': 'success',
                'cancelled': 'error'
            };
            
            return {
                dayOfWeek: (dt.getDay() === 0 ? 6 : dt.getDay() - 1), // 0 is Monday
                hour: dt.getHours(),
                minuteStart: dt.getMinutes() < 30 ? 0 : 45, // Map reasonably
                type: 'practica',
                label: u ? `${u.first_names} ${u.paternal_last_name}` : 'Unknown',
                sessionId: row.id,
                color: statusColorMap[row.status] || 'default'
            } as ScheduleBlock;
        });
        
        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const weekLabel = `${monday.getDate()} ${monthNames[monday.getMonth()]} - ${sunday.getDate()} ${monthNames[sunday.getMonth()]} ${sunday.getFullYear()}`;
        
        this._weeklySchedule.set({
            weekLabel,
            weekStart: monday.toISOString(),
            blocks
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
      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      if(yearStr && monthStr) {
          const monthIndex = parseInt(monthStr, 10) - 1;
          return `${monthNames[monthIndex]} ${yearStr}`;
      }
      return period;
  }

  async fetchMonthlyTarget(): Promise<void> {
    this._isLoading.set(true);
    // Mock target
    this._monthlyTarget.set({
      totalAmount: 1250000,
      completedHours: 120,
      targetHours: 180,
      projectedHours: 185,
      breakdown: [
        {categoria: 'practica', horas: 90},
        {categoria: 'teorico', horas: 20},
        {categoria: 'ensayo', horas: 10}
      ]
    });
    this._isLoading.set(false);
  }

  async fetchSessionsLog(): Promise<void> {
    this._isLoading.set(true);
    // Mock logs
    this._sessionsLog.set([
      { date: new Date().toISOString(), category: 'practica', categoryLabel: 'Clase Práctica', quantity: 4, hours: 3, amount: 25000 },
      { date: new Date().toISOString(), category: 'teorico', categoryLabel: 'Teoría', quantity: 1, hours: 2, amount: 15000 }
    ]);
    this._isLoading.set(false);
  }
}
