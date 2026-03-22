import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type {
  MaintenanceRow,
  MaintenanceKpis,
  ScheduledMaintenance,
} from '@core/models/ui/vehicle-detail.model';
import type { VehicleTableRow } from '@core/models/ui/vehicle-table.model';

// ─── Raw Supabase types ───────────────────────────────────────────────────────

interface RawMaintenance {
  id: number;
  type: string | null;
  description: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  km_at_time: number | null;
  cost: number | null;
  workshop: string | null;
  status: string | null;
  created_at: string;
}

interface RawVehicleForDetail {
  id: number;
  license_plate: string;
  brand: string;
  model: string;
  year: number;
  status: string | null;
  current_km: number;
  last_maintenance: string | null;
  branch_id: number | null;
  vehicle_assignments: {
    instructor_id: number;
    end_date: string | null;
    instructors: {
      users: { first_names: string; paternal_last_name: string } | null;
    } | null;
  }[];
  vehicle_documents: {
    type: string | null;
    expiry_date: string | null;
    status: string | null;
  }[];
}

// ─── Facade ───────────────────────────────────────────────────────────────────

/** Days until a maintenance is considered "soon" */
const SOON_DAYS = 14;

/**
 * FlotaDetalleFacade — gestiona el estado de detalle de un vehículo:
 * historial de mantenimientos, KPIs y mantenimientos programados.
 *
 * Patrón: AdminAlumnoDetalleFacade — carga secuencial vehicle → mantenimientos en paralelo.
 */
@Injectable({ providedIn: 'root' })
export class FlotaDetalleFacade {
  private readonly supabase = inject(SupabaseService);

