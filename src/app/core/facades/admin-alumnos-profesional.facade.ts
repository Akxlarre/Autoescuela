import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { MODULE_COUNT } from '@core/utils/professional-modules';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import type { AlumnoStatus } from '@core/models/ui/alumno-table-row.model';
import type {
  AlumnoProfesionalTableRow,
  SemaforoAsistencia,
} from '@core/models/ui/alumno-profesional-table-row.model';

// ─── Tipos de la respuesta cruda de Supabase ────────────────────────────────

interface RawProUser {
  id: number;
  rut: string;
  first_names: string;
  paternal_last_name: string;
  maternal_last_name: string;
  email: string;
  phone: string | null;
  branch_id: number | null;
}

interface RawProEnrollment {
  id: number;
  number: string | null;
  status: string | null;
  pending_balance: number | null;
  branch_id: number | null;
  students: { id: number; status: string | null; users: RawProUser };
  promotion_courses: { id: number; courses: { name: string; license_class: string } | null } | null;
}

// ─── Facade ──────────────────────────────────────────────────────────────────

/** Estados de matrícula considerados "matriculados" en la Base Profesional. */
const ENROLLED_STATUSES = ['active', 'completed', 'inactive'];

@Injectable({ providedIn: 'root' })
export class AdminAlumnosProfesionalFacade {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);
  private readonly branchFacade = inject(BranchFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly toast = inject(ToastService);

  // ── 1. ESTADO PRIVADO ────────────────────────────────────────────────────
  private readonly _alumnos = signal<AlumnoProfesionalTableRow[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _trashView = signal(false);
  private readonly _isArchiving = signal(false);

  private _initialized = false;
  private _lastBranchId: number | null = null;
  private _realtimeChannel: any | null = null;

  // ── 2. ESTADO PÚBLICO (solo lectura) ─────────────────────────────────────
  readonly alumnos = this._alumnos.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly trashView = this._trashView.asReadonly();
  readonly isArchiving = this._isArchiving.asReadonly();

  readonly totalAlumnos = computed(() => this._alumnos().length);
  readonly activos = computed(() => this._alumnos().filter((a) => a.estado === 'Activo').length);
  readonly conDeuda = computed(() => this._alumnos().filter((a) => a.saldo > 0).length);
  readonly enRiesgo = computed(() => this._alumnos().filter((a) => a.semaforo === 'red').length);

  // ── 3. MÉTODOS DE ACCIÓN ─────────────────────────────────────────────────

  setupRealtime(): void {
    if (this._realtimeChannel) return;
    this._realtimeChannel = this.supabase.client
      .channel('alumnos-profesional-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'enrollments' },
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

  dispose(): void {
    this.destroyRealtime();
  }

  /** SWR Initialization */
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
    this.setupRealtime();

    if (this._initialized && currentBranchId === this._lastBranchId) {
      void this.refreshSilently();
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchData(currentBranchId);
      this._initialized = true;
      this._lastBranchId = currentBranchId;
    } catch {
      this._error.set('Error al cargar alumnos profesionales');
    } finally {
      this._isLoading.set(false);
    }
  }

  async loadAlumnos(): Promise<void> {
    return this.initialize();
  }

  private async refreshSilently(): Promise<void> {
    try {
      const currentBranchId = this.getActiveBranchId();
      await this.fetchData(currentBranchId);
      this._lastBranchId = currentBranchId;
    } catch {
      // Fail silencioso — datos stale siguen visibles
    }
  }

  async setTrashView(value: boolean): Promise<void> {
    if (this._trashView() === value) return;
    this._trashView.set(value);
    this._initialized = false;
    await this.initialize();
  }

  /**
   * Verifica si un alumno profesional tiene historial de pagos o asistencia
   * (teórica/práctica). Homologa la regla de `AdminAlumnosFacade.checkHistorial`
   * (Clase B) — misma forma: enrollments no-draft del alumno → cuenta pagos +
   * actividad académica asociada. Se usa para decidir qué modal de confirmación
   * mostrar antes de archivar (`EliminarAlumnoModalComponent`).
   */
  async checkHistorial(studentId: number): Promise<{ hasHistory: boolean }> {
    const { data: enrollmentRows } = await this.supabase.client
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .neq('status', 'draft');

    const enrollmentIds: number[] = (enrollmentRows ?? []).map((e: { id: number }) => e.id);

    if (enrollmentIds.length === 0) return { hasHistory: false };

    const [paymentsResult, theoryResult, practiceResult] = await Promise.all([
      this.supabase.client
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .in('enrollment_id', enrollmentIds),
      this.supabase.client
        .from('professional_theory_attendance')
        .select('id', { count: 'exact', head: true })
        .in('enrollment_id', enrollmentIds),
      this.supabase.client
        .from('professional_practice_attendance')
        .select('id', { count: 'exact', head: true })
        .in('enrollment_id', enrollmentIds),
    ]);

    return {
      hasHistory:
        (paymentsResult.count ?? 0) > 0 ||
        (theoryResult.count ?? 0) > 0 ||
        (practiceResult.count ?? 0) > 0,
    };
  }

  async archivarAlumno(studentId: number): Promise<void> {
    this._isArchiving.set(true);
    try {
      const { error } = await this.supabase.client
        .from('students')
        .update({ status: 'archived' })
        .eq('id', studentId);
      if (error) throw error;
      this.toast.success('Alumno archivado correctamente.');
      await this.refreshSilently();
    } catch {
      this.toast.error('No se pudo archivar al alumno. Inténtalo de nuevo.');
      throw new Error('archivar_failed');
    } finally {
      this._isArchiving.set(false);
    }
  }

  async restaurarAlumno(studentId: number): Promise<void> {
    this._isArchiving.set(true);
    try {
      const { error } = await this.supabase.client
        .from('students')
        .update({ status: 'active' })
        .eq('id', studentId);
      if (error) throw error;
      this.toast.success('Alumno restaurado correctamente.');
      await this.refreshSilently();
    } catch {
      this.toast.error('No se pudo restaurar al alumno. Inténtalo de nuevo.');
      throw new Error('restaurar_failed');
    } finally {
      this._isArchiving.set(false);
    }
  }

  clearError(): void {
    this._error.set(null);
  }

  // ── Fetch + mapeo ─────────────────────────────────────────────────────────

  private async fetchData(branchId: number | null): Promise<void> {
    try {
      let query: any = this.supabase.client
        .from('enrollments')
        .select(
          `
          id, number, status, pending_balance, branch_id,
          students!inner(id, status, users!inner(id, rut, first_names, paternal_last_name, maternal_last_name, email, phone, branch_id)),
          promotion_courses(id, courses(name, license_class))
        `,
        )
        .eq('license_group', 'professional')
        .in('status', ENROLLED_STATUSES);

      if (branchId !== null) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query.order('id', { ascending: false });
      if (error) throw error;

      const enrollments = (data ?? []) as unknown as RawProEnrollment[];

      // Papelera: filtrar por estado del alumno (soft-delete a nivel persona)
      const filtered = enrollments.filter((e) =>
        this._trashView() ? e.students.status === 'archived' : e.students.status !== 'archived',
      );

      if (filtered.length === 0) {
        this._alumnos.set([]);
        return;
      }

      const enrollmentIds = filtered.map((e) => e.id);

      const [attRes, gradesRes] = await Promise.all([
        this.supabase.client
          .from('v_professional_attendance')
          .select('enrollment_id, attendance_flag')
          .in('enrollment_id', enrollmentIds),
        this.supabase.client
          .from('professional_module_grades')
          .select('enrollment_id, passed')
          .in('enrollment_id', enrollmentIds),
      ]);

      const flagMap = new Map<number, SemaforoAsistencia>();
      for (const r of (attRes.data ?? []) as {
        enrollment_id: number;
        attendance_flag: string | null;
      }[]) {
        if (r.attendance_flag)
          flagMap.set(r.enrollment_id, r.attendance_flag as SemaforoAsistencia);
      }

      const passedMap = new Map<number, number>();
      for (const g of (gradesRes.data ?? []) as {
        enrollment_id: number;
        passed: boolean | null;
      }[]) {
        if (g.passed === true) {
          passedMap.set(g.enrollment_id, (passedMap.get(g.enrollment_id) ?? 0) + 1);
        }
      }

      const rows = filtered.map((e) => this.mapRow(e, flagMap, passedMap));
      this._alumnos.set(rows);
    } catch (err) {
      this._error.set(
        err instanceof Error
          ? this.sanitizer.sanitize(err).message
          : 'Error al cargar alumnos profesionales',
      );
      throw err;
    }
  }

  private mapRow(
    e: RawProEnrollment,
    flagMap: Map<number, SemaforoAsistencia>,
    passedMap: Map<number, number>,
  ): AlumnoProfesionalTableRow {
    const u = e.students.users;
    const course = e.promotion_courses?.courses ?? null;
    return {
      id: String(e.students.id),
      nombre: u.first_names,
      apellido: `${u.paternal_last_name} ${u.maternal_last_name}`.trim(),
      rut: u.rut,
      email: u.email,
      celular: u.phone ?? '',
      nroMatricula: e.number ?? '—',
      promocion: course?.name ?? '—',
      licenseClass: course?.license_class ?? '',
      semaforo: flagMap.get(e.id) ?? null,
      modulosAprobados: passedMap.get(e.id) ?? 0,
      modulosTotal: MODULE_COUNT,
      estado: this.deriveStatus(e.status),
      saldo: e.pending_balance ?? 0,
      enrollmentId: e.id,
    };
  }

  private deriveStatus(status: string | null): AlumnoStatus {
    switch (status) {
      case 'active':
        return 'Activo';
      case 'completed':
        return 'Finalizado';
      case 'inactive':
        return 'Inactivo';
      case 'cancelled':
        return 'Retirado';
      default:
        return 'Pre-inscrito';
    }
  }
}
