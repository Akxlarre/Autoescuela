import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import { DashboardModel, LiveClassModel } from '@core/models/ui/dashboard.model';
import { toISODate } from '@core/utils/date.utils';

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
  private _liveClassesInterval: any | null = null;

  // ── 2. MÉTODOS DE ACCIÓN ─────────────────────────────────────────────────────

  setupRealtime(): void {
    if (this._realtimeChannel) return;

    // Intervalo local cada 1 minuto para recalcular el tiempo relativo y clases actuales
    this._liveClassesInterval = setInterval(() => {
      void this.refreshLiveClassesOnly();
    }, 60000);

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
    if (this._liveClassesInterval) {
      clearInterval(this._liveClassesInterval);
      this._liveClassesInterval = null;
    }
  }

  private async refreshLiveClassesOnly(): Promise<void> {
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
          icon: 'credit-card',
          color: 'default',
        },
        {
          id: 'vehicles',
          label: 'Vehículos',
          value: vehicles.filter((v: any) => v.status === 'available').length,
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
          id: 'qa2',
          icon: 'calendar',
          label: 'Agenda',
          llmAction: 'view-calendar',
          iconBg: 'transparent',
          iconColor: 'var(--text-secondary)',
        },
        {
          id: 'qa3',
          icon: 'credit-card',
          label: 'Pagos',
          llmAction: 'register-payment',
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

  async fetchLiveClasses(branchId: number | null): Promise<LiveClassModel[]> {
    const todayStr = toISODate(new Date());
    let liveClasses: LiveClassModel[] = [];

    // 1. Clases Prácticas
    let practicasQuery: any = this.supabase.client
      .from('class_b_sessions')
      .select(
        `
        id,
        class_number,
        scheduled_at,
        status,
        vehicles(brand, model, license_plate),
        instructors!class_b_sessions_instructor_id_fkey(users(first_names, paternal_last_name)),
        enrollments!inner(branch_id, students(users(first_names, paternal_last_name)))
      `,
      )
      .gte('scheduled_at', `${todayStr}T00:00:00`)
      .lte('scheduled_at', `${todayStr}T23:59:59`)
      .neq('status', 'cancelled');

    if (branchId !== null) {
      practicasQuery = practicasQuery.eq('enrollments.branch_id', branchId);
    }

    const { data: practicasData, error: practicasError } = await practicasQuery;

    if (!practicasError && practicasData) {
      const mappedPracticas = practicasData.map((row: any) => {
        const instRel =
          row['instructors'] ?? row['instructors!class_b_sessions_instructor_id_fkey'];
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
          scheduledAt: row.scheduled_at,
        } as LiveClassModel;
      });
      liveClasses = [...liveClasses, ...mappedPracticas];
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
      desc = `Registrad${artO} por ${userName}`;
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
      desc = `Eliminad${artO} por ${userName}`;
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
