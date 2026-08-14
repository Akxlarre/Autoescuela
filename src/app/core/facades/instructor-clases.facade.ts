import { Injectable, signal, computed, inject } from '@angular/core';
import { InstructorProfileFacade } from './instructor-profile.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { todayIso, getChileDateTimeRange } from '@core/utils/date.utils';
import type {
  InstructorClassRow,
  EvaluationFormData,
  UpcomingDay,
} from '@core/models/ui/instructor-portal.model';

@Injectable({
  providedIn: 'root',
})
export class InstructorClasesFacade {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private profileFacade = inject(InstructorProfileFacade);
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

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

  // Mock switch para revisión de flujo — desactivado (fix-001-i): la rama real
  // ya tiene cobertura de tests (instructor-clases.facade.spec.ts).
  private readonly useMock = false;

  async initialize(): Promise<void> {
    if (this._initialized) {
      await this.refreshSilently();
      return;
    }

    this._isLoading.set(true);
    await this.fetchTodayClasses();
    this._isLoading.set(false);

    if (!this.useMock) {
      this.setupRealtime();
    }
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
    if (this.useMock) {
      this._error.set(null);
      // Solo mockeamos si no hay datos ya cargados (para mantener el estado de "in_progress" si lo cambiamos)
      if (this._todayClasses().length === 0) {
        this._todayClasses.set(this.getMockClasses());
      }
      return;
    }

    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return;

    this._error.set(null);
    try {
      const { start, end } = getChileDateTimeRange(todayIso());

      const { data, error } = await this.supabase.client
        .from('class_b_sessions')
        .select(
          `
          id, scheduled_at, start_time, end_time, duration_min, status, class_number, km_start, km_end, evaluation_grade, notes,
          enrollments!inner(
            id, number,
            students!inner(id, users!inner(id, first_names, paternal_last_name, maternal_last_name, rut))
          ),
          vehicles(id, license_plate, brand, model)
        `,
        )
        .eq('instructor_id', instructorId)
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map(this.mapSessionToRow.bind(this));
      this._todayClasses.set(mapped);

      // If evaluating specific class, update it
      const currentSelected = this._selectedClass();
      if (currentSelected) {
        const updated = mapped.find((c) => c.sessionId === currentSelected.sessionId);
        if (updated) this._selectedClass.set(updated);
      }
    } catch (err: any) {
      console.error('Error fetching today classes:', err);
      this._error.set(this.sanitizer.sanitize(err).message || 'Error al cargar clases');
    }
  }

