import { Injectable, signal, computed, inject } from '@angular/core';
import { InstructorProfileFacade } from './instructor-profile.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type {
  InstructorClassRow,
  EvaluationFormData,
  UpcomingDay,
} from '@core/models/ui/instructor-portal.model';

@Injectable({
  providedIn: 'root',
})
export class InstructorClasesFacade {
  private profileFacade = inject(InstructorProfileFacade);
  private supabase = inject(SupabaseService);

  private _todayClasses = signal<InstructorClassRow[]>([]);
  private _selectedClass = signal<InstructorClassRow | null>(null);
  private _upcomingDays = signal<UpcomingDay[]>([]);
  private _isLoading = signal<boolean>(false);
  private _error = signal<string | null>(null);
  private _initialized = false;

  // Realtime channel
  private channel: any = null;

  readonly todayClasses = this._todayClasses.asReadonly();
  readonly selectedClass = this._selectedClass.asReadonly();
  readonly upcomingDays = this._upcomingDays.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly kpis = computed(() => {
    const classes = this._todayClasses();
    return {
      clasesHoy: classes.length,
      completadas: classes.filter((c) => c.status === 'completed').length,
      pendientes: classes.filter((c) => c.status === 'scheduled').length,
      enCurso: classes.filter((c) => c.status === 'in_progress').length,
    };
  });

  readonly nextClass = computed(() => {
    const classes = this._todayClasses();
    return classes.find((c) => c.status === 'scheduled') || null;
  });

  async initialize(): Promise<void> {
    if (this._initialized) {
      await this.refreshSilently();
      return;
    }

    this._isLoading.set(true);
    await this.fetchTodayClasses();
    this._isLoading.set(false);

    this.setupRealtime();
    this._initialized = true;
  }

  dispose(): void {
    if (this.channel) {
      this.supabase.client.removeChannel(this.channel);
      this.channel = null;
    }
    this._initialized = false;
  }

