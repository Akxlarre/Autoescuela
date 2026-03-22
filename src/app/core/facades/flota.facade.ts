import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type {
  VehicleTableRow,
  VehicleDocSummary,
  FlotaKpis,
  VehicleType,
  VehicleStatus,
  DocStatus,
} from '@core/models/ui/vehicle-table.model';
import type { VehicleAgendaSlot } from '@core/models/ui/vehicle-detail.model';

// ─── Raw Supabase types ───────────────────────────────────────────────────────

interface RawUser {
  first_names: string;
  paternal_last_name: string;
}

interface RawInstructor {
  user_id: number;
  users: RawUser | RawUser[] | null;
}

interface RawAssignment {
  instructor_id: number;
  end_date: string | null;
  instructors: RawInstructor | RawInstructor[] | null;
}

interface RawVehicleDocument {
  type: string | null;
  expiry_date: string | null;
  status: string | null;
}

interface RawVehicle {
  id: number;
  license_plate: string;
  brand: string;
  model: string;
  year: number;
  status: string | null;
  current_km: number;
  last_maintenance: string | null;
  branch_id: number | null;
  vehicle_assignments: RawAssignment[];
  vehicle_documents: RawVehicleDocument[];
}

interface RawClassBSession {
  id: number;
  scheduled_at: string;
  status: string | null;
  class_number: number | null;
  enrollments: {
    students: {
      users: { first_names: string; paternal_last_name: string } | null;
    } | null;
  } | null;
}

interface RawMaintenanceRecord {
  id: number;
  scheduled_date: string | null;
  completed_date: string | null;
  type: string | null;
  status: string | null;
  description: string | null;
}

// ─── Facade ───────────────────────────────────────────────────────────────────

/** Days until expiry to consider a document "expiring soon" */
const EXPIRY_SOON_DAYS = 30;

/**
 * FlotaFacade — gestiona el estado de la flota vehicular.
 *
 * Patrón SWR (Stale-While-Revalidate):
 *   - Primera visita: skeleton + fetch
 *   - Re-visitas: render cacheado + refetch silencioso
 *
 * Filtros: tipo (class_b | professional) y estado (available | in_class | maintenance | out_of_service)
 * NUNCA inyectar SupabaseService directamente en la UI.
 */
@Injectable({ providedIn: 'root' })
export class FlotaFacade {
  private readonly supabase = inject(SupabaseService);

