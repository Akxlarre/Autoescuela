import { Injectable, signal, computed, inject } from '@angular/core';
import {
  addDaysIso,
  chileDayRange,
  chileRange,
  formatChileDate,
  formatChilePattern,
  formatChileTime,
  toChileDate,
} from '@core/utils/chile-time.utils';

/** Etiqueta corta de un día próximo, p. ej. "mar, 6 oct". */
const UPCOMING_DAY_LABEL = { weekday: 'short', day: 'numeric', month: 'short' } as const;
import { InstructorProfileFacade } from './instructor-profile.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { assertReadOk } from '@core/utils/db-error.utils';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import { todayIso } from '@core/utils/date.utils';
import { chileTimeOfDay } from '@core/utils/chile-time.utils';
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
  private layoutDrawer = inject(LayoutDrawerFacadeService);

  private _todayClasses = signal<InstructorClassRow[]>([]);
  private _selectedClass = signal<InstructorClassRow | null>(null);
  private _upcomingDays = signal<UpcomingDay[]>([]);
  private _upcomingDaysError = signal<string | null>(null);
  private _isLoading = signal<boolean>(false);
  private _detailLoading = signal<boolean>(false);
  private _error = signal<string | null>(null);
  private _detailError = signal<string | null>(null);
  private _refreshFailed = signal<boolean>(false);
  private _initialized = false;
  private _lastDetailSessionId: number | null = null;

  private readonly listGuard = createRequestGuard();
  private readonly classDetailGuard = createRequestGuard();

  /**
   * Contador que se incrementa tras guardar una evaluación con éxito. Los Smart
   * Components que muestran listas de clases (ficha del alumno, horario semanal) —
   * cuyo estado vive en OTRO Facade que este no puede refrescar — hacen `effect()`
   * sobre esto para recargar en silencio su propia data. fix-236-m: la evaluación
   * pasó de página enrutada (donde el `goBack()` re-disparaba la carga del padre) a
   * Drawer (el padre queda montado y no se entera solo).
   */
  private _evaluationSavedTick = signal(0);
  readonly evaluationSavedTick = this._evaluationSavedTick.asReadonly();

  // Realtime channel
  private channel: any = null;

  readonly todayClasses = this._todayClasses.asReadonly();
  readonly selectedClass = this._selectedClass.asReadonly();
  readonly upcomingDays = this._upcomingDays.asReadonly();
  readonly upcomingDaysError = this._upcomingDaysError.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly detailError = this._detailError.asReadonly();
  readonly refreshFailed = this._refreshFailed.asReadonly();

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

    const requestToken = this.listGuard.next();
    this._isLoading.set(true);
    this._error.set(null);
    this._upcomingDaysError.set(null);

    try {
      await Promise.all([
        this.loadTodayClassesQuery(requestToken),
        this.loadUpcomingDaysQuery(requestToken),
      ]);
      if (!this.listGuard.isCurrent(requestToken)) return;
      this._initialized = true;
      if (!this.useMock) {
        this.setupRealtime();
      }
    } catch {
      if (!this.listGuard.isCurrent(requestToken)) return;
      this._todayClasses.set([]);
      this._upcomingDays.set([]);
      this._error.set('No se pudieron cargar las clases del día.');
    } finally {
      if (this.listGuard.isCurrent(requestToken)) {
        this._isLoading.set(false);
      }
    }
  }

  async reintentar(): Promise<void> {
    this._error.set(null);
    this._upcomingDaysError.set(null);
    this._refreshFailed.set(false);
    this._initialized = false;
    await this.initialize();
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
          void this.refreshSilently(); // refetch upon changes
        },
      )
      .subscribe();
  }

  private async loadTodayClassesQuery(requestToken?: number): Promise<InstructorClassRow[]> {
    if (this.useMock) {
      if (this._todayClasses().length === 0) {
        this._todayClasses.set(this.getMockClasses());
      }
      return this._todayClasses();
    }

    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return [];

    const { start, endExclusive } = chileDayRange(todayIso());

    const res = await this.supabase.client
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
      .lt('scheduled_at', endExclusive)
      .order('scheduled_at', { ascending: true });

    const data = assertReadOk(res);
    if (requestToken !== undefined && !this.listGuard.isCurrent(requestToken)) return [];

    const mapped = (data || []).map(this.mapSessionToRow.bind(this));
    this._todayClasses.set(mapped);

    // If evaluating specific class, update it
    const currentSelected = this._selectedClass();
    if (currentSelected) {
      const updated = mapped.find((c) => c.sessionId === currentSelected.sessionId);
      if (updated) this._selectedClass.set(updated);
    }

    return mapped;
  }

  async fetchTodayClasses(): Promise<void> {
    this._error.set(null);
    try {
      await this.loadTodayClassesQuery();
    } catch (err: any) {
      console.error('Error fetching today classes:', err);
      this._todayClasses.set([]);
      this._error.set(this.sanitizer.sanitize(err).message || 'Error al cargar clases');
    }
  }

  private async loadUpcomingDaysQuery(requestToken?: number): Promise<UpcomingDay[]> {
    if (this.useMock) {
      const mockDays: UpcomingDay[] = [8, 5].map((cantidad, i) => {
        const fecha = addDaysIso(todayIso(), i + 1);
        return { fecha, fechaLabel: formatChileDate(fecha, UPCOMING_DAY_LABEL), cantidad };
      });
      this._upcomingDays.set(mockDays);
      return mockDays;
    }

    const instructorId = await this.profileFacade.getInstructorId();
    if (!instructorId) return [];

    const today = todayIso();
    const upcoming = chileRange(addDaysIso(today, 1), addDaysIso(today, 4));

    const res = await this.supabase.client
      .from('class_b_sessions')
      .select('id, scheduled_at')
      .eq('instructor_id', instructorId)
      .gte('scheduled_at', upcoming.start)
      .lt('scheduled_at', upcoming.endExclusive)
      .in('status', ['scheduled', 'in_progress']);

    const data = assertReadOk(res);
    if (requestToken !== undefined && !this.listGuard.isCurrent(requestToken)) return [];

    const byDate = new Map<string, number>();
    for (const row of data || []) {
      const dateKey = toChileDate(row.scheduled_at as string);
      byDate.set(dateKey, (byDate.get(dateKey) || 0) + 1);
    }

    const days: UpcomingDay[] = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 3)
      .map(([fecha, cantidad]) => ({
        fecha,
        fechaLabel: formatChileDate(fecha, UPCOMING_DAY_LABEL),
        cantidad,
      }));

    this._upcomingDays.set(days);
    this._upcomingDaysError.set(null);
    return days;
  }

  async fetchUpcomingDays(): Promise<void> {
    try {
      await this.loadUpcomingDaysQuery();
    } catch (err: any) {
      console.error('Error fetching upcoming days:', err);
      this._upcomingDays.set([]);
      this._upcomingDaysError.set('No se pudieron cargar los próximos días.');
    }
  }

  /**
   * Abre la evaluación de una clase en el Drawer lateral (fix-236-m). Único punto de
   * entrada: reemplaza la navegación a la ruta `/instructor/alumnos/:id/evaluacion/:sessionId`
   * desde la ficha del alumno y el horario semanal. Carga el detalle ANTES de abrir para
   * que `InstructorEvaluacionComponent` (sin `input()`, se monta vía `NgComponentOutlet`)
   * ya encuentre `selectedClass()` poblado. El modo lectura lo deriva el propio componente
   * desde `canEvaluate` de la clase seleccionada.
   */
  async openEvaluacionDrawer(sessionId: number): Promise<void> {
    await this.loadClassDetail(sessionId);
    const { InstructorEvaluacionComponent } =
      await import('../../features/instructor/evaluacion/instructor-evaluacion.component');
    this.layoutDrawer.open(InstructorEvaluacionComponent, 'Evaluación Práctica', 'clipboard-pen');
  }

  async reintentarDetail(): Promise<void> {
    if (this._lastDetailSessionId !== null) {
      await this.loadClassDetail(this._lastDetailSessionId);
    }
  }

  async loadClassDetail(sessionId: number): Promise<void> {
    this._lastDetailSessionId = sessionId;
    // Caso A al cambiar de clase: limpiar al inicio para nunca mostrar la clase anterior
    this._selectedClass.set(null);
    this._detailError.set(null);
    this._detailLoading.set(true);

    if (this.useMock) {
      const mock = this.getMockClasses().find((c) => c.sessionId === sessionId);
      this._selectedClass.set(mock || null);
      this._detailLoading.set(false);
      return;
    }

    const requestToken = this.classDetailGuard.next();

    try {
      const res = await this.supabase.client
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

      const data = assertReadOk(res);
      if (!this.classDetailGuard.isCurrent(requestToken)) return;

      if (data) {
        this._selectedClass.set(this.mapSessionToRow(data));
      } else {
        this._selectedClass.set(null);
      }
    } catch (err: any) {
      console.error('Error fetching class detail:', err);
      if (!this.classDetailGuard.isCurrent(requestToken)) return;
      this._selectedClass.set(null);
      this._detailError.set('No se pudo cargar el detalle de la clase.');
    } finally {
      if (this.classDetailGuard.isCurrent(requestToken)) {
        this._detailLoading.set(false);
      }
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
            startTime: formatChilePattern(new Date(), 'HH:mm:ss')!,
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
          start_time: chileTimeOfDay(),
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
            endTime: formatChilePattern(new Date(), 'HH:mm:ss')!,
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
      const sessionRes = await this.supabase.client
        .from('class_b_sessions')
        .select('enrollment_id, vehicle_id, enrollments!inner(student_id)')
        .eq('id', sessionId)
        .maybeSingle();

      const session = assertReadOk(sessionRes);

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
          end_time: chileTimeOfDay(),
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

      // fix-362-m: la clase ya quedó finalizada; si falla la asistencia no se lanza (el instructor
      // vería un error sobre una clase que sí se cerró): se avisa qué faltó.
      const pendientes: string[] = [];
      // fix-222-b: el km del vehículo lo actualiza la BD al guardar km_end (trigger
      // trg_sync_vehicle_km_from_class); ya no se escribe desde acá y nunca retrocede.

      // 5. Register practice attendance
      if (session?.enrollments) {
        const studentId = (session.enrollments as any).student_id;
        if (studentId) {
          const attendance = await this.supabase.client.from('class_b_practice_attendance').upsert(
            {
              class_b_session_id: sessionId,
              student_id: studentId,
              status: 'present',
              // fix-191-m: si quedaba la fila archivada de una ocurrencia anterior de esta
              // sesión (reagendamiento RF-053), la asistencia de HOY vuelve a ser la vigente.
              archived_at: null,
            },
            { onConflict: 'class_b_session_id,student_id' },
          );
          if (attendance.error) pendientes.push('la asistencia del alumno');
        }
      }

      if (pendientes.length > 0) {
        this.toast.warning(
          'Clase finalizada, con datos sin guardar',
          `No se pudo actualizar ${pendientes.join(' ni ')}. Avisa a secretaría.`,
        );
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
      this._evaluationSavedTick.update((n) => n + 1);
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

  async refreshSilently(): Promise<void> {
    if (!this.profileFacade.instructorId()) return;

    const requestToken = this.listGuard.next();
    try {
      await Promise.all([
        this.loadTodayClassesQuery(requestToken),
        this.loadUpcomingDaysQuery(requestToken),
      ]);
      if (!this.listGuard.isCurrent(requestToken)) return;
      this._refreshFailed.set(false);
      this._error.set(null);
    } catch {
      if (!this.listGuard.isCurrent(requestToken)) return;
      this._refreshFailed.set(true);
    } finally {
      if (this.listGuard.isCurrent(requestToken)) {
        this._isLoading.set(false);
      }
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
    // Calcular end time aproximado si no tiene
    const endDt = new Date(dt.getTime() + row.duration_min * 60000);

    const timeLabel = `${formatChileTime(dt)} - ${formatChileTime(endDt)}`;

    // Status color
    const colorMap: Record<string, string> = {
      scheduled: 'info',
      in_progress: 'warning',
      completed: 'success',
      cancelled: 'danger',
      no_show: 'warn',
    };

    const labelMap: Record<string, string> = {
      scheduled: 'Agendada',
      in_progress: 'En Curso',
      completed: 'Completada',
      cancelled: 'Cancelada',
      no_show: 'Ausente',
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
    const today = todayIso();
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
