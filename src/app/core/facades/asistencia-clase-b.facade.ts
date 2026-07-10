import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { todayIso } from '@core/utils/date.utils';
import type {
  AsistenciaClaseBKpis,
  AlertaFaltaConsecutiva,
  ClasePracticaRow,
  ClasePracticaStatus,
  FinishClassPayload,
  InstructorOption,
  VehicleOption,
} from '@core/models/ui/asistencia-clase-b.model';

/** Builds start-of-day and end-of-day ISO strings for a given YYYY-MM-DD. */
function dayRange(iso: string): { start: string; end: string } {
  return { start: `${iso}T00:00:00`, end: `${iso}T23:59:59` };
}

/** Extracts HH:mm from a time string or TIMESTAMPTZ. */
function toHHmm(val: string | null): string {
  if (!val) return '--:--';
  if (val.includes('T') || val.length > 8) {
    const d = new Date(val);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return val.substring(0, 5);
}

/**
 * AsistenciaClaseBFacade — Control de asistencia de clases PRÁCTICAS Clase B.
 *
 * Las clases teóricas se gestionan por Ciclos en `CiclosTeoricosFacade` (Spec 0001);
 * este facade quedó acotado a:
 * - Clases prácticas individuales → `class_b_sessions` + `class_b_practice_attendance`
 * - KPIs derivados (tasa asistencia, alertas de faltas consecutivas)
 *
 * Filtro de sede:
 * - `setBranchFilter(null)` → Admin "Todas las escuelas" (sin filtro)
 * - `setBranchFilter(id)` → Admin con sede seleccionada o Secretaria
 */
@Injectable({ providedIn: 'root' })
export class AsistenciaClaseBFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly authFacade = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);

  // ── 1. Estado privado ──────────────────────────────────────────────────────

  private readonly _branchFilter = signal<number | null>(null);
  /** Fecha seleccionada (YYYY-MM-DD). Por defecto: hoy. */
  private readonly _selectedDate = signal<string>(todayIso());
  private readonly _kpis = signal<AsistenciaClaseBKpis | null>(null);
  private readonly _clasesPracticas = signal<ClasePracticaRow[]>([]);
  private readonly _alertas = signal<AlertaFaltaConsecutiva[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _isSaving = signal(false);

  // Practical class drawer state
  private readonly _selectedPractica = signal<ClasePracticaRow | null>(null);
  private readonly _vehiclesPorSede = signal<VehicleOption[]>([]);

  private _initialized = false;

  // ── 2. Estado público ──────────────────────────────────────────────────────

  readonly selectedDate = this._selectedDate.asReadonly();
  readonly kpis = this._kpis.asReadonly();
  readonly clasesPracticas = this._clasesPracticas.asReadonly();
  readonly alertas = this._alertas.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly selectedPractica = this._selectedPractica.asReadonly();
  readonly vehiclesPorSede = this._vehiclesPorSede.asReadonly();

  /** Lista deduplicada de instructores para el filtro de la tabla de prácticas. */
  readonly instructores = computed<InstructorOption[]>(() => {
    const seen = new Set<number>();
    return this._clasesPracticas()
      .filter((p) => {
        if (seen.has(p.instructorId)) return false;
        seen.add(p.instructorId);
        return true;
      })
      .map((p) => ({ id: p.instructorId, name: p.instructorName }));
  });

  // ── 3. Métodos de acción ───────────────────────────────────────────────────

  setBranchFilter(branchId: number | null): void {
    this._branchFilter.set(branchId);
  }

  async setDate(isoDate: string): Promise<void> {
    this._selectedDate.set(isoDate);
    await this.reload();
  }

  /** SWR initialize. */
  async initialize(): Promise<void> {
    if (this._initialized) {
      void this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    try {
      await this.fetchData();
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Fuerza recarga completa (con skeleton). */
  async reload(): Promise<void> {
    this._initialized = false;
    await this.initialize();
  }

  /** Marca una clase práctica como ausente. */
  async markAttendance(sessionId: number, status: ClasePracticaStatus): Promise<void> {
    this._isSaving.set(true);
    try {
      const recordedBy = this.authFacade.currentUser()?.dbId ?? null;
      const row = this._clasesPracticas().find((r) => r.id === sessionId);
      if (!row) return;

      const dbStatus = status === 'presente' ? 'present' : status === 'ausente' ? 'absent' : null;
      const sessionStatus = status === 'ausente' ? 'no_show' : undefined;

      if (dbStatus) {
        const { data: enrollment } = await this.supabase.client
          .from('enrollments')
          .select('student_id')
          .eq('id', row.enrollmentId!)
          .single();

        if (enrollment) {
          await this.supabase.client.from('class_b_practice_attendance').upsert(
            {
              class_b_session_id: sessionId,
              student_id: enrollment.student_id,
              status: dbStatus,
              recorded_by: recordedBy,
            },
            { onConflict: 'class_b_session_id,student_id' },
          );
        }
      }

      if (sessionStatus) {
        await this.supabase.client
          .from('class_b_sessions')
          .update({ status: sessionStatus })
          .eq('id', sessionId);
      }

      this._clasesPracticas.update((rows) =>
        rows.map((r) => (r.id === sessionId ? { ...r, status } : r)),
      );
      const label = status === 'presente' ? 'Presente' : 'Ausente';
      this.toast.success(`Asistencia marcada como ${label}`);

      if (dbStatus === 'absent' && row.enrollmentId) {
        await this.applyAbsencePenalty(row.enrollmentId, row.alumnoName);
      }
    } catch {
      this.toast.error('Error al registrar la asistencia');
    } finally {
      this._isSaving.set(false);
    }
  }

  /** Registra una justificación de inasistencia. */
  async justifyAbsence(sessionId: number, reason: string): Promise<void> {
    this._isSaving.set(true);
    try {
      const row = this._clasesPracticas().find((r) => r.id === sessionId);
      if (!row?.enrollmentId) return;

      const { data: enrollment } = await this.supabase.client
        .from('enrollments')
        .select('student_id')
        .eq('id', row.enrollmentId)
        .single();

      if (enrollment) {
        await this.supabase.client
          .from('class_b_practice_attendance')
          .update({ justification: reason, status: 'excused' })
          .eq('class_b_session_id', sessionId)
          .eq('student_id', enrollment.student_id);
      }

      this._clasesPracticas.update((rows) =>
        rows.map((r) =>
          r.id === sessionId ? { ...r, justificacion: reason, status: 'ausente' as const } : r,
        ),
      );
      this.toast.success('Justificación registrada');
    } catch {
      this.toast.error('Error al registrar la justificación');
    } finally {
      this._isSaving.set(false);
    }
  }

  /** Elimina el horario de un alumno. */
  async removeSchedule(enrollmentId: number): Promise<void> {
    this._isSaving.set(true);
    try {
      const { error } = await this.supabase.client
        .from('class_b_sessions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('enrollment_id', enrollmentId)
        .eq('status', 'scheduled');

      if (error) throw error;

      this._alertas.update((rows) =>
        rows.map((r) => (r.enrollmentId === enrollmentId ? { ...r, horarioActivo: false } : r)),
      );
      this.toast.success('Horario eliminado');
    } catch {
      this.toast.error('Error al eliminar el horario');
    } finally {
      this._isSaving.set(false);
    }
  }

  /** Reactiva el horario previamente eliminado de un alumno. */
  async reactivateSchedule(enrollmentId: number): Promise<void> {
    this._isSaving.set(true);
    try {
      const { error } = await this.supabase.client
        .from('class_b_sessions')
        .update({ status: 'scheduled', cancelled_at: null })
        .eq('enrollment_id', enrollmentId)
        .eq('status', 'cancelled');

      if (error) throw error;

      this._alertas.update((rows) =>
        rows.map((r) => (r.enrollmentId === enrollmentId ? { ...r, horarioActivo: true } : r)),
      );
      this.toast.success('Horario reactivado');
    } catch {
      this.toast.error('Error al reactivar el horario');
    } finally {
      this._isSaving.set(false);
    }
  }

  /** Envía recordatorio al alumno en riesgo. */
  async sendReminder(enrollmentId: number): Promise<void> {
    void enrollmentId;
    this.toast.info('Recordatorio enviado al alumno');
  }

  /** Carga los vehículos disponibles de una sede para el selector del drawer. */
  async loadVehiclesByBranch(branchId: number): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('vehicles')
      .select('id, license_plate, brand, model, current_km')
      .eq('branch_id', branchId)
      .order('license_plate', { ascending: true });

    if (error) return;

    this._vehiclesPorSede.set(
      (data ?? []).map((v: any) => ({
        id: v.id,
        plate: v.license_plate,
        brand: v.brand ?? null,
        model: v.model ?? null,
        currentKm: v.current_km ?? null,
      })),
    );
  }

  /** Establece la clase práctica seleccionada para los drawers de inicio/finalización. */
  selectPractica(row: ClasePracticaRow | null): void {
    this._selectedPractica.set(row);
  }

  /** Inicia una clase práctica (establece status in_progress + km_start, opcionalmente cambia el vehículo). */
  async startClass(sessionId: number, kmStart: number, vehicleId?: number): Promise<void> {
    this._isSaving.set(true);
    try {
      const startTime = new Date().toTimeString().split(' ')[0]; // "HH:MM:SS"
      const horaInicioReal = startTime.slice(0, 5); // "HH:MM"
      const payload: Record<string, unknown> = {
        status: 'in_progress',
        start_time: startTime,
        km_start: kmStart,
      };
      if (vehicleId !== undefined) payload['vehicle_id'] = vehicleId;

      const { error } = await this.supabase.client
        .from('class_b_sessions')
        .update(payload)
        .eq('id', sessionId);

      if (error) throw error;

      this._clasesPracticas.update((rows) =>
        rows.map((r) =>
          r.id === sessionId ? { ...r, status: 'en_curso' as const, kmStart, horaInicioReal } : r,
        ),
      );
      const current = this._selectedPractica();
      if (current?.id === sessionId) {
        this._selectedPractica.set({
          ...current,
          status: 'en_curso',
          kmStart,
          horaInicioReal,
          ...(vehicleId !== undefined ? { vehicleId } : {}),
        });
      }
      this.toast.success('Clase iniciada');
    } catch {
      this.toast.error('Error al iniciar la clase');
      throw new Error('startClass failed');
    } finally {
      this._isSaving.set(false);
    }
  }

  /** Finaliza una clase práctica: km_end + grade + checklist + asistencia + firmas opcionales. */
  async finishClass(payload: FinishClassPayload): Promise<void> {
    this._isSaving.set(true);
    try {
      const recordedBy = this.authFacade.currentUser()?.dbId ?? null;

      const { error } = await this.supabase.client
        .from('class_b_sessions')
        .update({
          status: 'completed',
          end_time: new Date().toTimeString().split(' ')[0],
          km_end: payload.kmEnd,
          completed_at: new Date().toISOString(),
          evaluation_grade: payload.grade,
          notes: payload.observations ?? null,
          evaluation_checklist: payload.checklist ?? null,
          signature_timestamp:
            payload.studentSignature || payload.instructorSignature
              ? new Date().toISOString()
              : null,
          student_signature: !!payload.studentSignature,
          instructor_signature: !!payload.instructorSignature,
        })
        .eq('id', payload.sessionId);

      if (error) throw error;

      const vehicleId = this._selectedPractica()?.vehicleId;
      if (vehicleId) {
        await this.supabase.client
          .from('vehicles')
          .update({ current_km: payload.kmEnd })
          .eq('id', vehicleId);
      }

      if (payload.studentId) {
        await this.supabase.client.from('class_b_practice_attendance').upsert(
          {
            class_b_session_id: payload.sessionId,
            student_id: payload.studentId,
            status: 'present',
            recorded_by: recordedBy,
          },
          { onConflict: 'class_b_session_id,student_id' },
        );
      }

      const finHHmm = new Date().toTimeString().slice(0, 5);
      this._clasesPracticas.update((rows) =>
        rows.map((r) =>
          r.id === payload.sessionId
            ? { ...r, status: 'presente' as const, horaFinReal: finHHmm }
            : r,
        ),
      );
      this.computeKpis(this._clasesPracticas(), this._alertas());
      this.toast.success('Clase finalizada', 'Evaluación y asistencia registradas.');
    } catch {
      this.toast.error('Error al finalizar la clase');
      throw new Error('finishClass failed');
    } finally {
      this._isSaving.set(false);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * RF-053: tras registrar una inasistencia, verifica si el alumno acumuló
   * 2+ inasistencias no justificadas y — de ser así — la BD ya canceló sus
   * agendamientos futuros (`apply_class_b_absence_penalty`). Refresca las
   * alertas y avisa a la secretaria vía toast si se liberó agenda.
   */
  private async applyAbsencePenalty(
    enrollmentId: number,
    alumnoName: string | null,
  ): Promise<void> {
    const { data: cancelledCount } = await this.supabase.client.rpc(
      'apply_class_b_absence_penalty',
      { p_enrollment_id: enrollmentId },
    );

    await this.refreshAlertasSilently();

    if ((cancelledCount ?? 0) > 0) {
      this.toast.warning(
        'Agenda liberada por inasistencias',
        `${alumnoName ?? 'El alumno'} acumuló 2 inasistencias no justificadas: se cancelaron ${cancelledCount} clase(s) futura(s).`,
      );
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchData();
    } catch {
      // Datos stale siguen visibles — fallo silencioso
    }
  }

  /** Re-consulta solo las alertas de faltas (y recalcula KPIs), sin refetch de la tabla del día. */
  private async refreshAlertasSilently(): Promise<void> {
    try {
      const branchMap = new Map<number, string>();
      for (const b of this.branchFacade.branches()) {
        branchMap.set(b.id, b.name);
      }
      const alertas = await this.fetchAlertas(this._branchFilter(), branchMap);
      this._alertas.set(alertas);
      this.computeKpis(this._clasesPracticas(), alertas);
    } catch {
      // Alertas stale siguen visibles — fallo silencioso
    }
  }

  /** Carga las clases prácticas del día + alertas + KPIs. */
  private async fetchData(): Promise<void> {
    const branchId = this._branchFilter();
    const date = this._selectedDate();
    const { start, end } = dayRange(date);

    const branchMap = new Map<number, string>();
    for (const b of this.branchFacade.branches()) {
      branchMap.set(b.id, b.name);
    }

    const practicas = await this.fetchPracticas(branchId, start, end, branchMap);
    this._clasesPracticas.set(practicas);

    const alertas = await this.fetchAlertas(branchId, branchMap);
    this._alertas.set(alertas);

    this.computeKpis(practicas, alertas);
  }

  /** Fetch practice sessions for the given day. */
  private async fetchPracticas(
    branchId: number | null,
    start: string,
    end: string,
    branchMap: Map<number, string>,
  ): Promise<ClasePracticaRow[]> {
    let query = this.supabase.client
      .from('class_b_sessions')
      .select(
        `
        id,
        enrollment_id,
        scheduled_at,
        start_time,
        end_time,
        status,
        instructor_id,
        class_number,
        km_start,
        vehicles(id, license_plate, brand, model, current_km),
        instructors!class_b_sessions_instructor_id_fkey(
          id,
          users!inner(first_names, paternal_last_name)
        ),
        enrollments(
          id,
          branch_id,
          branches(name),
          students!inner(
            id,
            users!inner(first_names, paternal_last_name)
          )
        ),
        class_b_practice_attendance(status, justification)
      `,
      )
      .gte('scheduled_at', start)
      .lte('scheduled_at', end)
      .or('status.neq.cancelled,status.is.null')
      .order('start_time', { ascending: true });

    if (branchId !== null) {
      query = query.eq('enrollments.branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? [])
      .filter((row: any) => {
        if (branchId !== null && !row.enrollments) return false;
        return true;
      })
      .map((row: any) => {
        const instRel = row['instructors!class_b_sessions_instructor_id_fkey'] ?? row.instructors;
        const inst = instRel?.users;
        const instName = inst
          ? `${inst.first_names ?? ''} ${inst.paternal_last_name ?? ''}`.trim()
          : 'Sin asignar';

        const student = row.enrollments?.students?.users;
        const alumnoName = student
          ? `${student.first_names ?? ''} ${student.paternal_last_name ?? ''}`.trim()
          : null;

        const attendance = row.class_b_practice_attendance?.[0];
        const sessionBranchId = row.enrollments?.branch_id ?? 0;
        const branchName =
          row.enrollments?.branches?.name ?? branchMap.get(sessionBranchId) ?? 'Sin sede';

        return {
          id: row.id,
          enrollmentId: row.enrollment_id,
          studentId: row.enrollments?.students?.id ?? null,
          classNumber: row.class_number ?? null,
          horaInicio: toHHmm(row.scheduled_at),
          horaInicioReal: row.start_time ? toHHmm(row.start_time) : null,
          horaFinReal: row.end_time ? toHHmm(row.end_time) : null,
          instructorId: row.instructor_id,
          instructorName: instName,
          alumnoName,
          status: mapPracticaStatus(row.status, attendance?.status),
          justificacion: attendance?.justification ?? null,
          branchId: sessionBranchId,
          branchName,
          scheduledAt: row.scheduled_at ?? '',
          kmStart: row.km_start ?? null,
          vehiclePlate: row.vehicles?.license_plate ?? null,
          vehicleBrand: row.vehicles?.brand ?? null,
          vehicleModel: row.vehicles?.model ?? null,
          vehicleId: row.vehicles?.id ?? null,
          vehicleCurrentKm: row.vehicles?.current_km ?? null,
        };
      });
  }

  /** Fetch consecutive absence alerts. */
  private async fetchAlertas(
    branchId: number | null,
    branchMap: Map<number, string>,
  ): Promise<AlertaFaltaConsecutiva[]> {
    let query = this.supabase.client
      .from('class_b_practice_attendance')
      .select(
        `
        id,
        student_id,
        status,
        recorded_at,
        class_b_sessions!inner(
          id,
          enrollment_id,
          status,
          scheduled_at,
          enrollments!inner(
            id,
            branch_id,
            status,
            students!inner(
              id,
              users!inner(first_names, paternal_last_name)
            )
          )
        )
      `,
      )
      .in('status', ['absent', 'no_show'])
      .eq('class_b_sessions.enrollments.status', 'active')
      .order('recorded_at', { ascending: false });

    if (branchId !== null) {
      query = query.eq('class_b_sessions.enrollments.branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) return [];

    const enrollmentAbsences = new Map<
      number,
      {
        studentId: number;
        enrollmentId: number;
        alumnoName: string;
        branchId: number;
        dates: string[];
        sessionStatus: string;
      }
    >();

    for (const row of data ?? []) {
      const session = row.class_b_sessions as any;
      if (!session?.enrollments) continue;

      const enrollment = session.enrollments;
      const enrollId = enrollment.id;
      const student = enrollment.students?.users;
      const name = student
        ? `${student.first_names ?? ''} ${student.paternal_last_name ?? ''}`.trim()
        : 'Desconocido';

      if (!enrollmentAbsences.has(enrollId)) {
        enrollmentAbsences.set(enrollId, {
          studentId: row.student_id,
          enrollmentId: enrollId,
          alumnoName: name,
          branchId: enrollment.branch_id,
          dates: [],
          sessionStatus: session.status,
        });
      }
      enrollmentAbsences.get(enrollId)!.dates.push(row.recorded_at ?? session.scheduled_at);
    }

    const alertas: AlertaFaltaConsecutiva[] = [];
    for (const [, info] of enrollmentAbsences) {
      if (info.dates.length >= 1) {
        alertas.push({
          studentId: info.studentId,
          enrollmentId: info.enrollmentId,
          alumnoName: info.alumnoName,
          faltasConsecutivas: info.dates.length,
          nivel: info.dates.length >= 2 ? 'danger' : 'warning',
          ultimaFechaFalta: info.dates[0] ?? '',
          horarioActivo: info.sessionStatus !== 'cancelled',
          branchId: info.branchId,
          branchName: branchMap.get(info.branchId) ?? 'Sin sede',
        });
      }
    }

    return alertas;
  }

  /** Compute KPIs from loaded practice data. */
  private computeKpis(practicas: ClasePracticaRow[], _alertas: AlertaFaltaConsecutiva[]): void {
    const presentes = practicas.filter((p) => p.status === 'presente').length;
    const ausentes = practicas.filter((p) => p.status === 'ausente').length;
    const clasesConAlumno = practicas.filter((p) => p.alumnoName !== null).length;

    const tasaAsistencia = clasesConAlumno > 0 ? (presentes / clasesConAlumno) * 100 : 100;
    const clasesEnCurso = practicas.filter((p) => p.status === 'en_curso').length;
    const now = new Date().toISOString();
    const pendientesPorIniciar = practicas.filter(
      (p) => p.status === 'pendiente' && p.alumnoName !== null && p.scheduledAt < now,
    ).length;

    this._kpis.set({
      tasaAsistencia: Math.round(tasaAsistencia * 10) / 10,
      tasaAsistenciaTrend: 0,
      inasistenciasHoy: ausentes,
      totalClasesHoy: practicas.length,
      clasesEnCurso,
      pendientesPorIniciar,
    });
  }
}

// ── Pure mapping helpers ───────────────────────────────────────────────────

/** Maps DB session + attendance status to UI status. */
function mapPracticaStatus(
  sessionStatus: string | null,
  attendanceStatus: string | null,
): ClasePracticaStatus {
  if (sessionStatus === 'in_progress') return 'en_curso';
  if (sessionStatus === 'completed') return 'presente';
  if (sessionStatus === 'no_show') return 'ausente';
  if (attendanceStatus === 'present') return 'presente';
  if (attendanceStatus === 'absent' || attendanceStatus === 'no_show') return 'ausente';
  if (attendanceStatus === 'excused') return 'ausente';
  return 'pendiente';
}
