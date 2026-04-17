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
  | 'payment'
  | 'confirmation'
  | 'psych-test-intro'
  | 'psych-test'
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
  enrollmentId?: number;
  message?: string;
  /** true cuando Webpay rechazó explícitamente el pago */
  rejected?: boolean;
  /** Datos enriquecidos para la página de retorno */
  branchName?: string;
  branchAddress?: string;
  courseName?: string;
  amountPaid?: number;
  courseBasePrice?: number;
  pendingBalance?: number;
  sessionCount?: number;
  paymentMode?: string;
  studentName?: string;
}

/**
 * Referencia mínima que se guarda en localStorage al iniciar el pago con
 * Transbank. Reemplaza el draft completo para que el componente /retorno
 * pueda identificar la sesión sin depender de datos del wizard.
 */
interface PendingPaymentRef {
  sessionToken: string;
  enrollmentId: number;
}

// ─── Draft persistence ───

interface PublicEnrollmentDraft {
  version: 1;
  sessionToken: string;
  savedAt: string;
  flowType: PublicFlowType;
  branchId: number;
  branchSlug: string;
  branchName: string;
  branchAddress: string;
  currentStep: PublicWizardStep;
  personalData: EnrollmentPersonalData | null;
  paymentMode: PaymentMode | null;
  instructorId: number | null;
  selectedSlotIds: string[];
  selectedCourseType: CourseType | null;
  convalidatesSimultaneously: boolean;
  /** Respuestas EPQ: 81 booleanos (null = sin responder). */
  psychTestAnswers: (boolean | null)[];
  /** Ruta en Storage (bucket 'documents') de la foto temporal subida en el paso documents. */
  carnetStoragePath: string | null;
}

/**
 * PublicEnrollmentFacade — Orquestador de matrícula online pública.
 *
 * A diferencia de EnrollmentFacade (admin/secretaria):
 * - NO depende de AuthFacade (no hay usuario autenticado)
 * - Writes van via Edge Function `public-enrollment` (SERVICE_ROLE_KEY bypass RLS)
 * - Reads de branches/courses son directos (RLS anón)
 * - Reads de instructors/schedule van via Edge Function (RLS no permite anón)
 *
 * Infraestructura para Transbank (implementada, pago pendiente de integrar):
 * - `_sessionToken` : UUID por sesión de wizard, persiste en localStorage
 * - `_hasDraftToRestore` : indica si hay un borrador recuperable
 * - `slot_holds` : reserva temporal de slots al confirmar horario (20 min TTL)
 * - `payment_attempts` : idempotencia del submit vía sessionToken
 * - Paso `payment` : stub que se convierte en redirect Webpay al integrar Transbank
 */
@Injectable({ providedIn: 'root' })
export class PublicEnrollmentFacade {
  private readonly supabase = inject(SupabaseService);

  // ── Storage keys ──
  private readonly DRAFT_KEY = 'pec_draft' as const;
  /** Referencia mínima post-initiate-payment (reemplaza el draft completo). */
  private readonly PENDING_KEY = 'pec_pending' as const;

  // ══════════════════════════════════════════════════════════════════════════════
  // 1. ESTADO REACTIVO (Privado)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Session & draft ──
  private readonly _sessionToken = signal<string>(this.readOrCreateToken());
  private readonly _hasDraftToRestore = signal<boolean>(this.checkStoredDraft());

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
  /** Respuestas EPQ: array de 81 elementos (null = sin responder, true = Sí, false = No). */
  private readonly _psychTestAnswers = signal<(boolean | null)[]>(Array(81).fill(null));

  // ── Documents ──
  /** Ruta en Storage (sin bucket) del archivo temporal subido por el usuario público. */
  private readonly _carnetStoragePath = signal<string | null>(null);
  /**
   * Blob URL local generada con URL.createObjectURL() tras subir el carnet.
   * Válida mientras la página esté abierta. Se revoca con URL.revokeObjectURL()
   * al limpiar el estado. Evita llamar a Storage para display (bucket es privado).
   */
  private readonly _carnetPreviewUrl = signal<string | null>(null);

  // ── Contract ──
  private readonly _contractPdfUrl = signal<string | null>(null);
  private readonly _signedContractFile = signal<File | null>(null);

