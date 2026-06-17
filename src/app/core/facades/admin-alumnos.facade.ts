import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { downloadExcel } from '@core/utils/excel.utils';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import type {
  AlumnoTableRow,
  AlumnoExpediente,
  AlumnoStatus,
  EnrollmentCurso,
} from '@core/models/ui/alumno-table-row.model';

// ─── Types for the raw Supabase join response ───────────────────────────────

interface RawDocument {
  type: string | null;
  status: string | null;
}

interface RawCourse {
  id: number;
  name: string;
}

interface RawEnrollment {
  id: number;
  number: string | null;
  status: string | null;
  payment_status: string | null;
  pending_balance: number | null;
  total_paid: number;
  docs_complete: boolean;
  created_at: string;
  expires_at: string | null;
  license_group: string | null;
  courses: RawCourse | null;
  student_documents: RawDocument[];
}

interface RawUser {
  id: number;
  rut: string;
  first_names: string;
  paternal_last_name: string;
  maternal_last_name: string;
  email: string;
  phone: string | null;
  branch_id: number | null;
}

interface RawStudent {
  id: number;
  status: string | null;
  address: string | null;
  users: RawUser;
  enrollments: RawEnrollment[];
  standalone_course_enrollments: { id: number }[];
}

// ─── Facade ──────────────────────────────────────────────────────────────────

const VENCER_THRESHOLD_DAYS = 7;

@Injectable({ providedIn: 'root' })
export class AdminAlumnosFacade {
    private readonly sanitizer = inject(ErrorSanitizerService);
private readonly supabase = inject(SupabaseService);
  private readonly branchFacade = inject(BranchFacade);
  private readonly toast = inject(ToastService);

