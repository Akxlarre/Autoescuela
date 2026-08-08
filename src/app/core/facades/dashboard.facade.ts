import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import { DashboardModel, LiveClassModel } from '@core/models/ui/dashboard.model';
import { toISODate } from '@core/utils/date.utils';
import { resolveVehicleStatus } from '@core/utils/vehicle-status.utils';
import { VALID_CLASS_B_SESSION_STATUSES } from '@core/utils/class-b-session.utils';

@Injectable({ providedIn: 'root' })
export class DashboardFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);

  // ── 1. ESTADO REACTIVO (Signals) ────────────────────────────────────────────
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly data = signal<DashboardModel | null>(null);

  private _initialized = false;
  private _lastBranchId: number | null = null;
  private _realtimeChannel: any | null = null;
  /** Descarta respuestas de fetchRealDashboardData() fuera de orden (spec 0005-m). */
  private readonly dashboardGuard = createRequestGuard();

  // ── 2. MÉTODOS DE ACCIÓN ─────────────────────────────────────────────────────

  setupRealtime(): void {
    if (this._realtimeChannel) return;

    this._realtimeChannel = this.supabase.client
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'class_b_sessions' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => void this.refreshSilently(),
      )
      .subscribe();
  }

  destroyRealtime(): void {
    if (this._realtimeChannel) {
      void this.supabase.client.removeChannel(this._realtimeChannel);
      this._realtimeChannel = null;
    }
  }

  async refreshLiveClassesOnly(): Promise<void> {
    try {
      const liveClasses = await this.fetchLiveClasses(this.getActiveBranchId());
      this.data.update((d) => (d ? { ...d, liveClasses } : null));
    } catch {
      // Swallowed
    }
  }

  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }

  async initialize(): Promise<void> {
    const branchId = this.getActiveBranchId();
    this.setupRealtime();

    if (this._initialized && branchId === this._lastBranchId) {
      void this.refreshSilently();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      await this.fetchRealDashboardData(branchId);
      this._initialized = true;
      this._lastBranchId = branchId;
    } catch {
      this.error.set('Error al cargar datos del dashboard');
    } finally {
      this.loading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchRealDashboardData(this.getActiveBranchId());
    } catch {
      // Swallowed
    }
  }

  private async fetchRealDashboardData(branchId: number | null): Promise<void> {
    const requestToken = this.dashboardGuard.next();
    const todayStr = toISODate(new Date());
    const [year, month] = todayStr.split('-');
    const firstOfMonth = `${year}-${month}-01`;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toISODate(yesterday);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = toISODate(sevenDaysAgo);

    const prevMonthDate = new Date(Number(year), Number(month) - 2, 1); // getMonth is 0-indexed, but here month is string "06". 06-2=4 => May
    const prevMonthYear = prevMonthDate.getFullYear();
    const prevMonthNum = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    const firstOfPrevMonth = `${prevMonthYear}-${prevMonthNum}-01`;
    const lastOfPrevMonthDate = new Date(Number(year), Number(month) - 1, 0);
    const lastOfPrevMonthStr = toISODate(lastOfPrevMonthDate);

    let studentsQuery: any = this.supabase.client
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    if (branchId !== null) studentsQuery = studentsQuery.eq('branch_id', branchId);

    let recentStudentsQuery: any = this.supabase.client
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('created_at', `${sevenDaysAgoStr}T00:00:00`);
    if (branchId !== null) recentStudentsQuery = recentStudentsQuery.eq('branch_id', branchId);

    let classesQuery: any = this.supabase.client
      .from('class_b_sessions')
      .select('id, enrollments!inner(branch_id)', { count: 'exact', head: true })
      .gte('scheduled_at', `${todayStr}T00:00:00`)
      .lte('scheduled_at', `${todayStr}T23:59:59`);
    if (branchId !== null) classesQuery = classesQuery.eq('enrollments.branch_id', branchId);

    let classesYesterdayQuery: any = this.supabase.client
      .from('class_b_sessions')
      .select('id, enrollments!inner(branch_id)', { count: 'exact', head: true })
      .gte('scheduled_at', `${yesterdayStr}T00:00:00`)
      .lte('scheduled_at', `${yesterdayStr}T23:59:59`);
    if (branchId !== null)
      classesYesterdayQuery = classesYesterdayQuery.eq('enrollments.branch_id', branchId);

    let revenueQuery: any = this.supabase.client
      .from('payments')
      .select('total_amount, enrollments!inner(branch_id)')
      .gte('payment_date', firstOfMonth);
    if (branchId !== null) revenueQuery = revenueQuery.eq('enrollments.branch_id', branchId);

    let prevRevenueQuery: any = this.supabase.client
      .from('payments')
      .select('total_amount, enrollments!inner(branch_id)')
      .gte('payment_date', firstOfPrevMonth)
      .lte('payment_date', lastOfPrevMonthStr);
    if (branchId !== null)
      prevRevenueQuery = prevRevenueQuery.eq('enrollments.branch_id', branchId);

    let vehiclesQuery: any = this.supabase.client.from('vehicles').select('id, status');
    if (branchId !== null) vehiclesQuery = vehiclesQuery.eq('branch_id', branchId);

    let auditLogQuery: any = this.supabase.client
      .from('audit_log')
      .select(
        'id, action, entity, entity_id, detail, created_at, users(first_names, paternal_last_name)',
      )
      .order('created_at', { ascending: false })
      .limit(6);
    if (branchId !== null) {
      auditLogQuery = auditLogQuery.or(`branch_id.eq.${branchId},branch_id.is.null`);
    }

    const [
      activeStudents,
      recentStudents,
      classesToday,
      classesYesterday,
      monthlyRevenue,
      prevMonthlyRevenue,
      vehiclesStatus,
      auditLogsResponse,
    ] = await Promise.all([
      studentsQuery,
      recentStudentsQuery,
      classesQuery,
      classesYesterdayQuery,
      revenueQuery,
      prevRevenueQuery,
      vehiclesQuery,
      auditLogQuery,
    ]);

    const revenue = (monthlyRevenue.data ?? []).reduce(
      (acc: number, r: any) => acc + (r.total_amount ?? 0),
      0,
    );
    const prevRevenue = (prevMonthlyRevenue.data ?? []).reduce(
      (acc: number, r: any) => acc + (r.total_amount ?? 0),
      0,
    );
    let revenueTrend = 0;
    if (prevRevenue > 0) {
      revenueTrend = Math.round(((revenue - prevRevenue) / prevRevenue) * 100);
    } else if (revenue > 0) {
      revenueTrend = 100;
    }
    const vehicles = vehiclesStatus.data ?? [];

    const user = this.auth.currentUser();
    const today = new Date();
    const dateStr = new Intl.DateTimeFormat('es', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(today);

    // Respuesta fuera de orden: ya se disparó una fetch más reciente, descartar (spec 0005-m).
    if (!this.dashboardGuard.isCurrent(requestToken)) return;

    this.data.set({
      hero: {
        userName: user?.name || 'Administrador',
        date: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
        classesToday: classesToday.count ?? 0,
        practicalClasses: classesToday.count ?? 0, // Simplified for now
        theoreticalClasses: 0,
        activeAlerts: 0,
      },
      kpis: [
        {
          id: 'users',
          label: 'Alumnos Activos',
          value: activeStudents.count ?? 0,
          trend: recentStudents.count ?? 0,
          trendLabel: 'nuevos últ. 7 días',
          trendSuffix: '',
          icon: 'users',
          color: 'default',
        },
        {
          id: 'classes',
          label: 'Clases Hoy',
          value: classesToday.count ?? 0,
          trend: (classesToday.count ?? 0) - (classesYesterday.count ?? 0),
          trendLabel: 'vs ayer',
          trendSuffix: '',
          subValue: 'Programadas para hoy',
          icon: 'book-open',
          color: 'success',
        },
        {
          id: 'revenue',
          label: 'Ingresos Mes',
          value: revenue / 1000000,
          prefix: '$',
          suffix: 'M',
          trend: revenueTrend,
          trendLabel: 'vs mes pasado',
          trendSuffix: '%',
          icon: 'credit-card',
          color: 'default',
        },
        {
          id: 'vehicles',
          label: 'Vehículos',
          value: vehicles.filter((v: any) => resolveVehicleStatus(v.status) === 'available').length,
          subValue: `Total flota: ${vehicles.length}`,
          icon: 'truck',
          color: 'warning',
        },
      ],
      activities: (auditLogsResponse.data ?? []).map((log: any) => this.mapAuditLogToActivity(log)),
      alerts: [],
      quickActions: [
        {
          id: 'qa1',
          icon: 'plus',
          label: 'Matricular',
          llmAction: 'new-enrollment',
          iconBg: 'var(--color-primary-muted)',
          iconColor: 'var(--color-primary)',
        },
        {
          id: 'qa3',
          icon: 'plus',
          label: 'Registrar Pago',
          llmAction: 'register-payment',
          iconBg: 'var(--color-primary-muted)',
          iconColor: 'var(--color-primary)',
        },
        {
          id: 'qa2',
          icon: 'calendar',
          label: 'Agenda',
          llmAction: 'view-calendar',
          iconBg: 'transparent',
          iconColor: 'var(--text-secondary)',
        },
        {
          id: 'qa4',
          icon: 'wallet',
          label: 'Registrar Egreso',
          llmAction: 'register-expense',
          iconBg: 'transparent',
          iconColor: 'var(--text-secondary)',
        },
      ],
      systemStatus: [
        { name: 'Supabase', ok: true },
        { name: 'Realtime', ok: !!this._realtimeChannel },
      ],
      liveClasses: await this.fetchLiveClasses(branchId),
    });
  }

  private static readonly PRACTICA_SELECT = `
    id,
    class_number,
    scheduled_at,
    duration_min,
    status,
    km_start,
    vehicles(id, brand, model, license_plate, current_km),
    instructors!class_b_sessions_instructor_id_fkey(users(first_names, paternal_last_name)),
    enrollments!inner(branch_id, student_id, students(users(first_names, paternal_last_name)))
  `;

  private mapPracticaRow(row: any): LiveClassModel {
    const instRel = row['instructors'] ?? row['instructors!class_b_sessions_instructor_id_fkey'];
    const instUser = instRel?.users;
    const studentUser = row.enrollments?.students?.users;
    const vehicle = row.vehicles;

    let status = 'pending';
    if (row.status === 'in_progress') status = 'in_progress';
    if (row.status === 'completed' || row.status === 'no_show') status = 'completed';

    return {
      id: `prac-${row.id}`,
      originalId: row.id,
      classNumber: row.class_number,
      studentName: studentUser
        ? `${studentUser.first_names ?? ''} ${studentUser.paternal_last_name ?? ''}`.trim()
        : 'Desconocido',
      instructorName: instUser
        ? `${instUser.first_names ?? ''} ${instUser.paternal_last_name ?? ''}`.trim()
        : 'Sin asignar',
      timeLabel: '00:00 - 00:45',
      status,
      type: 'practical',
      vehicle: vehicle
        ? `${vehicle.brand ?? ''} ${vehicle.model ?? ''} - ${vehicle.license_plate ?? ''}`.trim()
        : 'Sin vehículo',
      vehicleBrand: vehicle?.brand,
      vehicleModel: vehicle?.model,
      vehiclePlate: vehicle?.license_plate,
      vehicleId: vehicle?.id ?? null,
      vehicleCurrentKm: vehicle?.current_km ?? null,
      branchId: row.enrollments?.branch_id ?? null,
      scheduledAt: row.scheduled_at,
      durationMin: row.duration_min ?? 45,
      studentId: row.enrollments?.student_id ?? null,
      kmStart: row.km_start ?? null,
    } as LiveClassModel;
  }

  async fetchLiveClasses(branchId: number | null): Promise<LiveClassModel[]> {
    const todayStr = toISODate(new Date());
    let liveClasses: LiveClassModel[] = [];

    // 1. Clases Prácticas de hoy
    let practicasQuery: any = this.supabase.client
      .from('class_b_sessions')
      .select(DashboardFacade.PRACTICA_SELECT)
      .gte('scheduled_at', `${todayStr}T00:00:00`)
      .lte('scheduled_at', `${todayStr}T23:59:59`)
      .in('status', VALID_CLASS_B_SESSION_STATUSES)
      .eq('enrollments.status', 'active');

    if (branchId !== null) {
      practicasQuery = practicasQuery.eq('enrollments.branch_id', branchId);
    }

    // 2. Sesiones in_progress colgadas de días anteriores (fix-131-m): una sesión
    // in_progress nunca se cierra sola (spec 0001-i), así que sin este segundo fetch
    // desaparece del panel al día siguiente aunque siga bloqueando startClass() vía
    // trg_prevent_concurrent_in_progress — sin límite inferior de fecha.
    let stuckSessionsQuery: any = this.supabase.client
      .from('class_b_sessions')
      .select(DashboardFacade.PRACTICA_SELECT)
      .lt('scheduled_at', `${todayStr}T00:00:00`)
      .eq('status', 'in_progress')
      .eq('enrollments.status', 'active');

    if (branchId !== null) {
      stuckSessionsQuery = stuckSessionsQuery.eq('enrollments.branch_id', branchId);
    }

    const [{ data: practicasData, error: practicasError }, { data: stuckData, error: stuckError }] =
      await Promise.all([practicasQuery, stuckSessionsQuery]);

    if (!practicasError && practicasData) {
      liveClasses = [...liveClasses, ...practicasData.map((row: any) => this.mapPracticaRow(row))];
    }

    if (!stuckError && stuckData) {
      liveClasses = [...liveClasses, ...stuckData.map((row: any) => this.mapPracticaRow(row))];
    }

    // Las clases teóricas ahora se gestionan por Ciclos (Spec 0001) y no se
    // muestran en el feed de clases en vivo del dashboard.

    // Ordenar cronológicamente
    liveClasses.sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );

    return liveClasses;
  }

  async fetchActivityHistory(limit: number = 50): Promise<any[]> {
    const branchId = this.getActiveBranchId();
    let query: any = this.supabase.client
      .from('audit_log')
      .select(
        'id, action, entity, entity_id, detail, created_at, users(first_names, paternal_last_name)',
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (branchId !== null) {
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
    }

    const { data } = await query;

    return (data ?? []).map((log: any) => this.mapAuditLogToActivity(log));
  }

  /**
   * `audit_log.entity_id` es el PK de la fila afectada en SU PROPIA tabla, no un
   * `student_id` universal. Resuelve el `students.id` real para navegar al detalle
   * de alumno desde un evento de actividad reciente.
   */
  async resolveStudentIdForActivity(entity: string, entityId: number): Promise<number | null> {
    switch (entity) {
      case 'students':
        return entityId;
      case 'enrollments': {
        const { data } = await this.supabase.client
          .from('enrollments')
          .select('student_id')
          .eq('id', entityId)
          .maybeSingle();
        return data?.student_id ?? null;
      }
      case 'class_b_sessions': {
        const { data } = await this.supabase.client
          .from('class_b_sessions')
          .select('enrollments(student_id)')
          .eq('id', entityId)
          .maybeSingle();
        return (data as any)?.enrollments?.student_id ?? null;
      }
      default:
        return null;
    }
  }

  private mapAuditLogToActivity(log: any): any {
    const entityNames: Record<string, string> = {
      enrollments: 'Matrícula',
      payments: 'Pago',
      users: 'Usuario',
      students: 'Alumno',
      class_b_sessions: 'Clase Práctica',
      vehicles: 'Vehículo',
      professional_pre_registrations: 'Preinscripción',
      standalone_course_enrollments: 'Curso Singular',
      special_service_sales: 'Servicio Especial',
      student_documents: 'Documento',
      certificates: 'Certificado',
      vehicle_documents: 'Documento de Vehículo',
      maintenance_records: 'Mantención',
      class_b_theory_sessions: 'Clase Teórica',
      promotion_courses: 'Curso de Promoción',
      class_book: 'Libro de Clases',
      professional_theory_sessions: 'Sesión Teórica Profesional',
      professional_practice_sessions: 'Sesión Práctica Profesional',
      professional_module_grades: 'Nota de Módulo',
      website_config: 'Configuración Web',
    };
    const entityLabel = entityNames[log.entity] || 'Registro';
    const userName = log.users
      ? `${log.users.first_names} ${log.users.paternal_last_name}`
      : 'Sistema / Online';

    let title = `${entityLabel} actualizado`;
    let desc = log.detail || '';
    let icon = 'activity';
    let iconBg = 'var(--color-surface-hover)';
    let iconColor = 'var(--text-secondary)';

    // Determinar artículo según terminación
    const isFeminine = entityLabel.endsWith('a') || entityLabel.endsWith('ón');
    const artO = isFeminine ? 'a' : 'o';

    if (log.action === 'INSERT') {
      title = `Nuev${artO} ${entityLabel.toLowerCase()}`;
      // Usar el detalle real ("Registrado: Foto (Carnet) de Patricia Aguilar") en vez de un
      // mensaje genérico que no dice qué se registró (fix-107-m, mismo patrón que DELETE).
      const registeredLabel = (log.detail || '').replace(/^(Registrado|Inscripción Web):\s*/, '');
      desc = registeredLabel
        ? `${userName} registró: ${registeredLabel}`
        : `Registrad${artO} por ${userName}`;
      icon = 'plus';
      iconBg = 'var(--color-success-muted)';
      iconColor = 'var(--color-success)';

      if (log.entity === 'enrollments') icon = 'user-plus';
      if (log.entity === 'payments') icon = 'dollar-sign';
    } else if (log.action === 'UPDATE') {
      title = `${entityLabel} actualizad${artO}`;
      icon = 'edit-2';
      iconBg = 'var(--color-primary-muted)';
      iconColor = 'var(--color-primary)';
      // Limpiar prefix redundante [Entidad]
      desc = desc.replace(/^\[.*?\]\s*/, '');
      desc = `${userName} modificó: ${desc}`;
    } else if (log.action === 'DELETE') {
      title = `${entityLabel} eliminad${artO}`;
      // Usar el detalle real ("Eliminado: Juan Perez - Curso X ($800.000)") en vez de un
      // mensaje genérico que no dice qué se eliminó (fix-105-m).
      const deletedLabel = (log.detail || '').replace(/^Eliminado:\s*/, '');
      desc = deletedLabel
        ? `${userName} eliminó: ${deletedLabel}`
        : `Eliminad${artO} por ${userName}`;
      icon = 'trash-2';
      iconBg = 'var(--color-error-muted)';
      iconColor = 'var(--color-error)';
    }

    const logTime = new Date(log.created_at);
    // Para historial completo, mostrar fecha si no es de hoy
    const isToday = new Date().toDateString() === logTime.toDateString();
    const timeStr = isToday
      ? logTime.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
      : logTime.toLocaleDateString('es-CL', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });

    return {
      id: log.id.toString(),
      title,
      description: desc,
      time: timeStr,
      icon,
      iconBg,
      iconColor,
      entity: log.entity,
      entityId: log.entity_id,
      action: log.action,
    };
  }
}