  // ── Estado Privado ───────────────────────────────────────────────────────────
  private readonly _vehicles = signal<VehicleTableRow[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _typeFilter = signal<VehicleType | null>(null);
  private readonly _statusFilter = signal<VehicleStatus | null>(null);
  private readonly _selectedVehicleId = signal<number | null>(null);
  private readonly _vehicleAgenda = signal<VehicleAgendaSlot[]>([]);
  private readonly _isLoadingAgenda = signal(false);
  private _initialized = false;

  // ── Estado Público ───────────────────────────────────────────────────────────
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
    return {
      total: vs.length,
      available: vs.filter((v) => v.status === 'available').length,
      inClass: vs.filter((v) => v.status === 'in_class').length,
      maintenance: vs.filter((v) => v.status === 'maintenance').length,
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

  // ── Métodos de Acción ────────────────────────────────────────────────────────

  /**
   * Initialize con SWR: primera visita muestra skeleton y carga;
   * re-visitas renderizan caché y revalidan silenciosamente en background.
   */
  async init(): Promise<void> {
    if (this._initialized) {
      // Re-visit: refetch silencioso sin skeleton
      void this.fetchVehicles(false);
      return;
    }
    this._initialized = true;
    await this.fetchVehicles(true);
  }

  async refreshSilently(): Promise<void> {
    await this.fetchVehicles(false);
  }

  setTypeFilter(type: VehicleType | null): void {
    this._typeFilter.set(type);
  }

  setStatusFilter(status: VehicleStatus | null): void {
    this._statusFilter.set(status);
  }

  /** Selecciona un vehículo para edición/vista en el drawer */
  selectVehicle(id: number | null): void {
    this._selectedVehicleId.set(id);
  }

  /**
   * Crea un vehículo nuevo en la BD y refresca la lista.
   */
  async createVehicle(payload: {
    license_plate: string;
    brand: string;
    model: string;
    year: number;
    status?: string;
    current_km?: number;
    branch_id?: number | null;
  }): Promise<void> {
    const { error } = await this.supabase.client.from('vehicles').insert(payload);
    if (error) throw error;
    await this.fetchVehicles(false);
  }

  /**
   * Actualiza un vehículo existente y refresca la lista.
   */
  async updateVehicle(
    id: number,
    payload: Partial<{
      license_plate: string;
      brand: string;
      model: string;
      year: number;
      status: string;
      current_km: number;
      branch_id: number | null;
    }>,
  ): Promise<void> {
    const { error } = await this.supabase.client
      .from('vehicles')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
    await this.fetchVehicles(false);
  }

  /**
   * Asigna un documento (SOAP, rev. técnica, seguro, permiso) a un vehículo.
   */
  async upsertVehicleDocument(payload: {
    vehicle_id: number;
    type: string;
    expiry_date: string;
    document_number?: string | null;
    file_url?: string | null;
  }): Promise<void> {
    const { error } = await this.supabase.client
      .from('vehicle_documents')
      .upsert({ ...payload, status: 'valid' }, { onConflict: 'vehicle_id,type' });
    if (error) throw error;
    await this.fetchVehicles(false);
  }

  /**
   * Carga la agenda diaria del vehículo combinando class_b_sessions y maintenance_records.
   * Genera slots de 1h desde las 08:00 hasta las 18:00.
   */
  async loadVehicleAgenda(vehicleId: number, date: Date): Promise<void> {
    this._isLoadingAgenda.set(true);
    this._vehicleAgenda.set([]);

    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const dayStart = `${dateStr}T00:00:00`;
    const dayEnd = `${dateStr}T23:59:59`;

    const [sessionsResult, maintenancesResult] = await Promise.all([
      this.supabase.client
        .from('class_b_sessions')
        .select(
          `id, scheduled_at, status, class_number,
           enrollments!inner(
             students!inner(users!inner(first_names, paternal_last_name))
           )`,
        )
        .eq('vehicle_id', vehicleId)
        .gte('scheduled_at', dayStart)
        .lte('scheduled_at', dayEnd)
        .order('scheduled_at', { ascending: true }),

      this.supabase.client
        .from('maintenance_records')
        .select('id, scheduled_date, completed_date, type, status, description')
        .eq('vehicle_id', vehicleId)
        .or(
          `scheduled_date.eq.${dateStr},completed_date.eq.${dateStr}`,
        ),
    ]);

    const sessions = (sessionsResult.data ?? []) as unknown as RawClassBSession[];
    const maintenances = (maintenancesResult.data ?? []) as RawMaintenanceRecord[];

    // Construir mapa hora → evento
    const eventMap = new Map<string, VehicleAgendaSlot>();

    for (const session of sessions) {
      const scheduledAt = new Date(session.scheduled_at);
      const hour = `${String(scheduledAt.getHours()).padStart(2, '0')}:00`;
      const endHour = `${String(scheduledAt.getHours() + 1).padStart(2, '0')}:00`;

      // Extraer nombre del alumno (join anidado)
      const enrollmentsRaw = session.enrollments as unknown;
      const enrollment = (
        Array.isArray(enrollmentsRaw) ? enrollmentsRaw[0] : enrollmentsRaw
      ) as (typeof sessions)[0]['enrollments'];
      const studentsRaw = enrollment?.students as unknown;
      const student = (
        Array.isArray(studentsRaw) ? studentsRaw[0] : studentsRaw
      ) as { users: RawUser | RawUser[] | null } | null;
      const usersRaw = student?.users;
      const user = (Array.isArray(usersRaw) ? usersRaw[0] : usersRaw) as RawUser | null;
      const studentName = user
        ? `${user.first_names} ${user.paternal_last_name}`.trim()
        : 'Alumno';

      eventMap.set(hour, {
        hour,
        endHour,
        type: 'class',
        studentName,
        classNumber: typeof session.class_number === 'number' ? session.class_number : undefined,
      });
    }

    for (const maint of maintenances) {
      // Para mantenimientos no tenemos hora exacta, los ponemos en la mañana
      const hour = '09:00';
      const endHour = '10:00';
      if (!eventMap.has(hour)) {
        eventMap.set(hour, {
          hour,
          endHour,
          type: 'maintenance',
          description: maint.description ?? maint.type ?? 'Mantenimiento',
        });
      }
    }

    // Generar grilla 08:00–18:00 (11 horas)
    const slots: VehicleAgendaSlot[] = [];
    for (let h = 8; h < 18; h++) {
      const hour = `${String(h).padStart(2, '0')}:00`;
      const endHour = `${String(h + 1).padStart(2, '0')}:00`;
      slots.push(
        eventMap.get(hour) ?? { hour, endHour, type: 'empty' },
      );
    }

    this._vehicleAgenda.set(slots);
    this._isLoadingAgenda.set(false);
  }

  // ── Helpers Privados ─────────────────────────────────────────────────────────

  private async fetchVehicles(withSkeleton: boolean): Promise<void> {
    if (withSkeleton) {
      this._isLoading.set(true);
      this._error.set(null);
    }

    try {
      const { data, error } = await this.supabase.client
        .from('vehicles')
        .select(
          `
          id,
          license_plate,
          brand,
          model,
          year,
          status,
          current_km,
          last_maintenance,
          branch_id,
          vehicle_assignments(
            instructor_id,
            end_date,
            instructors(
              user_id,
              users(first_names, paternal_last_name)
            )
          ),
          vehicle_documents(
            type,
            expiry_date,
            status
          )
        `,
        )
        .order('id', { ascending: true });

      if (error) throw error;

      const rows = ((data ?? []) as unknown as RawVehicle[]).map((v) =>
        this.mapToTableRow(v),
      );
      this._vehicles.set(rows);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Error al cargar la flota');
    } finally {
      if (withSkeleton) this._isLoading.set(false);
    }
  }

  private mapToTableRow(v: RawVehicle): VehicleTableRow {
    // Asignación activa: end_date IS NULL
    const activeAssignment =
      v.vehicle_assignments.find((a) => a.end_date === null) ?? null;

    let instructorName: string | null = null;
    let instructorId: number | null = null;

    if (activeAssignment) {
      instructorId = activeAssignment.instructor_id;
      const instrRaw = activeAssignment.instructors;
      const instr = (
        Array.isArray(instrRaw) ? instrRaw[0] : instrRaw
      ) as RawInstructor | null;
      if (instr) {
        const userRaw = instr.users;
        const user = (
          Array.isArray(userRaw) ? userRaw[0] : userRaw
        ) as RawUser | null;
        if (user) {
          instructorName = `${user.first_names} ${user.paternal_last_name}`.trim();
        }
      }
    }

    const documents: VehicleDocSummary[] = v.vehicle_documents.map((d) => ({
      type: d.type ?? 'unknown',
      expiryDate: d.expiry_date ?? '',
      status: this.resolveDocStatus(d.expiry_date, d.status),
    }));

    return {
      id: v.id,
      licensePlate: v.license_plate,
      brand: v.brand,
      model: v.model,
      year: v.year,
      vehicleLabel: `${v.brand} ${v.model}`,
      type: this.resolveType(v.brand, v.model),
      status: this.resolveStatus(v.status),
      currentKm: v.current_km ?? 0,
      nextMaintenanceDate: v.last_maintenance ?? null,
      instructorName,
      instructorId,
      branchId: v.branch_id ?? null,
      documents,
    };
  }

  /** Deriva el tipo del vehículo según la columna status o el contexto.
   *  TODO: cuando la BD tenga columna vehicle_type, usar esa directamente. */
  private resolveType(brand: string, model: string): VehicleType {
    // Por ahora asumimos class_b salvo modelos de camión/bus conocidos
    const professionalKeywords = ['atego', 'actros', 'accelo', 'camion', 'bus', 'volvo', 'iveco'];
    const label = `${brand} ${model}`.toLowerCase();
    return professionalKeywords.some((k) => label.includes(k)) ? 'professional' : 'class_b';
  }

  private resolveStatus(raw: string | null): VehicleStatus {
    const map: Record<string, VehicleStatus> = {
      available: 'available',
      disponible: 'available',
      in_class: 'in_class',
      'en clase': 'in_class',
      en_clase: 'in_class',
      maintenance: 'maintenance',
      mantenimiento: 'maintenance',
      out_of_service: 'out_of_service',
      'fuera de servicio': 'out_of_service',
    };
    return map[raw?.toLowerCase() ?? ''] ?? 'available';
  }

  private resolveDocStatus(expiryDate: string | null, rawStatus: string | null): DocStatus {
    if (rawStatus === 'expired') return 'expired';
    if (!expiryDate) return 'valid';
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'expired';
    if (diffDays <= EXPIRY_SOON_DAYS) return 'expiring_soon';
    return 'valid';
  }
}
