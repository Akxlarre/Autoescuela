import { Injectable, inject, signal, computed } from '@angular/core';
import { addDaysIso, chileMonth } from '@core/utils/chile-time.utils';
import { PAYMENT_STATUSES_QUE_SUMAN } from '@core/utils/payment-status.utils';
import { todayIso } from '@core/utils/date.utils';

import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { ToastService } from '@core/services/ui/toast.service';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import { isBlockedInPilot } from '@core/config/pilot-phase.config';
import {
  filterSnoozedAlerts,
  parseSnoozes,
  pruneSnoozes,
  snoozeAlert,
  type AlertSnoozeMap,
} from '@core/utils/alert-snooze.utils';
import {
  VALID_CLASS_B_SESSION_STATUSES,
  buildClearScheduleMessage,
  enrollmentsWithConsecutiveAbsences,
  enrollmentsWithUnpenalizedPair,
} from '@core/utils/class-b-session.utils';
import { assertWriteOk, toFriendlyDbMessage } from '@core/utils/db-error.utils';
import type { AlertModel } from '@core/models/ui/dashboard.model';

/**
 * supabase-js no lanza cuando una consulta falla: devuelve { error }. Tratar eso como
 * "0 resultados" hacía ver "Todo en orden" (o una "Caja sin cerrar" falsa) con la red caída.
 * Toda consulta de una revisión de alertas pasa por acá (fix-405-m).
 */
async function queryOk<T = any>(query: PromiseLike<T>): Promise<T> {
  const result = await query;
  const error = (result as { error?: unknown } | null)?.error;
  if (error) throw error;
  return result;
}

/**
 * DashboardAlertsFacade — Capa 3 del sistema de notificaciones.
 *
 * Alertas computadas en tiempo real desde el estado de la BD.
 * A diferencia de las notificaciones (historial), las alertas son
 * estado vivo: queries que reflejan condiciones actuales.
 *
 * Queries paralelas (17):
 * Fase 1 & 2:
 *  1. Documentos de vehículos vencidos/por vencer
 *  2. Pagos pendientes de matrículas activas
 *  3. (B-1) Alumnos en 6ª clase con saldo pendiente
 *  4. (B-2) Alumnos con 12ª clase completada pendientes de certificado
 *  5. (B-3) Alumnos con inasistencias en 2 clases seguidas
 *  6. (F-3) Caja sin cerrar el día de hoy
 *  7. (F-4) Alumnos con deuda superior a 2 meses
 * Fase 3 — Pagos y Finanzas:
 *  8. (F-1) Pagos registrados hoy
 *  9. (F-2) Cuota 2 vencida: clase 7+ tomada con saldo pendiente
 * 10. (F-5) Instructores con horas sin liquidar en el período actual
 * Fase 3 — Pre-inscripciones Profesionales:
 * 11. (P-1) Nuevas pre-inscripciones pendientes de revisión
 * 12. (P-2) Tests psicológicos completados sin evaluación
 * 13. (P-3) Pre-inscripciones por vencer en 7 días
 * Fase 3 — Clase Profesional:
 * 14. (R-1) Alumnos con asistencia en rojo
 * 15. (R-2) Alumnos con asistencia en amarillo
 * 16. (R-3) Módulos reprobados (nota < 75, confirmados)
 * 17. (R-6) Calificaciones en borrador sin confirmar
 */