  private setupRealtime(): void {
    const instructorId = this.profileFacade.instructorId();
    if (!instructorId) return;

    this.channel = this.supabase.client
      .channel('instructor-classes-today')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'class_b_sessions',
          filter: `instructor_id=eq.${instructorId}`,
        },
        () => {
          this.refreshSilently(); // refetch upon changes
        },
      )
      .subscribe();
  }

  async fetchTodayClasses(): Promise<void> {
    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return;

    this._error.set(null);
    try {
      const todayDate = new Date().toISOString().split('T')[0];

      const { data, error } = await this.supabase.client
        .from('class_b_sessions')
        .select(
          `
          id, scheduled_at, start_time, end_time, duration_min, status, class_number, km_start, km_end, evaluation_grade, notes,
          enrollments!inner(
            id,
            students!inner(id, users!inner(id, first_names, paternal_last_name, rut))
          ),
          vehicles(id, license_plate, brand, model)
        `,
        )
        .eq('instructor_id', instructorId)
        .gte('scheduled_at', `${todayDate}T00:00:00+00:00`)
        .lt('scheduled_at', `${todayDate}T23:59:59+00:00`)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map(this.mapSessionToRow);
      this._todayClasses.set(mapped);

      // If evaluating specific class, update it
      const currentSelected = this._selectedClass();
      if (currentSelected) {
        const updated = mapped.find((c) => c.sessionId === currentSelected.sessionId);
        if (updated) this._selectedClass.set(updated);
      }
    } catch (err: any) {
      console.error('Error fetching today classes:', err);
      this._error.set(err.message || 'Error al cargar clases');
    }
  }

  async loadClassDetail(sessionId: number): Promise<void> {
    this._error.set(null);
    this._isLoading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('class_b_sessions')
        .select(
          `
          id, scheduled_at, start_time, end_time, duration_min, status, class_number, km_start, km_end, evaluation_grade, notes,
          enrollments!inner(
            id,
            students!inner(id, users!inner(id, first_names, paternal_last_name, rut))
          ),
          vehicles(id, license_plate, brand, model)
        `,
        )
        .eq('id', sessionId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        this._selectedClass.set(this.mapSessionToRow(data));
      } else {
        this._selectedClass.set(null);
      }
    } catch (err: any) {
      console.error('Error fetching class detail:', err);
      this._error.set(err.message || 'Error al cargar la clase');
    } finally {
      this._isLoading.set(false);
    }
  }

  async startClass(sessionId: number, kmStart: number): Promise<void> {
    try {
      const { error } = await this.supabase.client
        .from('class_b_sessions')
        .update({
          status: 'in_progress',
          start_time: new Date().toISOString(),
          km_start: kmStart,
        })
        .eq('id', sessionId);

      if (error) throw error;
      await this.refreshSilently();
    } catch (err: any) {
      console.error('Error starting class:', err);
      throw err;
    }
  }

  async finishClass(sessionId: number, kmEnd: number): Promise<void> {
    try {
      const { error } = await this.supabase.client
        .from('class_b_sessions')
        .update({
          status: 'completed',
          end_time: new Date().toISOString(),
          km_end: kmEnd,
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;
      await this.refreshSilently();
    } catch (err: any) {
      console.error('Error finishing class:', err);
      throw err;
    }
  }

  async cancelClass(sessionId: number, reason: string): Promise<void> {
    try {
      const { error } = await this.supabase.client
        .from('class_b_sessions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          notes: reason,
        })
        .eq('id', sessionId);

      if (error) throw error;
      await this.refreshSilently();
    } catch (err: any) {
      console.error('Error cancelling class:', err);
      throw err;
    }
  }

  async markNoShow(sessionId: number): Promise<void> {
    try {
      const { error } = await this.supabase.client
        .from('class_b_sessions')
        .update({ status: 'no_show' })
        .eq('id', sessionId);

      if (error) throw error;
      await this.refreshSilently();
    } catch (err: any) {
      console.error('Error marking no show:', err);
      throw err;
    }
  }

  async saveEvaluation(data: EvaluationFormData): Promise<void> {
    try {
      // Updates session evaluation info
      const { error: updateError } = await this.supabase.client
        .from('class_b_sessions')
        .update({
          evaluation_grade: data.grade,
          performance_notes: data.observations,
          signature_timestamp: new Date().toISOString(),
          student_signature: !!data.studentSignature,
          instructor_signature: !!data.instructorSignature,
        })
        .eq('id', data.sessionId);

      if (updateError) throw updateError;

      // We also could store signatures in Supabase Storage here.
      // And we might register attendance if necessary.

      await this.refreshSilently();
    } catch (err: any) {
      console.error('Error saving evaluation:', err);
      throw err;
    }
  }

  async fetchUpcomingDays(): Promise<void> {
    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return;

    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 4);
      endDate.setHours(23, 59, 59, 999);

      const { data, error } = await this.supabase.client
        .from('class_b_sessions')
        .select('id, scheduled_at')
        .eq('instructor_id', instructorId)
        .gte('scheduled_at', tomorrow.toISOString())
        .lte('scheduled_at', endDate.toISOString())
        .in('status', ['scheduled', 'in_progress']);

      if (error) throw error;

      const byDate = new Map<string, number>();
      for (const row of data || []) {
        const dateKey = (row.scheduled_at as string).split('T')[0];
        byDate.set(dateKey, (byDate.get(dateKey) || 0) + 1);
      }

      const days: UpcomingDay[] = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, 3)
        .map(([fecha, cantidad]) => {
          const dt = new Date(`${fecha}T12:00:00`);
          const fechaLabel = dt.toLocaleDateString('es-CL', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          });
          return { fecha, fechaLabel, cantidad };
        });

      this._upcomingDays.set(days);
    } catch (err: any) {
      console.error('Error fetching upcoming days:', err);
    }
  }

  async refreshSilently(): Promise<void> {
    if (this.profileFacade.instructorId()) {
      await this.fetchTodayClasses();
    }
  }

  private mapSessionToRow(row: any): InstructorClassRow {
    const studentUser = row.enrollments?.students?.users;
    const studentName = studentUser
      ? `${studentUser.first_names} ${studentUser.paternal_last_name}`
      : 'Desconocido';
    const studentRut = studentUser?.rut || '';
    const v = row.vehicles;
    const vehicleLabel = v ? `${v.brand || ''} ${v.model || ''}`.trim() : '';

    const dt = new Date(row.scheduled_at);
    const hourStr = dt.getHours().toString().padStart(2, '0');
    const minStr = dt.getMinutes().toString().padStart(2, '0');

    // Calcular end time aproximado si no tiene
    const endDt = new Date(dt.getTime() + row.duration_min * 60000);
    const endHourStr = endDt.getHours().toString().padStart(2, '0');
    const endMinStr = endDt.getMinutes().toString().padStart(2, '0');

    const timeLabel = `${hourStr}:${minStr} - ${endHourStr}:${endMinStr}`;

    // Status color
    const colorMap: Record<string, string> = {
      scheduled: 'info',
      in_progress: 'warning',
      completed: 'success',
      cancelled: 'error',
      no_show: 'muted',
    };

    const labelMap: Record<string, string> = {
      scheduled: 'Agendada',
      in_progress: 'En Curso',
      completed: 'Completada',
      cancelled: 'Cancelada',
      no_show: 'Falta',
    };

    return {
      sessionId: row.id,
      classNumber: row.class_number,
      scheduledAt: row.scheduled_at,
      startTime: row.start_time,
      endTime: row.end_time,
      durationMin: row.duration_min,
      status: row.status,
      studentName,
      studentRut,
      enrollmentId: row.enrollments?.id || 0,
      studentId: row.enrollments?.students?.id || 0,
      vehiclePlate: v?.license_plate || '',
      vehicleLabel: vehicleLabel || 'Vehículo',
      kmStart: row.km_start,
      kmEnd: row.km_end,
      evaluationGrade: row.evaluation_grade,
      notes: row.notes,
      timeLabel,
      statusLabel: labelMap[row.status] || row.status,
      statusColor: colorMap[row.status] || 'default',
      canStart: row.status === 'scheduled', // Simplified, actual validation might include window time checks
      canFinish: row.status === 'in_progress',
      canEvaluate: row.status === 'completed' && row.evaluation_grade === null,
    };
  }
}