  // ── Result ──
  private readonly _result = signal<PublicEnrollmentResult | null>(null);

  // ── UI state ──
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // ── Schedule polling ──
  private _schedulePollingInterval: ReturnType<typeof setInterval> | null = null;

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. ESTADO EXPUESTO (Público, solo lectura)
  // ══════════════════════════════════════════════════════════════════════════════

  readonly sessionToken = this._sessionToken.asReadonly();
  readonly hasDraftToRestore = this._hasDraftToRestore.asReadonly();
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
  readonly psychTestAnswers = this._psychTestAnswers.asReadonly();
  /** URL pública de la foto de carnet subida temporalmente al Storage. */
  readonly carnetPhotoUrl = computed<string | null>(() => {
    // Opción A: blob URL local creada en uploadCarnetPhoto().
    // No depende de que el bucket sea público; válida mientras la página esté abierta.
    return this._carnetPreviewUrl();
  });
  readonly contractPdfUrl = this._contractPdfUrl.asReadonly();
  readonly signedContractFile = this._signedContractFile.asReadonly();
  readonly result = this._result.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Monto a cobrar en este pago según curso y modalidad (total o abono 50%). */
  readonly paymentAmount = computed<number>(() => this.calculatePaymentAmount());

  // ── Computed: course options ──
  readonly courseOptions = computed<CourseOption[]>(() => {
    const result: CourseOption[] = [];
    for (const course of this._courses()) {
      const opt = this.mapCourseToOption(course);
      if (opt.type === 'class_b_sence' || opt.category === 'singular') continue;
      result.push(opt);
      if (opt.type === 'professional_a2') {
        result.push({ ...opt, label: 'Profesional A2 conv. A4', convalidation: true });
      } else if (opt.type === 'professional_a5') {
        result.push({ ...opt, label: 'Profesional A5 conv. A3', convalidation: true });
      }
    }
    return result;
  });

