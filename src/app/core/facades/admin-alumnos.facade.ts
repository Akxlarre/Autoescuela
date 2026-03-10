import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type {
  AlumnoTableRow,
  AlumnoExpediente,
  AlumnoStatus,
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
  district: string | null;
  users: RawUser;
  enrollments: RawEnrollment[];
}

// ─── Facade ──────────────────────────────────────────────────────────────────

/** Days ahead to consider an enrollment "por vencer" */
const VENCER_THRESHOLD_DAYS = 7;

@Injectable({ providedIn: 'root' })
export class AdminAlumnosFacade {
  private readonly supabase = inject(SupabaseService);

  // ── 1. ESTADO PRIVADO ────────────────────────────────────────────────────

  private readonly _alumnos = signal<AlumnoTableRow[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // ── 2. ESTADO PÚBLICO (solo lectura) ────────────────────────────────────

  readonly alumnos = this._alumnos.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly totalAlumnos = computed(() => this._alumnos().length);
  readonly activos = computed(() => this._alumnos().filter((a) => a.status === 'Activo').length);
  readonly conDeuda = computed(() => this._alumnos().filter((a) => a.pago_por_pagar > 0).length);
  readonly alumnosPorVencer = computed(() =>
    this._alumnos().filter((a) => a.expiresAt !== null && this.isWithinThreshold(a.expiresAt)),
  );

  // ── 3. MÉTODOS DE ACCIÓN ─────────────────────────────────────────────────

  async loadAlumnos(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const { data, error } = await this.supabase.client
        .from('students')
        .select(
          `
          id,
          status,
          district,
          users!inner(
            id,
            rut,
            first_names,
            paternal_last_name,
            maternal_last_name,
            email,
            phone,
            branch_id
          ),
          enrollments(
            id,
            number,
            status,
            payment_status,
            pending_balance,
            total_paid,
            docs_complete,
            created_at,
            expires_at,
            courses(
              id,
              name
            ),
            student_documents(
              type,
              status
            )
          )
        `,
        )
        .order('id', { ascending: false });

      if (error) throw error;

      const rows = ((data ?? []) as unknown as RawStudent[]).map((s) =>
        this.mapToAlumnoTableRow(s),
      );
      this._alumnos.set(rows);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Error al cargar alumnos');
    } finally {
      this._isLoading.set(false);
    }
  }

  clearError(): void {
    this._error.set(null);
  }

  // ── Mappers ──────────────────────────────────────────────────────────────

  private mapToAlumnoTableRow(s: RawStudent): AlumnoTableRow {
    const u = s.users;

    // Take the most recent enrollment (last created)
    const enrollment =
      s.enrollments.length > 0
        ? s.enrollments.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )[0]
        : null;

    const docs: RawDocument[] = enrollment?.student_documents ?? [];

    return {
      id: String(s.id),
      nombre: u.first_names,
      apellido: `${u.paternal_last_name} ${u.maternal_last_name}`.trim(),
      rut: u.rut,
      email: u.email,
      celular: u.phone ?? '',
      sucursal: u.branch_id ? `Sucursal ${u.branch_id}` : '',
      comuna: s.district ?? '',
      nroExpediente: enrollment?.number ?? '—',
      fechaIngreso: enrollment ? enrollment.created_at.slice(0, 10) : '—',
      status: this.deriveStatus(enrollment, s.status),
      cursa: enrollment?.courses?.name ?? '—',
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
    if (!enrollment) {
      return studentStatus === 'inactive' ? 'Inactivo' : 'Pre-inscrito';
    }

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
    const now = new Date();
    const exp = new Date(expiresAt);
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= VENCER_THRESHOLD_DAYS;
  }

  private formatVencimiento(expiresAt: string): string {
    const now = new Date();
    const exp = new Date(expiresAt);
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    return `En ${diffDays} días`;
  }
}
