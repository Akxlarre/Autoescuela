import { computed, inject, Injectable, signal } from '@angular/core';

import { SupabaseService } from '@core/services/infrastructure/supabase.service';

import type { Enrollment } from '@core/models/dto/enrollment.model';
import type { Course } from '@core/models/dto/course.model';
import type {
  EnrollmentPersonalData,
  CourseCategory,
  CourseType,
  CourseOption,
  SenceCodeOption,
} from '@core/models/ui/enrollment-personal-data.model';
import type {
  InstructorOption,
  ScheduleGrid,
  TimeSlot,
  WeekDay,
  WeekRange,
  PromotionOption,
  PromotionGroup,
  PaymentMode,
  StudentSummaryBanner,
} from '@core/models/ui/enrollment-assignment.model';
import type {
  EnrollmentWizardStep,
  StepConfig,
  SidebarSummary,
  CourseSummary,
  Requirement,
} from '@core/models/ui/enrollment-wizard.model';
import { ENROLLMENT_STEPS } from '@core/models/ui/enrollment-wizard.model';

// ─── Tipos internos ───

interface EnrollmentDraft {
  enrollmentId: number | null;
  studentId: number | null;
  userId: number | null;
}

/**
 * EnrollmentFacade — Orquestador principal del wizard de matrícula.
 *
 * Responsabilidades:
 * - Step 1: Buscar/crear estudiante, crear enrollment draft
 * - Step 2: Cargar instructores, slots de agenda, promociones profesionales
 * - Step 5: Invocar generación de contrato (Edge Function)
 * - Step 6: Confirmar matrícula (status → active, generar número)
 * - Wizard: Estado del stepper, sidebar summary, navegación
 */
@Injectable({ providedIn: 'root' })
export class EnrollmentFacade {
  private readonly supabase = inject(SupabaseService);

  // ══════════════════════════════════════════════════════════════════════════════
  // 1. ESTADO REACTIVO (Privado)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Draft anchor ──
  private readonly _draft = signal<EnrollmentDraft>({
    enrollmentId: null,
    studentId: null,
    userId: null,
  });

  // ── Wizard state ──
  private readonly _currentStep = signal<EnrollmentWizardStep>(1);
  private readonly _steps = signal<StepConfig[]>(structuredClone(ENROLLMENT_STEPS));
  private readonly _isSubmitting = signal(false);

  // ── Step 1: Personal data ──
  private readonly _personalData = signal<EnrollmentPersonalData | null>(null);
  private readonly _courses = signal<Course[]>([]); // Interno — nunca se expone a la UI
  private readonly _senceCodeMap = new Map<string, number>(); // code → id (interno para resolver FK)
  private readonly _senceOptions = signal<SenceCodeOption[]>([]);

  // ── Step 2: Assignment ──
  private readonly _instructors = signal<InstructorOption[]>([]);
  private readonly _scheduleGrid = signal<ScheduleGrid | null>(null);
  private readonly _selectedSlotIds = signal<string[]>([]);
  private readonly _paymentMode = signal<PaymentMode | null>(null);
  private readonly _selectedInstructorId = signal<number | null>(null);
  private readonly _promotionGroups = signal<PromotionGroup[]>([]);
  private readonly _selectedPromotionCourseId = signal<number | null>(null);

  // ── Enrollment record ──
  private readonly _enrollment = signal<Enrollment | null>(null);

  // ── UI state ──
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. ESTADO EXPUESTO (Público, solo lectura)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Draft ──
  readonly draft = this._draft.asReadonly();

  // ── Wizard ──
  readonly currentStep = this._currentStep.asReadonly();
  readonly steps = this._steps.asReadonly();
  readonly isSubmitting = this._isSubmitting.asReadonly();

  // ── Step 1 ──
  readonly personalData = this._personalData.asReadonly();
  readonly senceOptions = this._senceOptions.asReadonly(); // UI model (SenceCodeOption[])

  // ── Step 2 ──
  readonly instructors = this._instructors.asReadonly();
  readonly scheduleGrid = this._scheduleGrid.asReadonly();
  readonly selectedSlotIds = this._selectedSlotIds.asReadonly();
  readonly paymentMode = this._paymentMode.asReadonly();
  readonly selectedInstructorId = this._selectedInstructorId.asReadonly();
  readonly promotionGroups = this._promotionGroups.asReadonly();
  readonly selectedPromotionCourseId = this._selectedPromotionCourseId.asReadonly();

