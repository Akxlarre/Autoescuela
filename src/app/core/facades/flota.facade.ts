import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import { resolveVehicleStatus } from '@core/utils/vehicle-status.utils';
import { toISODate } from '@core/utils/date.utils';
import type {
  VehicleTableRow,
  VehicleDocSummary,
  FlotaKpis,
  VehicleType,
  VehicleStatus,
  DocStatus,
} from '@core/models/ui/vehicle-table.model';
import type { VehicleAgendaSlot } from '@core/models/ui/vehicle-detail.model';

const EXPIRY_SOON_DAYS = 30;

@Injectable({ providedIn: 'root' })
export class FlotaFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);

  // ── 1. ESTADO REACTIVO (Privado) ────────────────────────────────────────────
  private readonly _vehicles = signal<VehicleTableRow[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _typeFilter = signal<VehicleType | null>(null);
  private readonly _statusFilter = signal<VehicleStatus | null>(null);
  private readonly _selectedVehicleId = signal<number | null>(null);
  private readonly _vehicleAgenda = signal<VehicleAgendaSlot[]>([]);
  private readonly _isLoadingAgenda = signal(false);

  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;
  private _realtimeChannel: any | null = null;
  /** Descarta respuestas de fetchVehiclesData() fuera de orden (spec 0005-m). */
  private readonly vehiclesGuard = createRequestGuard();

  // ── 2. ESTADO EXPUESTO (Público) ──────────────────────────────────────────
  readonly vehicles = this._vehicles.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly typeFilter = this._typeFilter.asReadonly();
  readonly statusFilter = this._statusFilter.asReadonly();
  readonly selectedVehicleId = this._selectedVehicleId.asReadonly();
  readonly vehicleAgenda = this._vehicleAgenda.asReadonly();
  readonly isLoadingAgenda = this._isLoadingAgenda.asReadonly();

  readonly kpis = computed((): FlotaKpis => {
    const vs = this._vehicles();
    const statuses = vs.map((v) => resolveVehicleStatus(v.status));
    return {
      total: vs.length,
      available: statuses.filter((s) => s === 'available').length,
      maintenance: statuses.filter((s) => s === 'maintenance').length,
    };
  });

  readonly filteredVehicles = computed((): VehicleTableRow[] => {
    let result = this._vehicles();
    const type = this._typeFilter();
    const status = this._statusFilter();
    if (type) result = result.filter((v) => v.type === type);
    if (status) result = result.filter((v) => v.status === status);
    return result;
  });

  // ── 3. MÉTODOS DE ACCIÓN ─────────────────────────────────────────────────────

  setupRealtime(): void {
    if (this._realtimeChannel) return;
    this._realtimeChannel = this.supabase.client
      .channel('flota-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicles' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicle_documents' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicle_assignments' },
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

  async init(): Promise<void> {
    return this.initialize();
  } // Alias legacy

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
    this.setupRealtime();
    const branchId = this.getActiveBranchId();
    if (this._initialized && branchId === this._lastBranchId) {
      void this.refreshSilently();
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchVehiclesData();
      this._initialized = true;
      this._lastBranchId = branchId;
    } catch {
      this._error.set('Error al cargar la flota vehicular.');
    } finally {
      this._isLoading.set(false);
    }
  }

  async refreshSilently(): Promise<void> {
    try {
      await this.fetchVehiclesData();
    } catch {
      // Swallowed
    }
  }

  private async fetchVehiclesData(): Promise<void> {
    const requestToken = this.vehiclesGuard.next();
    const branchId = this.getActiveBranchId();
    let query: any = this.supabase.client
      .from('vehicles')
      .select(
        `
        id, license_plate, brand, model, year, status, current_km, last_maintenance, branch_id, both_branches,
        vehicle_assignments(instructor_id, end_date, instructors(user_id, users(first_names, paternal_last_name))),
        vehicle_documents(type, expiry_date, status)
      `,
      )
      .order('id', { ascending: true });
    // spec 0004-m (AC7): un vehículo both_branches=true también debe aparecer con
    // cualquier sede seleccionada. A diferencia de instructors (users.branch_id es un
    // recurso embebido), acá branch_id y both_branches viven en la misma tabla raíz —
    // el .or() de PostgREST sí funciona (confirmado contra Supabase local).
    if (branchId !== null) {
      query = query.or(`branch_id.eq.${branchId},both_branches.eq.true`);
    }
    const { data, error } = await query;

    if (error) throw error;

    const combustibleByVehicle = await this.fetchCombustibleMesPorVehiculo(branchId);
    // Respuesta fuera de orden: ya se disparó una fetch más reciente, descartar (spec 0005-m).
    if (!this.vehiclesGuard.isCurrent(requestToken)) return;
    this._vehicles.set((data ?? []).map((v: any) => this.mapToTableRow(v, combustibleByVehicle)));
  }

  /** Suma expenses.amount con category='combustible' del mes en curso, agrupado por vehicle_id (fix-007-i). */
  private async fetchCombustibleMesPorVehiculo(
    branchId: number | null,
  ): Promise<Map<number, number>> {
    const now = new Date();
    const firstOfMonth = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));

    let query: any = this.supabase.client
      .from('expenses')
      .select('vehicle_id, amount')
      .eq('category', 'combustible')
      .not('vehicle_id', 'is', null)
      .gte('date', firstOfMonth);
    if (branchId !== null) query = query.eq('branch_id', branchId);
    const { data, error } = await query;

    if (error || !data) return new Map();

    const totals = new Map<number, number>();
    for (const row of data as { vehicle_id: number; amount: number }[]) {
      totals.set(row.vehicle_id, (totals.get(row.vehicle_id) ?? 0) + (row.amount ?? 0));
    }
    return totals;
  }

  private mapToTableRow(v: any, combustibleByVehicle?: Map<number, number>): VehicleTableRow {
    const activeAssignment = v.vehicle_assignments?.find((a: any) => a.end_date === null) ?? null;
    let instructorName: string | null = null;
    let instructorId: number | null = null;

    if (activeAssignment) {
      instructorId = activeAssignment.instructor_id;
      const user = activeAssignment.instructors?.users;
      if (user) {
        instructorName = `${user.first_names} ${user.paternal_last_name}`.trim();
      }
    }

    return {
      id: v.id,
      licensePlate: v.license_plate,
      brand: v.brand,
      model: v.model,
      year: v.year,
      vehicleLabel: `${v.brand} ${v.model}`,
      type: this.resolveType(v.brand, v.model),
      status: resolveVehicleStatus(v.status),
      currentKm: v.current_km ?? 0,
      nextMaintenanceDate: v.last_maintenance ?? null,
      instructorName,
      instructorId,
      branchId: v.branch_id ?? null,
      bothBranches: v.both_branches ?? false,
      documents: (v.vehicle_documents ?? []).map((d: any) => ({
        type: d.type ?? 'unknown',
        expiryDate: d.expiry_date ?? '',
        status: this.resolveDocStatus(d.expiry_date, d.status),
      })),
      combustibleMes: combustibleByVehicle?.get(v.id) ?? 0,
    };
  }

  setTypeFilter(type: VehicleType | null): void {
    this._typeFilter.set(type);
  }
  setStatusFilter(status: VehicleStatus | null): void {
    this._statusFilter.set(status);
  }
  selectVehicle(id: number | null): void {
    this._selectedVehicleId.set(id);
  }

  async createVehicle(payload: any): Promise<void> {
    const { error } = await this.supabase.client.from('vehicles').insert(payload);
    if (error) throw error;
    this.toast.success('Vehículo creado', 'El vehículo ha sido registrado correctamente.');
    void this.refreshSilently();
  }

  async updateVehicle(id: number, payload: any): Promise<void> {
    const { error } = await this.supabase.client.from('vehicles').update(payload).eq('id', id);
    if (error) throw error;
    this.toast.success('Vehículo actualizado', 'Los datos han sido actualizados correctamente.');
    void this.refreshSilently();
  }

  async upsertVehicleDocument(payload: any): Promise<void> {
    const { error } = await this.supabase.client
      .from('vehicle_documents')
      .upsert({ ...payload, status: 'valid' }, { onConflict: 'vehicle_id,type' });
    if (error) throw error;
    void this.refreshSilently();
  }

  async loadVehicleAgenda(vehicleId: number, date: Date): Promise<void> {
    this._isLoadingAgenda.set(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      const [sessionsResult, maintenancesResult] = await Promise.all([
        this.supabase.client
          .from('class_b_sessions')
          .select(
            'id, scheduled_at, status, class_number, enrollments!inner(students!inner(users!inner(first_names, paternal_last_name)))',
          )
          .eq('vehicle_id', vehicleId)
          .gte('scheduled_at', `${dateStr}T00:00:00`)
          .lte('scheduled_at', `${dateStr}T23:59:59`)
          .order('scheduled_at', { ascending: true }),
        this.supabase.client
          .from('maintenance_records')
          .select('id, scheduled_date, type, description')
          .eq('vehicle_id', vehicleId)
          .eq('scheduled_date', dateStr),
      ]);

      const slots: VehicleAgendaSlot[] = [];
      const sessionMap = new Map(
        (sessionsResult.data ?? []).map((s: any) => [new Date(s.scheduled_at).getHours(), s]),
      );

      for (let h = 8; h < 18; h++) {
        const hour = `${String(h).padStart(2, '0')}:00`;
        const ses = sessionMap.get(h);
        if (ses) {
          const user = ses.enrollments?.students?.users;
          slots.push({
            hour,
            endHour: `${String(h + 1).padStart(2, '0')}:00`,
            type: 'class',
            studentName: user ? `${user.first_names} ${user.paternal_last_name}`.trim() : 'Alumno',
            classNumber: ses.class_number,
          });
        } else {
          slots.push({ hour, endHour: `${String(h + 1).padStart(2, '0')}:00`, type: 'empty' });
        }
      }
      this._vehicleAgenda.set(slots);
    } finally {
      this._isLoadingAgenda.set(false);
    }
  }

  private resolveType(brand: string, model: string): VehicleType {
    const label = `${brand} ${model}`.toLowerCase();
    return ['atego', 'actros', 'accelo', 'camion', 'bus', 'volvo', 'iveco'].some((k) =>
      label.includes(k),
    )
      ? 'professional'
      : 'class_b';
  }

  private resolveDocStatus(expiryDate: string | null, rawStatus: string | null): DocStatus {
    if (rawStatus === 'expired') return 'expired';
    if (!expiryDate) return 'valid';
    const diffDays = Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / 86400000);
    return diffDays < 0 ? 'expired' : diffDays <= EXPIRY_SOON_DAYS ? 'expiring_soon' : 'valid';
  }
}