  async loadClassDetail(sessionId: number): Promise<void> {
    this._error.set(null);
    this._isLoading.set(true);

    if (this.useMock) {
      const mock = this.getMockClasses().find((c) => c.sessionId === sessionId);
      this._selectedClass.set(mock || null);
      this._isLoading.set(false);
      return;
    }

    try {
      const { data, error } = await this.supabase.client
        .from('class_b_sessions')
        .select(
          `
          id, scheduled_at, start_time, end_time, duration_min, status, class_number, km_start, km_end, evaluation_grade, evaluation_checklist, notes, student_signature, instructor_signature,
          enrollments!inner(
            id, number,
            students!inner(id, users!inner(id, first_names, paternal_last_name, maternal_last_name, rut))
          ),
          vehicles(id, license_plate, brand, model, current_km)
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
      this._error.set(this.sanitizer.sanitize(err).message || 'Error al cargar la clase');
    } finally {
      this._isLoading.set(false);
    }
  }

  async startClass(sessionId: number, kmStart: number): Promise<void> {
    if (this.useMock) {
      // Simulamos latencia
      await new Promise((resolve) => setTimeout(resolve, 800));

      const updatedClasses = this._todayClasses().map((c) => {
        if (c.sessionId === sessionId) {
          return {
            ...c,
            status: 'in_progress',
            statusLabel: 'En Curso',
            statusColor: 'warning',
            kmStart: kmStart,
            startTime: new Date().toLocaleTimeString('es-CL'),
            canStart: false,
            canFinish: true,
          };
        }
        return c;
      });

      this._todayClasses.set(updatedClasses);
      const selected = updatedClasses.find((c) => c.sessionId === sessionId);
      if (selected) this._selectedClass.set(selected);
      return;
    }

    try {
      const { error } = await this.supabase.client
        .from('class_b_sessions')
        .update({
          status: 'in_progress',
          start_time: new Date().toTimeString().split(' ')[0],
          km_start: kmStart,
        })
        .eq('id', sessionId);

      if (error) throw error;
      await this.refreshSilently();
    } catch (err: any) {
      console.error('Error starting class:', err);
      const sanitized = this.sanitizer.sanitize(err);
      throw new Error(sanitized.message);
    }
  }

  async finishClass(
    sessionId: number,
    kmEnd: number,
    extra?: {
      notes?: string;
      studentSignature?: string | null;
      instructorSignature?: string | null;
    },
  ): Promise<void> {
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const updatedClasses = this._todayClasses().map((c) => {
        if (c.sessionId === sessionId) {
          return {
            ...c,
            status: 'completed',
            statusLabel: 'Completada',
            statusColor: 'success',
            kmEnd: kmEnd,
            notes: extra?.notes ?? c.notes,
            endTime: new Date().toLocaleTimeString('es-CL'),
            canStart: false,
            canFinish: false,
            canEvaluate: true,
          };
        }
        return c;
      });
      this._todayClasses.set(updatedClasses);
      return;
    }

    try {
      // 1. Get session details for attendance registration
      const { data: session } = await this.supabase.client
        .from('class_b_sessions')
        .select('enrollment_id, vehicle_id, enrollments!inner(student_id)')
        .eq('id', sessionId)
        .maybeSingle();

      // 2. Subir firmas opcionales (mismo helper que saveEvaluation)
      const studentSignatureUrl = extra?.studentSignature
        ? await this.uploadSignature(sessionId, 'student', extra.studentSignature)
        : null;
      const instructorSignatureUrl = extra?.instructorSignature
        ? await this.uploadSignature(sessionId, 'instructor', extra.instructorSignature)
        : null;

      // 3. Update session status — km, notas y firmas son opcionales salvo km.
      const { error } = await this.supabase.client
        .from('class_b_sessions')
        .update({
          status: 'completed',
          end_time: new Date().toTimeString().split(' ')[0],
          km_end: kmEnd,
          completed_at: new Date().toISOString(),
          ...(extra?.notes ? { notes: extra.notes } : {}),
          ...(studentSignatureUrl || instructorSignatureUrl
            ? {
                signature_timestamp: new Date().toISOString(),
                student_signature: !!studentSignatureUrl,
                instructor_signature: !!instructorSignatureUrl,
              }
            : {}),
        })
        .eq('id', sessionId);

      if (error) throw error;

      // 4. Propagar km final al vehículo (fix-189)
      if (session?.vehicle_id) {
        await this.supabase.client
          .from('vehicles')
          .update({ current_km: kmEnd })
          .eq('id', session.vehicle_id);
      }

      // 5. Register practice attendance
      if (session?.enrollments) {
        const studentId = (session.enrollments as any).student_id;
        if (studentId) {
          await this.supabase.client.from('class_b_practice_attendance').upsert(
            {
              class_b_session_id: sessionId,
              student_id: studentId,
              status: 'present',
            },
            { onConflict: 'class_b_session_id,student_id' },
          );
        }
      }

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
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const updatedClasses = this._todayClasses().map((c) => {
        if (c.sessionId === data.sessionId) {
          return {
            ...c,
            evaluationGrade: data.grade,
            evaluationChecklist: data.checklist,
            notes: data.observations,
          };
        }
        return c;
      });
      this._todayClasses.set(updatedClasses);
      return;
    }

    try {
      // Solo subimos si hay firma (dataUrl no es nulo)
      const studentSignatureUrl = data.studentSignature
        ? await this.uploadSignature(data.sessionId, 'student', data.studentSignature)
        : null;

      const instructorSignatureUrl = data.instructorSignature
        ? await this.uploadSignature(data.sessionId, 'instructor', data.instructorSignature)
        : null;

      // Actualizamos la sesión con todos los datos legales
      const { error: updateError } = await this.supabase.client
        .from('class_b_sessions')
        .update({
          evaluation_grade: data.grade,
          notes: data.observations,
          evaluation_checklist: data.checklist,
          signature_timestamp: new Date().toISOString(),
          student_signature: !!studentSignatureUrl,
          instructor_signature: !!instructorSignatureUrl,
          km_end: data.kmEnd, // Reforzamos el guardado de KM final aquí también
          status: 'completed',
        })
        .eq('id', data.sessionId);

      if (updateError) throw updateError;

      await this.refreshSilently();
    } catch (err: any) {
      console.error('Error saving evaluation:', err);
      throw err;
    }
  }

  /**
   * Helper privado para convertir Base64 a Blob y subir a Supabase Storage
   */
  private async uploadSignature(
    sessionId: number,
    role: 'student' | 'instructor',
    base64: string,
  ): Promise<string> {
    const base64Data = base64.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });

    const fileName = `sessions/${sessionId}/signature_${role}_${Date.now()}.png`;
    const { data, error } = await this.supabase.client.storage
      .from('documents')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      console.error(`Error uploading ${role} signature:`, error);
      throw error;
    }

    // Retornamos la ruta pública o el path interno para guardarlo en la columna
    return data.path;
  }

  async fetchUpcomingDays(): Promise<void> {
    if (this.useMock) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const afterTomorrow = new Date(today);
      afterTomorrow.setDate(today.getDate() + 2);

      const mockDays: UpcomingDay[] = [
        {
          fecha: tomorrow.toISOString().split('T')[0],
          fechaLabel: tomorrow.toLocaleDateString('es-CL', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }),
          cantidad: 8,
        },
        {
          fecha: afterTomorrow.toISOString().split('T')[0],
          fechaLabel: afterTomorrow.toLocaleDateString('es-CL', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }),
          cantidad: 5,
        },
      ];
      this._upcomingDays.set(mockDays);
      return;
    }

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

  showSuccess(summary: string, detail?: string): void {
    this.toast.success(summary, detail);
  }

  showError(summary: string, detail?: string): void {
    this.toast.error(summary, detail);
  }

  private mapSessionToRow(row: any): InstructorClassRow {
    const studentUser = row.enrollments?.students?.users;
    const studentName = studentUser
      ? `${studentUser.first_names} ${studentUser.paternal_last_name} ${studentUser.maternal_last_name || ''}`.trim()
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
      enrollmentNumber: row.enrollments?.number ?? null,
      enrollmentId: row.enrollments?.id || 0,
      studentId: row.enrollments?.students?.id || 0,
      vehiclePlate: v?.license_plate || '',
      vehicleLabel: vehicleLabel || 'Vehículo',
      vehicleCurrentKm: v?.current_km ?? null,
      kmStart: row.km_start,
      kmEnd: row.km_end,
      evaluationGrade: row.evaluation_grade,
      evaluationChecklist: row.evaluation_checklist || [],
      notes: row.notes,
      studentSigned: !!row.student_signature,
      instructorSigned: !!row.instructor_signature,
      timeLabel,
      statusLabel: labelMap[row.status] || row.status,
      statusColor: colorMap[row.status] || 'default',
      canStart: row.status === 'scheduled',
      canFinish: row.status === 'in_progress',
      canEvaluate: row.status === 'completed' && row.evaluation_grade === null,
    };
  }

  private getMockClasses(): InstructorClassRow[] {
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        sessionId: 9991,
        classNumber: 5,
        scheduledAt: `${today}T09:00:00Z`,
        startTime: null,
        endTime: null,
        durationMin: 45,
        status: 'scheduled',
        studentName: 'Juanito Pérez (Mock)',
        studentRut: '12.345.678-9',
        enrollmentNumber: 'MOCK-101',
        enrollmentId: 101,
        studentId: 201,
        vehiclePlate: 'MOCK-12',
        vehicleLabel: 'Toyota Yaris (Mock)',
        vehicleCurrentKm: 15230,
        kmStart: null,
        kmEnd: null,
        evaluationGrade: null,
        evaluationChecklist: [],
        notes: 'Clase de prueba para el flujo de inicio',
        studentSigned: false,
        instructorSigned: false,
        timeLabel: '09:00 - 09:45',
        statusLabel: 'Agendada',
        statusColor: 'info',
        canStart: true,
        canFinish: false,
        canEvaluate: false,
      },
      {
        sessionId: 9992,
        classNumber: 8,
        scheduledAt: `${today}T11:00:00Z`,
        startTime: null,
        endTime: null,
        durationMin: 45,
        status: 'scheduled',
        studentName: 'María García (Mock)',
        studentRut: '9.876.543-2',
        enrollmentNumber: 'MOCK-102',
        enrollmentId: 102,
        studentId: 202,
        vehiclePlate: 'MOCK-12',
        vehicleLabel: 'Toyota Yaris (Mock)',
        vehicleCurrentKm: 15230,
        kmStart: null,
        kmEnd: null,
        evaluationGrade: null,
        evaluationChecklist: [],
        notes: 'Segunda clase del día',
        studentSigned: false,
        instructorSigned: false,
        timeLabel: '11:00 - 11:45',
        statusLabel: 'Agendada',
        statusColor: 'info',
        canStart: true,
        canFinish: false,
        canEvaluate: false,
      },
    ];
  }
}