  // ── Enrollment (campos derivados, nunca el DTO crudo) ──
  readonly enrollmentStatus = computed(() => this._enrollment()?.status ?? null);
  readonly enrollmentNumber = computed(() => this._enrollment()?.number ?? null);
  readonly docsComplete = computed(() => this._enrollment()?.docs_complete ?? false);
  readonly contractAccepted = computed(() => this._enrollment()?.contract_accepted ?? false);
  readonly paymentStatus = computed(() => this._enrollment()?.payment_status ?? null);

  // ── UI ──
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly courseOptions = computed<CourseOption[]>(() =>
    this._courses().map((c) => this.mapCourseToOption(c)),
  );

  // ── Computed: Student summary banner (Steps 2-6) ──
  readonly studentSummary = computed<StudentSummaryBanner | null>(() => {
    const pd = this._personalData();
    if (!pd) return null;
    const fullName = `${pd.firstNames} ${pd.lastNames}`;
    const initials = fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
    const course = this._courses().find(
      (c) => c.license_class === this.courseTypeToLicenseClass(pd.courseType),
    );
    return {
      initials,
      fullName,
      courseLabel: course?.name ?? pd.courseType,
    };
  });

  // ── Computed: Sidebar summary ──
  readonly sidebarSummary = computed<SidebarSummary>(() => {
    const pd = this._personalData();
    const enrollment = this._enrollment();

    let course: CourseSummary | null = null;
    if (pd) {
      const c = this._courses().find(
        (co) => co.license_class === this.courseTypeToLicenseClass(pd.courseType),
      );
      if (c) {
        course = {
          type: c.name,
          duration: c.duration_weeks ? `${c.duration_weeks} semanas` : '—',
          practicalHours: c.practical_hours ? `${c.practical_hours}h` : '—',
          theoreticalHours: c.theory_hours ? `${c.theory_hours}h` : '—',
          totalPrice: c.base_price ?? 0,
        };
      }
    }

    const requirements: Requirement[] = [
      { label: 'Datos personales', fulfilled: pd !== null },
      {
        label: 'Asignación',
        fulfilled: this._currentStep() > 2,
      },
      {
        label: 'Documentos',
        fulfilled: enrollment?.docs_complete ?? false,
      },
      {
        label: 'Pago',
        fulfilled:
          enrollment?.payment_status === 'paid_full' || enrollment?.payment_status === 'partial',
      },
      {
        label: 'Contrato',
        fulfilled: enrollment?.contract_accepted ?? false,
      },
    ];

    return { course, requirements };
  });

