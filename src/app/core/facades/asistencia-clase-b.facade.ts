import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { ToastService } from '@core/services/ui/toast.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { chileDayRange, chileTimeOfDay, formatChileTime } from '@core/utils/chile-time.utils';
import { todayIso } from '@core/utils/date.utils';
import { isBlockedInPilot } from '@core/config/pilot-phase.config';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import {
  NoRowsAffectedError,
  assertWriteOk,
  toFriendlyDbMessage,
} from '@core/utils/db-error.utils';
import {
  type ClassBAbsence,
  type ClassBSessionAction,
  StaleSessionError,
  VALID_CLASS_B_SESSION_STATUSES,
  enrollmentsWithConsecutiveAbsences,
  enrollmentsWithRemovedSchedule,
} from '@core/utils/class-b-session.utils';
import type {
  AsistenciaClaseBKpis,
  AlertaFaltaConsecutiva,
  ClasePracticaRow,
  ClasePracticaStatus,
  FinishClassPayload,
  InstructorOption,
  VehicleOption,
} from '@core/models/ui/asistencia-clase-b.model';

/** Extracts HH:mm from a time string or TIMESTAMPTZ. */
function toHHmm(val: string | null): string {
  if (!val) return '--:--';
  if (val.includes('T') || val.length > 8) {
    return formatChileTime(val);
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
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly toast = inject(ToastService);
  private readonly authFacade = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly notifications = inject(NotificationsFacade);
  private readonly confirmModal = inject(ConfirmModalService);

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
  /**
   * `enrollmentId` de la alerta cuya acción está en vuelo, o `null`.
   *
   * Existe aparte de `_isSaving` porque el rail de alertas tiene una acción por fila:
   * con el booleano global, apretar un botón deshabilitaba los de TODAS las alertas y
   * no se veía cuál se estaba procesando (fix-093-b).
   */
  private readonly _savingAlertaId = signal<number | null>(null);

  // Practical class drawer state
  private readonly _selectedPractica = signal<ClasePracticaRow | null>(null);
  private readonly _vehiclesPorSede = signal<VehicleOption[]>([]);

  private _initialized = false;
  /** Sede con la que se hizo la última carga completa (fix-386-m); `undefined` = ninguna. */
  private _loadedBranchId: number | null | undefined = undefined;
  /** Descarta la respuesta de una carga que quedó obsoleta (facades.md §7). */
  private readonly dataGuard = createRequestGuard();

  // ── 2. Estado público ──────────────────────────────────────────────────────

  readonly selectedDate = this._selectedDate.asReadonly();
  readonly kpis = this._kpis.asReadonly();
  readonly clasesPracticas = this._clasesPracticas.asReadonly();
  readonly alertas = this._alertas.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly savingAlertaId = this._savingAlertaId.asReadonly();
  /**
   * fix-380-m: "Recordar" es una notificación in-app; con el portal Alumno bloqueado en el piloto
   * nadie la ve, así que no se ofrece (como las invitaciones de instructores, fix-214-b).
   */
  readonly recordatoriosHabilitados = !isBlockedInPilot('alumno');
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

  /**
   * fix-386-m: al abrir la pantalla la fecha vuelve a hoy (hora de Chile). El facade es un
   * singleton: sin esto quedaba el día que dejó elegido quien la usó antes, incluso otro usuario
   * tras cerrar sesión. Si estaba en otro día, lo cargado deja de valer.
   */
  enterToday(): void {
    const today = todayIso();
    if (this._selectedDate() === today) return;
    this._selectedDate.set(today);
    this._initialized = false;
  }

  /**
   * SWR initialize. Solo reutiliza lo que hay en memoria si se cargó con la misma sede
   * (fix-386-m): los datos de otra sede, o del usuario anterior, no se muestran ni un instante.
   */
  async initialize(): Promise<void> {
    const branchId = this._branchFilter();
    if (this._initialized && branchId === this._loadedBranchId) {
      void this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._loadedBranchId = branchId;
    this._clasesPracticas.set([]);
    this._alertas.set([]);
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

  /**
   * Datos de una clase por id (fix-374-m): la tabla del día, la práctica seleccionada (drawer
   * abierto desde el Dashboard) o, si ninguna la tiene completa, la BD. Así las acciones funcionan
   * igual desde Asistencia, "Clases Actuales" o la Agenda.
   */
  private async resolvePractica(
    sessionId: number,
  ): Promise<{ enrollmentId: number; scheduledAt: string; alumnoName: string | null } | null> {
    const selected = this._selectedPractica();
    const local =
      this._clasesPracticas().find((r) => r.id === sessionId) ??
      (selected?.id === sessionId ? selected : null);
    if (local?.enrollmentId && local.scheduledAt) {
      return {
        enrollmentId: local.enrollmentId,
        scheduledAt: local.scheduledAt,
        alumnoName: local.alumnoName,
      };
    }
    const { data } = await this.supabase.client
      .from('class_b_sessions')
      .select(
        'enrollment_id, scheduled_at, enrollments(students(users(first_names, paternal_last_name)))',
      )
      .eq('id', sessionId)
      .maybeSingle();
    if (!data) return null;
    const u = (data as any).enrollments?.students?.users;
    const nombre = u ? `${u.first_names ?? ''} ${u.paternal_last_name ?? ''}`.trim() : '';
    return {
      enrollmentId: data.enrollment_id,
      scheduledAt: data.scheduled_at,
      alumnoName: local?.alumnoName ?? (nombre || null),
    };
  }

  /** Marca una clase práctica como ausente. Devuelve si quedó registrada (fix-374-m). */
  async markAttendance(sessionId: number, status: ClasePracticaStatus): Promise<boolean> {
    this._isSaving.set(true);
    try {
      const recordedBy = this.authFacade.currentUser()?.dbId ?? null;
      const row = await this.resolvePractica(sessionId);
      if (!row) return false;

      // fix-371-m: la BD también lo rechaza; aquí se avisa sin escribir nada.
      if (status === 'ausente' && row.scheduledAt && new Date(row.scheduledAt) > new Date()) {
        this.toast.error(
          'La clase todavía no empieza',
          'La inasistencia se registra después de la hora agendada.',
        );
        return false;
      }

      const dbStatus = status === 'presente' ? 'present' : status === 'ausente' ? 'absent' : null;

      if (dbStatus) {
        const { data: enrollment } = await this.supabase.client
          .from('enrollments')
          .select('student_id')
          .eq('id', row.enrollmentId!)
          .single();

        // fix-362-m: sin la matrícula no hay a quién registrarle la asistencia; antes se
        // saltaba el upsert y el toast decía "marcada" igual.
        if (!enrollment) throw new NoRowsAffectedError();

        // fix-388-m: primero la sesión, y solo si sigue pendiente. Antes se escribía la asistencia
        // y después el estado sin mirar cómo estaba: una pestaña sin actualizar dejaba "Ausente"
        // una clase que otra persona ya había iniciado.
        if (status === 'ausente') {
          try {
            await this.moveSession(sessionId, 'scheduled', { status: 'no_show' }, 'absent');
          } catch (err) {
            if (err instanceof StaleSessionError && err.actualStatus === 'no_show') {
              // Otra persona ya la marcó: no hay nada que corregir ni que avisar como error.
              this.toast.info('La inasistencia ya estaba registrada');
              await this.refreshSilently();
              return true;
            }
            throw err;
          }
        }

        try {
          assertWriteOk(
            await this.supabase.client.from('class_b_practice_attendance').upsert(
              {
                class_b_session_id: sessionId,
                student_id: enrollment.student_id,
                status: dbStatus,
                recorded_by: recordedBy,
                // fix-191-m: la sesión vuelve a tener asistencia vigente; si quedaba la fila
                // archivada de una ocurrencia anterior (reagendamiento), se reactiva.
                archived_at: null,
                // spec 0048-b: la penalización solo cuenta faltas registradas desde que se activó
                // la regla en la sede; sin esto, un upsert sobre una fila existente conservaba la
                // fecha vieja y la falta nueva no contaba.
                recorded_at: new Date().toISOString(),
              },
              { onConflict: 'class_b_session_id,student_id' },
            ),
          );
        } catch (err) {
          // Sin su asistencia, la clase no puede quedar "Ausente": vuelve a pendiente.
          if (status === 'ausente') {
            const revert = await this.supabase.client
              .from('class_b_sessions')
              .update({ status: 'scheduled' })
              .eq('id', sessionId)
              .eq('status', 'no_show');
            if (revert.error) {
              this.toast.warning(
                'La clase quedó como ausente sin su registro',
                'No se pudo devolver a pendiente. Actualiza la lista y avisa al administrador.',
              );
            }
          }
          throw err;
        }
      }

      this._clasesPracticas.update((rows) =>
        rows.map((r) => (r.id === sessionId ? { ...r, status } : r)),
      );
      const label = status === 'presente' ? 'Presente' : 'Ausente';
      this.toast.success(`Asistencia marcada como ${label}`);

      if (dbStatus === 'absent' && row.enrollmentId) {
        await this.applyAbsencePenalty(row.enrollmentId, row.alumnoName);
      }
      return true;
    } catch (err) {
      if (err instanceof StaleSessionError) {
        await this.reportStaleSession(err);
        return false;
      }
      this.toast.error(toFriendlyDbMessage(err, 'Error al registrar la asistencia'));
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * fix-388-m: cambia el estado de una clase solo si sigue en `from`, el estado que la persona
   * tenía en pantalla. Sin tiempo real, dos personas pueden ver la misma clase "Pendiente": la
   * segunda en actuar no debe pisar lo que registró la primera. Si no tocó filas, lee el estado
   * real y lanza `StaleSessionError`; si tampoco puede leerla (RLS), `NoRowsAffectedError`.
   */
  private async moveSession(
    sessionId: number,
    from: 'scheduled' | 'in_progress',
    patch: Record<string, unknown>,
    action: ClassBSessionAction,
  ): Promise<void> {
    const result = assertWriteOk(
      await this.supabase.client
        .from('class_b_sessions')
        .update(patch)
        .eq('id', sessionId)
        .eq('status', from)
        .select('id'),
    );
    if (Array.isArray(result.data) && result.data.length > 0) return;

    const { data: current } = await this.supabase.client
      .from('class_b_sessions')
      .select('status')
      .eq('id', sessionId)
      .maybeSingle();
    if (!current?.status) throw new NoRowsAffectedError();
    throw new StaleSessionError(action, current.status);
  }

  /** Avisa que la clase cambió mientras se miraba y trae el estado real de la tabla. */
  private async reportStaleSession(err: StaleSessionError): Promise<void> {
    this.toast.warning('La clase cambió', `${err.message} La lista se actualizó.`);
    await this.refreshSilently();
  }

  /**
   * fix-377-m: deshace una inasistencia SIN justificar marcada por error. Archiva la falta (queda
   * en el historial, como al reagendar — fix-191-m) y la clase vuelve a 'scheduled' ("Pendiente").
   * Las clases que esa falta haya cancelado por penalización NO vuelven solas: se avisa.
   */
  async undoAbsence(sessionId: number): Promise<boolean> {
    const target = await this.resolvePractica(sessionId);
    const confirmed = await this.confirmModal.confirm({
      title: 'Deshacer inasistencia',
      message: `La clase de ${target?.alumnoName ?? 'este alumno'} vuelve a quedar pendiente y la falta pasa al historial. Si esa falta ya canceló clases por penalización, esas clases no vuelven solas: se reagendan desde la ficha del alumno.`,
      confirmLabel: 'Deshacer',
      cancelLabel: 'Cancelar',
      severity: 'warn',
    });
    if (!confirmed) return false;

    this._isSaving.set(true);
    try {
      const recordedAt = await this.archiveCurrentAbsence(sessionId);
      if (recordedAt === null) return false;
      assertWriteOk(
        await this.supabase.client
          .from('class_b_sessions')
          .update({ status: 'scheduled' })
          .eq('id', sessionId)
          .eq('status', 'no_show')
          .select('id'),
        { requireRows: true },
      );

      const canceladas = target?.enrollmentId
        ? await this.countCancelledSince(target.enrollmentId, recordedAt)
        : 0;

      this.toast.success('Inasistencia deshecha', 'La clase quedó pendiente.');
      if (canceladas > 0) {
        this.toast.warning(
          'Clases canceladas por la penalización',
          `${canceladas} clase(s) se cancelaron después de esta falta y siguen canceladas. Reagéndalas desde la ficha del alumno.`,
        );
      }
      await this.refreshSilently();
      return true;
    } catch (err) {
      this.toast.error(toFriendlyDbMessage(err, 'Error al deshacer la inasistencia'));
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * fix-377-m: archiva la falta vigente (sin justificar) de una sesión. Devuelve su `recorded_at`,
   * o `null` si no hay una falta que deshacer (ya avisado al usuario).
   */
  private async archiveCurrentAbsence(sessionId: number): Promise<string | null> {
    const { data: att, error } = await this.supabase.client
      .from('class_b_practice_attendance')
      .select('id, status, recorded_at')
      .eq('class_b_session_id', sessionId)
      .is('archived_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!att || (att.status !== 'absent' && att.status !== 'no_show')) {
      this.toast.error(
        'No se puede deshacer',
        att?.status === 'excused'
          ? 'La inasistencia está justificada.'
          : 'La clase no tiene una inasistencia vigente.',
      );
      return null;
    }
    assertWriteOk(
      await this.supabase.client
        .from('class_b_practice_attendance')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', att.id)
        .select('id'),
      { requireRows: true },
    );
    return att.recorded_at ?? '';
  }

  /** fix-377-m: clases de la matrícula canceladas desde un instante (¿la falta disparó la penalización?). */
  private async countCancelledSince(enrollmentId: number, since: string): Promise<number> {
    if (!since) return 0;
    const { count } = await this.supabase.client
      .from('class_b_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .eq('status', 'cancelled')
      .gte('cancelled_at', since);
    return count ?? 0;
  }

  /**
   * fix-378-m: cancela el inicio de una clase iniciada por error. Vuelve a 'scheduled'
   * ("Pendiente") sin hora ni km de inicio; desde ahí se marca ausente o se inicia de nuevo.
   */
  async cancelStart(sessionId: number): Promise<boolean> {
    const target = await this.resolvePractica(sessionId);
    const confirmed = await this.confirmModal.confirm({
      title: 'Cancelar inicio',
      message: `La clase de ${target?.alumnoName ?? 'este alumno'} vuelve a quedar pendiente, sin hora ni kilometraje de inicio. Úsalo si la clase se inició por error.`,
      confirmLabel: 'Cancelar inicio',
      cancelLabel: 'Volver',
      severity: 'warn',
    });
    if (!confirmed) return false;

    this._isSaving.set(true);
    try {
      assertWriteOk(
        await this.supabase.client
          .from('class_b_sessions')
          .update({ status: 'scheduled', start_time: null, km_start: null })
          .eq('id', sessionId)
          .eq('status', 'in_progress')
          .select('id'),
        { requireRows: true },
      );
      this.toast.success('Inicio cancelado', 'La clase quedó pendiente.');
      await this.refreshSilently();
      return true;
    } catch (err) {
      this.toast.error(toFriendlyDbMessage(err, 'Error al cancelar el inicio'));
      return false;
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

      if (!enrollment) throw new NoRowsAffectedError();

      // fix-362-m: requireRows — si no hay fila de asistencia vigente (o la RLS la filtra), el
      // update no toca nada y sin esto el toast decía "Justificación registrada" igual.
      const result = assertWriteOk(
        await this.supabase.client
          .from('class_b_practice_attendance')
          .update({ justification: reason, status: 'excused' })
          .eq('class_b_session_id', sessionId)
          .eq('student_id', enrollment.student_id)
          // fix-191-m: nunca reescribir el registro histórico de una ocurrencia ya reagendada.
          .is('archived_at', null)
          .select('id, recorded_at'),
        { requireRows: true },
      );

      this._clasesPracticas.update((rows) =>
        rows.map((r) =>
          r.id === sessionId ? { ...r, justificacion: reason, status: 'ausente' as const } : r,
        ),
      );
      this.toast.success('Justificación registrada');

      // fix-379-m (G05): justificar no devuelve las clases que la falta ya canceló.
      const recordedAt = (result.data as { recorded_at: string | null }[])[0]?.recorded_at ?? '';
      const canceladas = await this.countCancelledSince(row.enrollmentId, recordedAt);
      if (canceladas > 0) {
        this.toast.warning(
          'Las clases canceladas no vuelven solas',
          `${canceladas} clase(s) se cancelaron después de esta falta. Reagéndalas desde la ficha del alumno.`,
        );
      }
      // fix-379-m (G06): la falta justificada deja de contar en el rail.
      await this.refreshAlertasSilently();
    } catch (err) {
      this.toast.error(toFriendlyDbMessage(err, 'Error al registrar la justificación'));
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Elimina (cancela) el horario de un alumno.
   *
   * Pide confirmación: cancela las clases agendadas de esa matrícula de un solo clic y hasta
   * fix-093-b no había forma de deshacerlo por error. Solo toca clases FUTURAS (fix-364-m): una
   * clase de una hora ya pasada queda para registrarse como asistencia o inasistencia.
   */
  async removeSchedule(enrollmentId: number): Promise<void> {
    const alerta = this._alertas().find((a) => a.enrollmentId === enrollmentId);
    const confirmed = await this.confirmModal.confirm({
      title: 'Eliminar horario',
      message: `Se cancelarán todas las clases prácticas futuras de ${
        alerta?.alumnoName ?? 'este alumno'
      }. Puedes reactivarlas después desde la misma alerta.`,
      confirmLabel: 'Eliminar horario',
      cancelLabel: 'Cancelar',
      severity: 'danger',
    });
    if (!confirmed) return;

    this._isSaving.set(true);
    this._savingAlertaId.set(enrollmentId);
    try {
      const { data, error } = await this.supabase.client
        .from('class_b_sessions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('enrollment_id', enrollmentId)
        .eq('status', 'scheduled')
        .gt('scheduled_at', new Date().toISOString())
        .select('id');

      if (error) throw error;

      if (!data?.length) {
        this.toast.info('Este alumno no tiene clases futuras agendadas');
        return;
      }

      this._alertas.update((rows) =>
        rows.map((r) => (r.enrollmentId === enrollmentId ? { ...r, horarioActivo: false } : r)),
      );
      this.toast.success('Horario eliminado');
    } catch {
      this.toast.error('Error al eliminar el horario');
    } finally {
      this._isSaving.set(false);
      this._savingAlertaId.set(null);
    }
  }

  /**
   * Reactiva el horario previamente eliminado de un alumno.
   *
   * fix-364-m: solo las clases canceladas FUTURAS y con confirmación. Antes revivía también las
   * de fechas pasadas, que el cierre nocturno convertía en inasistencias esa misma noche. La
   * disponibilidad la revisan los triggers de doble agendamiento de la BD (instructor, alumno y
   * vehículo); como es un solo UPDATE, si un horario ya está ocupado no se reactiva ninguna.
   */
  async reactivateSchedule(enrollmentId: number): Promise<void> {
    const alerta = this._alertas().find((a) => a.enrollmentId === enrollmentId);

    this._isSaving.set(true);
    this._savingAlertaId.set(enrollmentId);
    try {
      const { data: futuras, error: lookupError } = await this.supabase.client
        .from('class_b_sessions')
        .select('id')
        .eq('enrollment_id', enrollmentId)
        .eq('status', 'cancelled')
        .gt('scheduled_at', new Date().toISOString());

      if (lookupError) throw lookupError;

      const ids = (futuras ?? []).map((s: { id: number }) => s.id);
      if (ids.length === 0) {
        this.toast.info(
          'No hay clases futuras para reactivar',
          'Para darle nuevas horas usa "Reagendar Clases" en la ficha del alumno.',
        );
        return;
      }

      const confirmed = await this.confirmModal.confirm({
        title: 'Reactivar horario',
        message: `${
          ids.length === 1
            ? 'Se volverá a agendar 1 clase futura'
            : `Se volverán a agendar ${ids.length} clases futuras`
        } de ${alerta?.alumnoName ?? 'este alumno'}, en su horario original. Las clases de fechas pasadas quedan canceladas.`,
        confirmLabel: 'Reactivar',
        cancelLabel: 'Cancelar',
        severity: 'warn',
      });
      if (!confirmed) return;

      assertWriteOk(
        await this.supabase.client
          .from('class_b_sessions')
          .update({ status: 'scheduled', cancelled_at: null })
          .in('id', ids)
          .eq('status', 'cancelled')
          .select('id'),
        { requireRows: true },
      );

      this._alertas.update((rows) =>
        rows.map((r) => (r.enrollmentId === enrollmentId ? { ...r, horarioActivo: true } : r)),
      );
      this.toast.success('Horario reactivado');
    } catch (err) {
      // P0001 = mensaje del trigger de doble agendamiento, ya redactado para el usuario.
      this.toast.error('No se pudo reactivar el horario', this.sanitizer.sanitize(err).message);
    } finally {
      this._isSaving.set(false);
      this._savingAlertaId.set(null);
    }
  }

  /**
   * Envía un recordatorio in-app al alumno en riesgo por faltas consecutivas.
   *
   * La alerta ya trae `studentId` en estado, así que solo falta resolver
   * `students.user_id` → `users.id`: `students.id` NO es el `users.id` que espera
   * `notifications.recipient_id` (patrón FK de spec 0024).
   *
   * El toast de éxito se emite **solo** si la notificación se insertó de verdad
   * (fix-093-b: antes era un stub que afirmaba el envío sin hacer nada).
   */
  async sendReminder(enrollmentId: number): Promise<void> {
    const alerta = this._alertas().find((a) => a.enrollmentId === enrollmentId);
    if (!alerta) return;

    this._isSaving.set(true);
    this._savingAlertaId.set(enrollmentId);
    try {
      const { data, error } = await this.supabase.client
        .from('students')
        .select('user_id')
        .eq('id', alerta.studentId)
        .single();

      if (error) throw error;

      const userId = data?.user_id;
      if (!userId) {
        this.toast.error('El alumno no tiene una cuenta asociada para recibir el recordatorio');
        return;
      }

      await this.notifications.notifyUsers([userId], {
        subject: 'Recordatorio de asistencia',
        // fix-380-m: las faltas pueden no ser seguidas; y "1 falta consecutivas" no concordaba.
        message: `Registramos ${alerta.faltasConsecutivas} ${
          alerta.faltasConsecutivas === 1 ? 'falta' : 'faltas'
        } sin justificar en tus clases prácticas. Contáctanos para reagendar antes de perder tu horario.`,
        referenceType: 'class_b',
      });

      this.toast.success('Recordatorio enviado al alumno');
    } catch {
      this.toast.error('No se pudo enviar el recordatorio');
    } finally {
      this._isSaving.set(false);
      this._savingAlertaId.set(null);
    }
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
      const startTime = chileTimeOfDay(); // "HH:MM:SS" de Chile (fix-370-m)
      const horaInicioReal = startTime.slice(0, 5); // "HH:MM"
      const payload: Record<string, unknown> = {
        status: 'in_progress',
        start_time: startTime,
        km_start: kmStart,
      };
      if (vehicleId !== undefined) payload['vehicle_id'] = vehicleId;

      // fix-388-m: solo se inicia una clase que sigue pendiente.
      await this.moveSession(sessionId, 'scheduled', payload, 'start');

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
      // fix-370-m: la fila, el vehículo elegido y los KPIs salen de la BD (antes quedaban con el
      // vehículo anterior y los KPIs sin recalcular hasta recargar).
      await this.refreshSilently();
    } catch (err) {
      if (err instanceof StaleSessionError) {
        await this.reportStaleSession(err);
        throw err;
      }
      const sanitized = this.sanitizer.sanitize(err);
      this.toast.error('Error al iniciar la clase', sanitized.message);
      throw new Error(sanitized.message);
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Finaliza una clase práctica desde admin/secretaria: km_end + asistencia + firmas
   * opcionales. No toca evaluación (grade/checklist/notes) — es materia exclusiva del
   * instructor, que la completa por separado (fix-115-m).
   */
  async finishClass(payload: FinishClassPayload): Promise<void> {
    this._isSaving.set(true);
    try {
      const recordedBy = this.authFacade.currentUser()?.dbId ?? null;

      // fix-388-m: solo se finaliza una clase que sigue en curso.
      await this.moveSession(
        payload.sessionId,
        'in_progress',
        {
          status: 'completed',
          end_time: chileTimeOfDay(),
          km_end: payload.kmEnd,
          completed_at: new Date().toISOString(),
          signature_timestamp:
            payload.studentSignature || payload.instructorSignature
              ? new Date().toISOString()
              : null,
          student_signature: !!payload.studentSignature,
          instructor_signature: !!payload.instructorSignature,
        },
        'finish',
      );

      // fix-362-m: a esta altura la clase YA quedó finalizada. Si falla el KM o la asistencia no
      // se lanza (el catch diría "Error al finalizar la clase" sobre una clase finalizada): se
      // avisa qué quedó sin guardar.
      const pendientes: string[] = [];

      const vehicleId = this._selectedPractica()?.vehicleId;
      if (vehicleId) {
        // .select() + filas: un vehículo de otra sede lo filtra la RLS sin devolver error.
        const km = await this.supabase.client
          .from('vehicles')
          .update({ current_km: payload.kmEnd })
          .eq('id', vehicleId)
          .select('id');
        if (km.error || !km.data?.length) pendientes.push('el kilometraje del vehículo');
      }

      if (payload.studentId) {
        const attendance = await this.supabase.client.from('class_b_practice_attendance').upsert(
          {
            class_b_session_id: payload.sessionId,
            student_id: payload.studentId,
            status: 'present',
            recorded_by: recordedBy,
            archived_at: null, // fix-191-m: la asistencia de esta ocurrencia es la vigente
          },
          { onConflict: 'class_b_session_id,student_id' },
        );
        if (attendance.error) pendientes.push('la asistencia del alumno');
      }

      const finHHmm = chileTimeOfDay().slice(0, 5);
      this._clasesPracticas.update((rows) =>
        rows.map((r) =>
          r.id === payload.sessionId
            ? { ...r, status: 'presente' as const, horaFinReal: finHHmm }
            : r,
        ),
      );
      this.computeKpis(this._clasesPracticas(), this._alertas());
      if (pendientes.length > 0) {
        this.toast.warning(
          'Clase finalizada, con datos sin guardar',
          `No se pudo actualizar ${pendientes.join(' ni ')}. Avisa al administrador.`,
        );
      } else {
        // fix-373-m: desde Asistencia no se evalúa (fix-115-m); solo se registra la asistencia.
        this.toast.success('Clase finalizada', 'Asistencia registrada.');
      }
    } catch (err) {
      if (err instanceof StaleSessionError) {
        await this.reportStaleSession(err);
        throw err;
      }
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
    const { data: cancelledCount, error } = await this.supabase.client.rpc(
      'apply_class_b_absence_penalty',
      { p_enrollment_id: enrollmentId },
    );

    await this.refreshAlertasSilently();

    // fix-362-m: la falta ya quedó registrada; lo que no se sabe es si se aplicó la regla.
    if (error) {
      this.toast.warning(
        'No se pudo revisar la penalización',
        `La inasistencia de ${alumnoName ?? 'el alumno'} quedó registrada, pero no se pudo verificar si corresponde cancelar su agenda.`,
      );
      return;
    }

    // spec 0048-b: -1 = la cancelación automática está desactivada en la sede. Si el alumno
    // igual quedó con 2 faltas seguidas, se avisa que su agenda NO se canceló (AC-E2).
    if (cancelledCount === -1) {
      // fix-379-m: 'danger' = faltas en dos clases seguidas (la regla de la RPC).
      const quedoEnRiesgo = this._alertas().some(
        (a) => a.enrollmentId === enrollmentId && a.nivel === 'danger',
      );
      if (quedoEnRiesgo) {
        this.toast.info(
          'Agenda no cancelada',
          `${alumnoName ?? 'El alumno'} tiene 2 inasistencias seguidas, pero la cancelación automática está desactivada en esta sede. Sus clases siguen agendadas.`,
        );
      }
      return;
    }

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
    const { start, endExclusive } = chileDayRange(date);

    const branchMap = new Map<number, string>();
    for (const b of this.branchFacade.branches()) {
      branchMap.set(b.id, b.name);
    }

    const requestToken = this.dataGuard.next();
    const practicas = await this.fetchPracticas(branchId, start, endExclusive, branchMap);
    if (!this.dataGuard.isCurrent(requestToken)) return;
    this._clasesPracticas.set(practicas);

    const alertas = await this.fetchAlertas(branchId, branchMap);
    if (!this.dataGuard.isCurrent(requestToken)) return;
    this._alertas.set(alertas);

    this.computeKpis(practicas, alertas);
  }

  /** Fetch practice sessions for the given day. */
  private async fetchPracticas(
    branchId: number | null,
    start: string,
    endExclusive: string,
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
        enrollments!inner(
          id,
          branch_id,
          branches(name),
          students!inner(
            id,
            users!inner(first_names, paternal_last_name)
          )
        ),
        class_b_practice_attendance(status, justification, archived_at)
      `,
      )
      .gte('scheduled_at', start)
      .lt('scheduled_at', endExclusive)
      .in('status', VALID_CLASS_B_SESSION_STATUSES)
      .eq('enrollments.status', 'active')
      // fix-369-m: por hora agendada; start_time es la hora real y es nula hasta iniciar.
      .order('scheduled_at', { ascending: true });

    if (branchId !== null) {
      query = query.eq('enrollments.branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // fix-369-m: enrollments!inner descarta en la BD las sesiones de matrículas no activas;
    // antes llegaban con enrollments = null cuando no había sede elegida.
    return (data ?? []).map((row: any) => {
      const instRel = row['instructors!class_b_sessions_instructor_id_fkey'] ?? row.instructors;
      const inst = instRel?.users;
      const instName = inst
        ? `${inst.first_names ?? ''} ${inst.paternal_last_name ?? ''}`.trim()
        : 'Sin asignar';

      const student = row.enrollments?.students?.users;
      const alumnoName = student
        ? `${student.first_names ?? ''} ${student.paternal_last_name ?? ''}`.trim()
        : null;

      // fix-191-m: solo la asistencia VIGENTE describe el estado de la sesión. Una fila
      // archivada es el registro histórico de una ocurrencia anterior de esa misma sesión
      // (reagendamiento RF-053, que recicla la fila en vez de crear una nueva); tomarla
      // pintaba "Ausente" una clase que está agendada.
      const attendance = (row.class_b_practice_attendance ?? []).find(
        (a: any) => a.archived_at == null,
      );
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
          class_number,
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
      // fix-191-m: una falta ya reagendada quedó archivada — es historial, no una
      // falta viva. Sin esto seguía alimentando la alerta de faltas consecutivas.
      .is('archived_at', null)
      .eq('class_b_sessions.enrollments.status', 'active')
      .in('class_b_sessions.status', VALID_CLASS_B_SESSION_STATUSES)
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
    const absences: ClassBAbsence[] = [];

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
      // fix-379-m: la fecha de la falta es la de la clase, no la de cuándo se registró.
      enrollmentAbsences.get(enrollId)!.dates.push(session.scheduled_at ?? row.recorded_at);
      absences.push({ enrollmentId: enrollId, classNumber: session.class_number ?? null });
    }

    const sinHorario = await this.fetchEnrollmentsWithRemovedSchedule([
      ...enrollmentAbsences.keys(),
    ]);
    // fix-379-m: rojo solo con faltas en dos clases seguidas — la regla de la RPC y del Dashboard.
    const conFaltasSeguidas = new Set(enrollmentsWithConsecutiveAbsences(absences));

    const alertas: AlertaFaltaConsecutiva[] = [];
    for (const [, info] of enrollmentAbsences) {
      if (info.dates.length >= 1) {
        const dates = [...info.dates].sort().reverse();
        alertas.push({
          studentId: info.studentId,
          enrollmentId: info.enrollmentId,
          alumnoName: info.alumnoName,
          faltasConsecutivas: info.dates.length,
          nivel: conFaltasSeguidas.has(info.enrollmentId) ? 'danger' : 'warning',
          ultimaFechaFalta: dates[0] ?? '',
          horarioActivo: !sinHorario.has(info.enrollmentId),
          branchId: info.branchId,
          branchName: branchMap.get(info.branchId) ?? 'Sin sede',
        });
      }
    }

    return alertas;
  }

  /**
   * Matrículas cuyo horario está eliminado, mirando sus clases FUTURAS.
   *
   * fix-365-m: antes se deducía del estado de la clase de la falta, que está en no_show y nunca
   * en cancelled, así que tras recargar la alerta volvía a ofrecer "Eliminar" y "Reactivar"
   * quedaba inalcanzable. Si la consulta falla se asume horario activo.
   */
  private async fetchEnrollmentsWithRemovedSchedule(enrollmentIds: number[]): Promise<Set<number>> {
    if (enrollmentIds.length === 0) return new Set();

    const { data, error } = await this.supabase.client
      .from('class_b_sessions')
      .select('enrollment_id, status')
      .in('enrollment_id', enrollmentIds)
      .in('status', ['scheduled', 'cancelled'])
      .gt('scheduled_at', new Date().toISOString());
    if (error) return new Set();

    return enrollmentsWithRemovedSchedule(
      (data ?? []).map((s: { enrollment_id: number; status: string }) => ({
        enrollmentId: s.enrollment_id,
        status: s.status,
      })),
    );
  }

  /** Compute KPIs from loaded practice data. */
  private computeKpis(practicas: ClasePracticaRow[], _alertas: AlertaFaltaConsecutiva[]): void {
    const presentes = practicas.filter((p) => p.status === 'presente').length;
    const ausentes = practicas.filter((p) => p.status === 'ausente').length;
    // fix-373-m: solo cuentan las clases ya registradas; una pendiente no es una inasistencia.
    const registradas = presentes + ausentes;
    const tasaAsistencia = registradas > 0 ? (presentes / registradas) * 100 : 100;
    const clasesEnCurso = practicas.filter((p) => p.status === 'en_curso').length;
    const now = new Date().toISOString();
    const pendientesPorIniciar = practicas.filter(
      (p) => p.status === 'pendiente' && p.alumnoName !== null && p.scheduledAt < now,
    ).length;

    this._kpis.set({
      tasaAsistencia: Math.round(tasaAsistencia * 10) / 10,
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