  // ── Estado Privado ───────────────────────────────────────────────────────────
  private readonly _vehicle = signal<VehicleTableRow | null>(null);
  private readonly _maintenances = signal<MaintenanceRow[]>([]);
  private readonly _scheduledMaintenances = signal<ScheduledMaintenance[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _selectedMaintenanceId = signal<number | null>(null);

  // ── Estado Público ───────────────────────────────────────────────────────────
  readonly vehicle = this._vehicle.asReadonly();
  readonly maintenances = this._maintenances.asReadonly();
  readonly scheduledMaintenances = this._scheduledMaintenances.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selectedMaintenanceId = this._selectedMaintenanceId.asReadonly();

  readonly maintenanceKpis = computed((): MaintenanceKpis => {
    const rows = this._maintenances();
    const spent = rows.reduce((acc, r) => acc + (r.cost ?? 0), 0);
    const v = this._vehicle();
    return {
      totalCount: rows.length,
      totalSpent: spent,
      avgMonthly: rows.length > 0 ? Math.round(spent / Math.max(rows.length, 1)) : 0,
      kmTraveled: v?.currentKm ?? 0,
    };
  });

  // ── Métodos de Acción ────────────────────────────────────────────────────────

  /** Selecciona un mantenimiento para edición en el drawer */
  selectMaintenance(id: number | null): void {
    this._selectedMaintenanceId.set(id);
  }

  /**
   * Carga el detalle completo del vehículo + historial de mantenimientos en paralelo.
   */
  async loadVehicleDetail(vehicleId: number): Promise<void> {
    this._vehicle.set(null);
    this._maintenances.set([]);
    this._scheduledMaintenances.set([]);
    this._error.set(null);
    this._isLoading.set(true);

    try {
      const [vehicleResult, maintenancesResult] = await Promise.all([
        this.supabase.client
          .from('vehicles')
          .select(
            `id, license_plate, brand, model, year, status, current_km, last_maintenance, branch_id,
             vehicle_assignments(instructor_id, end_date, instructors(users(first_names, paternal_last_name))),
             vehicle_documents(type, expiry_date, status)`,
          )
          .eq('id', vehicleId)
          .single(),

        this.supabase.client
          .from('maintenance_records')
          .select(
            'id, type, description, scheduled_date, completed_date, km_at_time, cost, workshop, status, created_at',
          )
          .eq('vehicle_id', vehicleId)
          .order('created_at', { ascending: false }),
      ]);

      if (vehicleResult.error) throw vehicleResult.error;

      const v = vehicleResult.data as unknown as RawVehicleForDetail;

      // Asignación activa (end_date IS NULL)
      const activeAssignment = v.vehicle_assignments.find((a) => a.end_date === null) ?? null;
      let instructorName: string | null = null;
      let instructorId: number | null = null;
      if (activeAssignment) {
        instructorId = activeAssignment.instructor_id;
        const instrRaw = activeAssignment.instructors;
        const instr = Array.isArray(instrRaw) ? instrRaw[0] : instrRaw;
        const userRaw = instr?.users;
        const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
        if (user) {
          instructorName = `${user.first_names} ${user.paternal_last_name}`.trim();
        }
      }

      this._vehicle.set({
        id: v.id,
        licensePlate: v.license_plate,
        brand: v.brand,
        model: v.model,
        year: v.year,
        vehicleLabel: `${v.brand} ${v.model}`,
        type: 'class_b',
        status: this.resolveStatus(v.status),
        currentKm: v.current_km ?? 0,
        nextMaintenanceDate: v.last_maintenance ?? null,
        instructorName,
        instructorId,
        branchId: v.branch_id ?? null,
        documents: v.vehicle_documents.map((d) => ({
          type: d.type ?? 'unknown',
          expiryDate: d.expiry_date ?? '',
          status: 'valid' as const,
        })),
      });

      // Mapear mantenimientos
      const mainRows = ((maintenancesResult.data ?? []) as RawMaintenance[]).map(
        (m): MaintenanceRow => ({
          id: m.id,
          date: m.completed_date ?? m.scheduled_date ?? m.created_at.slice(0, 10),
          type: m.type ?? 'Servicio general',
          km: m.km_at_time ?? null,
          cost: m.cost ?? null,
          workshop: m.workshop ?? null,
          nextServiceDate: null,
          description: m.description ?? null,
          status: m.status ?? 'completed',
        }),
      );
      this._maintenances.set(mainRows);

      // Construir mantenimientos programados desde vehicle_documents
      const scheduled: ScheduledMaintenance[] = v.vehicle_documents.map((d) => ({
        type: this.docTypeLabel(d.type),
        dueDate: d.expiry_date ?? null,
        status: this.resolveScheduledStatus(d.expiry_date),
      }));
      this._scheduledMaintenances.set(scheduled);
    } catch (err) {
      this._error.set(
        err instanceof Error ? err.message : 'Error al cargar el detalle del vehículo',
      );
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Registra un nuevo mantenimiento y recarga el detalle.
   */
  async createMaintenance(
    vehicleId: number,
    payload: {
      type: string;
      description?: string | null;
      km_at_time?: number | null;
      cost?: number | null;
      workshop?: string | null;
      scheduled_date?: string | null;
      completed_date?: string | null;
    },
  ): Promise<void> {
    const { error } = await this.supabase.client.from('maintenance_records').insert({
      vehicle_id: vehicleId,
      status: 'completed',
      ...payload,
    });
    if (error) throw error;
    await this.loadVehicleDetail(vehicleId);
  }

  /**
   * Actualiza un mantenimiento existente y recarga el detalle.
   */
  async updateMaintenance(
    id: number,
    vehicleId: number,
    payload: Partial<{
      type: string;
      description: string | null;
      km_at_time: number | null;
      cost: number | null;
      workshop: string | null;
      scheduled_date: string | null;
      completed_date: string | null;
      status: string;
    }>,
  ): Promise<void> {
    const { error } = await this.supabase.client
      .from('maintenance_records')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
    await this.loadVehicleDetail(vehicleId);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private resolveStatus(
    raw: string | null,
  ): 'available' | 'in_class' | 'maintenance' | 'out_of_service' {
    const map: Record<string, 'available' | 'in_class' | 'maintenance' | 'out_of_service'> = {
      available: 'available',
      disponible: 'available',
      in_class: 'in_class',
      maintenance: 'maintenance',
      mantenimiento: 'maintenance',
      out_of_service: 'out_of_service',
    };
    return map[raw?.toLowerCase() ?? ''] ?? 'available';
  }

  private resolveScheduledStatus(expiryDate: string | null): 'ok' | 'soon' | 'overdue' {
    if (!expiryDate) return 'ok';
    const today = new Date();
    const exp = new Date(expiryDate);
    const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'overdue';
    if (diff <= SOON_DAYS) return 'soon';
    return 'ok';
  }

  private docTypeLabel(type: string | null): string {
    const map: Record<string, string> = {
      soap: 'SOAP',
      technical_inspection: 'Revisión Técnica',
      circulation_permit: 'Permiso de Circulación',
      insurance: 'Seguro',
    };
    return map[type ?? ''] ?? (type ?? 'Documento');
  }
}