  // ── Computed: Can advance to next step ──
  readonly canAdvance = computed<boolean>(() => {
    const step = this._currentStep();
    switch (step) {
      case 1:
        return this._personalData() !== null;
      case 2:
        return this.isStep2Complete();
      case 3:
        return true; // Documents facade controls this
      case 4:
        return true; // Payment facade controls this
      case 5:
        return this._enrollment()?.contract_accepted ?? false;
      case 6:
        return false; // Final step
      default:
        return false;
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Step 1 (Datos personales)
  // ══════════════════════════════════════════════════════════════════════════════

  /** Carga el catálogo de cursos activos para la sucursal del usuario. */
  async loadCourses(branchId: number): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('courses')
      .select('*')
      .eq('branch_id', branchId)
      .eq('active', true)
      .order('name');

    if (error) {
      this._error.set('Error al cargar cursos: ' + error.message);
      return;
    }
    this._courses.set(data ?? []);
  }

  /** Carga códigos SENCE vigentes para un curso específico. Transforma DTO → SenceCodeOption. */
  async loadSenceCodes(courseId: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await this.supabase.client
      .from('sence_codes')
      .select('id, code, description')
      .eq('course_id', courseId)
      .eq('valid', true)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('code');

    if (error) {
      this._error.set('Error al cargar códigos SENCE: ' + error.message);
      return;
    }

    // Mapear DTO → UI model y guardar code→id para resolver FK al persistir
    this._senceCodeMap.clear();
    const options: SenceCodeOption[] = (data ?? []).map((row: any) => {
      this._senceCodeMap.set(row.code, row.id);
      return {
        code: row.code,
        label: row.description ?? row.code,
      };
    });
    this._senceOptions.set(options);
  }

  /**
   * Busca un usuario existente por RUT.
   * Retorna el user+student si existe, null si no.
   */
  /**
   * Busca un usuario existente por RUT.
   * Retorna datos pre-mapeados para la UI (no DTOs crudos).
   */
  async findUserByRut(rut: string): Promise<{
    firstNames: string;
    lastNames: string;
    email: string;
    phone: string;
    birthDate: string | null;
    gender: string | null;
    address: string | null;
    regionCode: string | null;
    communeValue: string | null;
    currentLicense: string | null;
    licenseDate: string | null;
  } | null> {
    const { data: user, error } = await this.supabase.client
      .from('users')
      .select('id, first_names, paternal_last_name, maternal_last_name, email, phone')
      .eq('rut', rut)
      .maybeSingle();

    if (error || !user) return null;

    const { data: student } = await this.supabase.client
      .from('students')
      .select(
        'birth_date, gender, address, region, district, current_license_class, license_obtained_date',
      )
      .eq('user_id', user.id)
      .maybeSingle();

    return {
      firstNames: user.first_names,
      lastNames: `${user.paternal_last_name} ${user.maternal_last_name}`.trim(),
      email: user.email,
      phone: user.phone ?? '',
      birthDate: student?.birth_date ?? null,
      gender: student?.gender ?? null,
      address: student?.address ?? null,
      regionCode: student?.region ?? null,
      communeValue: student?.district ?? null,
      currentLicense: student?.current_license_class ?? null,
      licenseDate: student?.license_obtained_date ?? null,
    };
  }

  /**
   * Step 1 → Persiste datos personales.
   * Crea o actualiza user+student, luego crea enrollment draft.
   */
  async savePersonalData(data: EnrollmentPersonalData, branchId: number): Promise<boolean> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      // 1. Upsert user
      const userId = await this.upsertUser(data, branchId);
      if (!userId) return false;

      // 2. Upsert student
      const studentId = await this.upsertStudent(data, userId);
      if (!studentId) return false;

      // 3. Resolve course_id
      const courseId = await this.resolveCourseId(data, branchId);
      if (!courseId) return false;

      // 4. Resolve sence_code_id (optional, from internal map)
      let senceCodeId: number | null = null;
      if (data.senceCode) {
        senceCodeId = this._senceCodeMap.get(data.senceCode) ?? null;
      }

      // 5. Check for existing draft for this student+course
      const existingDraft = await this.findExistingDraft(studentId, courseId);

      let enrollmentId: number;
      if (existingDraft) {
        // Update existing draft
        enrollmentId = existingDraft.id;
        const { error } = await this.supabase.client
          .from('enrollments')
          .update({
            branch_id: branchId,
            sence_code_id: senceCodeId,
            expires_at: this.getDraftExpiry(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', enrollmentId);

        if (error) {
          this._error.set('Error al actualizar matrícula: ' + error.message);
          return false;
        }
      } else {
        // Create new draft enrollment
        const course = this._courses().find((c) => c.id === courseId);
        const { data: newEnrollment, error } = await this.supabase.client
          .from('enrollments')
          .insert({
            student_id: studentId,
            course_id: courseId,
            branch_id: branchId,
            sence_code_id: senceCodeId,
            base_price: course?.base_price ?? 0,
            discount: 0,
            total_paid: 0,
            status: 'draft',
            expires_at: this.getDraftExpiry(),
            docs_complete: false,
            contract_accepted: false,
            certificate_enabled: false,
            registration_channel: 'office',
          })
          .select('*')
          .single();

        if (error || !newEnrollment) {
          this._error.set('Error al crear matrícula: ' + (error?.message ?? 'Sin datos'));
          return false;
        }
        enrollmentId = newEnrollment.id;
        this._enrollment.set(newEnrollment);
      }

      // 6. Update local state
      this._draft.set({ enrollmentId, studentId, userId });
      this._personalData.set(data);
      this.updateStepStatus(1, 'completed');
      this.goToStep(2);

      return true;
    } catch (e) {
      this._error.set('Error inesperado al guardar datos personales');
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Step 2 (Asignación)
  // ══════════════════════════════════════════════════════════════════════════════

  /** Carga instructores con vehículo asignado activo para la sucursal. */
  async loadInstructors(branchId: number): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('instructors')
      .select(
        `id,
         users!inner(first_names, paternal_last_name),
         vehicle_assignments!inner(
           vehicles!inner(brand, model, license_plate)
         )`,
      )
      .eq('active', true)
      .eq('users.branch_id', branchId);

    if (error) {
      this._error.set('Error al cargar instructores: ' + error.message);
      return;
    }

    const options: InstructorOption[] = (data ?? []).map((row: any) => ({
      id: row.id,
      name: `${row.users.first_names} ${row.users.paternal_last_name}`,
      vehicleDescription:
        `${row.vehicle_assignments[0]?.vehicles?.brand ?? ''} ${row.vehicle_assignments[0]?.vehicles?.model ?? ''}`.trim(),
      plate: row.vehicle_assignments[0]?.vehicles?.license_plate ?? '',
    }));

    this._instructors.set(options);
  }

  /**
   * Carga la grilla de horarios disponibles desde la vista
   * `v_class_b_schedule_availability` para un instructor específico.
   */
  async loadScheduleGrid(instructorId: number): Promise<void> {
    this._selectedInstructorId.set(instructorId);
    this._selectedSlotIds.set([]);
    this._scheduleGrid.set(null);
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const { data, error } = await this.supabase.client
        .from('v_class_b_schedule_availability')
        .select('*')
        .eq('instructor_id', instructorId)
        .order('slot_start', { ascending: true });

      if (error) {
        this._error.set('Error al cargar disponibilidad: ' + error.message);
        return;
      }

      if (!data || data.length === 0) {
        this._scheduleGrid.set(null);
        return;
      }

      this._scheduleGrid.set(this.buildScheduleGrid(data));
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Establece los slots seleccionados directamente (sincronización desde el contenedor). */
  setSelectedSlots(slotIds: string[]): void {
    this._selectedSlotIds.set(slotIds);
  }

  /** Selecciona/deselecciona un slot de horario. */
  toggleSlot(slotId: string): void {
    const current = this._selectedSlotIds();
    const idx = current.indexOf(slotId);

    if (idx >= 0) {
      this._selectedSlotIds.set(current.filter((id) => id !== slotId));
    } else {
      this._selectedSlotIds.set([...current, slotId]);
    }
  }

  /** Establece la modalidad de pago (completo vs abono). */
  setPaymentMode(mode: PaymentMode): void {
    this._paymentMode.set(mode);
  }

  /** Carga promociones profesionales abiertas para la clase de curso seleccionada. */
  async loadPromotions(branchId: number, courseCategory: CourseCategory): Promise<void> {
    if (courseCategory !== 'professional') {
      this._promotionGroups.set([]);
      return;
    }

    const pd = this._personalData();
    if (!pd) return;

    const { data, error } = await this.supabase.client
      .from('promotion_courses')
      .select(
        `id,
         max_students,
         enrolled_students,
         status,
         courses!inner(code, name, license_class),
         professional_promotions!inner(code, name, status, branch_id)`,
      )
      .eq('professional_promotions.branch_id', branchId)
      .eq('professional_promotions.status', 'open')
      .eq('status', 'active');

    if (error) {
      this._error.set('Error al cargar promociones: ' + error.message);
      return;
    }

    // Group by promotion
    const groupMap = new Map<string, PromotionOption[]>();
    for (const row of data ?? []) {
      const promo = row.professional_promotions as any;
      const course = row.courses as any;
      const groupKey = `${promo.code} – ${promo.name}`;

      const option: PromotionOption = {
        id: row.id,
        label: `${course.name} (${course.code})`,
        courseCode: course.code,
        enrolledCount: row.enrolled_students,
        maxCapacity: row.max_students,
        status: row.status === 'active' ? 'open' : 'finished',
      };

      const existing = groupMap.get(groupKey) ?? [];
      existing.push(option);
      groupMap.set(groupKey, existing);
    }

    const groups: PromotionGroup[] = Array.from(groupMap.entries()).map(([label, options]) => ({
      label,
      options,
    }));

    this._promotionGroups.set(groups);
  }

  /** Selecciona una promoción profesional (promotion_course_id). */
  selectPromotion(promotionCourseId: number): void {
    this._selectedPromotionCourseId.set(promotionCourseId);
  }

  /**
   * Step 2 → Persiste la asignación en el enrollment draft.
   * Para Clase B: guarda slots como class_b_sessions con status 'reserved'.
   * Para Profesional: asigna promotion_course_id.
   */
  async saveAssignment(): Promise<boolean> {
    const draft = this._draft();
    if (!draft.enrollmentId) return false;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const pd = this._personalData();
      if (!pd) return false;

      const isClassB =
        pd.courseCategory === 'non-professional' &&
        (pd.courseType === 'class_b' || pd.courseType === 'class_b_sence');

      if (isClassB) {
        // Save reserved sessions for Class B
        const slots = this._selectedSlotIds();
        const instructorId = this._selectedInstructorId();

        if (!instructorId || slots.length === 0) {
          this._error.set('Debe seleccionar instructor y horarios');
          return false;
        }

        // Get vehicle_id for this instructor
        const { data: assignment } = await this.supabase.client
          .from('vehicle_assignments')
          .select('vehicle_id')
          .eq('instructor_id', instructorId)
          .eq('active', true)
          .limit(1)
          .single();

        const vehicleId = assignment?.vehicle_id ?? null;

        // Parse slot IDs into session records
        const sessions = slots.map((slotId) => {
          // slotId format: "2024-01-15T09:00" — agregar segundos para timestamptz válido
          const scheduledAt =
            slotId.includes(':') && slotId.split(':').length === 2 ? `${slotId}:00` : slotId;
          return {
            enrollment_id: draft.enrollmentId,
            instructor_id: instructorId,
            vehicle_id: vehicleId,
            scheduled_at: scheduledAt,
            duration_min: 45,
            status: 'reserved',
          };
        });

        // Delete previous reserved sessions for this enrollment
        await this.supabase.client
          .from('class_b_sessions')
          .delete()
          .eq('enrollment_id', draft.enrollmentId)
          .eq('status', 'reserved');

        // Insert new reserved sessions
        const { error: sessionsError } = await this.supabase.client
          .from('class_b_sessions')
          .insert(sessions);

        if (sessionsError) {
          this._error.set('Error al reservar horarios: ' + sessionsError.message);
          return false;
        }
      } else if (pd.courseCategory === 'professional') {
        // Save promotion_course_id for professional
        const promotionCourseId = this._selectedPromotionCourseId();
        if (!promotionCourseId) {
          this._error.set('Debe seleccionar una promoción');
          return false;
        }

        const { error } = await this.supabase.client
          .from('enrollments')
          .update({
            promotion_course_id: promotionCourseId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', draft.enrollmentId);

        if (error) {
          this._error.set('Error al asignar promoción: ' + error.message);
          return false;
        }
      }
      // Singular: no assignment needed, step is informational

      this.updateStepStatus(2, 'completed');
      this.goToStep(3);
      return true;
    } catch (e) {
      this._error.set('Error inesperado al guardar asignación');
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Step 5 (Contrato)
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Invoca la Edge Function para generar el PDF del contrato.
   * Retorna la URL del PDF generado.
   */
  async generateContract(): Promise<string | null> {
    const draft = this._draft();
    if (!draft.enrollmentId) return null;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const { data, error } = await this.supabase.client.functions.invoke('generate-contract-pdf', {
        body: { enrollment_id: draft.enrollmentId },
      });

      if (error) {
        this._error.set('Error al generar contrato: ' + error.message);
        return null;
      }

      return data?.pdfUrl ?? null;
    } catch (e) {
      this._error.set('Error inesperado al generar contrato');
      return null;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Sube el contrato firmado y actualiza el enrollment.
   */
  async uploadSignedContract(file: File): Promise<boolean> {
    const draft = this._draft();
    if (!draft.enrollmentId || !draft.studentId) return false;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const filePath = `contracts/${draft.enrollmentId}/${file.name}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await this.supabase.client.storage
        .from('documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        this._error.set('Error al subir contrato: ' + uploadError.message);
        return false;
      }

      const {
        data: { publicUrl },
      } = this.supabase.client.storage.from('documents').getPublicUrl(filePath);

      // Upsert digital_contracts record
      const { error: contractError } = await this.supabase.client.from('digital_contracts').upsert(
        {
          enrollment_id: draft.enrollmentId,
          student_id: draft.studentId,
          file_name: file.name,
          file_url: publicUrl,
          accepted_at: new Date().toISOString(),
        },
        { onConflict: 'enrollment_id' },
      );

      if (contractError) {
        this._error.set('Error al registrar contrato: ' + contractError.message);
        return false;
      }

      // Update enrollment
      const { error: updateError } = await this.supabase.client
        .from('enrollments')
        .update({
          contract_accepted: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draft.enrollmentId);

      if (updateError) {
        this._error.set('Error al actualizar matrícula: ' + updateError.message);
        return false;
      }

      await this.refreshEnrollment();
      this.updateStepStatus(5, 'completed');
      this.goToStep(6);
      return true;
    } catch (e) {
      this._error.set('Error inesperado al subir contrato firmado');
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Registra la firma digital del contrato (sin archivo físico).
   * Actualiza digital_contracts + enrollments.contract_accepted y avanza al paso 6.
   */
  async markContractSigned(meta: {
    signerName: string | null;
    signatureHash: string | null;
    signedAt: string | null;
  }): Promise<boolean> {
    const draft = this._draft();
    if (!draft.enrollmentId || !draft.studentId) return false;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const { error: contractError } = await this.supabase.client.from('digital_contracts').upsert(
        {
          enrollment_id: draft.enrollmentId,
          student_id: draft.studentId,
          accepted_at: meta.signedAt ?? new Date().toISOString(),
        },
        { onConflict: 'enrollment_id' },
      );

      if (contractError) {
        this._error.set('Error al registrar firma: ' + contractError.message);
        return false;
      }

      const { error: updateError } = await this.supabase.client
        .from('enrollments')
        .update({ contract_accepted: true, updated_at: new Date().toISOString() })
        .eq('id', draft.enrollmentId);

      if (updateError) {
        this._error.set('Error al actualizar matrícula: ' + updateError.message);
        return false;
      }

      await this.refreshEnrollment();
      this.updateStepStatus(5, 'completed');
      this.goToStep(6);
      return true;
    } catch {
      this._error.set('Error inesperado al registrar firma');
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Step 6 (Confirmación)
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Confirma la matrícula: genera número, cambia status a active,
   * y confirma sesiones reservadas.
   */
  async confirmEnrollment(): Promise<string | null> {
    const draft = this._draft();
    if (!draft.enrollmentId) return null;

    this._isSubmitting.set(true);
    this._error.set(null);

    try {
      // Generate enrollment number (YYYY-NNNN)
      const enrollmentNumber = await this.generateEnrollmentNumber();
      if (!enrollmentNumber) return null;

      // Update enrollment to active
      const { error } = await this.supabase.client
        .from('enrollments')
        .update({
          number: enrollmentNumber,
          status: 'active',
          expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draft.enrollmentId);

      if (error) {
        this._error.set('Error al confirmar matrícula: ' + error.message);
        return null;
      }

      // Confirm reserved sessions → scheduled
      await this.supabase.client
        .from('class_b_sessions')
        .update({ status: 'scheduled' })
        .eq('enrollment_id', draft.enrollmentId)
        .eq('status', 'reserved');

      await this.refreshEnrollment();
      this.updateStepStatus(6, 'completed');

      return enrollmentNumber;
    } catch (e) {
      this._error.set('Error inesperado al confirmar matrícula');
      return null;
    } finally {
      this._isSubmitting.set(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 4. WIZARD NAVIGATION
  // ══════════════════════════════════════════════════════════════════════════════

  /** Navega a un step específico (solo si es ≤ current + 1). */
  goToStep(step: EnrollmentWizardStep): void {
    this._currentStep.set(step);
    this.updateStepStatus(step, 'active');
  }

  /** Retrocede un step. */
  goBack(): void {
    const current = this._currentStep();
    if (current > 1) {
      this.goToStep((current - 1) as EnrollmentWizardStep);
    }
  }

  /** Resetea todo el estado del wizard para una nueva matrícula. */
  reset(): void {
    this._draft.set({ enrollmentId: null, studentId: null, userId: null });
    this._currentStep.set(1);
    this._steps.set(structuredClone(ENROLLMENT_STEPS));
    this._isSubmitting.set(false);
    this._personalData.set(null);
    this._courses.set([]);
    this._senceCodeMap.clear();
    this._senceOptions.set([]);
    this._instructors.set([]);
    this._scheduleGrid.set(null);
    this._selectedSlotIds.set([]);
    this._paymentMode.set(null);
    this._selectedInstructorId.set(null);
    this._promotionGroups.set([]);
    this._selectedPromotionCourseId.set(null);
    this._enrollment.set(null);
    this._isLoading.set(false);
    this._error.set(null);
  }

  /** Recarga el enrollment desde la BD. */
  async refreshEnrollment(): Promise<void> {
    const draft = this._draft();
    if (!draft.enrollmentId) return;

    const { data, error } = await this.supabase.client
      .from('enrollments')
      .select('*')
      .eq('id', draft.enrollmentId)
      .single();

    if (!error && data) {
      this._enrollment.set(data);
    }
  }

  /** Limpia el error actual. */
  clearError(): void {
    this._error.set(null);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 5. MÉTODOS PRIVADOS
  // ══════════════════════════════════════════════════════════════════════════════

  private async upsertUser(data: EnrollmentPersonalData, branchId: number): Promise<number | null> {
    const [paternalLast, ...maternalParts] = data.lastNames.split(' ');
    const maternalLast = maternalParts.join(' ') || '';

    // Try to find existing user by RUT
    const { data: existing } = await this.supabase.client
      .from('users')
      .select('id')
      .eq('rut', data.rut)
      .maybeSingle();

    if (existing) {
      // Update existing user
      const { error } = await this.supabase.client
        .from('users')
        .update({
          first_names: data.firstNames,
          paternal_last_name: paternalLast,
          maternal_last_name: maternalLast,
          email: data.email,
          phone: data.phone,
          branch_id: branchId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        this._error.set('Error al actualizar usuario: ' + error.message);
        return null;
      }
      return existing.id;
    }

    // Create new user (role_id for student)
    const { data: studentRole } = await this.supabase.client
      .from('roles')
      .select('id')
      .eq('name', 'student')
      .single();

    const { data: newUser, error } = await this.supabase.client
      .from('users')
      .insert({
        rut: data.rut,
        first_names: data.firstNames,
        paternal_last_name: paternalLast,
        maternal_last_name: maternalLast,
        email: data.email,
        phone: data.phone,
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
    data: EnrollmentPersonalData,
    userId: number,
  ): Promise<number | null> {
    const { data: existing } = await this.supabase.client
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    const isMinor = this.calculateAge(data.birthDate) < 18;

    if (existing) {
      const { error } = await this.supabase.client
        .from('students')
        .update({
          birth_date: data.birthDate,
          gender: data.gender,
          address: data.address,
          region: data.regionCode,
          district: data.communeValue,
          is_minor: isMinor,
          current_license_class: data.currentLicense,
          license_obtained_date: data.licenseDate,
          status: 'active',
        })
        .eq('id', existing.id);

      if (error) {
        this._error.set('Error al actualizar alumno: ' + error.message);
        return null;
      }
      return existing.id;
    }

    const { data: newStudent, error } = await this.supabase.client
      .from('students')
      .insert({
        user_id: userId,
        birth_date: data.birthDate,
        gender: data.gender,
        address: data.address,
        region: data.regionCode,
        district: data.communeValue,
        is_minor: isMinor,
        has_notarial_auth: false,
        current_license_class: data.currentLicense,
        license_obtained_date: data.licenseDate,
        status: 'active',
      })
      .select('id')
      .single();

    if (error || !newStudent) {
      this._error.set('Error al crear alumno: ' + (error?.message ?? 'Sin datos'));
      return null;
    }
    return newStudent.id;
  }

  private async resolveCourseId(
    data: EnrollmentPersonalData,
    branchId: number,
  ): Promise<number | null> {
    const licenseClass = this.courseTypeToLicenseClass(data.courseType);
    const course = this._courses().find(
      (c) => c.license_class === licenseClass && c.branch_id === branchId,
    );

    if (!course) {
      this._error.set(`No se encontró un curso activo para la clase ${licenseClass}`);
      return null;
    }
    return course.id;
  }

  private async findExistingDraft(studentId: number, courseId: number): Promise<Enrollment | null> {
    const { data } = await this.supabase.client
      .from('enrollments')
      .select('*')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .eq('status', 'draft')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (data) {
      this._enrollment.set(data);
    }
    return data ?? null;
  }

  private async generateEnrollmentNumber(): Promise<string | null> {
    const year = new Date().getFullYear();
    const prefix = `${year}-`;

    // Get the highest existing number for this year
    const { data, error } = await this.supabase.client
      .from('enrollments')
      .select('number')
      .like('number', `${prefix}%`)
      .not('number', 'is', null)
      .order('number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this._error.set('Error al generar número de matrícula: ' + error.message);
      return null;
    }

    let nextSeq = 1;
    if (data?.number) {
      const currentSeq = parseInt(data.number.split('-')[1], 10);
      nextSeq = currentSeq + 1;
    }

    return `${prefix}${nextSeq.toString().padStart(4, '0')}`;
  }

  private getDraftExpiry(): string {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    return expiry.toISOString();
  }

  private mapCourseToOption(course: Course): CourseOption {
    const lc = course.license_class ?? '';
    const isSence =
      course.code?.toUpperCase().includes('SENCE') ||
      course.name?.toUpperCase().includes('SENCE') ||
      course.type?.includes('sence');

    let type: CourseType;
    if (lc === 'B') {
      type = isSence ? 'class_b_sence' : 'class_b';
    } else if (lc === 'A2') {
      type = 'professional_a2';
    } else if (lc === 'A3') {
      type = 'professional_a3';
    } else if (lc === 'A4') {
      type = 'professional_a4';
    } else if (lc === 'A5') {
      type = 'professional_a5';
    } else {
      type = 'singular';
    }

    const category: CourseCategory =
      lc === 'B' ? 'non-professional' : type === 'singular' ? 'singular' : 'professional';

    const iconMap: Record<string, string> = {
      class_b: 'car',
      class_b_sence: 'briefcase',
      professional_a2: 'car',
      professional_a3: 'truck',
      professional_a4: 'bus',
      professional_a5: 'settings',
      singular: 'star',
    };

    const colorMap: Record<string, CourseOption['color']> = {
      class_b: 'brand',
      class_b_sence: 'info',
      professional_a2: 'warning',
      professional_a3: 'warning',
      professional_a4: 'warning',
      professional_a5: 'warning',
      singular: 'default',
    };

    return {
      id: course.id,
      type,
      category,
      label: course.name,
      icon: iconMap[type] ?? 'book',
      color: colorMap[type] ?? 'brand',
      basePrice: course.base_price ?? 0,
      durationWeeks: course.duration_weeks ?? null,
      practicalHours: course.practical_hours ?? null,
    };
  }

  private courseTypeToLicenseClass(courseType: string): string {
    const map: Record<string, string> = {
      class_b: 'B',
      class_b_sence: 'B',
      professional_a2: 'A2',
      professional_a3: 'A3',
      professional_a4: 'A4',
      professional_a5: 'A5',
      singular: 'singular',
    };
    return map[courseType] ?? courseType;
  }

  private calculateAge(birthDate: string): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  private isStep2Complete(): boolean {
    const pd = this._personalData();
    if (!pd) return false;

    if (pd.courseCategory === 'non-professional') {
      return (
        this._selectedInstructorId() !== null &&
        this._selectedSlotIds().length > 0 &&
        this._paymentMode() !== null
      );
    }
    if (pd.courseCategory === 'professional') {
      return this._selectedPromotionCourseId() !== null;
    }
    // Singular: always complete (informational)
    return true;
  }

  private updateStepStatus(
    step: EnrollmentWizardStep,
    status: 'active' | 'completed' | 'error',
  ): void {
    this._steps.update((steps) => steps.map((s) => (s.step === step ? { ...s, status } : s)));
  }

  /** Deriva fecha ISO (YYYY-MM-DD) desde un timestamp. */
  private slotDateFromStart(slotStart: string | null | undefined): string {
    if (!slotStart) return '';
    const s = String(slotStart);
    return s.includes('T') ? s.split('T')[0]! : s.slice(0, 10);
  }

  /** Deriva hora HH:MM desde un timestamp. */
  private slotTimeFromTs(ts: string | null | undefined): string {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
  }

  private buildScheduleGrid(rawSlots: any[]): ScheduleGrid {
    // Vista expone slot_start/slot_end (timestamptz); no slot_date
    const dates = [...new Set(rawSlots.map((s) => this.slotDateFromStart(s.slot_start)))].sort();

    const days: WeekDay[] = dates.map((d) => {
      const date = new Date(d + 'T12:00:00Z');
      const dayFormatter = new Intl.DateTimeFormat('es', { weekday: 'short' });
      const labelFormatter = new Intl.DateTimeFormat('es', {
        day: 'numeric',
        month: 'short',
      });
      return {
        date: d,
        dayOfWeek: dayFormatter.format(date),
        label: labelFormatter.format(date),
      };
    });

    const week: WeekRange = {
      startDate: dates[0] ?? '',
      endDate: dates[dates.length - 1] ?? '',
      label: `${days[0]?.label ?? ''} – ${days[days.length - 1]?.label ?? ''}`,
      days,
    };

    const timeRows = [...new Set(rawSlots.map((s) => this.slotTimeFromTs(s.slot_start)))].sort();

    const slots: TimeSlot[] = rawSlots.map((s) => {
      const date = this.slotDateFromStart(s.slot_start);
      const startTime = this.slotTimeFromTs(s.slot_start);
      const endTime = this.slotTimeFromTs(s.slot_end);
      return {
        id: `${date}T${startTime}`,
        date,
        startTime,
        endTime,
        status: 'available' as const,
      };
    });

    return { week, timeRows, slots };
  }
}
