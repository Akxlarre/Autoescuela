import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { DashboardModel } from '@core/models/ui/dashboard.model';
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

  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    if (user?.role === 'admin') return this.branchFacade.selectedBranchId();
    return user?.branchId ?? null;
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

    let studentsQuery: any = this.supabase.client
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    if (branchId !== null) studentsQuery = studentsQuery.eq('branch_id', branchId);

    let classesQuery: any = this.supabase.client
      .from('class_b_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_at', `${todayStr}T00:00:00`)
      .lte('scheduled_at', `${todayStr}T23:59:59`);
    if (branchId !== null) classesQuery = classesQuery.eq('branch_id', branchId);

    let revenueQuery: any = this.supabase.client
      .from('payments')
      .select('total_amount, enrollments!inner(branch_id)')
      .gte('payment_date', firstOfMonth);
    if (branchId !== null) revenueQuery = revenueQuery.eq('enrollments.branch_id', branchId);

    let vehiclesQuery: any = this.supabase.client.from('vehicles').select('id, status');
    if (branchId !== null) vehiclesQuery = vehiclesQuery.eq('branch_id', branchId);

    const [activeStudents, classesToday, monthlyRevenue, vehiclesStatus] = await Promise.all([
      studentsQuery,
      classesQuery,
      revenueQuery,
      vehiclesQuery,
    ]);

    const revenue = (monthlyRevenue.data ?? []).reduce(
      (acc: number, r: any) => acc + (r.total_amount ?? 0),
      0,
    );
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
          trend: 0,
          trendLabel: 'vs ayer',
          icon: 'users',
          color: 'default',
        },
        {
          id: 'classes',
          label: 'Clases Hoy',
          value: classesToday.count ?? 0,
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
          trend: 0,
          trendLabel: 'acumulado mes',
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
      activities: [], // Could be fetched from a dedicated 'audit_logs' or 'recent_activity' view
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
    });
  }
}
