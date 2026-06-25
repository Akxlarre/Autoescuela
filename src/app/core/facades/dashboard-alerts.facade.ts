import { Injectable, inject, signal, computed } from '@angular/core';

import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import type { AlertModel } from '@core/models/ui/dashboard.model';

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
 *  5. (B-3) Alumnos con 2+ sesiones pasadas sin asistencia
 *  6. (F-3) Caja sin cerrar el día de hoy
 *  7. (F-4) Alumnos con deuda superior a 2 meses
 * Fase 3 — Pagos y Finanzas:
 *  8. (F-1) Pagos registrados hoy
 *  9. (F-2) Cuota 2 vencida en modalidad depósito
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

  // ── SWR State ────────────────────────────────────────────────────────────
  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;
  private readonly SNOOZE_KEY = 'ds_snoozed_alerts';
  private readonly SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000;

  // ── 1. ESTADO PRIVADO ──────────────────────────────────────────────────────
  private _activeAlerts = signal<AlertModel[]>([]);
  private _isLoading = signal(false);
  private _error = signal<string | null>(null);

  // ── 2. ESTADO PÚBLICO (readonly) ───────────────────────────────────────────
  readonly activeAlerts = this._activeAlerts.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly alertCount = computed(() => this._activeAlerts().length);

  // ── 3. MÉTODOS DE ACCIÓN ───────────────────────────────────────────────────

  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    if (user?.role === 'admin') return this.branchFacade.selectedBranchId();
    return user?.branchId ?? null;
  }

  /**
   * SWR: primera llamada muestra skeleton, revisitas refrescan en background.
   */
  async initialize(): Promise<void> {
    const branchId = this.getActiveBranchId();
    if (this._initialized && branchId === this._lastBranchId) {
      void this.refreshSilently();
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchAlertsData(branchId);
      this._initialized = true;
      this._lastBranchId = branchId;
    } catch {
      this._error.set('Error al cargar alertas');
    } finally {
      this._isLoading.set(false);
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
   * Descarta una alerta localmente (snooze 24h).
   */
  dismissAlert(alertId: string): void {
    const snoozedStr = localStorage.getItem(this.SNOOZE_KEY);
    const snoozed = snoozedStr ? JSON.parse(snoozedStr) : {};
    snoozed[alertId] = Date.now();
    localStorage.setItem(this.SNOOZE_KEY, JSON.stringify(snoozed));
    this._activeAlerts.update((alerts) => alerts.filter((a) => a.id !== alertId));
  }

  /**
   * (B-3) Cancela todas las sesiones 'scheduled' de una matrícula.
   * Usar cuando el alumno tiene 2+ inasistencias consecutivas y se decide
   * limpiar su horario actual para re-agendarlo.
   */
  async clearScheduleForEnrollment(enrollmentId: number): Promise<boolean> {
    const { error } = await this.supabase.client
      .from('class_b_sessions')
      .update({ status: 'cancelled' })
      .eq('enrollment_id', enrollmentId)
      .eq('status', 'scheduled');

    if (error) {
      console.error('[DashboardAlertsFacade] clearScheduleForEnrollment error:', error);
      return false;
    }

    void this.refreshSilently();
    return true;
  }

  // ── Coordinador de queries ──────────────────────────────────────────────────

  private async fetchAlertsData(branchId: number | null): Promise<void> {
    const results = await Promise.all([
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
      this.checkPendingInstructorPayments(),
      // Fase 3 — Pre-inscripciones Profesionales
      this.checkNewPreRegistrations(branchId),
      this.checkPendingPsychEvaluation(branchId),
      this.checkExpiringPreRegistrations(branchId),
      // Fase 3 — Clase Profesional
      this.checkRedAttendance(branchId),
      this.checkYellowAttendance(branchId),
      this.checkFailedModules(branchId),
      this.checkDraftGrades(branchId),
    ]);
    const allAlerts = results.flat();
    this._activeAlerts.set(this.filterSnoozedAlerts(allAlerts));
  }

  private filterSnoozedAlerts(alerts: AlertModel[]): AlertModel[] {
    const snoozedStr = localStorage.getItem(this.SNOOZE_KEY);
    if (!snoozedStr) return alerts;

    try {
      const snoozed = JSON.parse(snoozedStr) as Record<string, number>;
      const now = Date.now();
      let modified = false;

      for (const [id, timestamp] of Object.entries(snoozed)) {
        if (now - timestamp > this.SNOOZE_DURATION_MS) {
          delete snoozed[id];
          modified = true;
        }
      }

      if (modified) localStorage.setItem(this.SNOOZE_KEY, JSON.stringify(snoozed));

      return alerts.filter((a) => !snoozed[a.id]);
    } catch {
      return alerts;
    }
  }

  // ── Queries privadas — Fase 1 & 2 ─────────────────────────────────────────

  /**
   * Documentos de vehículos vencidos o por vencer.
   * Usa `alert_config.advance_days` para el horizonte de alerta.
   */
  private async checkExpiredDocuments(branchId: number | null): Promise<AlertModel[]> {
    const alerts: AlertModel[] = [];

    const { data: configs } = await this.supabase.client
      .from('alert_config')
      .select('alert_type, advance_days')
      .eq('active', true);

    const advanceDays =
      configs?.find((c: any) => c.alert_type === 'document_expiry')?.advance_days ?? 30;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let expiredQuery: any = this.supabase.client
      .from('vehicle_documents')
      .select('id, vehicles!inner(branch_id)', { count: 'exact', head: true })
      .lt('expiry_date', todayStr);
    if (branchId !== null) expiredQuery = expiredQuery.eq('vehicles.branch_id', branchId);
    const { count: expiredCount } = await expiredQuery;

    if (expiredCount && expiredCount > 0) {
      alerts.push({
        id: 'alert-docs-expired',
        title: `${expiredCount} Documento${expiredCount > 1 ? 's' : ''} vencido${expiredCount > 1 ? 's' : ''}`,
        description: 'Vehículos requieren atención inmediata',
        severity: 'error',
        count: expiredCount,
      });
    }

    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + advanceDays);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    let soonQuery: any = this.supabase.client
      .from('vehicle_documents')
      .select('id, vehicles!inner(branch_id)', { count: 'exact', head: true })
      .gte('expiry_date', todayStr)
      .lte('expiry_date', futureDateStr);
    if (branchId !== null) soonQuery = soonQuery.eq('vehicles.branch_id', branchId);
    const { count: soonCount } = await soonQuery;

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
    const { count } = await query;

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

    const { data, error } = await query;
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
      .eq('certificate_enabled', true)
      .is('certificate_b_pdf_url', null);
    if (branchId !== null) query = query.eq('branch_id', branchId);

    const { count } = await query;
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
   * (B-3) Alumnos con 2 o más sesiones presenciales pasadas sin asistencia.
   * La alerta incluye los `enrollmentIds` afectados para invocar
   * `clearScheduleForEnrollment()` desde la UI.
   */
  private async checkConsecutiveAbsences(branchId: number | null): Promise<AlertModel[]> {
    let query: any = this.supabase.client
      .from('class_b_sessions')
      .select('enrollment_id, enrollments!inner(branch_id)')
      .eq('status', 'scheduled')
      .lt('scheduled_at', new Date().toISOString())
      .eq('enrollments.status', 'active')
      .limit(500);
    if (branchId !== null) query = query.eq('enrollments.branch_id', branchId);

    const { data, error } = await query;
    if (error || !data) return [];

    const countByEnrollment = new Map<number, number>();
    for (const session of data as Array<{ enrollment_id: number }>) {
      countByEnrollment.set(
        session.enrollment_id,
        (countByEnrollment.get(session.enrollment_id) ?? 0) + 1,
      );
    }

    const affectedIds = [...countByEnrollment.entries()]
      .filter(([, c]) => c >= 2)
      .map(([id]) => id);

    const affectedCount = affectedIds.length;
    if (affectedCount === 0) return [];

    return [
      {
        id: 'alert-consecutive-absences',
        title: `${affectedCount} alumno${affectedCount > 1 ? 's' : ''} con 2+ clases sin asistir`,
        description: 'Tienen sesiones agendadas pasadas sin registrar asistencia',
        severity: 'error',
        count: affectedCount,
        action: {
          label: 'Borrar horarios',
          type: 'clear-schedule',
          enrollmentIds: affectedIds,
        },
      },
    ];
  }

  /**
   * (F-3) Caja sin cerrar el día de hoy (zona horaria Chile).
   */
  private async checkUnclosedCash(branchId: number | null): Promise<AlertModel[]> {
    const todayChile = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Santiago',
    });

    let query: any = this.supabase.client
      .from('cash_closings')
      .select('id', { count: 'exact', head: true })
      .eq('date', todayChile)
      .eq('status', 'closed');
    if (branchId !== null) query = query.eq('branch_id', branchId);

    const { count } = await query;
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
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    let query: any = this.supabase.client
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gt('pending_balance', 0)
      .lt('created_at', sixtyDaysAgo.toISOString());
    if (branchId !== null) query = query.eq('branch_id', branchId);

    const { count } = await query;
    if (!count || count === 0) return [];

    return [
      {
        id: 'alert-old-debts',
        title: `${count} alumno${count > 1 ? 's' : ''} con deuda mayor a 2 meses`,
        description: 'Tienen saldo pendiente con más de 60 días sin pagar',
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
    const todayChile = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Santiago',
    });

    let query: any = this.supabase.client
      .from('payments')
      .select('id, enrollments!inner(branch_id)', { count: 'exact', head: true })
      .eq('payment_date', todayChile);
    if (branchId !== null) query = query.eq('enrollments.branch_id', branchId);

    const { count, error } = await query;
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
   * (F-2) Alumnos con modalidad depósito que superaron la 6ª clase sin pagar la cuota 2.
   * Condición: class_b_sessions con class_number > 6 cuya matrícula tiene
   * payment_mode='deposit', status='active' y pending_balance > 0.
   */
  private async checkOverdueSecondInstallment(branchId: number | null): Promise<AlertModel[]> {
    let query: any = this.supabase.client
      .from('class_b_sessions')
      .select('enrollment_id, enrollments!inner(payment_mode, pending_balance, branch_id)')
      .eq('enrollments.payment_mode', 'deposit')
      .eq('enrollments.status', 'active')
      .gt('enrollments.pending_balance', 0)
      .gt('class_number', 6);
    if (branchId !== null) query = query.eq('enrollments.branch_id', branchId);

    const { data, error } = await query;
    if (error || !data) return [];

    const uniqueEnrollments = new Set<number>(data.map((s: any) => s.enrollment_id));
    const count = uniqueEnrollments.size;
    if (count === 0) return [];

    return [
      {
        id: 'alert-overdue-second-installment',
        title: `${count} matrícula${count > 1 ? 's' : ''} con cuota 2 vencida`,
        description:
          'Alumnos con depósito inicial que superaron la 6ª clase sin pagar la segunda cuota',
        severity: 'warning',
        count,
      },
    ];
  }

  /**
   * (F-5) Instructores con horas prácticas registradas en el período actual sin liquidación.
   * No aplica filtro de sede — los instructores tienen scope propio vía su branch_id de usuario.
   */
  private async checkPendingInstructorPayments(): Promise<AlertModel[]> {
    const currentPeriod = new Date()
      .toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
      .substring(0, 7); // 'YYYY-MM'

    const { data: hoursData, error: hoursError } = await this.supabase.client
      .from('instructor_monthly_hours')
      .select('instructor_id')
      .eq('period', currentPeriod)
      .gt('practical_sessions', 0);

    if (hoursError || !hoursData || hoursData.length === 0) return [];

    const { data: paidData, error: paidError } = await this.supabase.client
      .from('instructor_monthly_payments')
      .select('instructor_id')
      .eq('period', currentPeriod);

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

    const { count, error } = await query;
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

    const { count, error } = await query;
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
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    let query: any = this.supabase.client
      .from('professional_pre_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review')
      .gt('expires_at', now.toISOString())
      .lte('expires_at', sevenDaysFromNow.toISOString());
    if (branchId !== null) query = query.eq('branch_id', branchId);

    const { count, error } = await query;
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
   * (R-1) Alumnos Profesional con semáforo de asistencia en rojo.
   * No aplica filtro de sede — la vista v_professional_attendance no expone FK
   * joinable; RLS restringe acceso por rol.
   */
  private async checkRedAttendance(_branchId: number | null): Promise<AlertModel[]> {
    const { count, error } = await this.supabase.client
      .from('v_professional_attendance')
      .select('enrollment_id', { count: 'exact', head: true })
      .eq('status', 'red');

    if (error || !count || count === 0) return [];

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

  /**
   * (R-2) Alumnos Profesional con semáforo de asistencia en amarillo.
   * No aplica filtro de sede — ver checkRedAttendance.
   */
  private async checkYellowAttendance(_branchId: number | null): Promise<AlertModel[]> {
    const { count, error } = await this.supabase.client
      .from('v_professional_attendance')
      .select('enrollment_id', { count: 'exact', head: true })
      .eq('status', 'yellow');

    if (error || !count || count === 0) return [];

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

    const { count, error } = await query;
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

    const { count, error } = await query;
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
