import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import { toISODate } from '@core/utils/date.utils';
import type {
  InstructorTableRow,
  InstructorHoraRow,
  InstructorHorarioSession,
  InstructorType,
  LicenseStatus,
  VehicleOption,
  VehicleAssignmentHistory,
} from '@core/models/ui/instructor-table.model';
import { getInitialsFromDisplayName } from '@core/models/ui/user.model';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

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
  bothBranches: boolean;
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
  bothBranches: boolean;
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
  active: boolean;
  registration_date: string | null;
  both_branches: boolean;
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
    first_login: boolean;
    supabase_uid: string | null;
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
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly branchFacade = inject(BranchFacade);
  private readonly authFacade = inject(AuthFacade);

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

  private readonly _horasMonth = signal<number>(new Date().getMonth() + 1);
  private readonly _horasYear = signal<number>(new Date().getFullYear());
  private readonly _horasMensuales = signal<InstructorHoraRow[]>([]);
  private readonly _isLoadingHoras = signal<boolean>(false);

  private readonly _horario = signal<InstructorHorarioSession[]>([]);
  private readonly _isLoadingHorario = signal<boolean>(false);

  // ── Estado público ─────────────────────────────────────────────────────────
  readonly instructores = this._instructores.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly branches = this._branches.asReadonly();
  readonly vehicles = this._vehicles.asReadonly();
  readonly isSubmitting = this._isSubmitting.asReadonly();
  readonly selectedInstructor = this._selectedInstructor.asReadonly();
  readonly assignmentHistory = this._assignmentHistory.asReadonly();
  readonly horasMonth = this._horasMonth.asReadonly();
  readonly horasYear = this._horasYear.asReadonly();
  readonly horasMensuales = this._horasMensuales.asReadonly();
  readonly isLoadingHoras = this._isLoadingHoras.asReadonly();
  readonly isHorasCurrentMonth = computed(() => {
    const now = new Date();
    return this._horasMonth() === now.getMonth() + 1 && this._horasYear() === now.getFullYear();
  });
  readonly horario = this._horario.asReadonly();
  readonly isLoadingHorario = this._isLoadingHorario.asReadonly();

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

  /**
   * Sede activa para el scope de queries (fix-027).
   * admin → respeta el selector; secretaria → su sede (misconfig → ninguna fila).
   */
  private getActiveBranchId(): number | null {
    const user = this.authFacade.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }

  async initialize(): Promise<void> {
    const currentBranchId = this.getActiveBranchId();
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

  private static readonly INSTRUCTOR_SELECT = `
    id,
    user_id,
    type,
    license_number,
    license_class,
    license_expiry,
    license_status,
    active,
    registration_date,
    both_branches,
    users!inner (
      id,
      rut,
      first_names,
      paternal_last_name,
      maternal_last_name,
      email,
      phone,
      active,
      branch_id,
      first_login,
      supabase_uid
    ),
    vehicle_assignments (
      vehicle_id,
      start_date,
      vehicles ( id, license_plate, brand, model, year )
    )
  `;

  private async fetchData(): Promise<void> {
    const branchId = this.getActiveBranchId();

    let query = this.supabase.client
      .from('instructors')
      .select(InstructoresFacade.INSTRUCTOR_SELECT)
      .is('vehicle_assignments.end_date', null)
      .order('registration_date', { ascending: false });

    if (branchId !== null) {
      query = query.eq('users.branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) {
      this._error.set(this.sanitizer.sanitize(error).message);
      throw error;
    }

    let rows = (data as unknown as InstructorRow[]) ?? [];

    // spec 0004-m (AC6): un instructor `both_branches=true` de OTRA sede también debe
    // aparecer. PostgREST rechaza `or=()` mezclando una columna de recurso embebido
    // (`users.branch_id`) con una columna raíz (`both_branches`) — PGRST100, confirmado
    // contra Supabase local — por eso es una segunda query + merge client-side, no un
    // solo `.or()`.
    if (branchId !== null) {
      const { data: bothBranchesData, error: bbError } = await this.supabase.client
        .from('instructors')
        .select(InstructoresFacade.INSTRUCTOR_SELECT)
        .is('vehicle_assignments.end_date', null)
        .eq('both_branches', true);

      if (!bbError && bothBranchesData) {
        const seenIds = new Set(rows.map((r) => r.id));
        for (const extra of bothBranchesData as unknown as InstructorRow[]) {
          if (!seenIds.has(extra.id)) {
            rows = [...rows, extra];
            seenIds.add(extra.id);
          }
        }
      }
    }

    const activeClassesById = await this.fetchActiveClassesCounts(rows.map((r) => r.id));
    this._instructores.set(rows.map((r) => this.mapRow(r, activeClassesById.get(r.id) ?? 0)));
  }

  /** COUNT en vivo de `class_b_sessions` en curso ("Transcurriendo") por instructor, acotado a hoy. */
  private async fetchActiveClassesCounts(instructorIds: number[]): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    if (instructorIds.length === 0) return counts;

    const todayStr = toISODate(new Date());

    const { data, error } = await this.supabase.client
      .from('class_b_sessions')
      .select('instructor_id')
      .eq('status', 'in_progress')
      .in('instructor_id', instructorIds)
      .gte('scheduled_at', `${todayStr}T00:00:00`)
      .lte('scheduled_at', `${todayStr}T23:59:59`);

    if (error) return counts;

    for (const row of (data as { instructor_id: number }[]) ?? []) {
      counts.set(row.instructor_id, (counts.get(row.instructor_id) ?? 0) + 1);
    }
    return counts;
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

    // Cargar todos los vehículos activos. Sin filtro de sede acá: el picker de
    // "Vehículo asignado" (Crear/Editar Instructor) filtra client-side por la sede
    // elegida en el form + `bothBranches` (spec 0004-m, AC6) — ver drawers.
    const { data: allVehicles, error: vError } = await this.supabase.client
      .from('vehicles')
      .select('id, license_plate, brand, model, year, status, branch_id, both_branches')
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
          branch_id: number | null;
          both_branches: boolean;
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
            branchId: v.branch_id,
            bothBranches: v.both_branches,
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

  async loadHorasMensuales(): Promise<void> {
    this._isLoadingHoras.set(true);
    try {
      const month = this._horasMonth();
      const year = this._horasYear();
      const period = `${year}-${String(month).padStart(2, '0')}`;

      const { data, error } = await this.supabase.client
        .from('instructor_monthly_hours')
        .select('instructor_id, practical_sessions, total_equivalent')
        .eq('period', period);

      if (error) throw error;

      const instructores = this._instructores();
      const rows: InstructorHoraRow[] = (data ?? []).map(
        (h: {
          instructor_id: number;
          practical_sessions: number | null;
          total_equivalent: number | null;
        }) => {
          const inst = instructores.find((i) => i.id === h.instructor_id);
          return {
            instructorId: h.instructor_id,
            nombre: inst?.nombre ?? `Instructor #${h.instructor_id}`,
            initials: inst?.initials ?? '?',
            practicalSessions: h.practical_sessions ?? 0,
            totalEquivalent: h.total_equivalent ?? 0,
          };
        },
      );
      rows.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      this._horasMensuales.set(rows);
    } catch {
      this._horasMensuales.set([]);
    } finally {
      this._isLoadingHoras.set(false);
    }
  }

  navHorasAnterior(): void {
    const month = this._horasMonth();
    const year = this._horasYear();
    if (month === 1) {
      this._horasMonth.set(12);
      this._horasYear.set(year - 1);
    } else {
      this._horasMonth.set(month - 1);
    }
    this.loadHorasMensuales();
  }

  navHorasSiguiente(): void {
    const now = new Date();
    if (this._horasYear() === now.getFullYear() && this._horasMonth() >= now.getMonth() + 1) return;
    const month = this._horasMonth();
    const year = this._horasYear();
    if (month === 12) {
      this._horasMonth.set(1);
      this._horasYear.set(year + 1);
    } else {
      this._horasMonth.set(month + 1);
    }
    this.loadHorasMensuales();
  }

  async loadHorario(instructorId: number): Promise<void> {
    this._isLoadingHorario.set(true);
    this._horario.set([]);
    try {
      const { data, error } = await this.supabase.client
        .from('class_b_sessions')
        .select(
          `
          id,
          scheduled_at,
          class_number,
          duration_min,
          enrollments!inner (
            students!inner (
              users!inner ( first_names, paternal_last_name )
            )
          ),
          vehicles ( license_plate )
        `,
        )
        .eq('instructor_id', instructorId)
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(60);

      if (error) throw error;

      const rows: InstructorHorarioSession[] = (data ?? []).map((s: Record<string, unknown>) => {
        const enr = s['enrollments'] as {
          students: { users: { first_names: string; paternal_last_name: string } };
        } | null;
        const u = enr?.students?.users;
        const studentName = u ? `${u.first_names} ${u.paternal_last_name}` : 'Alumno';
        const vehicle = s['vehicles'] as { license_plate: string } | null;
        return {
          id: s['id'] as number,
          scheduledAt: s['scheduled_at'] as string,
          classNumber: (s['class_number'] as number | null) ?? null,
          durationMin: (s['duration_min'] as number | null) ?? 45,
          studentName,
          studentInitials: studentName
            .split(' ')
            .slice(0, 2)
            .map((w) => w[0])
            .join('')
            .toUpperCase(),
          vehiclePlate: vehicle?.license_plate ?? null,
        };
      });

      this._horario.set(rows);
    } catch {
      this._horario.set([]);
    } finally {
      this._isLoadingHorario.set(false);
    }
  }

  /** Devuelve el `instructorId` recién creado (para subir sus documentos), o `null` si falló. */
  async crearInstructor(payload: CrearInstructorPayload): Promise<number | null> {
    this._isSubmitting.set(true);
    try {
      const { data, error } = await this.supabase.client.functions.invoke('create-instructor', {
        body: payload,
      });

      if (error)
        throw new Error(this.sanitizer.sanitize(error).message ?? 'Error al crear instructor');

      // Verificar si la respuesta contiene un error
      if (data?.error) throw new Error(data.error);

      this.toast.success('Instructor creado', 'La cuenta ha sido creada correctamente.');
      this._vehiclesLoaded = false;
      await Promise.all([this.refreshSilently(), this.loadVehicles()]);
      return (data?.instructorId as number | undefined) ?? null;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? this.sanitizer.sanitize(err).message : 'Error al crear instructor';
      this.toast.error('Error', msg);
      return null;
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
          bothBranches: payload.bothBranches,
        },
      });

      // fix-029-i: relanzamos el error ORIGINAL (no un Error re-envuelto con el mensaje
      // genérico del sanitizer) — así el catch abajo puede leer error.context (el Response
      // crudo de un FunctionsHttpError) y recuperar el mensaje de negocio real del Edge
      // Function, en vez de perderlo. Ver DOMAIN-GOTCHAS DG-085.
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      this._vehiclesLoaded = false;
      await Promise.all([this.refreshSilently(), this.loadVehicles()]);
      this.toast.success(
        'Instructor actualizado',
        'Los datos han sido actualizados correctamente.',
      );
      return true;
    } catch (err: unknown) {
      const msg = await this.resolveEditarInstructorErrorMessage(err);
      this.toast.error('Error', msg);
      return false;
    } finally {
      this._isSubmitting.set(false);
    }
  }

  /**
   * fix-029-i: `functions.invoke()` de Supabase, cuando el Edge Function responde con status
   * no-2xx, retorna un `FunctionsHttpError` cuyo `.message` es genérico ("Edge Function
   * returned a non-2xx status code") — el mensaje de negocio real queda en `error.context`
   * (el `Response` crudo), sin leer. `ErrorSanitizerService.sanitize()` no lo reconoce (no es
   * `HttpErrorResponse` de Angular ni trae `.code`) y cae a un mensaje genérico, ocultando del
   * usuario errores reales como "email ya usado por otro instructor".
   */
  private async resolveEditarInstructorErrorMessage(err: unknown): Promise<string> {
    const context = (err as { context?: unknown } | null)?.context;
    if (context && typeof (context as Response).json === 'function') {
      try {
        const body = await (context as Response).json();
        if (typeof body?.error === 'string') {
          if (body.error.includes('users_email_key')) {
            return 'Ya existe otro usuario registrado con ese correo electrónico.';
          }
          return body.error;
        }
      } catch {
        // Body no parseable como JSON — seguimos al fallback del sanitizer.
      }
    }
    return err instanceof Error
      ? this.sanitizer.sanitize(err).message
      : 'Error al actualizar instructor';
  }

  /**
   * (Re)envía el correo de invitación de activación de un instructor vía Edge Function
   * `activate-instructor-account` (fix-168-m, corregido en fix-169-m). Aplica tanto para
   * un reenvío normal (`first_login = true`, ya tiene cuenta pero nunca la activó) como
   * para una primera activación tardía (`!hasAuthAccount`) — un instructor creado por
   * `create-instructor` siempre tiene `supabase_uid` desde el alta, pero una fila
   * insertada fuera de ese flujo (seed, SQL directo) puede no tenerla; la Edge Function
   * crea la cuenta en ese caso y sincroniza `supabase_uid` de vuelta a `public.users`.
   */
  async enviarInvitacion(userId: number, email: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.client.functions.invoke(
        'activate-instructor-account',
        { body: { userId, email: email.trim().toLowerCase() } },
      );
      if (error)
        throw new Error(this.sanitizer.sanitize(error).message ?? 'Error al enviar la invitación');
      if (data?.error) throw new Error(data.error);

      this.toast.success('Invitación enviada correctamente.');
      void this.refreshSilently();
      return true;
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? this.sanitizer.sanitize(err).message
          : 'Error al enviar la invitación';
      this.toast.error('Error', msg);
      return false;
    }
  }

  private mapRow(r: InstructorRow, activeClassesCount: number): InstructorTableRow {
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
      activeClassesCount,
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
      bothBranches: r.both_branches ?? false,
      firstLogin: u.first_login,
      hasAuthAccount: !!u.supabase_uid,
    };
  }
}