  readonly hiddenCourseCategories = computed<CourseCategory[]>(() => {
    const courses = this.courseOptions();
    const available = new Set(courses.map((c) => c.category));
    const checked: CourseCategory[] = ['non-professional', 'professional'];
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

  /** Total de clases del curso sin considerar modalidad de pago. */
  readonly basePracticalSlotCount = computed<number>(() => {
    const pd = this._personalData();
    if (!pd || pd.courseCategory !== 'non-professional') return 0;
    const licenseClass = this.courseTypeToLicenseClass(pd.courseType);
    const course = this._courses().find((c) => c.license_class === licenseClass);
    return course?.practical_hours ? Math.round((course.practical_hours * 60) / 45) : 12;
  });

  readonly requiredSlotCount = computed<number>(() => {
    const total = this.basePracticalSlotCount();
    if (total === 0) return 0;
    return this._paymentMode() === 'partial' ? Math.ceil(total / 2) : total;
  });

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
        return this._carnetStoragePath() !== null;
      case 'contract':
        return this._signedContractFile() !== null;
      case 'payment':
        return true; // Webpay gestionará la validación
      case 'psych-test':
        return this._psychTestAnswers().every((a) => a !== null);
      case 'pre-confirmation':
        return true;
      default:
        return false;
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Branch & Flow
  // ══════════════════════════════════════════════════════════════════════════════

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

      if (!courseRes.error && courseRes.data) {
        const pricingMap = new Map<number, BranchCoursePrice[]>();
        for (const c of courseRes.data) {
          if (!c.branch_id) continue;
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

  async selectBranch(branch: BranchOption): Promise<void> {
    const prev = this._selectedBranch();
    // Si el usuario cambia de sede habiendo avanzado, descartar datos posteriores
    if (prev !== null && prev.id !== branch.id) {
      this.clearSubsequentStepData();
    }
    this._selectedBranch.set(branch);
    this._flowType.set(null);
    await this.loadCourses(branch.id);
  }

  selectFlowType(flow: PublicFlowType): void {
    const prev = this._flowType();
    // Si el usuario cambia de flujo habiendo avanzado, descartar datos posteriores
    if (prev !== null && prev !== flow) {
      this.clearSubsequentStepData();
    }
    this._flowType.set(flow);
    this.buildSteps(flow);
  }

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

  savePersonalData(data: EnrollmentPersonalData): void {
    this._personalData.set(data);
    this.updateStepStatus('personal-data', 'completed');

    const flow = this._flowType();
    if (flow === 'class_b') {
      this._currentStep.set('payment-mode');
      this.updateStepStatus('payment-mode', 'active');
    } else {
      this._selectedCourseType.set(data.courseType);
      this._convalidatesSimultaneously.set(data.convalidatesSimultaneously);
      this._currentStep.set('psych-test-intro');
      this.updateStepStatus('psych-test', 'active');
    }
    this.saveDraft();
  }

  /** Avanza de la pantalla de introducción al test psicológico al test en sí. */
  startPsychTest(): void {
    this._currentStep.set('psych-test');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Assignment (Class B)
  // ══════════════════════════════════════════════════════════════════════════════

  setPaymentMode(mode: PaymentMode): void {
    this._paymentMode.set(mode);
  }

  confirmPaymentMode(): void {
    this.updateStepStatus('payment-mode', 'completed');
    this._currentStep.set('schedule');
    this.updateStepStatus('schedule', 'active');
    this.saveDraft();
  }

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

  async loadScheduleGrid(instructorId: number, preserveSlots = false): Promise<void> {
    this._selectedInstructorId.set(instructorId);
    if (!preserveSlots) {
      this._selectedSlotIds.set([]);
    }
    this._scheduleGrid.set(null);
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const { data, error } = await this.supabase.client.functions.invoke('public-enrollment', {
        body: {
          action: 'load-schedule',
          instructorId,
          sessionToken: this._sessionToken(),
        },
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

  toggleSlot(slotId: string): void {
    const current = this._selectedSlotIds();
    const idx = current.indexOf(slotId);
    if (idx >= 0) {
      this._selectedSlotIds.set(current.filter((id) => id !== slotId));
    } else {
      this._selectedSlotIds.set([...current, slotId]);
    }
  }

  setSelectedSlots(slotIds: string[]): void {
    this._selectedSlotIds.set(slotIds);
  }

  /**
   * Confirma la selección de horario.
   * Crea slot_holds en BD (TTL 20 min) antes de avanzar para impedir que otro
   * alumno tome los mismos slots mientras se completa el wizard y el pago.
   */
  async confirmSchedule(): Promise<void> {
    const reserved = await this.reserveSlots();
    if (!reserved) return; // error ya seteado en reserveSlots()

    this.updateStepStatus('schedule', 'completed');
    this._currentStep.set('documents');
    this.updateStepStatus('documents', 'active');
    this.saveDraft();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Slot Holds
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Reserva los slots seleccionados en BD para esta sesión (TTL 20 min).
   * Si hay conflictos con otra sesión activa, setea el error y devuelve false.
   */
  async reserveSlots(): Promise<boolean> {
    const instructorId = this._selectedInstructorId();
    const slotIds = this._selectedSlotIds();

    if (!instructorId || !slotIds.length) return true;

    const { data, error } = await this.supabase.client.functions.invoke('public-enrollment', {
      body: {
        action: 'reserve-slots',
        sessionToken: this._sessionToken(),
        instructorId,
        slotIds,
      },
    });

    if (error || !data?.success) {
      if (data?.conflictingSlots?.length) {
        this._error.set(
          'Algunos horarios ya fueron seleccionados por otro alumno. Por favor elige otros horarios.',
        );
        // Auto-deselect conflicting slots
        const conflicts = new Set<string>(data.conflictingSlots);
        this._selectedSlotIds.update((ids) => ids.filter((id) => !conflicts.has(id)));
      } else {
        this._error.set('Error al reservar horarios. Intenta de nuevo.');
      }
      return false;
    }

    return true;
  }

  /**
   * Libera los slot_holds de esta sesión.
   * Se llama cuando el usuario retrocede al paso de horario (fire & forget).
   */
  releaseSlots(): void {
    void this.supabase.client.functions.invoke('public-enrollment', {
      body: { action: 'release-slots', sessionToken: this._sessionToken() },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Documents
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Sube la foto de carnet a Storage en la ruta temporal
   * `public-uploads/carnet/{sessionToken}` usando el cliente anónimo.
   * La Edge Function moverá el archivo al destino final
   * `students/{enrollmentId}/id_photo` al confirmar la matrícula.
   */
  async uploadCarnetPhoto(file: File): Promise<boolean> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const path = `public-uploads/carnet/${this._sessionToken()}`;

      const { error } = await this.supabase.client.storage
        .from('documents')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (error) {
        this._error.set('Error al subir la foto: ' + error.message);
        return false;
      }

      this._carnetStoragePath.set(path);

      // Crear blob URL local para el preview (bucket privado: no usamos publicUrl).
      // Revocar la anterior si existía para evitar memory leaks.
      const prev = this._carnetPreviewUrl();
      if (prev) URL.revokeObjectURL(prev);
      this._carnetPreviewUrl.set(URL.createObjectURL(file));

      this.saveDraft();
      return true;
    } catch {
      this._error.set('Error inesperado al subir la foto');
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  confirmDocuments(): void {
    this.updateStepStatus('documents', 'completed');
    this._currentStep.set('contract');
    this.updateStepStatus('contract', 'active');
    this.saveDraft();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Contract
  // ══════════════════════════════════════════════════════════════════════════════

  setSignedContract(file: File): void {
    this._signedContractFile.set(file);
  }

  /** Confirma contrato y avanza al paso de pago (Webpay). */
  confirmContract(): void {
    this.updateStepStatus('contract', 'completed');
    this._currentStep.set('payment');
    this.updateStepStatus('payment', 'active');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Payment (stub Transbank)
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Inicia el proceso de pago con Transbank Webpay Plus.
   *
   * Llama a 'initiate-payment' en la Edge Function, que:
   *   1. Crea el enrollment como 'pending_payment'
   *   2. Crea las class_b_sessions como 'reserved'
   *   3. Guarda el draft completo en payment_attempts.draft_snapshot
   *   4. [TODO Transbank] Obtiene URL + token de Webpay
   *
   * Si la Edge Function retorna webpayUrl → redirige a Webpay (la app se destruye).
   * La confirmación la maneja /inscripcion/retorno vía confirmPayment(tokenWs).
   *
   * Mientras Transbank no esté integrado, webpayUrl será null y el flujo se
   * detiene aquí con un mensaje informativo.
   */
  async initiatePayment(): Promise<PublicEnrollmentResult> {
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
          action: 'initiate-payment',
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
          sessionToken: this._sessionToken(),
          amount: this.calculatePaymentAmount(),
          carnetStoragePath: this._carnetStoragePath(),
        },
      });

      if (error || !data?.success) {
        const msg = error?.message ?? 'Error al iniciar el pago';
        this._error.set(msg);
        return { success: false, message: msg };
      }

      // Reemplazar draft completo por referencia mínima en localStorage
      this.clearDraft();
      this.savePendingPaymentRef({
        sessionToken: this._sessionToken(),
        enrollmentId: data.enrollmentId,
      });

      // Redirigir a Webpay — Webpay exige POST con token_ws (no GET redirect)
      if (data.webpayUrl && data.webpayToken) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.webpayUrl;
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'token_ws';
        input.value = data.webpayToken;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
        return { success: true }; // no se alcanza tras el redirect
      }

      // Transbank pendiente de integrar
      this._error.set(
        'El pago online aún no está disponible. Contacta a la autoescuela para completar tu matrícula.',
      );
      return { success: false, message: 'Pago online no disponible' };
    } finally {
      this._isSubmitting.set(false);
    }
  }

  /**
   * Confirma el pago desde el componente /inscripcion/retorno.
   * Recibe el token_ws que Webpay añade al return_url como query param.
   */
  async confirmPayment(tokenWs: string): Promise<PublicEnrollmentResult> {
    this._isSubmitting.set(true);
    this._error.set(null);

    try {
      const { data, error } = await this.supabase.client.functions.invoke('public-enrollment', {
        body: { action: 'confirm-payment', tokenWs },
      });

      if (error) {
        this._error.set('Error al confirmar el pago: ' + error.message);
        return { success: false, message: error.message };
      }

      if (!data?.success) {
        return {
          success: false,
          rejected: data?.rejected ?? false,
          message: data?.message ?? 'El pago no fue procesado correctamente',
        };
      }

      const result: PublicEnrollmentResult = {
        success: true,
        enrollmentNumber: data.enrollmentNumber,
        enrollmentId: data.enrollmentId,
        branchName: data.branchName,
        branchAddress: data.branchAddress,
        courseName: data.courseName,
        amountPaid: data.amountPaid,
        courseBasePrice: data.courseBasePrice,
        pendingBalance: data.pendingBalance,
        sessionCount: data.sessionCount,
        paymentMode: data.paymentMode,
        studentName: data.studentName,
      };
      this._result.set(result);
      this.clearPendingPaymentRef();
      return result;
    } catch {
      this._error.set('Error inesperado al confirmar el pago');
      return { success: false, message: 'Error inesperado' };
    } finally {
      this._isSubmitting.set(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Professional Pre-inscription
  // ══════════════════════════════════════════════════════════════════════════════

  selectProfessionalCourse(courseType: CourseType, convalidation: boolean): void {
    this._selectedCourseType.set(courseType);
    this._convalidatesSimultaneously.set(convalidation);
  }

  /** Actualiza las respuestas del test psicológico y persiste el draft. */
  savePsychTestAnswers(answers: (boolean | null)[]): void {
    this._psychTestAnswers.set(answers);
    this.saveDraft();
  }

  /** Marca el test como completado y avanza a pre-confirmación. */
  confirmPsychTest(): void {
    this.updateStepStatus('psych-test', 'completed');
    this._currentStep.set('pre-confirmation');
    this.updateStepStatus('pre-confirmation', 'active');
    this._hasDraftToRestore.set(false);
    // No se guarda el draft: el submit ya limpió localStorage.
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN — Submit
  // ══════════════════════════════════════════════════════════════════════════════

  /** Envía la matrícula completa de Clase B via Edge Function (idempotente). */
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
          sessionToken: this._sessionToken(),
          carnetStoragePath: this._carnetStoragePath(),
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
      this.clearDraft(); // Éxito: limpiar borrador
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
          psychTestAnswers: this._psychTestAnswers(),
        },
      });

      if (error) {
        this._error.set('Error al enviar pre-inscripción: ' + error.message);
        return { success: false, message: error.message };
      }

      const result: PublicEnrollmentResult = { success: true, message: data?.message };
      this._result.set(result);
      this.updateStepStatus('pre-confirmation', 'completed');
      this.clearDraft();
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

  /**
   * Descarta todos los datos de los pasos posteriores al paso 1 (branch).
   * Se llama cuando el usuario cambia de sede o de tipo de flujo habiendo avanzado,
   * ya que los datos anteriores son inválidos o inconsistentes con la nueva elección.
   */
  private clearSubsequentStepData(): void {
    // Liberar slot holds si existían (fire & forget)
    if (this._selectedSlotIds().length > 0) {
      this.releaseSlots();
    }

    // Limpiar foto temporal en Storage (fire & forget)
    const tempPath = this._carnetStoragePath();
    if (tempPath) {
      void this.supabase.client.storage.from('documents').remove([tempPath]);
    }

    this._personalData.set(null);
    this._paymentMode.set(null);
    this._selectedInstructorId.set(null);
    this._scheduleGrid.set(null);
    this._selectedSlotIds.set([]);
    this._selectedCourseType.set(null);
    this._convalidatesSimultaneously.set(false);
    this._psychTestAnswers.set(Array(81).fill(null));
    this._carnetStoragePath.set(null);
    const previewUrl = this._carnetPreviewUrl();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    this._carnetPreviewUrl.set(null);
    this._contractPdfUrl.set(null);
    this._signedContractFile.set(null);
    this._result.set(null);
    this._error.set(null);

    this.stopSchedulePolling();
    this.clearDraft();
  }

  goToStep(step: PublicWizardStep): void {
    this._currentStep.set(step);
    this.updateStepStatus(step, 'active');
  }

  goBack(): void {
    const flow = this._flowType();
    const current = this._currentStep();

    // El usuario ya pagó/confirmó → no se puede retroceder desde la pantalla final
    if (current === 'confirmation' || current === 'pre-confirmation') return;

    const classBOrder: PublicWizardStep[] = [
      'branch',
      'personal-data',
      'payment-mode',
      'schedule',
      'documents',
      'contract',
      'payment',
      'confirmation',
    ];
    // psych-test-intro: pantalla intermedia entre personal-data y psych-test
    if (current === 'psych-test-intro') {
      this.updateStepStatus('psych-test', 'pending');
      this._currentStep.set('personal-data');
      this.updateStepStatus('personal-data', 'active');
      return;
    }

    // Desde psych-test (profesional) retrocedemos a la intro, no a personal-data
    if (current === 'psych-test' && flow === 'professional') {
      this._currentStep.set('psych-test-intro');
      return;
    }

    const professionalOrder: PublicWizardStep[] = [
      'branch',
      'personal-data',
      'psych-test',
      'pre-confirmation',
    ];

    const order = flow === 'professional' ? professionalOrder : classBOrder;
    const idx = order.indexOf(current);
    if (idx <= 0) return;

    const prevStep = order[idx - 1];

    // Actualizar estados de la barra de progreso
    this.updateStepStatus(current, 'pending');
    this._currentStep.set(prevStep);
    this.updateStepStatus(prevStep, 'active');

    // Al retroceder al paso de horario, liberar holds para que otros puedan tomarlos
    if (prevStep === 'schedule') {
      this.releaseSlots();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 5. DRAFT PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Restaura el borrador guardado en localStorage.
   * Llama internamente a loadCourses para que los computed signals funcionen.
   */
  restoreDraft(): void {
    const draft = this.readDraft();
    if (!draft) {
      this._hasDraftToRestore.set(false);
      return;
    }

    // Restaurar session token del draft (los slot_holds están asociados a él)
    this._sessionToken.set(draft.sessionToken);

    // Restaurar branch sin necesidad de esperar a _branches
    this._selectedBranch.set({
      id: draft.branchId,
      slug: draft.branchSlug,
      name: draft.branchName,
      address: draft.branchAddress,
    });

    // Restaurar datos de formulario
    this._flowType.set(draft.flowType);
    this.buildSteps(draft.flowType);
    this._personalData.set(draft.personalData);
    this._paymentMode.set(draft.paymentMode);
    this._selectedInstructorId.set(draft.instructorId);
    this._selectedSlotIds.set(draft.selectedSlotIds);
    this._selectedCourseType.set(draft.selectedCourseType);
    this._convalidatesSimultaneously.set(draft.convalidatesSimultaneously);
    this._psychTestAnswers.set(draft.psychTestAnswers ?? Array(81).fill(null));
    this._carnetStoragePath.set(draft.carnetStoragePath ?? null);

    // Restaurar paso actual y marcar anteriores como completados
    this._currentStep.set(draft.currentStep);
    const stepOrder: PublicWizardStep[] =
      draft.flowType === 'professional'
        ? ['branch', 'personal-data', 'psych-test', 'pre-confirmation']
        : [
            'branch',
            'personal-data',
            'payment-mode',
            'schedule',
            'documents',
            'contract',
            'payment',
            'confirmation',
          ];
    const currentIdx = stepOrder.indexOf(draft.currentStep);
    this._steps.update((steps) =>
      steps.map((s) => {
        const idx = stepOrder.indexOf(s.id);
        if (idx < currentIdx) return { ...s, status: 'completed' };
        if (s.id === draft.currentStep) return { ...s, status: 'active' };
        return s;
      }),
    );

    // Cargar cursos para que funcionen los computed signals
    void this.loadCourses(draft.branchId);

    this._hasDraftToRestore.set(false);
  }

  /**
   * Descarta el borrador y limpia el estado.
   * El sessionToken se renueva para evitar reasoiar holds con la sesión anterior.
   */
  discardDraft(): void {
    // Limpiar archivo temporal en Storage si el usuario había subido la foto (fire & forget)
    const tempPath = this._carnetStoragePath();
    if (tempPath) {
      void this.supabase.client.storage.from('documents').remove([tempPath]);
    }
    this.clearDraft();
    this._sessionToken.set(this.generateToken());
    this._carnetStoragePath.set(null);
    this._hasDraftToRestore.set(false);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 6. RESET & ERROR
  // ══════════════════════════════════════════════════════════════════════════════

  reset(): void {
    this.stopSchedulePolling();
    this.clearDraft();
    this._sessionToken.set(this.generateToken());
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
    this._psychTestAnswers.set(Array(81).fill(null));
    this._carnetStoragePath.set(null);
    const previewUrl = this._carnetPreviewUrl();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    this._carnetPreviewUrl.set(null);
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
  // 7. POLLING — Actualización periódica de disponibilidad
  // ══════════════════════════════════════════════════════════════════════════════

  private startSchedulePolling(instructorId: number): void {
    this.stopSchedulePolling();

    this._schedulePollingInterval = setInterval(async () => {
      const currentSelected = this._selectedSlotIds();

      const { data, error } = await this.supabase.client.functions.invoke('public-enrollment', {
        body: {
          action: 'load-schedule',
          instructorId,
          sessionToken: this._sessionToken(),
        },
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

  private stopSchedulePolling(): void {
    if (this._schedulePollingInterval) {
      clearInterval(this._schedulePollingInterval);
      this._schedulePollingInterval = null;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 8. MÉTODOS PRIVADOS
  // ══════════════════════════════════════════════════════════════════════════════

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
        { id: 'payment', label: 'Pago', status: 'pending' },
        { id: 'confirmation', label: 'Confirmación', status: 'pending' },
      ]);
    } else {
      this._steps.set([
        { id: 'branch', label: 'Sede', status: 'completed' },
        { id: 'personal-data', label: 'Datos personales', status: 'pending' },
        { id: 'psych-test', label: 'Test Psicológico', status: 'pending' },
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

  // ── Payment helpers ────────────────────────────────────────────────────────

  /**
   * Calcula el monto a cobrar según el curso activo y la modalidad de pago.
   * Se pasa a Webpay al crear la transacción.
   */
  private calculatePaymentAmount(): number {
    const pd = this._personalData();
    if (!pd) return 0;
    const licenseClass = this.courseTypeToLicenseClass(pd.courseType);
    const course = this._courses().find((c) => c.license_class === licenseClass);
    const basePrice = course?.base_price ?? 0;
    return this._paymentMode() === 'partial' ? Math.ceil(basePrice / 2) : basePrice;
  }

  private savePendingPaymentRef(ref: PendingPaymentRef): void {
    try {
      localStorage.setItem(this.PENDING_KEY, JSON.stringify(ref));
    } catch {
      // localStorage no disponible
    }
  }

  private clearPendingPaymentRef(): void {
    try {
      localStorage.removeItem(this.PENDING_KEY);
    } catch {
      // ignore
    }
  }

  // ── Draft helpers ──────────────────────────────────────────────────────────

  private saveDraft(): void {
    const branch = this._selectedBranch();
    const flowType = this._flowType();
    if (!flowType || !branch) return;

    const draft: PublicEnrollmentDraft = {
      version: 1,
      sessionToken: this._sessionToken(),
      savedAt: new Date().toISOString(),
      flowType,
      branchId: branch.id,
      branchSlug: branch.slug ?? '',
      branchName: branch.name,
      branchAddress: (branch as any).address ?? '',
      currentStep: this._currentStep(),
      personalData: this._personalData(),
      paymentMode: this._paymentMode(),
      instructorId: this._selectedInstructorId(),
      selectedSlotIds: this._selectedSlotIds(),
      selectedCourseType: this._selectedCourseType(),
      convalidatesSimultaneously: this._convalidatesSimultaneously(),
      psychTestAnswers: this._psychTestAnswers(),
      carnetStoragePath: this._carnetStoragePath(),
    };

    try {
      localStorage.setItem(this.DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // localStorage no disponible (modo privado extremo, SSR, etc.)
    }
  }

  private clearDraft(): void {
    try {
      localStorage.removeItem(this.DRAFT_KEY);
    } catch {
      // ignore
    }
  }

  private readDraft(): PublicEnrollmentDraft | null {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(this.DRAFT_KEY) : null;
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PublicEnrollmentDraft;
      return parsed.version === 1 ? parsed : null;
    } catch {
      return null;
    }
  }

  private checkStoredDraft(): boolean {
    const draft = this.readDraft();
    return draft !== null && !!draft.sessionToken;
  }

  private readOrCreateToken(): string {
    const draft = this.readDraft();
    return draft?.sessionToken ?? this.generateToken();
  }

  private generateToken(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  // ── Course mapping ──────────────────────────────────────────────────────────

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
