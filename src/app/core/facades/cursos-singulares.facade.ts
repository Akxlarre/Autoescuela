/**
 * CursosSingularesFacade — RF-035.
 * Gestión de Cursos Singulares (SENCE, Grúa, Retroexcavadora…).
 * Patrón SWR: primera visita con skeleton, re-visitas refrescan en background.
 * Branch-scoped: null = todas las sedes (admin global); number = sede específica.
 */
import { computed, inject, Injectable, signal } from '@angular/core';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import type { StandaloneCourse } from '@core/models/dto/standalone-course.model';
import type {
  CursoSingularRow,
  CursosSingularesKpis,
  EstadoCursoSingular,
  InscriptoCursoSingular,
  NuevoCursoSingularFormData,
  SingularPaymentForm,
  SingularPersonalDataForm,
  SingularStudentSearch,
  TipoCursoSingular,
} from '@core/models/ui/cursos-singulares.model';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { normalizeRutForStorage } from '@core/utils/rut.utils';

// ── Helpers de mapeo ──────────────────────────────────────────────────────────

function computeEstado(raw: string | null | undefined, startDate: string): EstadoCursoSingular {
  // 'cancelled' y 'completed' son estados explícitos — respetar siempre
  if (raw === 'cancelled' || raw === 'completed') return raw;
  // 'upcoming' / 'active' se derivan de la fecha: si ya pasó → active
  return new Date(startDate) <= new Date() ? 'active' : 'upcoming';
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
  const estado = computeEstado(dto.status, dto.start_date);
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
  private readonly auth = inject(AuthFacade);
  private readonly toast = inject(ToastService);

  // ── 1. Estado privado ──────────────────────────────────────────────────────
  private readonly _cursos = signal<CursoSingularRow[]>([]);
  private readonly _selectedCurso = signal<CursoSingularRow | null>(null);
  private readonly _inscriptos = signal<InscriptoCursoSingular[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isLoadingInscriptos = signal(false);
  private readonly _isSaving = signal(false);
  private readonly _error = signal<string | null>(null);
  private _initialized = false;

  // ── Estado del wizard de inscripción ──────────────────────────────────────
  private readonly _wizardStep = signal<1 | 2>(1);
  private readonly _isSearching = signal(false);
  private readonly _studentSearch = signal<SingularStudentSearch | null>(null);
  private readonly _studentNotFound = signal(false);
  /** Datos personales pendientes de confirmar — sólo se escriben en BD al confirmar inscripción. */
  private readonly _pendingPersonalData = signal<SingularPersonalDataForm | null>(null);
  private readonly _pendingBranchId = signal<number>(1);

  // ── 2. Estado público (readonly) ──────────────────────────────────────────
  readonly cursos = this._cursos.asReadonly();
  readonly selectedCurso = this._selectedCurso.asReadonly();
  readonly inscriptos = this._inscriptos.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isLoadingInscriptos = this._isLoadingInscriptos.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();

  // Wizard
  readonly wizardStep = this._wizardStep.asReadonly();
  readonly isSearching = this._isSearching.asReadonly();
  readonly studentSearch = this._studentSearch.asReadonly();
  readonly studentNotFound = this._studentNotFound.asReadonly();

  // ── 3. Computed ────────────────────────────────────────────────────────────

  readonly kpis = computed<CursosSingularesKpis>(() => {
    const list = this._cursos();
    const activos = list.filter((c) => c.estado === 'active');
    const conIngresos = list.filter((c) => c.estado !== 'cancelled');
    return {
      cursosActivos: activos.length,
      totalCursos: list.length,
      totalInscritos: list.reduce((s, c) => s + c.inscritos, 0),
      ingresosEstimados: conIngresos.reduce((s, c) => s + c.ingresoEstimado, 0),
    };
  });

  // ── 4. Métodos de acción — Cursos ──────────────────────────────────────────

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

  async refreshSilently(): Promise<void> {
    try {
      await this.fetchCursos();
    } catch {
      // Datos stale siguen visibles
    }
  }

  async selectCurso(curso: CursoSingularRow | null): Promise<void> {
    this._selectedCurso.set(curso);
    this._error.set(null);
    this._inscriptos.set([]);
    if (curso) await this.loadInscriptos(curso.id);
  }

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
          payment_method,
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
          montoPagado: row.amount_paid ?? 0,
          paymentStatus: row.payment_status ?? 'pending',
          paymentMethod: row.payment_method ?? 'efectivo',
          enrolledAt: row.enrolled_at,
        })),
      );
    } catch {
      this._inscriptos.set([]);
    } finally {
      this._isLoadingInscriptos.set(false);
    }
  }

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

  async marcarCursoFinalizado(cursoId: number): Promise<boolean> {
    this._isSaving.set(true);
    this._error.set(null);
    try {
      const { error } = await this.supabase.client
        .from('standalone_courses')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', cursoId);
      if (error) throw error;
      this.toast.success('Curso marcado como finalizado');
      await this.refreshSilently();
      return true;
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Error al finalizar el curso');
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  async cancelarCurso(cursoId: number): Promise<boolean> {
    this._isSaving.set(true);
    this._error.set(null);
    try {
      const { error } = await this.supabase.client
        .from('standalone_courses')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', cursoId);
      if (error) throw error;
      this.toast.success('Curso cancelado');
      await this.refreshSilently();
      return true;
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Error al cancelar el curso');
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  async marcarEnrollmentPagado(enrollmentId: number): Promise<boolean> {
    this._isSaving.set(true);
    this._error.set(null);
    try {
      const cursoId = this._selectedCurso()?.id;
      const precio = this._selectedCurso()?.precio ?? 0;

      const { error } = await this.supabase.client
        .from('standalone_course_enrollments')
        .update({ payment_status: 'paid', amount_paid: precio })
        .eq('id', enrollmentId);

      if (error) throw error;
      if (cursoId) await this.loadInscriptos(cursoId);
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

  // ── 5. Métodos del wizard de inscripción ───────────────────────────────────

  /** Reinicia el estado del wizard para abrir el drawer limpio. */
  resetWizard(): void {
    this._wizardStep.set(1);
    this._studentSearch.set(null);
    this._studentNotFound.set(false);
    this._pendingPersonalData.set(null);
    this._pendingBranchId.set(1);
    this._error.set(null);
  }

  /**
   * Busca un alumno por RUT en las tablas users + students.
   * Pre-llena el resultado en `studentSearch`; si no existe setea `studentNotFound`.
   */
  async searchByRut(rut: string): Promise<void> {
    this._isSearching.set(true);
    this._studentSearch.set(null);
    this._studentNotFound.set(false);
    this._error.set(null);

    try {
      const normalized = normalizeRutForStorage(rut);
      const { data: user } = await this.supabase.client
        .from('users')
        .select('id, first_names, paternal_last_name, email, phone')
        .eq('rut', normalized)
        .maybeSingle();

      if (!user) {
        this._studentNotFound.set(true);
        return;
      }

      const { data: student } = await this.supabase.client
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      this._studentSearch.set({
        userId: user.id,
        studentId: student?.id ?? null,
        nombreCompleto: `${user.first_names} ${user.paternal_last_name}`,
        firstNames: user.first_names,
        paternalLastName: user.paternal_last_name,
        rut: normalized,
        email: user.email ?? '',
        phone: user.phone ?? '',
      });
    } catch {
      this._error.set('Error al buscar el alumno');
    } finally {
      this._isSearching.set(false);
    }
  }

  /**
   * Step 1 del wizard: almacena los datos del formulario en memoria y avanza al paso 2.
   * No escribe nada en la BD — todos los writes ocurren al confirmar en inscribirAlumno().
   */
  savePersonalData(form: SingularPersonalDataForm, branchId: number): boolean {
    this._error.set(null);
    if (!form.firstNames.trim() || !form.paternalLastName.trim()) {
      this._error.set('Completa los datos requeridos del alumno.');
      return false;
    }
    this._pendingPersonalData.set(form);
    this._pendingBranchId.set(branchId);
    this._wizardStep.set(2);
    return true;
  }

  /**
   * Step 2 del wizard: upsert user+student y luego inscribe al alumno.
   * Todos los writes a BD ocurren aquí de forma secuencial; si el usuario
   * abandona antes de llegar a este punto, la BD no queda en estado parcial.
   */
  async inscribirAlumno(cursoId: number, payment: SingularPaymentForm): Promise<boolean> {
    const form = this._pendingPersonalData();
    if (!form) {
      this._error.set('No hay datos del alumno. Completa el paso anterior.');
      return false;
    }

    this._isSaving.set(true);
    this._error.set(null);
    try {
      const branchId = this._pendingBranchId();

      // 1. Crear o actualizar usuario
      const userId = await this.upsertUser(form, branchId);
      if (!userId) return false;

      // 2. Crear o actualizar alumno
      const studentId = await this.upsertStudent(form, userId);
      if (!studentId) return false;

      // 3. Verificar que no esté ya inscrito
      const { data: existing } = await this.supabase.client
        .from('standalone_course_enrollments')
        .select('id')
        .eq('standalone_course_id', cursoId)
        .eq('student_id', studentId)
        .maybeSingle();

      if (existing) {
        this._error.set('Este alumno ya está inscrito en el curso.');
        return false;
      }

      // 4. Insertar inscripción
      const registeredBy = this.auth.currentUser()?.dbId ?? null;
      const { error } = await this.supabase.client.from('standalone_course_enrollments').insert({
        standalone_course_id: cursoId,
        student_id: studentId,
        amount_paid: payment.amountPaid,
        payment_status: payment.paymentStatus,
        payment_method: payment.paymentMethod,
        enrolled_at: new Date().toISOString(),
        registered_by: registeredBy,
      });

      if (error) throw error;

      this.toast.success('Alumno inscrito correctamente');
      await this.loadInscriptos(cursoId);
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al inscribir al alumno';
      this._error.set(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  goToWizardStep(step: 1 | 2): void {
    this._wizardStep.set(step);
  }

  // ── Privado ────────────────────────────────────────────────────────────────

  private async fetchCursos(): Promise<void> {
    const branchId = this.branchFacade.selectedBranchId();

    let query = this.supabase.client
      .from('standalone_courses')
      .select('*, standalone_course_enrollments(count)')
      .order('start_date', { ascending: false });

    if (branchId !== null) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const mapped = (data ?? []).map(mapCursoDto);
    this._cursos.set(mapped);

    // Sync _selectedCurso con datos frescos para que los KPIs del drawer reflejen cambios
    const sel = this._selectedCurso();
    if (sel) {
      const updated = mapped.find((c) => c.id === sel.id);
      if (updated) this._selectedCurso.set(updated);
    }
  }

  private async upsertUser(
    form: SingularPersonalDataForm,
    branchId: number,
  ): Promise<number | null> {
    const normalized = normalizeRutForStorage(form.rut);

    const { data: existing } = await this.supabase.client
      .from('users')
      .select('id')
      .eq('rut', normalized)
      .maybeSingle();

    if (existing) {
      const updatePayload: Record<string, unknown> = {
        first_names: form.firstNames || undefined,
        paternal_last_name: form.paternalLastName || undefined,
        maternal_last_name: form.maternalLastName || undefined,
        updated_at: new Date().toISOString(),
      };
      if (form.email) updatePayload['email'] = form.email;
      if (form.phone) updatePayload['phone'] = form.phone;

      const { error } = await this.supabase.client
        .from('users')
        .update(updatePayload)
        .eq('id', existing.id);

      if (error) {
        this._error.set('Error al actualizar usuario: ' + error.message);
        return null;
      }
      return existing.id;
    }

    const { data: studentRole } = await this.supabase.client
      .from('roles')
      .select('id')
      .eq('name', 'student')
      .single();

    const { data: newUser, error } = await this.supabase.client
      .from('users')
      .insert({
        rut: normalized,
        first_names: form.firstNames,
        paternal_last_name: form.paternalLastName,
        maternal_last_name: form.maternalLastName || null,
        email: form.email,
        phone: form.phone || null,
        role_id: studentRole?.id ?? null,
        branch_id: branchId,
        active: true,
        first_login: true,
      })
      .select('id')
      .single();

    if (error || !newUser) {
      this._error.set('Error al crear usuario: ' + (error?.message ?? 'Sin datos'));
      return null;
    }
    return newUser.id;
  }

  private async upsertStudent(
    form: SingularPersonalDataForm,
    userId: number,
  ): Promise<number | null> {
    const today = new Date();
    const birth = form.birthDate ? new Date(form.birthDate) : null;
    const age = birth ? today.getFullYear() - birth.getFullYear() : 25;
    const isMinor = age < 18;

    const payload = {
      birth_date: form.birthDate || null,
      gender: form.gender || null,
      address: form.address || null,
      is_minor: isMinor,
      has_notarial_auth: false,
      status: 'active',
    };

    const { data: existing } = await this.supabase.client
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const { error } = await this.supabase.client
        .from('students')
        .update(payload)
        .eq('id', existing.id);

      if (error) {
        this._error.set('Error al actualizar alumno: ' + error.message);
        return null;
      }
      return existing.id;
    }

    const { data: newStudent, error } = await this.supabase.client
      .from('students')
      .insert({ user_id: userId, ...payload })
      .select('id')
      .single();

    if (error || !newStudent) {
      this._error.set('Error al crear alumno: ' + (error?.message ?? 'Sin datos'));
      return null;
    }
    return newStudent.id;
  }
}