@Injectable({ providedIn: 'root' })
export class DashboardAlertsFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly toast = inject(ToastService);

  // ── SWR State ────────────────────────────────────────────────────────────
  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;
  /** Número de la última carga con skeleton (ver `initialize`). */
  private _loadTicket = 0;
  /** Usuario para el que se cargaron las alertas guardadas (ver `initialize`). */
  private _loadedUserId: string | null = null;
  /** Descarta respuestas de fetchAlertsData() fuera de orden (facades.md §7, fix-404-m). */
  private readonly alertsGuard = createRequestGuard();
  private readonly SNOOZE_KEY = 'ds_snoozed_alerts';

  // ── 1. ESTADO PRIVADO ──────────────────────────────────────────────────────
  private _activeAlerts = signal<AlertModel[]>([]);
  private _isLoading = signal(false);
  private _error = signal<string | null>(null);
  /** Alguna revisión falló en la última carga: la lista puede estar incompleta. */
  private _incomplete = signal(false);

  // ── 2. ESTADO PÚBLICO (readonly) ───────────────────────────────────────────
  readonly activeAlerts = this._activeAlerts.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  /**
   * Texto para mostrar cuando la lista de alertas no es confiable: la carga falló entera o
   * faltó alguna revisión. `null` = la lista está completa. Quien pinta alertas lo muestra en
   * vez de "Todo en orden" (fix-405-m).
   */
  readonly loadProblem = computed(() => {
    if (this._error()) return 'No se pudieron revisar las alertas.';
    return this._incomplete() ? 'No se pudieron revisar todas las alertas.' : null;
  });
  readonly alertCount = computed(() => this._activeAlerts().length);

  // ── 3. MÉTODOS DE ACCIÓN ───────────────────────────────────────────────────

  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }

  /**
   * SWR: primera llamada muestra skeleton, revisitas refrescan en background.
   */
  async initialize(): Promise<void> {
    const branchId = this.getActiveBranchId();

    // Lo guardado es de quien lo cargó: si entró otra persona en la misma pestaña se descarta
    // en vez de mostrarlo mientras refresca (fix-409-m).
    const userId = this.auth.currentUser()?.id ?? null;
    if (userId !== this._loadedUserId) {
      this._loadedUserId = userId;
      this._initialized = false;
      this._activeAlerts.set([]);
      this._incomplete.set(false);
    }

    if (this._initialized && branchId === this._lastBranchId) {
      void this.refreshSilently();
      return;
    }

    // Solo la carga más reciente apaga isLoading, registra la sede cargada o muestra su error
    // (fix-404-m): una carga vieja que termina después no debe dejar la lista como "lista".
    const ticket = ++this._loadTicket;
    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchAlertsData(branchId);
      if (ticket === this._loadTicket) {
        this._initialized = true;
        this._lastBranchId = branchId;
      }
    } catch {
      if (ticket === this._loadTicket) this._error.set('Error al cargar alertas');
    } finally {
      if (ticket === this._loadTicket) this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchAlertsData(this.getActiveBranchId());
    } catch {
      // Fail silencioso — datos stale siguen visibles
    }
  }

  /** Legacy wrapper */
  async loadAlerts(): Promise<void> {
    return this.initialize();
  }

  /**
   * Descarta una alerta por 24 h, para este usuario y con los casos que tiene ahora: si después
   * tiene más, vuelve a mostrarse (fix-415-m; regla en alert-snooze.utils.ts).
   */
  dismissAlert(alertId: string): void {
    const alert = this._activeAlerts().find((a) => a.id === alertId) ?? { id: alertId };
    const now = Date.now();
    const snoozes = snoozeAlert(this.readSnoozes(now), this.currentUserId(), alert, now);
    localStorage.setItem(this.SNOOZE_KEY, JSON.stringify(snoozes));
    this._activeAlerts.update((alerts) => alerts.filter((a) => a.id !== alertId));
  }

  private currentUserId(): string | null {
    return this.auth.currentUser()?.id ?? null;
  }

  /** Descartes vigentes guardados en este navegador (los vencidos se limpian al leer). */
  private readSnoozes(now: number): AlertSnoozeMap {
    return pruneSnoozes(parseSnoozes(localStorage.getItem(this.SNOOZE_KEY)), now);
  }

  /**
   * (B-3) Cancela las clases prácticas FUTURAS agendadas de las matrículas de la alerta.
   *
   * Pide confirmación diciendo cuántas clases y de qué alumnos (fix-364-m: antes cancelaba todo,
   * pasado y futuro, con un clic). Las clases de horas ya pasadas no se tocan: quedan para
   * registrarse como asistencia o inasistencia.
   *
   * @returns `true` solo si se cancelaron clases.
   */
  async clearSchedules(enrollmentIds: number[]): Promise<boolean> {
    if (enrollmentIds.length === 0) return false;

    try {
      const { data, error } = await this.supabase.client
        .from('class_b_sessions')
        .select(
          'id, enrollment_id, enrollments!inner(students!inner(users!inner(first_names, paternal_last_name)))',
        )
        .in('enrollment_id', enrollmentIds)
        .eq('status', 'scheduled')
        .gt('scheduled_at', new Date().toISOString());
      if (error) throw error;

      const sessions = (data ?? []) as any[];
      if (sessions.length === 0) {
        this.toast.info(
          'No hay clases futuras que cancelar',
          'Estos alumnos ya no tienen clases prácticas agendadas.',
        );
        return false;
      }

      const groups = new Map<number, { alumnoName: string; clases: number }>();
      for (const session of sessions) {
        const user = session.enrollments?.students?.users;
        const group = groups.get(session.enrollment_id) ?? {
          alumnoName:
            `${user?.first_names ?? ''} ${user?.paternal_last_name ?? ''}`.trim() || 'Alumno',
          clases: 0,
        };
        group.clases += 1;
        groups.set(session.enrollment_id, group);
      }

      const confirmed = await this.confirmModal.confirm({
        title: 'Borrar horarios',
        message: buildClearScheduleMessage([...groups.values()]),
        confirmLabel: 'Cancelar clases',
        cancelLabel: 'Volver',
        severity: 'danger',
      });
      if (!confirmed) return false;

      // Por id y todavía 'scheduled': solo lo que el usuario vio en el diálogo.
      const result = assertWriteOk(
        await this.supabase.client
          .from('class_b_sessions')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .in(
            'id',
            sessions.map((s) => s.id),
          )
          .eq('status', 'scheduled')
          .select('id'),
        { requireRows: true },
      );

      const cancelled = (result.data as unknown[]).length;

      // fix-391-m: cancelar a mano también es penalizar; se registra en cada matrícula para que
      // esas faltas no vuelvan a entrar en "Borrar horarios" cuando se reagenden las clases.
      const stamp = await this.supabase.client
        .from('enrollments')
        .update({ absence_penalty_applied_at: new Date().toISOString() })
        .in('id', [...groups.keys()])
        .select('id');
      if (stamp.error || !stamp.data?.length) {
        this.toast.warning(
          'No se registró la penalización',
          'Las clases se cancelaron, pero estos alumnos pueden volver a aparecer en "Borrar horarios". Avisa al administrador.',
        );
      }
      this.toast.success(
        'Horarios borrados',
        `Se ${cancelled === 1 ? 'canceló 1 clase' : `cancelaron ${cancelled} clases`} de ${
          groups.size
        } ${groups.size === 1 ? 'alumno' : 'alumnos'}.`,
      );
      void this.refreshSilently();
      return true;
    } catch (err) {
      console.error('[DashboardAlertsFacade] clearSchedules error:', err);
      this.toast.error(toFriendlyDbMessage(err, 'No se pudieron borrar los horarios'));
      return false;
    }
  }

  // ── Coordinador de queries ──────────────────────────────────────────────────

  private async fetchAlertsData(branchId: number | null): Promise<void> {
    const requestToken = this.alertsGuard.next();
    // allSettled: una revisión que falla no debe ocultar las alertas de las que sí respondieron.
    const settled = await Promise.allSettled([
      // Fase 1 & 2
      this.checkExpiredDocuments(branchId),
      this.checkPendingPayments(branchId),
      this.checkSixthClassWithDebt(branchId),
      this.checkTwelfthClassCompleted(branchId),
      this.checkConsecutiveAbsences(branchId),
      this.checkUnclosedCash(branchId),
      this.checkOldDebts(branchId),
      // Fase 3 — Pagos y Finanzas
      this.checkRecentPayments(branchId),
      this.checkOverdueSecondInstallment(branchId),
      this.checkPendingInstructorPayments(branchId),
      // Pre-inscritos, Asistencia y Evaluaciones de Clase Profesional están bloqueadas en el
      // piloto: una alerta que nadie puede atender no se muestra (fix-416-m).
      ...(isBlockedInPilot('clase-profesional-recorte')
        ? []
        : [
            // Fase 3 — Pre-inscripciones Profesionales
            this.checkNewPreRegistrations(branchId),
            this.checkPendingPsychEvaluation(branchId),
            this.checkExpiringPreRegistrations(branchId),
            // Fase 3 — Clase Profesional
            this.checkRedAttendance(branchId),
            this.checkYellowAttendance(branchId),
            this.checkFailedModules(branchId),
            this.checkDraftGrades(branchId),
          ]),
    ]);
    // Ya se pidió una carga más reciente (otra sede): descartar esta respuesta.
    if (!this.alertsGuard.isCurrent(requestToken)) return;

    const failed = settled.filter((r) => r.status === 'rejected');
    // Ninguna revisión respondió (sin red, sesión caída): es un error de carga, no una lista vacía.
    if (failed.length === settled.length) throw (failed[0] as PromiseRejectedResult).reason;

    const allAlerts = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    this._activeAlerts.set(this.filterSnoozedAlerts(allAlerts));
    this._incomplete.set(failed.length > 0);
  }

  private filterSnoozedAlerts(alerts: AlertModel[]): AlertModel[] {
    const now = Date.now();
    return filterSnoozedAlerts(alerts, this.readSnoozes(now), this.currentUserId(), now);
  }

  // ── Queries privadas — Fase 1 & 2 ─────────────────────────────────────────

  /**
   * Documentos de vehículos vencidos o por vencer.
   * Usa `alert_config.advance_days` para el horizonte de alerta.
   */
  private async checkExpiredDocuments(branchId: number | null): Promise<AlertModel[]> {
    const alerts: AlertModel[] = [];

    const { data: configs } = await queryOk(
      this.supabase.client
        .from('alert_config')
        .select('alert_type, advance_days')
        .eq('active', true),
    );

    const advanceDays =
      configs?.find((c: any) => c.alert_type === 'document_expiry')?.advance_days ?? 30;

    const todayStr = todayIso();

    let expiredQuery: any = this.supabase.client
      .from('vehicle_documents')
      .select('id, vehicles!inner(branch_id)', { count: 'exact', head: true })
      .lt('expiry_date', todayStr);
    if (branchId !== null) expiredQuery = expiredQuery.eq('vehicles.branch_id', branchId);
    const { count: expiredCount } = await queryOk(expiredQuery);

    if (expiredCount && expiredCount > 0) {
      alerts.push({
        id: 'alert-docs-expired',
        title: `${expiredCount} Documento${expiredCount > 1 ? 's' : ''} vencido${expiredCount > 1 ? 's' : ''}`,
        description: 'Vehículos requieren atención inmediata',
        severity: 'error',
        count: expiredCount,
      });
    }

    const futureDateStr = addDaysIso(todayStr, advanceDays);

    let soonQuery: any = this.supabase.client
      .from('vehicle_documents')
      .select('id, vehicles!inner(branch_id)', { count: 'exact', head: true })
      .gte('expiry_date', todayStr)
      .lte('expiry_date', futureDateStr);
    if (branchId !== null) soonQuery = soonQuery.eq('vehicles.branch_id', branchId);
    const { count: soonCount } = await queryOk(soonQuery);

    if (soonCount && soonCount > 0) {
      alerts.push({
        id: 'alert-docs-expiring',
        title: `${soonCount} Documento${soonCount > 1 ? 's' : ''} por vencer`,
        description: `Vencen en los próximos ${advanceDays} días`,
        severity: 'warning',
        count: soonCount,
      });
    }

    return alerts;
  }

  /**
   * Matrículas activas con saldo pendiente (general).
   */
  private async checkPendingPayments(branchId: number | null): Promise<AlertModel[]> {
    let query: any = this.supabase.client
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gt('pending_balance', 0);
    if (branchId !== null) query = query.eq('branch_id', branchId);
    const { count } = await queryOk(query);

    if (count && count > 0) {
      return [
        {
          id: 'alert-pending-payments',
          title: `${count} Pago${count > 1 ? 's' : ''} pendiente${count > 1 ? 's' : ''}`,
          description: 'Revisar cuentas por cobrar',
          severity: 'warning',
          count,
        },
      ];
    }

    return [];
  }

  /**
   * (B-1) Alumnos que completaron exactamente su 6ª clase y aún tienen saldo pendiente.
   */
  private async checkSixthClassWithDebt(branchId: number | null): Promise<AlertModel[]> {
    let query: any = this.supabase.client
      .from('class_b_sessions')
      .select('enrollment_id, enrollments!inner(pending_balance, branch_id)')
      .eq('class_number', 6)
      .eq('status', 'completed')
      .eq('enrollments.status', 'active')
      .gt('enrollments.pending_balance', 0);
    if (branchId !== null) query = query.eq('enrollments.branch_id', branchId);

    const { data, error } = await queryOk(query);
    if (error || !data) return [];

    const uniqueEnrollments = new Set<number>(data.map((s: any) => s.enrollment_id));
    const count = uniqueEnrollments.size;
    if (count === 0) return [];

    return [
      {
        id: 'alert-sixth-class-debt',
        title: `${count} alumno${count > 1 ? 's' : ''} en 6ª clase con saldo pendiente`,
        description: 'Completaron la 6ª clase práctica y tienen cuota por cobrar',
        severity: 'warning',
        count,
      },
    ];
  }

  /**
   * (B-2) Alumnos con 12ª clase completada cuyo certificado aún no fue generado.
   */
  private async checkTwelfthClassCompleted(branchId: number | null): Promise<AlertModel[]> {
    let query: any = this.supabase.client
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      // Solo Clase B: una matrícula Profesional no tiene 12ª clase ni se certifica acá (fix-410-m).
      .eq('license_group', 'class_b')
      .eq('certificate_enabled', true)
      .is('certificate_b_pdf_url', null);
    if (branchId !== null) query = query.eq('branch_id', branchId);

    const { count } = await queryOk(query);
    if (!count || count === 0) return [];

    return [
      {
        id: 'alert-twelfth-class-cert-pending',
        title: `${count} alumno${count > 1 ? 's' : ''} listo${count > 1 ? 's' : ''} para certificar`,
        description: 'Completaron la 12ª clase — certificado pendiente de generar',
        severity: 'success',
        count,
      },
    ];
  }

  /**
   * (B-3) Alumnos con inasistencias vigentes en 2 clases prácticas seguidas (regla RF-053).
   *
   * fix-364-m: antes contaba clases 'scheduled' con hora pasada, es decir clases de hoy que
   * nadie había registrado todavía, no faltas. La alerta incluye los `enrollmentIds` afectados
   * para invocar `clearSchedules()` desde la UI.
   */
  private async checkConsecutiveAbsences(branchId: number | null): Promise<AlertModel[]> {
    let query: any = this.supabase.client
      .from('class_b_practice_attendance')
      .select(
        'recorded_at, class_b_sessions!inner(enrollment_id, class_number, status, enrollments!inner(branch_id, status, absence_penalty_applied_at))',
      )
      .in('status', ['absent', 'no_show'])
      // Una falta ya reagendada quedó archivada: es historial, no una falta viva (fix-191-m).
      .is('archived_at', null)
      .in('class_b_sessions.status', VALID_CLASS_B_SESSION_STATUSES)
      .eq('class_b_sessions.enrollments.status', 'active');
    if (branchId !== null) {
      query = query.eq('class_b_sessions.enrollments.branch_id', branchId);
    }

    const { data, error } = await queryOk(query);
    if (error || !data) return [];

    const rows = (data as any[]).filter((row) => row.class_b_sessions);
    const absences = rows.map((row) => ({
      enrollmentId: row.class_b_sessions.enrollment_id as number,
      classNumber: (row.class_b_sessions.class_number ?? null) as number | null,
      recordedAt: (row.recorded_at ?? null) as string | null,
    }));
    const penalizedAt = new Map<number, string | null>(
      rows.map((row) => [
        row.class_b_sessions.enrollment_id,
        row.class_b_sessions.enrollments?.absence_penalty_applied_at ?? null,
      ]),
    );

    const affectedCount = enrollmentsWithConsecutiveAbsences(absences).length;
    if (affectedCount === 0) return [];

    // fix-391-m: la alerta cuenta a todos los alumnos con faltas seguidas, pero "Borrar horarios"
    // solo actúa sobre los pares que todavía no fueron penalizados (J07).
    const pendingIds = enrollmentsWithUnpenalizedPair(absences, penalizedAt);

    return [
      {
        id: 'alert-consecutive-absences',
        title: `${affectedCount} alumno${affectedCount > 1 ? 's' : ''} con 2 inasistencias seguidas`,
        description: 'Faltaron a dos clases prácticas consecutivas sin justificar',
        severity: 'error',
        count: affectedCount,
        ...(pendingIds.length > 0
          ? {
              action: {
                label: 'Borrar horarios',
                type: 'clear-schedule' as const,
                enrollmentIds: pendingIds,
              },
            }
          : {}),
      },
    ];
  }

  /**
   * (F-3) Caja sin cerrar el día de hoy (zona horaria Chile).
   */
  private async checkUnclosedCash(branchId: number | null): Promise<AlertModel[]> {
    const todayChile = todayIso();

    let query: any = this.supabase.client
      .from('cash_closings')
      .select('id', { count: 'exact', head: true })
      .eq('date', todayChile)
      .eq('status', 'closed');
    if (branchId !== null) query = query.eq('branch_id', branchId);

    const { count } = await queryOk(query);
    if (count && count > 0) return [];

    return [
      {
        id: 'alert-cash-not-closed',
        title: 'Caja sin cerrar',
        description: 'No se ha registrado el cierre de caja del día',
        severity: 'error',
        action: { label: 'Ir a Cuadratura', type: 'navigate' },
      },
    ];
  }

  /**
   * (F-4) Alumnos con deuda superior a 2 meses.
   */
  private async checkOldDebts(branchId: number | null): Promise<AlertModel[]> {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000);

    let query: any = this.supabase.client
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gt('pending_balance', 0)
      .lt('created_at', sixtyDaysAgo.toISOString());
    if (branchId !== null) query = query.eq('branch_id', branchId);

    const { count } = await queryOk(query);
    if (!count || count === 0) return [];

    return [
      {
        id: 'alert-old-debts',
        // Mide la antigüedad de la matrícula, no los días sin pagar (hotfix-153-m).
        title: `${count} matrícula${count > 1 ? 's' : ''} de más de 60 días con saldo`,
        description: 'Se matricularon hace más de 60 días y todavía tienen saldo pendiente',
        severity: 'warning',
        count,
      },
    ];
  }

  // ── Queries privadas — Fase 3: Pagos y Finanzas ───────────────────────────

  /**
   * (F-1) Pagos registrados hoy (date = fecha Chile).
   */
  private async checkRecentPayments(branchId: number | null): Promise<AlertModel[]> {
    const todayChile = todayIso();

    let query: any = this.supabase.client
      .from('payments')
      .select('id, enrollments!inner(branch_id)', { count: 'exact', head: true })
      .in('status', [...PAYMENT_STATUSES_QUE_SUMAN])
      .eq('payment_date', todayChile);
    if (branchId !== null) query = query.eq('enrollments.branch_id', branchId);

    const { count, error } = await queryOk(query);
    if (error || !count || count === 0) return [];

    return [
      {
        id: 'alert-recent-payments',
        title: `${count} pago${count > 1 ? 's' : ''} registrado${count > 1 ? 's' : ''} hoy`,
        description: 'Nuevos ingresos registrados en el día',
        severity: 'success',
        count,
      },
    ];
  }

  /**
   * (F-2) Matrículas activas con saldo pendiente que ya TOMARON una clase 7 o posterior.
   *
   * Desde spec 0010-i la clase 7 se bloquea con cualquier deuda, sin importar la modalidad de
   * pago: quien la toma debiendo fue habilitado sin pago. Por eso no se filtra por payment_mode
   * (hasta fix-402-m se filtraba por 'deposit', valor que nunca existió — DG-004 — y la alerta
   * no se disparaba). Solo cuentan clases en curso o completadas: las 12 se agendan al
   * matricular, así que una clase 7+ agendada o cancelada no dice nada.
   */
  private async checkOverdueSecondInstallment(branchId: number | null): Promise<AlertModel[]> {
    let query: any = this.supabase.client
      .from('class_b_sessions')
      .select('enrollment_id, enrollments!inner(pending_balance, branch_id, status)')
      .in('status', ['in_progress', 'completed'])
      .eq('enrollments.status', 'active')
      .gt('enrollments.pending_balance', 0)
      .gt('class_number', 6);
    if (branchId !== null) query = query.eq('enrollments.branch_id', branchId);

    const { data, error } = await queryOk(query);
    if (error || !data) return [];

    const uniqueEnrollments = new Set<number>(data.map((s: any) => s.enrollment_id));
    const count = uniqueEnrollments.size;
    if (count === 0) return [];

    return [
      {
        id: 'alert-overdue-second-installment',
        title: `${count} matrícula${count > 1 ? 's' : ''} con cuota 2 vencida`,
        description: 'Ya tomaron una clase 7 o posterior y siguen con saldo pendiente',
        severity: 'warning',
        count,
      },
    ];
  }

  /**
   * (F-5) Instructores con horas prácticas registradas en el período actual sin liquidación.
   * Con una sede elegida, solo los instructores de esa sede.
   */
  private async checkPendingInstructorPayments(branchId: number | null): Promise<AlertModel[]> {
    const currentPeriod = chileMonth(); // 'YYYY-MM'

    // Sede del instructor = users.branch_id, el mismo criterio de Liquidaciones (fix-410-m).
    let hoursQuery: any = this.supabase.client
      .from('instructor_monthly_hours')
      .select('instructor_id, instructors!inner(users!inner(branch_id))')
      .eq('period', currentPeriod)
      .gt('practical_sessions', 0);
    if (branchId !== null) hoursQuery = hoursQuery.eq('instructors.users.branch_id', branchId);

    const { data: hoursData, error: hoursError } = await queryOk(hoursQuery);

    if (hoursError || !hoursData || hoursData.length === 0) return [];

    const { data: paidData, error: paidError } = await queryOk(
      this.supabase.client
        .from('instructor_monthly_payments')
        .select('instructor_id')
        .eq('period', currentPeriod),
    );

    if (paidError) return [];

    const paidIds = new Set<number>((paidData ?? []).map((p: any) => p.instructor_id));
    const pendingCount = hoursData.filter((h: any) => !paidIds.has(h.instructor_id)).length;
    if (pendingCount === 0) return [];

    return [
      {
        id: 'alert-pending-instructor-payments',
        title: `${pendingCount} instructor${pendingCount > 1 ? 'es' : ''} sin liquidar`,
        description: `Período ${currentPeriod} — tienen horas registradas sin liquidación`,
        severity: 'warning',
        count: pendingCount,
      },
    ];
  }

  // ── Queries privadas — Fase 3: Pre-inscripciones Profesionales ────────────

  /**
   * (P-1) Pre-inscripciones profesionales con status='pending_review'.
   */
  private async checkNewPreRegistrations(branchId: number | null): Promise<AlertModel[]> {
    let query: any = this.supabase.client
      .from('professional_pre_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review');
    if (branchId !== null) query = query.eq('branch_id', branchId);

    const { count, error } = await queryOk(query);
    if (error || !count || count === 0) return [];

    return [
      {
        id: 'alert-new-pre-registrations',
        title: `${count} pre-inscripción${count > 1 ? 'es' : ''} nueva${count > 1 ? 's' : ''}`,
        description: 'Solicitudes Clase Profesional pendientes de revisión',
        severity: 'info',
        count,
      },
    ];
  }

  /**
   * (P-2) Pre-inscripciones con test psicológico completado pero sin resultado evaluado.
   */
  private async checkPendingPsychEvaluation(branchId: number | null): Promise<AlertModel[]> {
    let query: any = this.supabase.client
      .from('professional_pre_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('psych_test_status', 'completed')
      .is('psych_test_result', null);
    if (branchId !== null) query = query.eq('branch_id', branchId);

    const { count, error } = await queryOk(query);
    if (error || !count || count === 0) return [];

    return [
      {
        id: 'alert-pending-psych-evaluation',
        title: `${count} test psicológico${count > 1 ? 's' : ''} por evaluar`,
        description: 'Pre-inscritos completaron el test EPQ y esperan evaluación',
        severity: 'warning',
        count,
      },
    ];
  }

  /**
   * (P-3) Pre-inscripciones con status='pending_review' que vencen en los próximos 7 días.
   * Requiere columna `expires_at` en `professional_pre_registrations`.
   */
  private async checkExpiringPreRegistrations(branchId: number | null): Promise<AlertModel[]> {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86_400_000);

    let query: any = this.supabase.client
      .from('professional_pre_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review')
      .gt('expires_at', now.toISOString())
      .lte('expires_at', sevenDaysFromNow.toISOString());
    if (branchId !== null) query = query.eq('branch_id', branchId);

    const { count, error } = await queryOk(query);
    if (error || !count || count === 0) return [];

    return [
      {
        id: 'alert-expiring-pre-registrations',
        title: `${count} pre-inscripción${count > 1 ? 'es' : ''} por vencer`,
        description: 'Solicitudes pendientes que vencen en los próximos 7 días',
        severity: 'warning',
        count,
      },
    ];
  }

  // ── Queries privadas — Fase 3: Clase Profesional ──────────────────────────

  /**
   * Cuántas matrículas Profesional tienen el semáforo de asistencia en el color pedido, dentro
   * de la sede elegida. La vista v_professional_attendance no trae sede: con una sede elegida se
   * cruzan sus enrollment_id contra enrollments.branch_id (fix-410-m; antes se ignoraba la sede).
   */
  private async countProfessionalAttendance(
    flag: 'red' | 'yellow',
    branchId: number | null,
  ): Promise<number> {
    if (branchId === null) {
      const { count } = await queryOk(
        this.supabase.client
          .from('v_professional_attendance')
          .select('enrollment_id', { count: 'exact', head: true })
          .eq('attendance_flag', flag),
      );
      return count ?? 0;
    }

    const { data } = await queryOk(
      this.supabase.client
        .from('v_professional_attendance')
        .select('enrollment_id')
        .eq('attendance_flag', flag),
    );
    const ids = ((data ?? []) as { enrollment_id: number }[]).map((row) => row.enrollment_id);
    if (ids.length === 0) return 0;

    const { count } = await queryOk(
      this.supabase.client
        .from('enrollments')
        .select('id', { count: 'exact', head: true })
        .in('id', ids)
        .eq('branch_id', branchId),
    );
    return count ?? 0;
  }

  /** (R-1) Alumnos Profesional con semáforo de asistencia en rojo. */
  private async checkRedAttendance(branchId: number | null): Promise<AlertModel[]> {
    const count = await this.countProfessionalAttendance('red', branchId);
    if (count === 0) return [];

    return [
      {
        id: 'alert-professional-attendance-red',
        title: `${count} alumno${count > 1 ? 's' : ''} con asistencia crítica`,
        description: 'Alumnos Profesional con nivel de asistencia en rojo',
        severity: 'error',
        count,
      },
    ];
  }

  /** (R-2) Alumnos Profesional con semáforo de asistencia en amarillo. */
  private async checkYellowAttendance(branchId: number | null): Promise<AlertModel[]> {
    const count = await this.countProfessionalAttendance('yellow', branchId);
    if (count === 0) return [];

    return [
      {
        id: 'alert-professional-attendance-yellow',
        title: `${count} alumno${count > 1 ? 's' : ''} con asistencia en riesgo`,
        description: 'Alumnos Profesional con nivel de asistencia en amarillo',
        severity: 'warning',
        count,
      },
    ];
  }

  /**
   * (R-3) Módulos profesionales con calificación confirmada menor a 75.
   */
  private async checkFailedModules(branchId: number | null): Promise<AlertModel[]> {
    let query: any = this.supabase.client
      .from('professional_module_grades')
      .select('id, enrollments!inner(branch_id)', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .lt('grade', 75);
    if (branchId !== null) query = query.eq('enrollments.branch_id', branchId);

    const { count, error } = await queryOk(query);
    if (error || !count || count === 0) return [];

    return [
      {
        id: 'alert-failed-modules',
        title: `${count} módulo${count > 1 ? 's' : ''} reprobado${count > 1 ? 's' : ''}`,
        description: 'Calificaciones confirmadas con nota menor a 75 en Clase Profesional',
        severity: 'warning',
        count,
      },
    ];
  }

  /**
   * (R-6) Calificaciones de módulos profesionales en estado borrador sin confirmar.
   */
  private async checkDraftGrades(branchId: number | null): Promise<AlertModel[]> {
    let query: any = this.supabase.client
      .from('professional_module_grades')
      .select('id, enrollments!inner(branch_id)', { count: 'exact', head: true })
      .eq('status', 'draft');
    if (branchId !== null) query = query.eq('enrollments.branch_id', branchId);

    const { count, error } = await queryOk(query);
    if (error || !count || count === 0) return [];

    return [
      {
        id: 'alert-draft-grades',
        title: `${count} calificación${count > 1 ? 'es' : ''} en borrador`,
        description: 'Notas de módulos Profesional pendientes de confirmar',
        severity: 'warning',
        count,
      },
    ];
  }
}