  // ── 1. ESTADO PRIVADO ────────────────────────────────────────────────────
  private readonly _alumnos = signal<AlumnoTableRow[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isExporting = signal(false);
  private readonly _isGeneratingFicha = signal<number | false>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _isArchiving = signal(false);
  private readonly _trashView = signal(false);

  private _initialized = false;
  private _lastBranchId: number | null = null;
  private _realtimeChannel: any | null = null;
  private readonly _drawerMode = signal<'zoom' | 'asistencia'>('zoom');

  // ── 2. ESTADO PÚBLICO (solo lectura) ────────────────────────────────────
  readonly alumnos = this._alumnos.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isExporting = this._isExporting.asReadonly();
  readonly isGeneratingFicha = this._isGeneratingFicha.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isArchiving = this._isArchiving.asReadonly();
  readonly trashView = this._trashView.asReadonly();

  readonly totalAlumnos = computed(() => this._alumnos().length);
  readonly activos = computed(() => this._alumnos().filter((a) => a.status === 'Activo').length);
  readonly conDeuda = computed(() => this._alumnos().filter((a) => a.pago_por_pagar > 0).length);
  readonly alumnosPorVencer = computed(() =>
    this._alumnos().filter((a) => a.expiresAt !== null && this.isWithinThreshold(a.expiresAt)),
  );
  readonly drawerMode = this._drawerMode.asReadonly();

  // ── 3. MÉTODOS DE ACCIÓN ─────────────────────────────────────────────────

  setupRealtime(): void {
    if (this._realtimeChannel) return;
    this._realtimeChannel = this.supabase.client
      .channel('alumnos-listado-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => void this.refreshSilently(),
      )
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

  /**
   * SWR Initialization
   */
  async initialize(): Promise<void> {
    const currentBranchId = this.branchFacade.selectedBranchId();
    this.setupRealtime();

    if (this._initialized && currentBranchId === this._lastBranchId) {
      void this.refreshSilently();
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchAlumnosData(currentBranchId);
      this._initialized = true;
      this._lastBranchId = currentBranchId;
    } catch {
      this._error.set('Error al cargar alumnos');
    } finally {
      this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      const currentBranchId = this.branchFacade.selectedBranchId();
      await this.fetchAlumnosData(currentBranchId);
      this._lastBranchId = currentBranchId;
    } catch {
      // Swallowed
    }
  }

  async loadAlumnos(): Promise<void> {
    return this.initialize();
  }

  setDrawerMode(mode: 'zoom' | 'asistencia'): void {
    this._drawerMode.set(mode);
  }

  async setTrashView(value: boolean): Promise<void> {
    if (this._trashView() === value) return;
    this._trashView.set(value);
    this._initialized = false;
    await this.initialize();
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

  async exportAlumnos(req: {
    format: 'pdf' | 'excel';
    search: string;
    curso: string;
    estado: string;
    expediente: string;
  }): Promise<void> {
    this._isExporting.set(true);
    try {
      const { data, error } = await this.supabase.client.functions.invoke('export-students', {
        body: {
          format: req.format,
          branch_id: this.branchFacade.selectedBranchId(),
          search: req.search,
          curso: req.curso,
          estado: req.estado,
          expediente: req.expediente,
        },
      });
      if (error) throw error;

      const fecha = new Date().toISOString().slice(0, 10);

      if (req.format === 'excel') {
        const { headers, rows } = data as { headers: string[]; rows: (string | number)[][] };
        downloadExcel('Alumnos', headers, rows, `alumnos_${fecha}`);
      } else {
        const rawBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
        const blob = new Blob([rawBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alumnos_${fecha}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      this.toast.error('No se pudo exportar la lista. Inténtalo de nuevo.');
    } finally {
      this._isExporting.set(false);
    }
  }

  async exportarFicha(enrollmentId: number): Promise<void> {
    this._isGeneratingFicha.set(enrollmentId);
    try {
      const { data, error } = await this.supabase.client.functions.invoke(
        'generate-enrollment-sheet',
        { body: { enrollment_id: enrollmentId } },
      );
      if (error) throw error;

      const rawBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
      const blob = new Blob([rawBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ficha_Matricula_${enrollmentId}_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      this.toast.error('No se pudo generar la ficha. Inténtalo de nuevo.');
    } finally {
      this._isGeneratingFicha.set(false);
    }
  }

  clearError(): void {
    this._error.set(null);
  }

  /**
   * Verifica si un alumno tiene historial de pagos o clases prácticas.
   * Se usa para decidir qué modal de confirmación mostrar antes de archivar.
   */
  async checkHistorial(studentId: number): Promise<{ hasHistory: boolean }> {
    const { data: enrollmentRows } = await this.supabase.client
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .neq('status', 'draft');

    const enrollmentIds: number[] = (enrollmentRows ?? []).map((e: { id: number }) => e.id);

    if (enrollmentIds.length === 0) return { hasHistory: false };

    const [paymentsResult, classesResult] = await Promise.all([
      this.supabase.client
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .in('enrollment_id', enrollmentIds),
      this.supabase.client
        .from('class_b_sessions')
        .select('id', { count: 'exact', head: true })
        .in('enrollment_id', enrollmentIds),
    ]);

    return {
      hasHistory: (paymentsResult.count ?? 0) > 0 || (classesResult.count ?? 0) > 0,
    };
  }

  /**
   * Soft-delete: actualiza students.status = 'archived'.
   * El alumno desaparece del listado principal pero sus datos se preservan.
   */
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

  private async fetchAlumnosData(branchId: number | null): Promise<void> {
    try {
      let query: any = this.supabase.client
        .from('students')
        .select(
          `
          id, status, address,
          users!inner(id, rut, first_names, paternal_last_name, maternal_last_name, email, phone, branch_id),
          enrollments(id, number, status, payment_status, pending_balance, total_paid, docs_complete, created_at, expires_at, license_group,
            courses(id, name),
            student_documents(type, status)
          ),
          standalone_course_enrollments(id)
        `,
        )
        [this._trashView() ? 'eq' : 'neq']('status', 'archived');

      if (branchId !== null) {
        query = query.eq('users.branch_id', branchId);
      }

      const { data, error } = await query.order('id', { ascending: false });
      if (error) throw error;

      const rawData = (data ?? []) as unknown as RawStudent[];

      // Filtrar alumnos que SOLO tienen inscripciones a cursos singulares (y cero matrículas regulares/drafts)
      const INCOMPLETE_STATUSES = new Set(['cancelled', 'pending_payment']);
      const validStudents = rawData.filter((s) => {
        const hasRegular = s.enrollments && s.enrollments.length > 0;
        const hasSingular =
          s.standalone_course_enrollments && s.standalone_course_enrollments.length > 0;
        // Si no tiene regular pero sí singular, es exclusivamente de Curso Singular -> Ocultar
        if (!hasRegular && hasSingular) return false;
        // Ocultar alumnos cuyas únicas matrículas son canceladas o pago pendiente online
        // (transacciones Webpay abandonadas/fallidas que nunca completaron el proceso)
        if (hasRegular && !hasSingular) {
          const hasValidEnrollment = s.enrollments.some(
            (e) => !INCOMPLETE_STATUSES.has(e.status ?? ''),
          );
          if (!hasValidEnrollment) return false;
        }
        return true;
      });

      const rows = validStudents.map((s) => this.mapToAlumnoTableRow(s));
      this._alumnos.set(rows);
    } catch (err) {
      this._error.set(err instanceof Error ? this.sanitizer.sanitize(err).message : 'Error al cargar alumnos');
      throw err;
    }
  }

  private mapToAlumnoTableRow(s: RawStudent): AlumnoTableRow {
    const u = s.users;
    // Excluir enrollments incompletos (Webpay abandonado/rechazado) del display.
    // El enrollment principal es el más reciente con estado válido.
    const INCOMPLETE_STATUSES = new Set(['cancelled', 'pending_payment']);
    const sorted =
      s.enrollments.length > 0
        ? [...s.enrollments]
            .filter((e) => !INCOMPLETE_STATUSES.has(e.status ?? ''))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        : [];
    const enrollment = sorted[0] ?? null;
    const docs = enrollment?.student_documents ?? [];

    const nroExpedientes = sorted
      .filter((e) => e.number && e.status !== 'draft')
      .map((e) => e.number as string);

    const cursos: EnrollmentCurso[] = sorted
      .filter((e) => e.courses?.name)
      .map((e) => ({
        nombre: e.courses!.name,
        licenseGroup: e.license_group === 'professional' ? 'professional' : 'class_b',
      }));

    return {
      id: String(s.id),
      nombre: u.first_names,
      apellido: `${u.paternal_last_name} ${u.maternal_last_name}`.trim(),
      rut: u.rut,
      email: u.email,
      celular: u.phone ?? '',
      sucursal: u.branch_id ? `Sucursal ${u.branch_id}` : '',
      comuna: s.address ?? '',
      nroExpedientes: nroExpedientes.length > 0 ? nroExpedientes : ['—'],
      fechaIngreso: enrollment ? enrollment.created_at.slice(0, 10) : '—',
      status: this.deriveStatus(enrollment, s.status),
      cursos: cursos.length > 0 ? cursos : [{ nombre: '—', licenseGroup: 'class_b' }],
      pago_por_pagar: enrollment?.pending_balance ?? 0,
      pago_total: enrollment?.total_paid ?? 0,
      exp_teorico: 'pendiente',
      exp_practico: 'pendiente',
      expediente: this.deriveExpediente(docs),
      expiresAt: enrollment?.expires_at ?? null,
      vencimiento: enrollment?.expires_at
        ? this.formatVencimiento(enrollment.expires_at)
        : undefined,
      enrollmentId: enrollment?.id,
    };
  }

  private deriveStatus(
    enrollment: RawEnrollment | null,
    studentStatus: string | null,
  ): AlumnoStatus {
    if (!enrollment) return studentStatus === 'inactive' ? 'Inactivo' : 'Pre-inscrito';
    switch (enrollment.status) {
      case 'active':
        if (enrollment.payment_status === 'pending') return 'Pendiente Pago';
        if (!enrollment.docs_complete) return 'Docs Pendientes';
        return 'Activo';
      case 'completed':
        return 'Finalizado';
      case 'withdrawn':
        return 'Retirado';
      case 'draft':
        return 'Pre-inscrito';
      default:
        return studentStatus === 'inactive' ? 'Inactivo' : 'Pre-inscrito';
    }
  }

  private deriveExpediente(docs: RawDocument[]): AlumnoExpediente {
    const types = new Set(docs.map((d) => d.type).filter(Boolean));
    return {
      ci: types.has('cedula_identidad'),
      foto: types.has('foto_carnet'),
      medico: types.has('certificado_medico'),
      semep: types.has('semep'),
    };
  }

  private isWithinThreshold(expiresAt: string): boolean {
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= VENCER_THRESHOLD_DAYS;
  }

  private formatVencimiento(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    return `En ${diffDays} días`;
  }
}
