/**
 * CursosSingularesFacade — RF-035.
 * Gestión de Cursos Singulares (SENCE, Grúa, Retroexcavadora…).
 * Patrón SWR: primera visita con skeleton, re-visitas refrescan en background.
 * Branch-scoped: null = todas las sedes (admin global); number = sede específica.
 */
import { computed, inject, Injectable, signal } from '@angular/core';
import { BranchFacade } from '@core/facades/branch.facade';
import type { StandaloneCourse } from '@core/models/dto/standalone-course.model';
import type {
  CursoSingularRow,
  CursosSingularesKpis,
  EstadoCursoSingular,
  InscriptoCursoSingular,
  NuevoCursoSingularFormData,
  TipoCursoSingular,
} from '@core/models/ui/cursos-singulares.model';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

// ── Helpers de mapeo ──────────────────────────────────────────────────────────

function toEstado(raw: string | null | undefined): EstadoCursoSingular {
  const valid: EstadoCursoSingular[] = ['upcoming', 'active', 'completed', 'cancelled'];
  return valid.includes(raw as EstadoCursoSingular) ? (raw as EstadoCursoSingular) : 'upcoming';
}

function toTipo(raw: string): TipoCursoSingular {
  return raw === 'particular' ? 'particular' : 'sence';
}

function toBillingType(raw: string): 'sence_franchise' | 'boleta' | 'factura' {
  if (raw === 'boleta' || raw === 'factura') return raw;
  return 'sence_franchise';
}

function mapCursoDto(
  dto: StandaloneCourse & { standalone_course_enrollments?: { count: number }[] },
): CursoSingularRow {
  const inscritos = dto.standalone_course_enrollments?.[0]?.count ?? 0;
  const estado = toEstado(dto.status);
  return {
    id: dto.id,
    nombre: dto.name,
    tipo: toTipo(dto.type),
    billingType: toBillingType(dto.billing_type),
    precio: dto.base_price,
    duracionHoras: dto.duration_hours,
    inscritos,
    cupos: dto.max_students,
    estado,
    inicio: dto.start_date,
    ingresoEstimado: dto.base_price * inscritos,
  };
}

// ── Facade ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CursosSingularesFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly branchFacade = inject(BranchFacade);

  // ── 1. Estado privado ──────────────────────────────────────────────────────
  private readonly _cursos = signal<CursoSingularRow[]>([]);
  private readonly _selectedCurso = signal<CursoSingularRow | null>(null);
  private readonly _inscriptos = signal<InscriptoCursoSingular[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isLoadingInscriptos = signal(false);
  private readonly _isSaving = signal(false);
  private readonly _error = signal<string | null>(null);
  private _initialized = false;

  // ── 2. Estado público (readonly) ──────────────────────────────────────────
  readonly cursos = this._cursos.asReadonly();
  /** Curso actualmente seleccionado para drawers de detalle / cobro. */
  readonly selectedCurso = this._selectedCurso.asReadonly();
  /** Lista de inscriptos del curso seleccionado. */
  readonly inscriptos = this._inscriptos.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isLoadingInscriptos = this._isLoadingInscriptos.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();

  // ── 3. Computed ────────────────────────────────────────────────────────────

  /** KPIs derivados de los cursos cargados. */
  readonly kpis = computed<CursosSingularesKpis>(() => {
    const list = this._cursos();
    const activos = list.filter((c) => c.estado === 'active');
    const conIngresos = list.filter((c) => c.estado === 'active' || c.estado === 'completed');
    return {
      cursosActivos: activos.length,
      totalCursos: list.length,
      totalInscritos: list.reduce((s, c) => s + c.inscritos, 0),
      ingresosEstimados: conIngresos.reduce((s, c) => s + c.ingresoEstimado, 0),
    };
  });

  // ── 4. Métodos de acción ───────────────────────────────────────────────────

  /**
   * SWR initialize: primera llamada → skeleton + fetch.
   * Re-entradas → datos cacheados visibles + refresh silencioso.
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      void this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    try {
      await this.fetchCursos();
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Refresca sin mostrar skeleton — usado tras mutaciones y SWR re-entry. */
  async refreshSilently(): Promise<void> {
    try {
      await this.fetchCursos();
    } catch {
      // Datos stale siguen visibles
    }
  }

  /** Fija el curso activo y carga sus inscriptos para los drawers. */
  async selectCurso(curso: CursoSingularRow | null): Promise<void> {
    this._selectedCurso.set(curso);
    this._error.set(null);
    this._inscriptos.set([]);
    if (curso) await this.loadInscriptos(curso.id);
  }

  /** Carga la lista de inscriptos de un curso singular. */
  async loadInscriptos(cursoId: number): Promise<void> {
    this._isLoadingInscriptos.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('standalone_course_enrollments')
        .select(
          `
          id,
          student_id,
          amount_paid,
          payment_status,
          enrolled_at,
          students!inner(
            users!inner(
              first_names,
              paternal_last_name,
              rut
            )
          )
        `,
        )
        .eq('standalone_course_id', cursoId)
        .order('enrolled_at', { ascending: true });

      if (error) throw error;

      this._inscriptos.set(
        (data ?? []).map((row: any) => ({
          enrollmentId: row.id,
          studentId: row.student_id,
          nombreAlumno: `${row.students.users.first_names} ${row.students.users.paternal_last_name}`,
          rutAlumno: row.students.users.rut ?? '',
          montoPagado: row.amount_paid,
          paymentStatus: row.payment_status ?? 'pending',
          enrolledAt: row.enrolled_at,
        })),
      );
    } catch {
      this._inscriptos.set([]);
    } finally {
      this._isLoadingInscriptos.set(false);
    }
  }

  /** Crea un nuevo curso singular en Supabase. */
  async crearCurso(form: NuevoCursoSingularFormData): Promise<boolean> {
    this._isSaving.set(true);
    this._error.set(null);
    try {
      const branchId = this.branchFacade.selectedBranchId();
      const { error } = await this.supabase.client.from('standalone_courses').insert({
        name: form.nombre,
        type: form.tipo,
        billing_type: form.billingType,
        base_price: form.precio,
        duration_hours: form.duracionHoras,
        max_students: form.cupos,
        start_date: form.inicio,
        status: 'upcoming',
        ...(branchId !== null ? { branch_id: branchId } : {}),
      });

      if (error) throw error;
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear el curso';
      this._error.set(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Marca una inscripción de curso singular como pagada.
   * Usado por el drawer de Registrar Cobro.
   */
  async marcarEnrollmentPagado(enrollmentId: number): Promise<boolean> {
    this._isSaving.set(true);
    this._error.set(null);
    try {
      const { error } = await this.supabase.client
        .from('standalone_course_enrollments')
        .update({ payment_status: 'paid' })
        .eq('id', enrollmentId);

      if (error) throw error;
      // Actualiza la lista local para reflejar el cambio inmediatamente
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar el cobro';
      this._error.set(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  // ── Privado ────────────────────────────────────────────────────────────────

  private async fetchCursos(): Promise<void> {
    const branchId = this.branchFacade.selectedBranchId();

    let query = this.supabase.client
      .from('standalone_courses')
      .select('*, standalone_course_enrollments(count)')
      .order('start_date', { ascending: false });

    // null = Admin "Todas las escuelas" → sin filtro de sede
    if (branchId !== null) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;

    this._cursos.set((data ?? []).map(mapCursoDto));
  }
}
