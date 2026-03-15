import { computed, inject, Injectable, signal } from '@angular/core';

import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { normalizeRutForStorage } from '@core/utils/rut.utils';
import type { Course } from '@core/models/dto/course.model';
import type { BranchOption, BranchCoursePrice } from '@core/models/ui/branch.model';
import type {
  EnrollmentPersonalData,
  CourseCategory,
  CourseType,
  CourseOption,
} from '@core/models/ui/enrollment-personal-data.model';
import type {
  InstructorOption,
  ScheduleGrid,
  SlotStatus,
  TimeSlot,
  WeekDay,
  WeekRange,
  PaymentMode,
  StudentSummaryBanner,
} from '@core/models/ui/enrollment-assignment.model';

// ─── Public enrollment step types ───

export type PublicFlowType = 'class_b' | 'professional';

export type PublicWizardStep =
  | 'branch'
  | 'personal-data'
  | 'payment-mode'
  | 'schedule'
  | 'documents'
  | 'contract'
  | 'confirmation'
  | 'course-selection'
  | 'pre-confirmation';

interface PublicStepConfig {
  id: PublicWizardStep;
  label: string;
  status: 'pending' | 'active' | 'completed';
}

/** Result from the Edge Function after successful enrollment. */
export interface PublicEnrollmentResult {
  success: boolean;
  enrollmentNumber?: string;
  message?: string;
}

/**
 * PublicEnrollmentFacade — Orquestador de matrícula online pública.
 *
 * A diferencia de EnrollmentFacade (admin/secretaria):
 * - NO depende de AuthFacade (no hay usuario autenticado)
 * - Writes van via Edge Function `public-enrollment` (SERVICE_ROLE_KEY bypass RLS)
 * - Reads de branches/courses son directos (RLS anón)
 * - Reads de instructors/schedule van via Edge Function (RLS no permite anón)
 * - El estado del wizard es puramente client-side hasta el submit final
 */
@Injectable({ providedIn: 'root' })
export class PublicEnrollmentFacade {
  private readonly supabase = inject(SupabaseService);

  // ══════════════════════════════════════════════════════════════════════════════
  // 1. ESTADO REACTIVO (Privado)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Branch & flow ──
  private readonly _branches = signal<BranchOption[]>([]);
  private readonly _branchCoursePricing = signal<Map<number, BranchCoursePrice[]>>(new Map());
  private readonly _selectedBranch = signal<BranchOption | null>(null);
  private readonly _flowType = signal<PublicFlowType | null>(null);

  // ── Wizard ──
  private readonly _currentStep = signal<PublicWizardStep>('branch');
  private readonly _steps = signal<PublicStepConfig[]>([]);
  private readonly _isSubmitting = signal(false);

  // ── Courses ──
  private readonly _courses = signal<Course[]>([]);

  // ── Personal data ──
  private readonly _personalData = signal<EnrollmentPersonalData | null>(null);

  // ── Assignment (Class B) ──
  private readonly _instructors = signal<InstructorOption[]>([]);
  private readonly _scheduleGrid = signal<ScheduleGrid | null>(null);
  private readonly _selectedSlotIds = signal<string[]>([]);
  private readonly _paymentMode = signal<PaymentMode | null>(null);
  private readonly _selectedInstructorId = signal<number | null>(null);

  // ── Professional pre-inscription ──
  private readonly _selectedCourseType = signal<CourseType | null>(null);
  private readonly _convalidatesSimultaneously = signal(false);

  // ── Documents ──
  private readonly _carnetPhotoFile = signal<File | null>(null);

  // ── Contract ──
  private readonly _contractPdfUrl = signal<string | null>(null);
  private readonly _signedContractFile = signal<File | null>(null);

  // ── Result ──
  private readonly _result = signal<PublicEnrollmentResult | null>(null);

  // ── UI state ──
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // ── Schedule polling (Realtime no disponible para anón) ──
  private _schedulePollingInterval: ReturnType<typeof setInterval> | null = null;

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. ESTADO EXPUESTO (Público, solo lectura)
  // ══════════════════════════════════════════════════════════════════════════════

