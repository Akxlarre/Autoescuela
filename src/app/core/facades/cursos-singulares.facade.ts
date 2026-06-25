/**
 * CursosSingularesFacade — RF-035.
 * Gestión de Cursos Singulares (SENCE, Grúa, Retroexcavadora…).
 * Patrón SWR: primera visita con skeleton, re-visitas refrescan en background.
 * Branch-scoped: null = todas las sedes (admin global); number = sede específica.
 */
import { computed, inject, Injectable, signal } from '@angular/core';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
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
import { calcAge, isMinor } from '@core/utils/age.utils';
import { toFriendlyDbMessage } from '@core/utils/db-error.utils';

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

/** Subconjunto de la inscripción necesario para computar finanzas del curso. */
interface EnrollmentFinanceDto {
  amount_paid: number | null;
  payment_status: string | null;
  discount_amount: number | null;
}

export function mapCursoDto(
  dto: StandaloneCourse & { standalone_course_enrollments?: EnrollmentFinanceDto[] },
): CursoSingularRow {
  const enrollments = dto.standalone_course_enrollments ?? [];
  const estado = computeEstado(dto.status, dto.start_date);
  // Cobrado real: lo que efectivamente entró.
  const ingresoCobrado = enrollments.reduce((s, e) => s + (e.amount_paid ?? 0), 0);
  // Por cobrar: saldo de cada inscripción (precio − descuento − pagado), nunca negativo.
  const porCobrar = enrollments.reduce(
    (s, e) => s + Math.max(0, dto.base_price - (e.discount_amount ?? 0) - (e.amount_paid ?? 0)),
    0,
  );
  return {
    id: dto.id,
    nombre: dto.name,
    tipo: toTipo(dto.type),
    billingType: toBillingType(dto.billing_type),
    precio: dto.base_price,
    duracionHoras: dto.duration_hours,
    inscritos: enrollments.length,
    cupos: dto.max_students,
    estado,
    inicio: dto.start_date,
    branchId: dto.branch_id ?? 0,
    ingresoCobrado,
    porCobrar,
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
  /** Sede del último fetch — invalida la caché SWR cuando el admin cambia de sede. */
  private _lastBranchId: number | null | undefined = undefined;

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
    const noCancelados = list.filter((c) => c.estado !== 'cancelled');
    return {
      cursosActivos: activos.length,
      totalCursos: list.length,
      totalInscritos: list.reduce((s, c) => s + c.inscritos, 0),
      ingresosCobrados: noCancelados.reduce((s, c) => s + c.ingresoCobrado, 0),
      porCobrar: noCancelados.reduce((s, c) => s + c.porCobrar, 0),
    };
  });

  // ── 4. Métodos de acción — Cursos ──────────────────────────────────────────

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
    const branchId = this.getActiveBranchId();
    if (this._initialized && branchId === this._lastBranchId) {
      void this.refreshSilently();
      return;
    }
    // Primera carga o cambio de sede → recarga completa con skeleton
    this._initialized = true;
    this._lastBranchId = branchId;
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
    const precio = this._selectedCurso()?.precio ?? 0;
    try {
      const { data, error } = await this.supabase.client
        .from('standalone_course_enrollments')
        .select(
          `
          id,
          student_id,
          amount_paid,
          discount_amount,
          discount_reason,
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
          descuento: row.discount_amount ?? 0,
          descuentoMotivo: row.discount_reason ?? null,
          montoAPagar: Math.max(0, precio - (row.discount_amount ?? 0)),
          paymentStatus: row.payment_status ?? 'pending',
          paymentMethod: row.payment_method ?? 'efectivo',
          enrolledAt: row.enrolled_at,
        })),
      );
    } catch (err) {
      // No silenciar: la lista vacía engañaría en una vista de cobros
      this._inscriptos.set([]);
      this.setSafeError(err, 'No se pudo cargar la lista de inscritos. Intenta actualizar.');
    } finally {
      this._isLoadingInscriptos.set(false);
    }
  }

  async crearCurso(form: NuevoCursoSingularFormData): Promise<boolean> {
    this._isSaving.set(true);
    this._error.set(null);
    try {
      // branch_id es NOT NULL: la sede viene siempre explícita del formulario
      if (!form.branchId) {
        this._error.set('Selecciona la sede a la que pertenece el curso.');
        return false;
      }
      const { error } = await this.supabase.client.from('standalone_courses').insert({
        name: form.nombre,
        type: form.tipo,
        billing_type: form.billingType,
        base_price: form.precio,
        duration_hours: form.duracionHoras,
        max_students: form.cupos,
        start_date: form.inicio,
        branch_id: form.branchId,
        registered_by: this.auth.currentUser()?.dbId ?? null,
      });

      if (error) throw error;
      await this.refreshSilently();
      return true;
    } catch (err) {
      this.setSafeError(err, 'No se pudo crear el curso. Intenta nuevamente.');
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
      this.setSafeError(err, 'No se pudo finalizar el curso. Intenta nuevamente.');
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
      this.setSafeError(err, 'No se pudo cancelar el curso. Intenta nuevamente.');
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

      // Respetar el descuento acordado al inscribir: se cobra precio − descuento
      const { data: enr, error: readError } = await this.supabase.client
        .from('standalone_course_enrollments')
        .select('discount_amount')
        .eq('id', enrollmentId)
        .maybeSingle();
      if (readError) throw readError;

      const montoACobrar = Math.max(0, precio - (enr?.discount_amount ?? 0));

      const { error } = await this.supabase.client
        .from('standalone_course_enrollments')
        .update({
          payment_status: 'paid',
          amount_paid: montoACobrar,
          paid_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId);

      if (error) throw error;
      if (cursoId) await this.loadInscriptos(cursoId);
      await this.refreshSilently();
      return true;
    } catch (err) {
      this.setSafeError(err, 'No se pudo registrar el cobro. Intenta nuevamente.');
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
   * Pre-llena el resultado COMPLETO (incl. fecha de nacimiento, género y
   * dirección) en `studentSearch` para que el formulario quede pre-cargado
   * y un alumno existente nunca pierda datos al ser re-inscrito.
   * Si no existe setea `studentNotFound`.
   */
  async searchByRut(rut: string): Promise<void> {
    this._isSearching.set(true);
    this._studentSearch.set(null);
    this._studentNotFound.set(false);
    this._error.set(null);

    try {
      const normalized = normalizeRutForStorage(rut);
      const { data: user, error: userError } = await this.supabase.client
        .from('users')
        .select('id, first_names, paternal_last_name, maternal_last_name, email, phone')
        .eq('rut', normalized)
        .maybeSingle();

      if (userError) throw userError;

      if (!user) {
        this._studentNotFound.set(true);
        return;
      }

      const { data: student, error: studentError } = await this.supabase.client
        .from('students')
        .select('id, birth_date, gender, address')
        .eq('user_id', user.id)
        .maybeSingle();

      if (studentError) throw studentError;

      this._studentSearch.set({
        userId: user.id,
        studentId: student?.id ?? null,
        nombreCompleto: `${user.first_names} ${user.paternal_last_name}`,
        firstNames: user.first_names,
        paternalLastName: user.paternal_last_name,
        maternalLastName: user.maternal_last_name ?? '',
        rut: normalized,
        email: user.email ?? '',
        phone: user.phone ?? '',
        birthDate: student?.birth_date ?? '',
        gender: student?.gender === 'F' ? 'F' : 'M',
        address: student?.address ?? '',
      });
    } catch (err) {
      this.setSafeError(err, 'No se pudo buscar el alumno. Intenta nuevamente.');
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
    // La BD exige birth_date NOT NULL y edad mínima 17 — validar aquí con
    // mensaje claro en vez de dejar que explote el constraint de PostgreSQL.
    const age = calcAge(form.birthDate);
    if (age === null) {
      this._error.set('Ingresa la fecha de nacimiento del alumno.');
      return false;
    }
    if (age < 17) {
      this._error.set('El alumno debe tener al menos 17 años para inscribirse.');
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

      // 1. Verificar duplicado ANTES de escribir nada: si el alumno ya está
      //    inscrito, no se debe mutar su ficha de usuario/alumno.
      const yaInscrito = await this.isAlreadyEnrolled(cursoId, form.rut);
      if (yaInscrito) {
        this._error.set('Este alumno ya está inscrito en el curso.');
        return false;
      }

      // 1b. Verificar cupos disponibles (el trigger de BD es el backstop
      //     contra inscripciones concurrentes).
      const hayCupo = await this.hasAvailableSeats(cursoId);
      if (!hayCupo) {
        this._error.set('No quedan cupos disponibles en este curso.');
        return false;
      }

      // 2. Crear o actualizar usuario
      const userId = await this.upsertUser(form, branchId);
      if (!userId) return false;

      // 3. Crear o actualizar alumno
      const studentId = await this.upsertStudent(form, userId);
      if (!studentId) return false;

      // 4. Insertar inscripción
      const registeredBy = this.auth.currentUser()?.dbId ?? null;
      const { error } = await this.supabase.client.from('standalone_course_enrollments').insert({
        standalone_course_id: cursoId,
        student_id: studentId,
        amount_paid: payment.amountPaid,
        discount_amount: payment.discountAmount,
        discount_reason: payment.discountAmount > 0 ? payment.discountReason : null,
        payment_status: payment.paymentStatus,
        payment_method: payment.paymentMethod,
        enrolled_at: new Date().toISOString(),
        paid_at: payment.paymentStatus === 'paid' ? new Date().toISOString() : null,
        registered_by: registeredBy,
      });

      if (error) throw error;

      this.toast.success('Alumno inscrito correctamente');
      await this.loadInscriptos(cursoId);
      await this.refreshSilently();
      return true;
    } catch (err) {
      this.setSafeError(err, 'No se pudo completar la inscripción. Intenta nuevamente.');
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  goToWizardStep(step: 1 | 2): void {
    this._wizardStep.set(step);
  }

  // ── Privado ────────────────────────────────────────────────────────────────

  /**
   * Registra el error real en consola (diagnóstico) y expone a la UI solo un
   * mensaje amigable — nunca texto crudo de PostgreSQL (AC2 fix-015).
   */
  private setSafeError(err: unknown, fallback: string): void {
    console.error('[CursosSingularesFacade]', err);
    this._error.set(toFriendlyDbMessage(err, fallback));
  }

  /** Lookup read-only: ¿el RUT ya tiene una inscripción en este curso? */
  private async isAlreadyEnrolled(cursoId: number, rut: string): Promise<boolean> {
    const normalized = normalizeRutForStorage(rut);
    const { data: user } = await this.supabase.client
      .from('users')
      .select('id')
      .eq('rut', normalized)
      .maybeSingle();
    if (!user) return false;

    const { data: student } = await this.supabase.client
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!student) return false;

    const { data: existing } = await this.supabase.client
      .from('standalone_course_enrollments')
      .select('id')
      .eq('standalone_course_id', cursoId)
      .eq('student_id', student.id)
      .maybeSingle();
    return existing !== null;
  }

  /** Compara inscripciones actuales contra max_students con datos frescos de BD. */
  private async hasAvailableSeats(cursoId: number): Promise<boolean> {
    const { data: curso, error: cursoError } = await this.supabase.client
      .from('standalone_courses')
      .select('max_students')
      .eq('id', cursoId)
      .maybeSingle();
    if (cursoError || !curso) return false;

    const { count, error: countError } = await this.supabase.client
      .from('standalone_course_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('standalone_course_id', cursoId);
    if (countError) return false;

    return (count ?? 0) < curso.max_students;
  }

  private async fetchCursos(): Promise<void> {
    const branchId = this.getActiveBranchId();

    let query = this.supabase.client
      .from('standalone_courses')
      .select('*, standalone_course_enrollments(amount_paid, payment_status, discount_amount)')
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
      // Solo actualizar campos con valor — nunca borrar datos existentes
      // con strings vacíos del formulario.
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (form.firstNames.trim()) updatePayload['first_names'] = form.firstNames.trim();
      if (form.paternalLastName.trim())
        updatePayload['paternal_last_name'] = form.paternalLastName.trim();
      if (form.maternalLastName.trim())
        updatePayload['maternal_last_name'] = form.maternalLastName.trim();
      if (form.email) updatePayload['email'] = form.email;
      if (form.phone) updatePayload['phone'] = form.phone;

      const { error } = await this.supabase.client
        .from('users')
        .update(updatePayload)
        .eq('id', existing.id);

      if (error) {
        this.setSafeError(error, 'No se pudieron actualizar los datos del alumno.');
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
      this.setSafeError(error, 'No se pudo registrar al alumno. Intenta nuevamente.');
      return null;
    }
    return newUser.id;
  }

  private async upsertStudent(
    form: SingularPersonalDataForm,
    userId: number,
  ): Promise<number | null> {
    const { data: existing } = await this.supabase.client
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // UPDATE conservador: solo campos con valor real. `birth_date` es
      // NOT NULL en BD — jamás enviarle null a un alumno existente.
      const updatePayload: Record<string, unknown> = {};
      if (form.birthDate) {
        updatePayload['birth_date'] = form.birthDate;
        updatePayload['is_minor'] = isMinor(form.birthDate);
      }
      if (form.gender) updatePayload['gender'] = form.gender;
      if (form.address) updatePayload['address'] = form.address;

      if (Object.keys(updatePayload).length === 0) return existing.id;

      const { error } = await this.supabase.client
        .from('students')
        .update(updatePayload)
        .eq('id', existing.id);

      if (error) {
        this.setSafeError(error, 'No se pudieron actualizar los datos del alumno.');
        return null;
      }
      return existing.id;
    }

    const { data: newStudent, error } = await this.supabase.client
      .from('students')
      .insert({
        user_id: userId,
        birth_date: form.birthDate,
        gender: form.gender || null,
        address: form.address || null,
        is_minor: isMinor(form.birthDate),
        has_notarial_auth: false,
        status: 'active',
      })
      .select('id')
      .single();

    if (error || !newStudent) {
      this.setSafeError(error, 'No se pudo registrar al alumno. Intenta nuevamente.');
      return null;
    }
    return newStudent.id;
  }
}
