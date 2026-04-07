import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { BranchFacade } from '@core/facades/branch.facade';
import type {
  InstructorTableRow,
  InstructorType,
  LicenseStatus,
  VehicleOption,
  VehicleAssignmentHistory,
} from '@core/models/ui/instructor-table.model';
import { getInitialsFromDisplayName } from '@core/models/ui/user.model';

// ── Payloads ──────────────────────────────────────────────────────────────────

export interface CrearInstructorPayload {
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  rut: string;
  email: string;
  phone: string;
  type: InstructorType;
  licenseNumber: string;
  licenseClass: string;
  licenseExpiry: string;
  vehicleId: number | null;
  branchId: number;
}

export interface EditarInstructorPayload {
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  phone: string;
  email: string;
  currentEmail: string;
  type: InstructorType;
  licenseNumber: string;
  licenseClass: string;
  licenseExpiry: string;
  active: boolean;
  vehicleId: number | null;
  currentVehicleId: number | null;
  branchId: number;
}

// ── DTOs internos de Supabase ─────────────────────────────────────────────────

interface VehicleRow {
  id: number;
  license_plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
}

interface VehicleAssignmentRow {
  vehicle_id: number;
  start_date: string;
  vehicles: VehicleRow | null;
}

interface InstructorRow {
  id: number;
  user_id: number;
  type: string | null;
  license_number: string | null;
  license_class: string | null;
  license_expiry: string | null;
  license_status: string | null;
  active_classes_count: number;
  active: boolean;
  registration_date: string | null;
  users: {
    id: number;
    rut: string;
    first_names: string;
    paternal_last_name: string;
    maternal_last_name: string | null;
    email: string;
    phone: string | null;
    active: boolean;
    branch_id: number | null;
  } | null;
  vehicle_assignments: VehicleAssignmentRow[];
}

interface BranchOption {
  id: number;
  name: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  theory: 'Teórico',
  practice: 'Práctico',
  both: 'Ambos',
};

const LICENSE_STATUS_LABELS: Record<string, string> = {
  valid: 'Vigente',
  expiring_soon: 'Por vencer',
  expired: 'Vencida',
};

// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class InstructoresFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly branchFacade = inject(BranchFacade);

  // ── Estado privado ─────────────────────────────────────────────────────────
  private readonly _instructores = signal<InstructorTableRow[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;

  private readonly _branches = signal<BranchOption[]>([]);
  private _branchesLoaded = false;

  private readonly _vehicles = signal<VehicleOption[]>([]);
  private _vehiclesLoaded = false;

  private readonly _isSubmitting = signal(false);
  private readonly _selectedInstructor = signal<InstructorTableRow | null>(null);
  private readonly _assignmentHistory = signal<VehicleAssignmentHistory[]>([]);

  // ── Estado público ─────────────────────────────────────────────────────────
  readonly instructores = this._instructores.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly branches = this._branches.asReadonly();
  readonly vehicles = this._vehicles.asReadonly();
  readonly isSubmitting = this._isSubmitting.asReadonly();
  readonly selectedInstructor = this._selectedInstructor.asReadonly();
  readonly assignmentHistory = this._assignmentHistory.asReadonly();

  // ── KPIs computed ──────────────────────────────────────────────────────────
  readonly totalInstructores = computed<number>(() => this._instructores().length);
  readonly activos = computed<number>(
    () => this._instructores().filter((i) => i.estado === 'activo').length,
  );
  readonly inactivos = computed<number>(
    () => this._instructores().filter((i) => i.estado === 'inactivo').length,
  );
  readonly licenciasPorVencer = computed<number>(
    () => this._instructores().filter((i) => i.licenseStatus === 'expiring_soon').length,
  );

  // ── Acciones ───────────────────────────────────────────────────────────────

  selectInstructor(inst: InstructorTableRow): void {
    this._selectedInstructor.set(inst);
  }

  async initialize(): Promise<void> {
    const currentBranchId = this.branchFacade.selectedBranchId();
    if (this._initialized && currentBranchId === this._lastBranchId) {
      this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._lastBranchId = currentBranchId;
    this._isLoading.set(true);
    try {
      await this.fetchData();
    } finally {
      this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchData();
    } catch {
      // Fail silencioso — datos stale siguen visibles
    }
  }

  private async fetchData(): Promise<void> {
    const branchId = this.branchFacade.selectedBranchId();

    let query = this.supabase.client
      .from('instructors')
      .select(
        `
        id,
        user_id,
        type,
        license_number,
        license_class,
        license_expiry,
        license_status,
        active_classes_count,
        active,
        registration_date,
        users!inner (
          id,
          rut,
          first_names,
          paternal_last_name,
          maternal_last_name,
          email,
          phone,
          active,
          branch_id
        ),
        vehicle_assignments (
          vehicle_id,
          start_date,
          vehicles ( id, license_plate, brand, model, year )
        )
      `,
      )
      .is('vehicle_assignments.end_date', null)
      .order('registration_date', { ascending: false });

    if (branchId !== null) {
      query = query.eq('users.branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) {
      this._error.set(error.message);
      throw error;
    }

    const rows = (data as unknown as InstructorRow[]) ?? [];
    this._instructores.set(rows.map((r) => this.mapRow(r)));
  }

  async loadBranches(): Promise<void> {
    if (this._branchesLoaded) return;
    const { data, error } = await this.supabase.client
      .from('branches')
      .select('id, name')
      .order('name');
    if (!error) {
      this._branches.set((data as BranchOption[]) ?? []);
      this._branchesLoaded = true;
    }
  }

  async loadVehicles(): Promise<void> {
    if (this._vehiclesLoaded) return;

    // Cargar todos los vehículos activos
    const { data: allVehicles, error: vError } = await this.supabase.client
      .from('vehicles')
      .select('id, license_plate, brand, model, year, status')
      .order('license_plate');

    if (vError || !allVehicles) return;

    // Cargar asignaciones activas para saber cuáles están asignados
    const { data: activeAssignments } = await this.supabase.client
      .from('vehicle_assignments')
      .select('vehicle_id')
      .is('end_date', null);

    const assignedIds = new Set(
      (activeAssignments ?? []).map((a: { vehicle_id: number }) => a.vehicle_id),
    );

    this._vehicles.set(
      allVehicles.map(
        (v: {
          id: number;
          license_plate: string;
          brand: string | null;
          model: string | null;
          year: number | null;
          status: string | null;
        }) => {
          const modelLabel = [v.brand, v.model, v.year].filter(Boolean).join(' ');
          let status: 'available' | 'assigned' | 'maintenance' = 'available';
          if (v.status === 'maintenance' || v.status === 'blocked') {
            status = 'maintenance';
          } else if (assignedIds.has(v.id)) {
            status = 'assigned';
          }
          return {
            id: v.id,
            licensePlate: v.license_plate,
            label: `${v.license_plate} - ${modelLabel}`.trim(),
            status,
          };
        },
      ),
    );
    this._vehiclesLoaded = true;
  }

  async loadAssignmentHistory(instructorId: number): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('vehicle_assignments')
      .select(
        `
        id,
        start_date,
        end_date,
        vehicle_id,
        vehicles ( license_plate, brand, model, year ),
        assigned_by_user:users!vehicle_assignments_assigned_by_fkey ( first_names, paternal_last_name )
      `,
      )
      .eq('instructor_id', instructorId)
      .order('start_date', { ascending: false });

    if (error || !data) {
      this._assignmentHistory.set([]);
      return;
    }

    this._assignmentHistory.set(
      data.map((a: Record<string, unknown>) => {
        const v = a['vehicles'] as {
          license_plate: string;
          brand: string | null;
          model: string | null;
          year: number | null;
        } | null;
        const assignedByUser = a['assigned_by_user'] as {
          first_names: string;
          paternal_last_name: string;
        } | null;
        return {
          id: a['id'] as number,
          vehiclePlate: v?.license_plate ?? '—',
          vehicleModel: [v?.brand, v?.model, v?.year].filter(Boolean).join(' '),
          startDate: a['start_date'] as string,
          endDate: (a['end_date'] as string) ?? null,
          assignedBy: assignedByUser
            ? `${assignedByUser.first_names} ${assignedByUser.paternal_last_name}`
            : null,
        };
      }),
    );
  }

  async crearInstructor(payload: CrearInstructorPayload): Promise<boolean> {
    this._isSubmitting.set(true);
    try {
      const { data, error } = await this.supabase.client.functions.invoke('create-instructor', {
        body: payload,
      });

      if (error) throw new Error(error.message ?? 'Error al crear instructor');

      // Verificar si la respuesta contiene un error
      if (data?.error) throw new Error(data.error);

      this.toast.success('Instructor creado', 'La cuenta ha sido creada correctamente.');
      this._vehiclesLoaded = false;
      await Promise.all([this.refreshSilently(), this.loadVehicles()]);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear instructor';
      this.toast.error('Error', msg);
      return false;
    } finally {
      this._isSubmitting.set(false);
    }
  }

  async editarInstructor(
    instructorId: number,
    userId: number,
    payload: EditarInstructorPayload,
  ): Promise<boolean> {
    this._isSubmitting.set(true);
    try {
      const { data, error } = await this.supabase.client.functions.invoke('update-instructor', {
        body: {
          instructorId,
          userId,
          firstNames: payload.firstNames,
          paternalLastName: payload.paternalLastName,
          maternalLastName: payload.maternalLastName,
          phone: payload.phone,
          email: payload.email.trim().toLowerCase(),
          currentEmail: payload.currentEmail.trim().toLowerCase(),
          type: payload.type,
          licenseNumber: payload.licenseNumber,
          licenseClass: payload.licenseClass,
          licenseExpiry: payload.licenseExpiry,
          active: payload.active,
          vehicleId: payload.vehicleId,
          currentVehicleId: payload.currentVehicleId,
          branchId: payload.branchId,
        },
      });

      if (error) throw new Error(error.message ?? 'Error al actualizar instructor');
      if (data?.error) throw new Error(data.error);

      this._vehiclesLoaded = false;
      await Promise.all([this.refreshSilently(), this.loadVehicles()]);
      this.toast.success(
        'Instructor actualizado',
        'Los datos han sido actualizados correctamente.',
      );
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar instructor';
      this.toast.error('Error', msg);
      return false;
    } finally {
      this._isSubmitting.set(false);
    }
  }

  private mapRow(r: InstructorRow): InstructorTableRow {
    const u = r.users!;
    const nombre = [u.first_names, u.paternal_last_name, u.maternal_last_name ?? '']
      .filter((s) => s.trim().length > 0)
      .join(' ');

    // Current vehicle assignment (end_date IS NULL)
    const currentAssignment = r.vehicle_assignments?.[0] ?? null;
    const vehicle = currentAssignment?.vehicles ?? null;
    const vehicleModel = vehicle
      ? [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ')
      : null;

    const tipoRaw = ((r.type as string) ?? 'practice').trim().toLowerCase();
    const tipo = (tipoRaw as InstructorType) || 'practice';
    const statusRaw = ((r.license_status as string) ?? 'valid').trim().toLowerCase();
    const licenseStatus = (statusRaw as LicenseStatus) || 'valid';

    return {
      id: r.id,
      userId: u.id,
      nombre,
      initials: getInitialsFromDisplayName(nombre),
      email: u.email,
      rut: u.rut,
      phone: u.phone ?? '',
      tipo,
      tipoLabel: TYPE_LABELS[tipo] ?? tipo,
      licenseNumber: r.license_number ?? '',
      licenseClass: r.license_class ?? '',
      licenseExpiry: r.license_expiry ?? null,
      licenseStatus,
      licenseStatusLabel: LICENSE_STATUS_LABELS[licenseStatus] ?? licenseStatus,
      activeClassesCount: r.active_classes_count,
      estado: r.active && u.active ? 'activo' : 'inactivo',
      registrationDate: r.registration_date ?? null,
      vehiclePlate: vehicle?.license_plate ?? null,
      vehicleModel,
      vehicleId: vehicle?.id ?? null,
      vehicleAssignmentDate: currentAssignment?.start_date ?? null,
      firstName: u.first_names,
      paternalLastName: u.paternal_last_name,
      maternalLastName: u.maternal_last_name ?? '',
      branchId: u.branch_id,
    };
  }
}