  readonly branches = this._branches.asReadonly();
  readonly branchCoursePricing = this._branchCoursePricing.asReadonly();
  readonly selectedBranch = this._selectedBranch.asReadonly();
  readonly flowType = this._flowType.asReadonly();
  readonly currentStep = this._currentStep.asReadonly();
  readonly steps = this._steps.asReadonly();
  readonly isSubmitting = this._isSubmitting.asReadonly();
  readonly personalData = this._personalData.asReadonly();
  readonly instructors = this._instructors.asReadonly();
  readonly scheduleGrid = this._scheduleGrid.asReadonly();
  readonly selectedSlotIds = this._selectedSlotIds.asReadonly();
  readonly paymentMode = this._paymentMode.asReadonly();
  readonly selectedInstructorId = this._selectedInstructorId.asReadonly();
  readonly selectedCourseType = this._selectedCourseType.asReadonly();
  readonly convalidatesSimultaneously = this._convalidatesSimultaneously.asReadonly();
  readonly carnetPhotoFile = this._carnetPhotoFile.asReadonly();
  readonly contractPdfUrl = this._contractPdfUrl.asReadonly();
  readonly signedContractFile = this._signedContractFile.asReadonly();
  readonly result = this._result.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  // ── Computed: course options (sin SENCE, sin singular) ──
  readonly courseOptions = computed<CourseOption[]>(() => {
    const result: CourseOption[] = [];
    for (const course of this._courses()) {
      const opt = this.mapCourseToOption(course);
      // Filtrar SENCE y singular de la vista pública
      if (opt.type === 'class_b_sence' || opt.category === 'singular') continue;
      result.push(opt);
      // Agregar variantes de convalidación
      if (opt.type === 'professional_a2') {
        result.push({ ...opt, label: 'Profesional A2 conv. A4', convalidation: true });
      } else if (opt.type === 'professional_a5') {
        result.push({ ...opt, label: 'Profesional A5 conv. A3', convalidation: true });
      }
    }
    return result;
  });

