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
 * Queries paralelas:
 * 1. Documentos de vehículos vencidos/por vencer
 * 2. Pagos pendientes de matrículas activas
 */
@Injectable({ providedIn: 'root' })
export class DashboardAlertsFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);

  // ── SWR State ────────────────────────────────────────────────────────────
  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;

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

  /**
   * SWR Initialization:
   * First call triggers isLoading(true). Subsequent calls refresh silently.
   */
  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    if (user?.role === 'admin') return this.branchFacade.selectedBranchId();
    return user?.branchId ?? null;
  }

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
      // Swallowed
    }
  }

  /** Legacy wrapper */
  async loadAlerts(): Promise<void> {
    return this.initialize();
  }

  private async fetchAlertsData(branchId: number | null): Promise<void> {
    try {
      const alerts = await Promise.all([
        this.checkExpiredDocuments(branchId),
        this.checkPendingPayments(branchId),
      ]);
      this._activeAlerts.set(alerts.flat());
    } catch (err) {
      console.error('[DashboardAlertsFacade] fetchAlertsData error:', err);
      throw err;
    }
  }

  // ── Queries privadas ───────────────────────────────────────────────────────

  /**
   * Query 1: Documentos de vehículos vencidos o por vencer.
   * Lee `alert_config` para obtener `advance_days`, luego consulta `vehicle_documents`.
   */
  private async checkExpiredDocuments(branchId: number | null): Promise<AlertModel[]> {
    const alerts: AlertModel[] = [];

    // Obtener configuración de anticipación de alertas
    const { data: configs } = await this.supabase.client
      .from('alert_config')
      .select('alert_type, advance_days')
      .eq('active', true);

    const advanceDays =
      configs?.find((c: any) => c.alert_type === 'document_expiry')?.advance_days ?? 30;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Documentos ya vencidos
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
      });
    }

    // Documentos por vencer (dentro de advance_days)
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
      });
    }

    return alerts;
  }

  /**
   * Query 2: Matrículas activas con saldo pendiente.
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
        },
      ];
    }

    return [];
  }
}
