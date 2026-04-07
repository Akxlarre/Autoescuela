import { computed, inject, Injectable, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { EnrollmentDocumentsFacade } from '@core/facades/enrollment-documents.facade';
import { EnrollmentPaymentFacade } from '@core/facades/enrollment-payment.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';

import type { Enrollment } from '@core/models/dto/enrollment.model';
import { normalizeRutForStorage } from '@core/utils/rut.utils';
import { toISODate, to24hTime } from '@core/utils/date.utils';
import type { Course } from '@core/models/dto/course.model';
import type { BranchOption } from '@core/models/ui/branch.model';
import type {
  EnrollmentPersonalData,
  CourseCategory,
  CourseType,
  CourseOption,
  SenceCodeOption,
  CurrentLicenseType,
} from '@core/models/ui/enrollment-personal-data.model';
import type {
  InstructorOption,
  ScheduleGrid,
  SlotStatus,
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
  DraftSummary,
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
  private readonly auth = inject(AuthFacade);
  private readonly docsFacade = inject(EnrollmentDocumentsFacade);
  private readonly paymentFacade = inject(EnrollmentPaymentFacade);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly dmsViewer = inject(DmsViewerService);

  async confirm(config: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    severity?: 'info' | 'warn' | 'success' | 'danger' | 'secondary';
  }): Promise<boolean> {
    return this.confirmModal.confirm(config);
  }

  openDocument(url: string, fileName?: string): void {
    this.dmsViewer.openByUrl(url, fileName || 'Documento');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 1. ESTADO REACTIVO (Privado)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Draft anchor ──
  private readonly _draft = signal<EnrollmentDraft>({
    enrollmentId: null,
    studentId: null,
    userId: null,
  });

  // ── Active drafts (pending enrollments for draft list view) ──
  private readonly _activeDrafts = signal<DraftSummary[]>([]);

  // ── Wizard state ──
  private readonly _currentStep = signal<EnrollmentWizardStep>(1);
  private readonly _steps = signal<StepConfig[]>(structuredClone(ENROLLMENT_STEPS));
  private readonly _isSubmitting = signal(false);

  // ── Sedes disponibles (admin: todas; secretaria: solo la suya) ──
  private readonly _branches = signal<BranchOption[]>([]);

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

  // Número de sesiones requeridas según modalidad de pago y horas del curso
  private readonly _requiredSlotCount = computed<number>(() => {
    const pd = this._personalData();
    const mode = this._paymentMode();
    if (!pd || pd.courseCategory !== 'non-professional') return 0;
    const licenseClass = this.courseTypeToLicenseClass(pd.courseType);
    const course = this._courses().find((c) => c.license_class === licenseClass);
    const total = course?.practical_hours ? Math.round((course.practical_hours * 60) / 45) : 12;
    return mode === 'partial' ? Math.ceil(total / 2) : total;
  });

  // ── Enrollment record ──
  private readonly _enrollment = signal<Enrollment | null>(null);
  private readonly _contractFileUrl = signal<string | null>(null);

  // ── UI state ──
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // ── Realtime ──
  private _scheduleChannel: RealtimeChannel | null = null;
  private _realtimeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. ESTADO EXPUESTO (Público, solo lectura)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Branches ──
  readonly branches = this._branches.asReadonly();

  // ── Draft ──
  readonly draft = this._draft.asReadonly();
  readonly activeDrafts = this._activeDrafts.asReadonly();

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
  readonly contractFileUrl = this._contractFileUrl.asReadonly();

  // ── UI ──
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly courseOptions = computed<CourseOption[]>(() => {
    const result: CourseOption[] = [];
    for (const course of this._courses()) {
      const opt = this.mapCourseToOption(course);
      result.push(opt);
      if (opt.type === 'professional_a2') {
        result.push({ ...opt, label: 'Profesional A2 conv. A4', convalidation: true });
      } else if (opt.type === 'professional_a5') {
        result.push({ ...opt, label: 'Profesional A5 conv. A3', convalidation: true });
      }
    }
    return result;
  });

  /** Categorías ocultas: se oculta cualquier categoría sin cursos cargados.
   *  Singular siempre visible (cursos de tipo "otros" no tienen license_class). */
  readonly hiddenCourseCategories = computed<CourseCategory[]>(() => {
    const courses = this.courseOptions();
    const available = new Set(courses.map((c) => c.category));
    const checked: CourseCategory[] = ['non-professional', 'professional'];
    return checked.filter((cat) => !available.has(cat));
  });

  // ── Computed: Student summary banner (Steps 2-6) ──
  readonly studentSummary = computed<StudentSummaryBanner | null>(() => {
    const pd = this._personalData();
    if (!pd) return null;
    const fullName = `${pd.firstNames} ${pd.paternalLastName} ${pd.maternalLastName}`.trim();
    const initials = fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
    const course = this._courses().find(
      (c) => c.license_class === this.courseTypeToLicenseClass(pd.courseType),
    );
    const baseName = course?.name ?? pd.courseType;
    const convSuffix = pd.convalidatesSimultaneously
      ? ` + conv. ${pd.courseType === 'professional_a2' ? 'A4' : 'A3'}`
      : '';
    return {
      initials,
      fullName,
      courseLabel: baseName + convSuffix,
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

  /** Carga las sedes disponibles desde la BD (para que el admin pueda elegir). */
  async loadBranches(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('branches')
      .select('id, name, slug')
      .order('id');

    if (error) {
      this._error.set('Error al cargar sedes: ' + error.message);
      return;
    }

    this._branches.set(data ?? []);
  }

  /** Carga el catálogo de cursos activos para la sucursal del usuario. */
  async loadCourses(branchId?: number): Promise<void> {
    const user = this.auth.currentUser();
    const effectiveBranchId = branchId ?? user?.branchId;

    let query = this.supabase.client
      .from('courses')
      .select('*')
      .eq('active', true)
      // Excluir cursos CONV (is_convalidation=true): no son seleccionables en el wizard.
      // Son contenedores de sesiones internos; se crean en promotion_courses por la administración.
      .or('is_convalidation.is.null,is_convalidation.eq.false')
      .order('name');

    // Filtrar por sede: cada secretaria solo ve los cursos de su propia sede
    if (effectiveBranchId) {
      query = query.eq('branch_id', effectiveBranchId) as typeof query;
    }

    const { data, error } = await query;

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
    paternalLastName: string;
    maternalLastName: string;
    email: string;
    phone: string;
    birthDate: string | null;
    gender: string | null;
    address: string | null;
    currentLicense: string | null;
    licenseDate: string | null;
  } | null> {
    const { data: user, error } = await this.supabase.client
      .from('users')
      .select('id, first_names, paternal_last_name, maternal_last_name, email, phone')
      .eq('rut', normalizeRutForStorage(rut))
      .maybeSingle();

    if (error || !user) return null;

    const { data: student } = await this.supabase.client
      .from('students')
      .select('birth_date, gender, address, current_license_class, license_obtained_date')
      .eq('user_id', user.id)
      .maybeSingle();

    return {
      firstNames: user.first_names,
      paternalLastName: user.paternal_last_name,
      maternalLastName: user.maternal_last_name,
      email: user.email,
      phone: user.phone ?? '',
      birthDate: student?.birth_date ?? null,
      gender: student?.gender ?? null,
      address: student?.address ?? null,
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
      const course = this._courses().find((c) => c.id === courseId);
      if (existingDraft) {
        // Update existing draft (base_price incluido para corregir posibles drafts con valor incorrecto)
        enrollmentId = existingDraft.id;
        const { error } = await this.supabase.client
          .from('enrollments')
          .update({
            branch_id: branchId,
            sence_code_id: senceCodeId,
            base_price: course?.base_price ?? existingDraft.base_price,
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
            registration_channel: 'in_person',
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

      // 7. Sincronizar license_validations con la elección de convalidación.
      // Se hace aquí (Step 1) para que el contrato (Step 5) y la restauración
      // de drafts puedan leer el registro sin esperar a confirmEnrollment().
      if (data.courseCategory === 'professional') {
        if (data.convalidatesSimultaneously) {
          const convalidatedLicense = data.courseType === 'professional_a2' ? 'A4' : 'A3';
          const { error: lvError } = await this.supabase.client.from('license_validations').upsert(
            {
              enrollment_id: enrollmentId,
              convalidated_license: convalidatedLicense,
              convalidation_promotion_course_id: null,
              reduced_hours: 60,
            },
            { onConflict: 'enrollment_id' },
          );
          if (lvError) {
            this._error.set(
              `Error al registrar convalidación ${convalidatedLicense}: ${lvError.message}`,
            );
            return false;
          }
        } else {
          // El usuario desmarcó la convalidación (o retrocedió y cambió el curso):
          // eliminar cualquier registro previo para este enrollment.
          await this.supabase.client
            .from('license_validations')
            .delete()
            .eq('enrollment_id', enrollmentId);
        }
      }

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
      .eq('users.branch_id', branchId)
      // Solo la asignación activa (end_date IS NULL); excluye historial de vehículos
      .is('vehicle_assignments.end_date', null);

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
  async loadScheduleGrid(instructorId: number, preserveSlots = false): Promise<void> {
    this._selectedInstructorId.set(instructorId);
    if (!preserveSlots) {
      this._selectedSlotIds.set([]);
    }
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
      this.subscribeToScheduleChanges(instructorId);
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

    const licenseClass = this.courseTypeToLicenseClass(pd.courseType);

    const { data, error } = await this.supabase.client
      .from('promotion_courses')
      .select(
        `id,
         code,
         max_students,
         status,
         courses!inner(code, name, license_class),
         professional_promotions!promotion_id(code, name, status, branch_id)`,
      )
      .eq('courses.license_class', licenseClass)
      .eq('professional_promotions.branch_id', branchId)
      .in('professional_promotions.status', ['planned', 'in_progress'])
      .eq('status', 'active');

    if (error) {
      this._error.set('Error al cargar promociones: ' + error.message);
      return;
    }

    // Count enrolled students per promotion_course from enrollments table
    const pcIds = (data ?? []).map((r) => r.id);
    let enrolledCounts: Record<number, number> = {};
    if (pcIds.length > 0) {
      const { data: enrollData } = await this.supabase.client
        .from('enrollments')
        .select('promotion_course_id')
        .in('promotion_course_id', pcIds)
        .not('status', 'in', '("cancelled","draft")');
      if (enrollData) {
        enrolledCounts = enrollData.reduce((acc: Record<number, number>, e: any) => {
          acc[e.promotion_course_id] = (acc[e.promotion_course_id] ?? 0) + 1;
          return acc;
        }, {});
      }
    }

    // Orden canónico de clases profesionales
    const licenseOrder: Record<string, number> = { A2: 1, A3: 2, A4: 3, A5: 4 };

    // Ordenar filas crudas por license_class antes de agrupar
    const sorted = (data ?? []).slice().sort((a, b) => {
      const lcA = licenseOrder[(a.courses as any)?.license_class?.toUpperCase()] ?? 99;
      const lcB = licenseOrder[(b.courses as any)?.license_class?.toUpperCase()] ?? 99;
      return lcA - lcB;
    });

    // Group by promotion
    const groupMap = new Map<string, PromotionOption[]>();
    for (const row of sorted) {
      const promo = row.professional_promotions as any;
      const course = row.courses as any;
      // LEFT JOIN: si la promoción no coincide con branch/status, PostgREST devuelve null
      if (!promo) continue;
      const groupKey = `${promo.name} – ${promo.code}`;

      const option: PromotionOption = {
        id: row.id,
        code: (row as any).code ?? null,
        label: course.name,
        courseCode: course.code,
        enrolledCount: enrolledCounts[row.id] ?? 0,
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
          .is('end_date', null)
          .limit(1)
          .single();

        const vehicleId = assignment?.vehicle_id ?? null;

        // slotId = TIMESTAMPTZ original de v_class_b_schedule_availability
        // (ej: "2026-03-10T12:00:00+00:00") — se persiste directamente sin transformación
        const sessions = slots.map((slotId) => ({
          enrollment_id: draft.enrollmentId,
          instructor_id: instructorId,
          vehicle_id: vehicleId,
          scheduled_at: slotId,
          duration_min: 45,
          status: 'reserved',
        }));

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

        // Persistir modalidad de pago en enrollment para poder rehidratarla en drafts
        await this.supabase.client
          .from('enrollments')
          .update({
            payment_mode: this._paymentMode() ?? 'total',
            updated_at: new Date().toISOString(),
          })
          .eq('id', draft.enrollmentId);
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
      // Use a fixed key (without file.name) to avoid invalid characters (spaces, accents).
      // The original file name is preserved in the DB record (file_name column).
      const ext = file.name.split('.').pop() ?? 'pdf';
      const filePath = `contracts/${draft.enrollmentId}/contract.${ext}`;

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

      this._contractFileUrl.set(publicUrl);

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
      const registeredBy = this.auth.currentUser()?.dbId ?? null;
      const { error } = await this.supabase.client
        .from('enrollments')
        .update({
          number: enrollmentNumber,
          status: 'active',
          registered_by: registeredBy,
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

  /** Navega a un step específico y persiste en BD (fire-and-forget). */
  goToStep(step: EnrollmentWizardStep): void {
    this._currentStep.set(step);
    this.updateStepStatus(step, 'active');

    // Persistir current_step en BD (fire-and-forget, no bloquea UI)
    const enrollmentId = this._draft().enrollmentId;
    if (enrollmentId) {
      this.supabase.client
        .from('enrollments')
        .update({ current_step: step, updated_at: new Date().toISOString() })
        .eq('id', enrollmentId)
        .then();
    }
  }

  /** Retrocede un step. */
  goBack(): void {
    const current = this._currentStep();
    if (current > 1) {
      this.goToStep((current - 1) as EnrollmentWizardStep);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 4b. DRAFT RECOVERY — Detección, reanudación y descarte de borradores
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Carga los borradores activos (no expirados) para la sucursal dada.
   * Retorna DraftSummary[] con info suficiente para la lista de selección.
   */
  async loadActiveDrafts(): Promise<DraftSummary[]> {
    this._error.set(null);

    const { data, error } = await this.supabase.client
      .from('enrollments')
      .select(
        `id, current_step, created_at, expires_at,
         students!inner(
           id,
           users!inner(first_names, paternal_last_name, maternal_last_name, rut)
         ),
         courses!inner(name)`,
      )
      .eq('status', 'draft')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      this._error.set('Error al cargar borradores: ' + error.message);
      this._activeDrafts.set([]);
      return [];
    }

    const stepLabels: Record<number, string> = {
      1: 'Datos personales',
      2: 'Asignación',
      3: 'Documentos',
      4: 'Pago',
      5: 'Contrato',
      6: 'Confirmación',
    };

    const drafts: DraftSummary[] = (data ?? []).map((row: any) => {
      const user = row.students?.users;
      const fullName = user
        ? `${user.first_names} ${user.paternal_last_name} ${user.maternal_last_name ?? ''}`.trim()
        : 'Sin nombre';

      return {
        enrollmentId: row.id,
        studentName: fullName,
        studentRut: user?.rut ?? '',
        courseLabel: row.courses?.name ?? '',
        currentStep: row.current_step as EnrollmentWizardStep,
        stepLabel: stepLabels[row.current_step] ?? `Paso ${row.current_step}`,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      };
    });

    this._activeDrafts.set(drafts);
    return drafts;
  }

  /**
   * Reanuda un borrador existente: rehidrata los 3 facades desde la BD.
   * Carga datos personales, asignación, documentos, pagos y contrato según el paso.
   */
  async resumeDraft(enrollmentId: number): Promise<boolean> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      // 1. Cargar el enrollment completo
      const { data: enrollment, error: enrollError } = await this.supabase.client
        .from('enrollments')
        .select('*')
        .eq('id', enrollmentId)
        .single();

      if (enrollError || !enrollment) {
        this._error.set('Error al cargar borrador: ' + (enrollError?.message ?? 'No encontrado'));
        return false;
      }

      this._enrollment.set(enrollment);

      // 1b. Extender expires_at 24h desde ahora para evitar que el draft
      //     expire durante una sesión activa de reanudación.
      await this.supabase.client
        .from('enrollments')
        .update({ expires_at: this.getDraftExpiry() })
        .eq('id', enrollmentId);

      // 2. Cargar student + user para reconstruir personalData
      const { data: student } = await this.supabase.client
        .from('students')
        .select(
          `id, birth_date, gender, address, is_minor, current_license_class, license_obtained_date,
           users!inner(id, rut, first_names, paternal_last_name, maternal_last_name, email, phone)`,
        )
        .eq('id', enrollment.student_id)
        .single();

      if (!student) {
        this._error.set('Error al cargar datos del alumno');
        return false;
      }

      const user = (student as any).users;

      // 3. Cargar cursos para resolver courseType
      await this.loadCourses();
      const course = this._courses().find((c) => c.id === enrollment.course_id);

      if (!course) {
        this._error.set('No se encontró el curso asociado al borrador');
        return false;
      }

      // 4. Reconstruir personalData desde BD
      const courseOption = this.mapCourseToOption(course);
      const personalData: EnrollmentPersonalData = {
        rut: user.rut ?? '',
        firstNames: user.first_names ?? '',
        paternalLastName: user.paternal_last_name ?? '',
        maternalLastName: user.maternal_last_name ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
        birthDate: student.birth_date ?? '',
        gender: student.gender ?? '',
        address: student.address ?? '',
        courseCategory: courseOption.category,
        courseType: courseOption.type,
        singularCourseCode: null,
        senceCode: null,
        currentLicense: (student.current_license_class as CurrentLicenseType) ?? null,
        licenseDate: student.license_obtained_date ?? null,
        convalidatesSimultaneously: false, // se actualiza abajo si existe registro
        validationBook: null,
        historicalPromotionId: null,
        courses: this._courses().map((c) => this.mapCourseToOption(c)),
      };

      // 4b. Restaurar convalidatesSimultaneously desde license_validations
      if (courseOption.category === 'professional') {
        const { data: lv } = await this.supabase.client
          .from('license_validations')
          .select('convalidated_license')
          .eq('enrollment_id', enrollment.id)
          .maybeSingle();
        if (lv) {
          personalData.convalidatesSimultaneously = true;
        }
      }

      this._personalData.set(personalData);
      this._draft.set({
        enrollmentId: enrollment.id,
        studentId: student.id,
        userId: user.id,
      });

      // 5. Rehidratar step 2 (asignación) si el paso es >= 2
      const currentStep = enrollment.current_step as EnrollmentWizardStep;

      // Restaurar payment_mode (guardado en paso 2)
      if (enrollment.payment_mode) {
        this._paymentMode.set(enrollment.payment_mode as PaymentMode);
      }

      if (currentStep >= 2 && courseOption.category === 'non-professional') {
        // Cargar sesiones reservadas para reconstruir slots seleccionados
        const { data: sessions } = await this.supabase.client
          .from('class_b_sessions')
          .select('scheduled_at, instructor_id')
          .eq('enrollment_id', enrollmentId)
          .eq('status', 'reserved');

        if (sessions && sessions.length > 0) {
          const instructorId = sessions[0].instructor_id;
          this._selectedInstructorId.set(instructorId);
          this._selectedSlotIds.set(sessions.map((s: any) => String(s.scheduled_at)));
        }
      } else if (currentStep >= 2 && courseOption.category === 'professional') {
        // Cargar lista de promociones para que el paso 2 tenga opciones disponibles
        await this.loadPromotions(enrollment.branch_id, 'professional');
        if (enrollment.promotion_course_id) {
          this._selectedPromotionCourseId.set(enrollment.promotion_course_id);
        }
      }

      // 6. Rehidratar step 3 (documentos) si el paso es >= 3
      if (currentStep >= 3) {
        await this.docsFacade.loadDocuments(enrollmentId);
      }

      // 7. Rehidratar step 4 (pago) si el paso es >= 4
      if (currentStep >= 4) {
        await this.paymentFacade.rehydrateFromEnrollment(enrollmentId);
      }

      // 8. Setear step actual y marcar pasos anteriores como completed
      for (let s = 1; s < currentStep; s++) {
        this.updateStepStatus(s as EnrollmentWizardStep, 'completed');
      }
      this._currentStep.set(currentStep);
      this.updateStepStatus(currentStep, 'active');

      // Limpiar la lista de drafts (ya se eligió uno)
      this._activeDrafts.set([]);

      return true;
    } catch {
      this._error.set('Error inesperado al reanudar borrador');
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Descarta un borrador: elimina todos los datos asociados y el enrollment.
   * Actualiza la lista de drafts activos.
   */
  async discardDraft(enrollmentId: number): Promise<boolean> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      // Eliminar carpeta completa del estudiante en storage antes de borrar registros BD
      const folderPrefix = `students/${enrollmentId}/`;
      const { data: storageFiles } = await this.supabase.client.storage
        .from('documents')
        .list(folderPrefix);

      if (storageFiles && storageFiles.length > 0) {
        const filePaths = storageFiles.map((f) => `${folderPrefix}${f.name}`);
        await this.supabase.client.storage.from('documents').remove(filePaths);
      }

      // Eliminar datos asociados en orden (respetando FKs)
      await this.supabase.client
        .from('class_b_sessions')
        .delete()
        .eq('enrollment_id', enrollmentId)
        .eq('status', 'reserved');

      await this.supabase.client
        .from('discount_applications')
        .delete()
        .eq('enrollment_id', enrollmentId);

      await this.supabase.client.from('payments').delete().eq('enrollment_id', enrollmentId);

      await this.supabase.client
        .from('student_documents')
        .delete()
        .eq('enrollment_id', enrollmentId);

      await this.supabase.client
        .from('digital_contracts')
        .delete()
        .eq('enrollment_id', enrollmentId);

      const { error } = await this.supabase.client
        .from('enrollments')
        .delete()
        .eq('id', enrollmentId);

      if (error) {
        this._error.set('Error al descartar borrador: ' + error.message);
        return false;
      }

      // Actualizar lista local de drafts
      this._activeDrafts.update((drafts) => drafts.filter((d) => d.enrollmentId !== enrollmentId));

      return true;
    } catch {
      this._error.set('Error inesperado al descartar borrador');
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // REALTIME — Suscripción a cambios en class_b_sessions
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Suscribe al canal Realtime de `class_b_sessions` filtrado por instructor.
   * Cada INSERT/UPDATE/DELETE dispara un re-query debounced de la vista.
   */
  private subscribeToScheduleChanges(instructorId: number): void {
    this.unsubscribeFromScheduleChanges();

    this._scheduleChannel = this.supabase.client
      .channel(`schedule-instructor-${instructorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'class_b_sessions',
          filter: `instructor_id=eq.${instructorId}`,
        },
        () => this.handleScheduleChange(instructorId),
      )
      .subscribe();
  }

  /**
   * Re-query debounced de la vista de disponibilidad.
   * Preserva slots seleccionados que sigan disponibles y auto-deselecciona los ocupados.
   */
  private handleScheduleChange(instructorId: number): void {
    if (this._realtimeDebounceTimer) clearTimeout(this._realtimeDebounceTimer);

    this._realtimeDebounceTimer = setTimeout(async () => {
      const currentSelected = this._selectedSlotIds();

      const { data, error } = await this.supabase.client
        .from('v_class_b_schedule_availability')
        .select('*')
        .eq('instructor_id', instructorId)
        .order('slot_start', { ascending: true });

      if (error || !data || data.length === 0) return;

      const newGrid = this.buildScheduleGrid(data);
      this._scheduleGrid.set(newGrid);

      // Auto-deseleccionar slots que pasaron a occupied
      const availableIds = new Set(
        newGrid.slots.filter((s) => s.status === 'available').map((s) => s.id),
      );
      const validSelections = currentSelected.filter((id) => availableIds.has(id));
      if (validSelections.length !== currentSelected.length) {
        this._selectedSlotIds.set(validSelections);
      }
    }, 300);
  }

  /** Limpia el canal Realtime y el timer de debounce. */
  private unsubscribeFromScheduleChanges(): void {
    if (this._realtimeDebounceTimer) {
      clearTimeout(this._realtimeDebounceTimer);
      this._realtimeDebounceTimer = null;
    }
    if (this._scheduleChannel) {
      this.supabase.client.removeChannel(this._scheduleChannel);
      this._scheduleChannel = null;
    }
  }

  /** Resetea todo el estado del wizard para una nueva matrícula. */
  reset(): void {
    this.unsubscribeFromScheduleChanges();
    this._draft.set({ enrollmentId: null, studentId: null, userId: null });
    this._currentStep.set(1);
    this._steps.set(structuredClone(ENROLLMENT_STEPS));
    this._isSubmitting.set(false);
    this._personalData.set(null);
    this._courses.set([]);
    this._branches.set([]);
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
    this._contractFileUrl.set(null);
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
    const normalizedRut = normalizeRutForStorage(data.rut);
    const updatePayload: Record<string, unknown> = {
      first_names: data.firstNames || undefined,
      paternal_last_name: data.paternalLastName || undefined,
      maternal_last_name: data.maternalLastName || undefined,
      branch_id: branchId,
      updated_at: new Date().toISOString(),
    };
    // Only include email/phone if non-empty — prevents accidental overwrites with empty strings.
    if (data.email) updatePayload['email'] = data.email;
    if (data.phone) updatePayload['phone'] = data.phone;

    // If we already have a userId (resuming a draft), skip the RUT lookup and update directly.
    // This avoids a 409 conflict when RLS prevents the SELECT from returning the existing row.
    const knownUserId = this._draft().userId;
    if (knownUserId) {
      const { error } = await this.supabase.client
        .from('users')
        .update(updatePayload)
        .eq('id', knownUserId);

      if (error) {
        this._error.set('Error al actualizar usuario: ' + error.message);
        return null;
      }
      return knownUserId;
    }

    // Try to find existing user by RUT
    const { data: existing } = await this.supabase.client
      .from('users')
      .select('id')
      .eq('rut', normalizedRut)
      .maybeSingle();

    if (existing) {
      // Update existing user
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

    // Create new user (role_id for student)
    const { data: studentRole } = await this.supabase.client
      .from('roles')
      .select('id')
      .eq('name', 'student')
      .single();

    const { data: newUser, error } = await this.supabase.client
      .from('users')
      .insert({
        rut: normalizedRut,
        first_names: data.firstNames,
        paternal_last_name: data.paternalLastName,
        maternal_last_name: data.maternalLastName,
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
    const isMinor = this.calculateAge(data.birthDate) < 18;
    const updatePayload = {
      birth_date: data.birthDate || null,
      gender: data.gender || null,
      address: data.address || null,
      is_minor: isMinor,
      current_license_class: data.currentLicense || null,
      license_obtained_date: data.licenseDate || null,
      status: 'active',
    };

    // If we already have a studentId (resuming a draft), update directly by id.
    const knownStudentId = this._draft().studentId;
    if (knownStudentId) {
      const { error } = await this.supabase.client
        .from('students')
        .update(updatePayload)
        .eq('id', knownStudentId);

      if (error) {
        this._error.set('Error al actualizar alumno: ' + error.message);
        return null;
      }
      return knownStudentId;
    }

    const { data: existing } = await this.supabase.client
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const { error } = await this.supabase.client
        .from('students')
        .update(updatePayload)
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
        birth_date: data.birthDate || null,
        gender: data.gender || null,
        address: data.address || null,
        is_minor: isMinor,
        has_notarial_auth: false,
        current_license_class: data.currentLicense || null,
        license_obtained_date: data.licenseDate || null,
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
    // Primera opción: usar el id del CourseOption ya cargado en personalData
    // (contiene el id real de BD, diferencia SENCE vs no-SENCE directamente)
    const option = data.courses.find((c) => c.type === data.courseType);
    if (option) return option.id;

    // Fallback: buscar en _courses por licencia y sede
    // Para SENCE vs no-SENCE, filtrar por si el código incluye 'sence'
    const licenseClass = this.courseTypeToLicenseClass(data.courseType);
    const isSence = data.courseType.includes('sence');
    const course = this._courses().find(
      (c) =>
        c.license_class === licenseClass &&
        c.branch_id === branchId &&
        (isSence
          ? c.code?.toLowerCase().includes('sence')
          : !c.code?.toLowerCase().includes('sence')),
    );

    if (!course) {
      this._error.set(`No se encontró un curso activo para la clase ${licenseClass} en esta sede`);
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
    const courseId = this._enrollment()?.course_id;
    if (!courseId) {
      this._error.set('Error: no se pudo determinar el curso para la numeración');
      return null;
    }

    // RPC que devuelve el siguiente número secuencial separado por tipo de licencia:
    // Clase B (license_class = 'B') y Profesional (A2/A3/A4) tienen secuencias independientes.
    const { data, error } = await this.supabase.client.rpc('get_next_enrollment_number', {
      p_course_id: courseId,
    });

    if (error) {
      this._error.set('Error al generar número de matrícula: ' + error.message);
      return null;
    }

    return data as string;
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
      const required = this._requiredSlotCount();
      return (
        this._selectedInstructorId() !== null &&
        this._paymentMode() !== null &&
        required > 0 &&
        this._selectedSlotIds().length >= required
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

  /** Deriva fecha ISO (YYYY-MM-DD) desde un timestamp, en hora local Santiago. */
  private slotDateFromStart(slotStart: string | null | undefined): string {
    if (!slotStart) return '';
    return toISODate(slotStart);
  }

  /** Deriva hora HH:MM desde un timestamp, en hora local Santiago. */
  private slotTimeFromTs(ts: string | null | undefined): string {
    if (!ts) return '';
    return to24hTime(ts);
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
        // ID = TIMESTAMPTZ original de la vista; permite persistirlo directamente
        // en class_b_sessions.scheduled_at sin reconstrucción ni pérdida de zona
        id: String(s.slot_start),
        date,
        startTime,
        endTime,
        status: (s.slot_status === 'occupied' ? 'occupied' : 'available') as SlotStatus,
      };
    });

    return { week, timeRows, slots };
  }
}