  /** Categorías ocultas según los cursos disponibles para la sede. */
  readonly hiddenCourseCategories = computed<CourseCategory[]>(() => {
    const courses = this.courseOptions();
    const available = new Set(courses.map((c) => c.category));
    const checked: CourseCategory[] = ['non-professional', 'professional'];
    // Siempre ocultar singular en vista pública
    const hidden = checked.filter((cat) => !available.has(cat));
    hidden.push('singular');
    return hidden;
  });

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
    return { initials, fullName, courseLabel: course?.name ?? pd.courseType };
  });

  /** Número de slots requeridos según modalidad de pago. */
  readonly requiredSlotCount = computed<number>(() => {
    const pd = this._personalData();
    const mode = this._paymentMode();
    if (!pd || pd.courseCategory !== 'non-professional') return 0;
    const licenseClass = this.courseTypeToLicenseClass(pd.courseType);
    const course = this._courses().find((c) => c.license_class === licenseClass);
    const total = course?.practical_hours ? Math.round((course.practical_hours * 60) / 45) : 12;
    return mode === 'partial' ? Math.ceil(total / 2) : total;
  });

  /** Indica si el paso actual puede avanzar. */
  readonly canAdvance = computed<boolean>(() => {
    const step = this._currentStep();
    switch (step) {
      case 'branch':
        return this._selectedBranch() !== null && this._flowType() !== null;
      case 'personal-data':
        return this._personalData() !== null;
      case 'payment-mode':
        return this._paymentMode() !== null;
      case 'schedule':
        return (
          this._selectedInstructorId() !== null &&
          this._selectedSlotIds().length >= this.requiredSlotCount()
        );
      case 'documents':
        return this._carnetPhotoFile() !== null;
      case 'contract':
        return this._signedContractFile() !== null;
      case 'course-selection':
        return this._selectedCourseType() !== null;
      default:
        return false;
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Branch & Flow
  // ══════════════════════════════════════════════════════════════════════════════

  /** Carga las sedes desde la BD (lectura anónima). */
  async loadBranches(): Promise<void> {
    this._isLoading.set(true);
    try {
      const [branchRes, courseRes] = await Promise.all([
        this.supabase.client.from('branches').select('id, name, slug, address').order('id'),
        this.supabase.client
          .from('courses')
          .select('id, code, name, base_price, license_class, branch_id')
          .eq('active', true)
          .or('is_convalidation.is.null,is_convalidation.eq.false')
          .order('name'),
      ]);

      if (branchRes.error) {
        this._error.set('Error al cargar sedes: ' + branchRes.error.message);
        return;
      }
      this._branches.set(branchRes.data ?? []);

      // Build pricing map grouped by branch
      if (!courseRes.error && courseRes.data) {
        const pricingMap = new Map<number, BranchCoursePrice[]>();
        for (const c of courseRes.data) {
          if (!c.branch_id) continue;
          // Excluir SENCE y singular de la vista pública
          if (c.code?.includes('sence')) continue;
          const list = pricingMap.get(c.branch_id) ?? [];
          list.push({
            name: c.name,
            price: c.base_price ?? 0,
            licenseClass: c.license_class ?? '',
          });
          pricingMap.set(c.branch_id, list);
        }
        this._branchCoursePricing.set(pricingMap);
      }
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Selecciona una sede y carga sus cursos. */
  async selectBranch(branch: BranchOption): Promise<void> {
    this._selectedBranch.set(branch);
    this._flowType.set(null);
    await this.loadCourses(branch.id);
  }

  /** Selecciona el tipo de flujo (class_b o professional). */
  selectFlowType(flow: PublicFlowType): void {
    this._flowType.set(flow);
    this.buildSteps(flow);
  }

  /** Confirma la selección de sede+flujo y avanza. */
  confirmBranchSelection(): void {
    const flow = this._flowType();
    if (!flow) return;
    this.buildSteps(flow);
    this._currentStep.set('personal-data');
    this.updateStepStatus('personal-data', 'active');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Personal Data
  // ══════════════════════════════════════════════════════════════════════════════

  /** Guarda los datos personales (solo estado local). */
  savePersonalData(data: EnrollmentPersonalData): void {
    this._personalData.set(data);
    this.updateStepStatus('personal-data', 'completed');

    const flow = this._flowType();
    if (flow === 'class_b') {
      this._currentStep.set('payment-mode');
      this.updateStepStatus('payment-mode', 'active');
    } else {
      this._currentStep.set('course-selection');
      this.updateStepStatus('course-selection', 'active');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Assignment (Class B)
  // ══════════════════════════════════════════════════════════════════════════════

  /** Establece la modalidad de pago y avanza al horario. */
  setPaymentMode(mode: PaymentMode): void {
    this._paymentMode.set(mode);
  }

  confirmPaymentMode(): void {
    this.updateStepStatus('payment-mode', 'completed');
    this._currentStep.set('schedule');
    this.updateStepStatus('schedule', 'active');
  }

  /** Carga instructores con vehículo activo para la sede via Edge Function. */
  async loadInstructors(branchId: number): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const { data, error } = await this.supabase.client.functions.invoke('public-enrollment', {
        body: { action: 'load-instructors', branchId },
      });

      if (error) {
        this._error.set('Error al cargar instructores: ' + error.message);
        return;
      }
      this._instructors.set(data?.instructors ?? []);
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Carga la grilla de horarios para un instructor via Edge Function. */
  async loadScheduleGrid(instructorId: number): Promise<void> {
    this._selectedInstructorId.set(instructorId);
    this._selectedSlotIds.set([]);
    this._scheduleGrid.set(null);
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const { data, error } = await this.supabase.client.functions.invoke('public-enrollment', {
        body: { action: 'load-schedule', instructorId },
      });

      if (error) {
        this._error.set('Error al cargar disponibilidad: ' + error.message);
        return;
      }

      if (data?.grid) {
        this._scheduleGrid.set(data.grid as ScheduleGrid);
        this.startSchedulePolling(instructorId);
      }
    } finally {
      this._isLoading.set(false);
    }
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

  /** Establece los slots seleccionados directamente. */
  setSelectedSlots(slotIds: string[]): void {
    this._selectedSlotIds.set(slotIds);
  }

  /** Confirma la selección de horario y avanza a documentos. */
  confirmSchedule(): void {
    this.updateStepStatus('schedule', 'completed');
    this._currentStep.set('documents');
    this.updateStepStatus('documents', 'active');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Documents
  // ══════════════════════════════════════════════════════════════════════════════

  /** Guarda el archivo de foto de carnet (solo estado local). */
  setCarnetPhoto(file: File): void {
    this._carnetPhotoFile.set(file);
  }

  /** Confirma documentos y avanza al contrato. */
  confirmDocuments(): void {
    this.updateStepStatus('documents', 'completed');
    this._currentStep.set('contract');
    this.updateStepStatus('contract', 'active');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Contract
  // ══════════════════════════════════════════════════════════════════════════════

  /** Guarda el contrato firmado (solo estado local). */
  setSignedContract(file: File): void {
    this._signedContractFile.set(file);
  }

  /** Confirma contrato y avanza a confirmación. */
  confirmContract(): void {
    this.updateStepStatus('contract', 'completed');
    this._currentStep.set('confirmation');
    this.updateStepStatus('confirmation', 'active');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Professional Pre-inscription
  // ══════════════════════════════════════════════════════════════════════════════

  /** Selecciona el curso profesional para pre-inscripción. */
  selectProfessionalCourse(courseType: CourseType, convalidation: boolean): void {
    this._selectedCourseType.set(courseType);
    this._convalidatesSimultaneously.set(convalidation);
  }

  /** Confirma selección de curso y avanza a confirmación. */
  confirmCourseSelection(): void {
    this.updateStepStatus('course-selection', 'completed');
    this._currentStep.set('pre-confirmation');
    this.updateStepStatus('pre-confirmation', 'active');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Submit
  // ══════════════════════════════════════════════════════════════════════════════

  /** Envía la matrícula completa de Clase B via Edge Function. */
  async submitClaseBEnrollment(): Promise<PublicEnrollmentResult> {
    this._isSubmitting.set(true);
    this._error.set(null);

    try {
      const pd = this._personalData();
      const branch = this._selectedBranch();
      if (!pd || !branch) {
        return { success: false, message: 'Datos incompletos' };
      }

      const { data, error } = await this.supabase.client.functions.invoke('public-enrollment', {
        body: {
          action: 'submit-clase-b',
          branchId: branch.id,
          personalData: {
            rut: normalizeRutForStorage(pd.rut),
            firstNames: pd.firstNames,
            paternalLastName: pd.paternalLastName,
            maternalLastName: pd.maternalLastName,
            email: pd.email,
            phone: pd.phone,
            birthDate: pd.birthDate,
            gender: pd.gender,
            address: pd.address,
            courseType: pd.courseType,
          },
          paymentMode: this._paymentMode(),
          instructorId: this._selectedInstructorId(),
          selectedSlotIds: this._selectedSlotIds(),
        },
      });

      if (error) {
        this._error.set('Error al enviar matrícula: ' + error.message);
        return { success: false, message: error.message };
      }

      const result: PublicEnrollmentResult = {
        success: true,
        enrollmentNumber: data?.enrollmentNumber,
      };
      this._result.set(result);
      this.updateStepStatus('confirmation', 'completed');
      return result;
    } catch {
      this._error.set('Error inesperado al enviar matrícula');
      return { success: false, message: 'Error inesperado' };
    } finally {
      this._isSubmitting.set(false);
    }
  }

  /** Envía la pre-inscripción profesional via Edge Function. */
  async submitPreInscription(): Promise<PublicEnrollmentResult> {
    this._isSubmitting.set(true);
    this._error.set(null);

    try {
      const pd = this._personalData();
      const branch = this._selectedBranch();
      const courseType = this._selectedCourseType();
      if (!pd || !branch || !courseType) {
        return { success: false, message: 'Datos incompletos' };
      }

      const { data, error } = await this.supabase.client.functions.invoke('public-enrollment', {
        body: {
          action: 'submit-pre-inscription',
          branchId: branch.id,
          personalData: {
            rut: normalizeRutForStorage(pd.rut),
            firstNames: pd.firstNames,
            paternalLastName: pd.paternalLastName,
            maternalLastName: pd.maternalLastName,
            email: pd.email,
            phone: pd.phone,
            birthDate: pd.birthDate,
            gender: pd.gender,
            address: pd.address,
          },
          courseType,
          convalidatesSimultaneously: this._convalidatesSimultaneously(),
        },
      });

      if (error) {
        this._error.set('Error al enviar pre-inscripción: ' + error.message);
        return { success: false, message: error.message };
      }

      const result: PublicEnrollmentResult = { success: true, message: data?.message };
      this._result.set(result);
      this.updateStepStatus('pre-confirmation', 'completed');
      return result;
    } catch {
      this._error.set('Error inesperado al enviar pre-inscripción');
      return { success: false, message: 'Error inesperado' };
    } finally {
      this._isSubmitting.set(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 4. WIZARD NAVIGATION
  // ══════════════════════════════════════════════════════════════════════════════

  goToStep(step: PublicWizardStep): void {
    this._currentStep.set(step);
    this.updateStepStatus(step, 'active');
  }

  goBack(): void {
    const flow = this._flowType();
    const current = this._currentStep();

    const classBOrder: PublicWizardStep[] = [
      'branch',
      'personal-data',
      'payment-mode',
      'schedule',
      'documents',
      'contract',
      'confirmation',
    ];
    const professionalOrder: PublicWizardStep[] = [
      'branch',
      'personal-data',
      'course-selection',
      'pre-confirmation',
    ];

    const order = flow === 'professional' ? professionalOrder : classBOrder;
    const idx = order.indexOf(current);
    if (idx > 0) {
      this._currentStep.set(order[idx - 1]);
    }
  }

  /** Resetea todo el estado para una nueva matrícula. */
  // ══════════════════════════════════════════════════════════════════════════════
  // POLLING — Actualización periódica de disponibilidad (sin Realtime para anón)
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Inicia polling cada 15s para re-consultar disponibilidad via Edge Function.
   * Supabase Realtime no funciona para usuarios anónimos (RLS deniega SELECT
   * en class_b_sessions al rol anon), por lo que usamos polling como fallback.
   */
  private startSchedulePolling(instructorId: number): void {
    this.stopSchedulePolling();

    this._schedulePollingInterval = setInterval(async () => {
      const currentSelected = this._selectedSlotIds();

      const { data, error } = await this.supabase.client.functions.invoke('public-enrollment', {
        body: { action: 'load-schedule', instructorId },
      });

      if (error || !data?.grid) return;

      const newGrid = data.grid as ScheduleGrid;
      this._scheduleGrid.set(newGrid);

      // Auto-deseleccionar slots que pasaron a occupied
      const availableIds = new Set(
        newGrid.slots.filter((s) => s.status === 'available').map((s) => s.id),
      );
      const validSelections = currentSelected.filter((id) => availableIds.has(id));
      if (validSelections.length !== currentSelected.length) {
        this._selectedSlotIds.set(validSelections);
      }
    }, 15_000);
  }

  /** Detiene el polling de disponibilidad. */
  private stopSchedulePolling(): void {
    if (this._schedulePollingInterval) {
      clearInterval(this._schedulePollingInterval);
      this._schedulePollingInterval = null;
    }
  }

  reset(): void {
    this.stopSchedulePolling();
    this._selectedBranch.set(null);
    this._flowType.set(null);
    this._currentStep.set('branch');
    this._steps.set([]);
    this._isSubmitting.set(false);
    this._courses.set([]);
    this._personalData.set(null);
    this._instructors.set([]);
    this._scheduleGrid.set(null);
    this._selectedSlotIds.set([]);
    this._paymentMode.set(null);
    this._selectedInstructorId.set(null);
    this._selectedCourseType.set(null);
    this._convalidatesSimultaneously.set(false);
    this._carnetPhotoFile.set(null);
    this._contractPdfUrl.set(null);
    this._signedContractFile.set(null);
    this._result.set(null);
    this._isLoading.set(false);
    this._error.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 5. MÉTODOS PRIVADOS
  // ══════════════════════════════════════════════════════════════════════════════

  /** Carga cursos activos (sin convalidaciones) para la sede dada. */
  private async loadCourses(branchId: number): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('courses')
      .select('*')
      .eq('active', true)
      .or('is_convalidation.is.null,is_convalidation.eq.false')
      .eq('branch_id', branchId)
      .order('name');

    if (error) {
      this._error.set('Error al cargar cursos: ' + error.message);
      return;
    }
    this._courses.set(data ?? []);
  }

  private buildSteps(flow: PublicFlowType): void {
    if (flow === 'class_b') {
      this._steps.set([
        { id: 'branch', label: 'Sede', status: 'completed' },
        { id: 'personal-data', label: 'Datos personales', status: 'pending' },
        { id: 'payment-mode', label: 'Modalidad', status: 'pending' },
        { id: 'schedule', label: 'Horario', status: 'pending' },
        { id: 'documents', label: 'Foto carnet', status: 'pending' },
        { id: 'contract', label: 'Contrato', status: 'pending' },
        { id: 'confirmation', label: 'Confirmación', status: 'pending' },
      ]);
    } else {
      this._steps.set([
        { id: 'branch', label: 'Sede', status: 'completed' },
        { id: 'personal-data', label: 'Datos personales', status: 'pending' },
        { id: 'course-selection', label: 'Curso', status: 'pending' },
        { id: 'pre-confirmation', label: 'Confirmación', status: 'pending' },
      ]);
    }
  }

  private updateStepStatus(
    stepId: PublicWizardStep,
    status: 'active' | 'completed' | 'pending',
  ): void {
    this._steps.update((steps) => steps.map((s) => (s.id === stepId ? { ...s, status } : s)));
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
}
