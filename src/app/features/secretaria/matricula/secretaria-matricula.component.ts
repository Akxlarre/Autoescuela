import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { calcAge } from '@core/utils/age.utils';
import { normalizePhoto } from '@core/utils/image.utils';
import { IconComponent } from '@shared/components/icon/icon.component';
import { StepperModule } from 'primeng/stepper';
import { ButtonModule } from 'primeng/button';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { EnrollmentFacade } from '@core/facades/enrollment.facade';
import { EnrollmentDocumentsFacade } from '@core/facades/enrollment-documents.facade';
import { EnrollmentPaymentFacade } from '@core/facades/enrollment-payment.facade';
import { ToastService } from '@core/services/ui/toast.service';

// Models
import type { EnrollmentWizardStep } from '@core/models/ui/enrollment-wizard.model';
import type { EnrollmentPersonalData } from '@core/models/ui/enrollment-personal-data.model';
import type { EnrollmentAssignmentData } from '@core/models/ui/enrollment-assignment.model';
import type {
  EnrollmentDocumentsData,
  DocumentType,
} from '@core/models/ui/enrollment-documents.model';
import type { EnrollmentPaymentData } from '@core/models/ui/enrollment-payment.model';
import type {
  EnrollmentContractData,
  ContractStatus,
  SignedContractUpload,
} from '@core/models/ui/enrollment-contract.model';
import type { EnrollmentConfirmationData } from '@core/models/ui/enrollment-confirmation.model';

// Step Components (Shared)
import { PersonalDataComponent } from '@shared/components/matricula-steps/personal-data/personal-data.component';
import { AssignmentComponent } from '@shared/components/matricula-steps/assignment/assignment.component';
import { DocumentsComponent } from '@shared/components/matricula-steps/documents/documents.component';
import { PaymentComponent } from '@shared/components/matricula-steps/payment/payment.component';
import { ContractComponent } from '@shared/components/matricula-steps/contract/contract.component';
import { ConfirmationComponent } from '@shared/components/matricula-steps/confirmation/confirmation.component';
import { DraftListComponent } from '@shared/components/matricula-steps/draft-list/draft-list.component';
import { BranchGateComponent } from '@shared/components/branch-gate/branch-gate.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { ScrollRevealDirective } from '@core/directives/scroll-reveal.directive';

const DEFAULT_PERSONAL_DATA: EnrollmentPersonalData = {
  rut: '',
  firstNames: '',
  paternalLastName: '',
  maternalLastName: '',
  email: '',
  phone: '',
  birthDate: '',
  gender: 'M',
  address: '',
  courseCategory: 'non-professional',
  courseType: 'class_b',
  singularCourseCode: null,
  senceCode: null,
  currentLicense: null,
  licenseDate: null,
  convalidatesSimultaneously: false,
  historicalPromotionId: null,
  validationBook: null,
  courses: [],
};

const EMPTY_SUMMARY = { initials: '', fullName: '', courseLabel: '' };

@Component({
  selector: 'app-secretaria-matricula',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    StepperModule,
    ButtonModule,
    IconComponent,
    PersonalDataComponent,
    AssignmentComponent,
    DocumentsComponent,
    PaymentComponent,
    ContractComponent,
    ConfirmationComponent,
    DraftListComponent,
    BranchGateComponent,
    SkeletonBlockComponent,
    ScrollRevealDirective,
    AnimateInDirective,
  ],
  styleUrls: ['./secretaria-matricula.component.scss'],
  templateUrl: './secretaria-matricula.component.html',
})
export class SecretariaMatriculaComponent implements OnInit, OnDestroy {
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthFacade);
  protected readonly branchFacade = inject(BranchFacade);
  readonly enrollment = inject(EnrollmentFacade);
  readonly docs = inject(EnrollmentDocumentsFacade);
  readonly payment = inject(EnrollmentPaymentFacade);
  private readonly toast = inject(ToastService);

  // ── activeStep (0-indexed para p-stepper, derivado del facade 1-based) ───
  readonly activeStep = computed(() => this.enrollment.currentStep() - 1);

  // ── Sede activa — admin: usa el selector del topbar (BranchFacade); secretaria: anclada a la suya ────
  readonly activeBranchId = computed(() => {
    const user = this.auth.currentUser();
    if (user?.role === 'admin') {
      const selected = this.branchFacade.selectedBranchId();
      return selected ?? this.branchFacade.branches()[0]?.id ?? 1;
    }
    return user?.branchId ?? 1;
  });

  constructor() {
    // Reacciona al cambio de sede en el topbar (solo admin) mientras el wizard está activo.
    // Usa untracked para leer _viewMode sin suscribirse a sus cambios (evita re-ejecución al entrar al wizard).
    effect(() => {
      const user = this.auth.currentUser();
      if (user?.role !== 'admin') return;

      const branchId = this.branchFacade.selectedBranchId();
      if (branchId === null) return; // "Todas las escuelas" no aplica al wizard

      if (untracked(() => this._viewMode()) !== 'wizard') return;

      this._step1Form.set(DEFAULT_PERSONAL_DATA);
      void this.enrollment.loadCourses(branchId);
    });

    effect(() => {
      const step = this.enrollment.currentStep();
      const pd = this.enrollment.personalData();

      // Paso 2: carga instructores al entrar (Clase B)
      const branchId = this.activeBranchId();
      if (step === 2 && pd?.courseCategory === 'non-professional' && branchId != null) {
        this.enrollment.loadInstructors(branchId);
        // Draft resume: instructor ya seleccionado pero grilla no cargada → cargar sin resetear slots
        const instructorId = this.enrollment.selectedInstructorId();
        if (instructorId != null && this.enrollment.scheduleGrid() == null) {
          void this.enrollment.loadScheduleGrid(instructorId, true);
        }
      }

      // Paso 5: recalcula pricing (reactivo a cambio de paymentMode)
      if (step === 5 && pd) {
        const course = this.enrollment.courseOptions().find((c) => c.type === pd.courseType);
        const paymentMode = this.enrollment.paymentMode();
        // Fallback al base_price del enrollment en BD por si courseOptions aún no cargó
        const basePrice = course?.basePrice ?? this.enrollment.enrollmentBasePrice();
        const SESSION_MIN = 45;
        const totalSessions = course?.practicalHours
          ? Math.round((course.practicalHours * 60) / SESSION_MIN)
          : 12;
        if (basePrice > 0) {
          this.payment.computePricing({
            courseLabel: course?.label ?? pd.courseType,
            basePrice,
            practicalClassesIncluded: totalSessions,
            isDeposit: paymentMode === 'partial',
          });
        }
      }
    });

    // Badge "Paso N de 6" en el header del drawer (no-op si se usa como vista routeada).
    effect(() => {
      const badge = this.viewMode() === 'wizard' ? `Paso ${this.activeStep() + 1} de 6` : null;
      this.layoutDrawer.setBadge(badge);
    });
  }

  // ── Vista: 'branch-gate' fuerza elección de sede antes de arrancar el wizard ──
  private readonly _viewMode = signal<'loading' | 'branch-gate' | 'draft-list' | 'wizard'>(
    'loading',
  );
  readonly viewMode = this._viewMode.asReadonly();

  // ── Estado de guardado (spinner en botones Next) ──────────────────────────
  private readonly _isSaving = signal(false);
  readonly isSaving = this._isSaving.asReadonly();

  // ── Lightbox (imagen a pantalla completa, elevado al nivel del wizard) ────
  readonly lightboxUrl = signal<string | null>(null);

  // ── Estado local del formulario paso 1 (datos no persistidos aún) ────────
  private readonly _step1Form = signal<EnrollmentPersonalData>(DEFAULT_PERSONAL_DATA);

  // ── Estado local del contrato (generación + firma) ────────────────────────
  private readonly _contractPdfUrl = signal<string | null>(null);
  private readonly _contractStatus = signal<ContractStatus>('pending');
  /** Almacena el objeto completo de firma (digital o archivo físico). */
  private readonly _signedContractUpload = signal<SignedContractUpload | null>(null);

  // ── Datos computados por paso (desde facades) ─────────────────────────────

  readonly step1Data = computed<EnrollmentPersonalData>(() => ({
    ...this._step1Form(),
    courses: this.enrollment.courseOptions(),
  }));

  readonly step2Data = computed<EnrollmentAssignmentData>(() => {
    const pd = this.enrollment.personalData();
    const summary = this.enrollment.studentSummary() ?? EMPTY_SUMMARY;
    const slotIds = this.enrollment.selectedSlotIds();
    const paymentMode = this.enrollment.paymentMode();
    const instructors = this.enrollment.instructors();
    const grid = this.enrollment.scheduleGrid();
    const instructorId = this.enrollment.selectedInstructorId();

    // Derivar sesiones desde practical_hours del curso (45 min/sesión, class_b_sessions.duration_min)
    const SESSION_MIN = 45;
    const selectedCourse = this.enrollment.courseOptions().find((c) => c.type === pd?.courseType);
    const totalSessions = selectedCourse?.practicalHours
      ? Math.round((selectedCourse.practicalHours * 60) / SESSION_MIN)
      : 12; // fallback hasta que el curso esté en BD
    // Se agendan SIEMPRE las 12 clases, aunque el alumno abone solo la primera mitad.
    const requiredCount = totalSessions;

    return {
      view:
        pd?.courseCategory === 'professional'
          ? 'professional'
          : pd?.courseType === 'singular'
            ? 'singular'
            : 'class-b',
      studentSummary: summary,
      paymentMode,
      totalSessions,
      instructorId,
      instructors,
      scheduleGrid: grid,
      scheduleLoading: this.enrollment.isLoading(),
      slotSelection: {
        selectedSlotIds: slotIds,
        requiredCount,
        currentCount: slotIds.length,
        // Admin/secretaria puede agendar hasta 3 clases por día (vs 1 en flujo público).
        maxClassesPerDay: 3,
        isComplete: slotIds.length >= requiredCount,
      },
      promotionId: this.enrollment.selectedPromotionCourseId(),
      promotionGroups: this.enrollment.promotionGroups(),
      convalidatesSimultaneously: pd?.convalidatesSimultaneously ?? false,
      convalidatedLicense:
        pd?.convalidatesSimultaneously && pd.courseType === 'professional_a2'
          ? 'A4'
          : pd?.convalidatesSimultaneously && pd.courseType === 'professional_a5'
            ? 'A3'
            : null,
    };
  });

  readonly step3Data = computed<EnrollmentDocumentsData>(() => {
    const pd = this.enrollment.personalData();
    const summary = this.enrollment.studentSummary() ?? EMPTY_SUMMARY;
    const view = pd?.courseCategory === 'professional' ? 'professional' : 'class-b';
    return {
      view,
      studentSummary: summary,
      isMinor: pd ? this.calcAge(pd.birthDate) < 18 : false,
      photoTab: this.docs.photoTab(),
      cameraState: this.docs.cameraState(),
      carnetPhoto: this.docs.carnetPhoto(),
      photoNeedsConfirmation: this.docs.photoNeedsConfirmation(),
      uploadedDocuments: this.docs.documents(),
      requiredDocuments:
        view === 'professional'
          ? this.docs.getRequirements('professional', pd ? this.calcAge(pd.birthDate) < 18 : false)
          : [],
      hvcValidation: this.docs.hvcValidation(),
      notarialAuthorization: this.docs.documents().get('autorizacion_notarial') ?? null,
    };
  });

  readonly step4Data = computed<EnrollmentContractData>(() => {
    const pd = this.enrollment.personalData();
    const birthDateStr = pd?.birthDate;
    const isMinor = birthDateStr ? (calcAge(birthDateStr) ?? 99) < 18 : false;
    return {
      studentSummary: this.enrollment.studentSummary() ?? EMPTY_SUMMARY,
      contractGeneration: {
        status: this._contractStatus(),
        pdfUrl: this._contractPdfUrl(),
        generatedAt: null,
        errorMessage: this.enrollment.error() ?? null,
      },
      signedContract: this._signedContractUpload(),
      isMinor,
      canAdvance: !!this._signedContractUpload()?.file || this.enrollment.contractAccepted(),
    };
  });

  readonly step5Data = computed<EnrollmentPaymentData>(() => {
    const summary = this.enrollment.studentSummary() ?? EMPTY_SUMMARY;
    const pd = this.enrollment.personalData();
    const pricing = this.payment.pricing();
    return {
      studentSummary: summary,
      pricing: pricing ?? {
        courseLabel: summary.courseLabel,
        practicalClassesIncluded: 12,
        basePrice: 0,
        isDeposit: false,
        amountDue: 0,
      },
      discount: this.payment.discount(),
      totalToPay: this.payment.totalToPay(),
      paymentMethod: this.payment.paymentMethod(),
      availableDiscounts: this.payment.availableDiscounts(),
      selectedDiscountId: this.payment.selectedDiscountId(),
      isSingularCourse: pd?.courseType === 'singular',
      singularAlert: { visible: false, message: '' },
      canAdvance: this.payment.canConfirmPayment(),
    };
  });

  readonly step6Data = computed<EnrollmentConfirmationData>(() => {
    const pd = this.enrollment.personalData();
    const summary = this.enrollment.studentSummary();
    const paymentMethod = this.payment.paymentMethod();
    const category = pd?.courseCategory ?? 'non-professional';
    return {
      enrollmentNumber: this.enrollment.enrollmentNumber() ?? '—',
      courseCategory: category,
      student: {
        fullName: summary?.fullName ?? '—',
        rut: pd?.rut ?? '—',
        email: pd?.email ?? '—',
        phone: pd?.phone ?? '—',
      },
      course: {
        courseLabel: summary?.courseLabel ?? '—',
        paymentMethodLabel: this.paymentMethodLabel(paymentMethod),
        paymentMethod: paymentMethod ?? 'efectivo',
        enrollmentDate: new Date().toISOString(),
        discountAmount: this.payment.discount().amount ?? 0,
        totalPaid: this.payment.totalToPay(),
      },
      nextStepsVariant: category === 'singular' ? 'singular' : 'regular',
      nextSteps:
        category === 'non-professional'
          ? [
              {
                text: 'Se ha enviado una copia del contrato al email del alumno.',
                highlights: ['contrato', 'email'],
              },
              {
                text: 'Las clases prácticas están agendadas según el horario acordado.',
                highlights: ['clase práctica'],
              },
            ]
          : category === 'professional'
            ? [
                {
                  text: 'Se ha enviado la confirmación de matrícula al email del alumno.',
                  highlights: ['confirmación', 'email'],
                },
                {
                  text: 'El alumno debe asistir a las clases según el calendario de la promoción.',
                  highlights: ['clases', 'promoción'],
                },
                {
                  text: 'Se requiere un mínimo de asistencia para rendir el examen final.',
                  highlights: ['asistencia', 'examen final'],
                },
                ...(pd?.convalidatesSimultaneously
                  ? [
                      {
                        text: `Convalidación ${pd.courseType === 'professional_a2' ? 'A4' : 'A3'} registrada. La administración abrirá el libro de clases correspondiente.`,
                        highlights: [
                          `Convalidación ${pd.courseType === 'professional_a2' ? 'A4' : 'A3'}`,
                          'libro de clases',
                        ],
                      },
                    ]
                  : []),
              ]
            : [
                {
                  text: 'El servicio ha sido registrado correctamente.',
                  highlights: ['servicio'],
                },
                {
                  text: 'El alumno recibirá la confirmación en su correo electrónico.',
                  highlights: ['confirmación', 'correo'],
                },
              ],
      pendingDocuments: {
        visible: !this.enrollment.docsComplete(),
        message: 'Hay documentos pendientes de aprobación.',
      },
    };
  });

  // ── Computed UI ───────────────────────────────────────────────────────────
  readonly stepperClass = computed(
    () => `stepper-premium stepper-premium--step-${this.activeStep() + 1}`,
  );

  ngOnInit(): void {
    this.setupDrawerActions();
    this.initWizard();
  }

  ngOnDestroy(): void {
    this.layoutDrawer.setActions([]);
    this.layoutDrawer.setBadge(null);
    this.branchFacade.setRequiresSpecificBranch(false);
  }

  /** Llamado por BranchGateComponent cuando el admin elige una sede. */
  onBranchSelectedFromGate(id: number): void {
    this.branchFacade.selectBranch(id);
    void this.initWizard();
  }

  private async initWizard(): Promise<void> {
    this._viewMode.set('loading');

    await this.auth.whenReady;

    if (this.auth.currentUser()?.role === 'admin') {
      this.branchFacade.setRequiresSpecificBranch(true);

      // Si no hay sede elegida, mostrar la gate antes de arrancar el wizard.
      if (this.branchFacade.selectedBranchId() === null) {
        this._viewMode.set('branch-gate');
        return;
      }
    }

    // Verificar si hay borradores pendientes antes de iniciar wizard limpio
    const branch = this.activeBranchId();
    const drafts = await this.enrollment.loadActiveDrafts(branch);

    if (drafts.length > 0) {
      this._viewMode.set('draft-list');
      return;
    }

    // Sin borradores → iniciar wizard limpio
    await this.startFreshWizard();
  }

  /** Inicia el wizard desde cero (sin borrador). La sede activa se lee desde activeBranchId(). */
  private async startFreshWizard(): Promise<void> {
    const branch = this.activeBranchId();
    this.enrollment.reset();
    this.docs.reset();
    this.payment.reset();
    this._step1Form.set(DEFAULT_PERSONAL_DATA);
    this._contractPdfUrl.set(null);
    this._contractStatus.set('pending');
    this._signedContractUpload.set(null);
    await this.enrollment.loadCourses(branch);

    // Re-matrícula desde Ex-alumnos (fix-020): el RUT viaja por query param.
    // Precarga los datos del alumno que vuelve antes de mostrar el wizard.
    const rut = this.route.snapshot.queryParamMap.get('rut');
    if (rut) await this.prefillStep1(rut);

    this._viewMode.set('wizard');
  }

  /** Reanuda un borrador existente desde la lista de drafts. */
  async onResumeDraft(enrollmentId: number): Promise<void> {
    this._viewMode.set('loading');
    const ok = await this.enrollment.resumeDraft(enrollmentId);
    if (ok) {
      // Cargar cursos para que los computed funcionen correctamente
      const branchId = this.activeBranchId();
      await this.enrollment.loadCourses(branchId);
      // Sincronizar _step1Form con los datos del draft para que onStep1Next
      // envíe los datos correctos si el usuario navega de vuelta al paso 1.
      const pd = this.enrollment.personalData();
      if (pd) this._step1Form.set(pd);
      this._viewMode.set('wizard');
    } else {
      // Fallback: volver a la lista de drafts
      this._viewMode.set('draft-list');
    }
  }

  /** Descarta un borrador tras confirmación y actualiza la vista. */
  async onDiscardDraft(enrollmentId: number): Promise<void> {
    const confirmed = await this.enrollment.confirm({
      title: '¿Descartar matrícula?',
      message: 'Se eliminarán todos los datos del borrador. Esta acción no se puede deshacer.',
      severity: 'danger',
      confirmLabel: 'Sí, descartar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;

    this._viewMode.set('loading');
    await this.enrollment.discardDraft(enrollmentId);
    if (this.enrollment.activeDrafts().length === 0) {
      await this.startFreshWizard();
    } else {
      this._viewMode.set('draft-list');
    }
  }

  /** Desde la lista de drafts, el usuario elige empezar una matrícula nueva. */
  onStartNewFromDraftList(): void {
    void this.startFreshWizard();
  }

  private setupDrawerActions(): void {
    this.layoutDrawer.setActions([
      { label: 'Reiniciar', icon: 'rotate-ccw', callback: () => this.resetWizard() },
    ]);
  }

  private resetWizard(): void {
    void this.startFreshWizard();
  }

  // ── Navegación via stepper PrimeNG ────────────────────────────────────────
  onStepperChange(step: number | null | undefined): void {
    if (step == null) return;
    const target = Math.min(Math.max(step + 1, 1), 6) as EnrollmentWizardStep;
    this.enrollment.goToStep(target);
  }

  // ── Paso 1: Datos personales ──────────────────────────────────────────────

  onStep1DataChange(data: EnrollmentPersonalData): void {
    this._step1Form.set(data);
  }

  /**
   * Blur del RUT en el Paso 1: precarga los datos de un alumno existente (fix-020).
   * Entrada compartida con "Re-matricular" de Ex-alumnos (vía query param `rut`).
   */
  async onStep1RutBlur(rut: string): Promise<void> {
    await this.prefillStep1(rut);
  }

  /**
   * Rellena el formulario del Paso 1 con los datos de la persona dueña del `rut`,
   * sin pisar el RUT escrito ni la selección de curso. No hace nada si no existe.
   */
  private async prefillStep1(rut: string): Promise<void> {
    const prefill = await this.enrollment.prefillFromStudent(rut);
    if (!prefill) return;
    this._step1Form.update((form) => ({ ...form, ...prefill, rut }));
    this.toast.info(
      'Datos precargados',
      'Se cargaron los datos personales de este alumno automáticamente.',
    );
  }

  async onStep1Next(): Promise<void> {
    this._isSaving.set(true);
    try {
      const branchId = this.activeBranchId();
      const ok = await this.enrollment.savePersonalData(this._step1Form(), branchId);
      if (ok) {
        const category = this._step1Form().courseCategory;
        if (category === 'non-professional') {
          await this.enrollment.loadInstructors(branchId);
        } else if (category === 'professional') {
          await this.enrollment.loadPromotions(branchId, category);
        }
      }
    } finally {
      this._isSaving.set(false);
    }
  }

  // ── Paso 2: Asignación ────────────────────────────────────────────────────
  onStep2DataChange(data: EnrollmentAssignmentData): void {
    const instructorChanged =
      data.instructorId != null && data.instructorId !== this.enrollment.selectedInstructorId();

    if (instructorChanged) {
      // loadScheduleGrid resetea _selectedSlotIds internamente — no llamar setSelectedSlots
      this.enrollment.loadScheduleGrid(data.instructorId!);
      return;
    }

    if (data.paymentMode && data.paymentMode !== this.enrollment.paymentMode()) {
      this.enrollment.setPaymentMode(data.paymentMode);
    }
    if (data.promotionId && data.promotionId !== this.enrollment.selectedPromotionCourseId()) {
      this.enrollment.selectPromotion(data.promotionId);
    }
    this.enrollment.setSelectedSlots(data.slotSelection.selectedSlotIds);
  }

  async onStep2Next(): Promise<void> {
    const s2 = this.step2Data();
    // Guard: Clase B requiere selección completa de slots antes de persistir
    if (s2.view === 'class-b' && !s2.slotSelection.isComplete) return;
    this._isSaving.set(true);
    try {
      const ok = await this.enrollment.saveAssignment();
      // Al entrar al Paso 3: si es un alumno que vuelve y la matrícula aún no tiene
      // foto propia, precargar la de su matrícula anterior para confirmar/reemplazar (fix-020).
      if (ok) {
        const { studentId, enrollmentId } = this.enrollment.draft();
        if (studentId && enrollmentId) {
          await this.docs.loadPreviousPhoto(studentId, enrollmentId);
        }
      }
    } finally {
      this._isSaving.set(false);
    }
  }

  /** Confirma reutilizar la foto de la matrícula anterior (fix-020). */
  async onConfirmPhoto(): Promise<void> {
    const { enrollmentId } = this.enrollment.draft();
    if (enrollmentId) await this.docs.confirmPreviousPhoto(enrollmentId);
  }

  // ── Paso 3: Documentos ────────────────────────────────────────────────────
  async onDocFileSelected(event: { type: string; file: File }): Promise<void> {
    const { enrollmentId } = this.enrollment.draft();
    if (!enrollmentId) return;
    if (event.type === 'id_photo') {
      const normalizedFile = await normalizePhoto(event.file);
      const dataUrl = await this.fileToDataUrl(normalizedFile);
      await this.docs.uploadCarnetPhoto(dataUrl, normalizedFile.name, enrollmentId);
    } else {
      await this.docs.uploadDocument(event.type as DocumentType, event.file, enrollmentId);
    }
  }

  async onStep3Next(): Promise<void> {
    this._isSaving.set(true);
    try {
      const { enrollmentId } = this.enrollment.draft();
      if (enrollmentId) await this.docs.markDocsComplete(enrollmentId, true);
      this.enrollment.goToStep(4);
    } finally {
      this._isSaving.set(false);
    }
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Paso 4: Contrato ─────────────────────────────────────────────────────
  async onGenerateContract(): Promise<void> {
    this._contractStatus.set('generating');
    const url = await this.enrollment.generateContract();
    this._contractPdfUrl.set(url);
    this._contractStatus.set(url ? 'generated' : 'error');
  }

  onStep4DataChange(data: EnrollmentContractData): void {
    if (data.signedContract) this._signedContractUpload.set(data.signedContract);
  }

  async onStep4Next(): Promise<void> {
    const upload = this._signedContractUpload();
    this._isSaving.set(true);
    try {
      if (upload?.file) {
        // uploadSignedContract persiste el contrato y hace goToStep(5) internamente
        await this.enrollment.uploadSignedContract(upload.file);
        // Pre-cargar descuentos para el siguiente paso de pago (fire-and-forget)
        const pd = this.enrollment.personalData();
        if (pd) void this.payment.loadAvailableDiscounts(pd.courseType);
      } else if (this.enrollment.contractAccepted()) {
        // Re-entrada: contrato ya aceptado en sesión anterior → avanzar a pago
        const pd = this.enrollment.personalData();
        if (pd) void this.payment.loadAvailableDiscounts(pd.courseType);
        this.enrollment.goToStep(5);
      }
    } finally {
      this._isSaving.set(false);
    }
  }

  // ── Paso 5: Pago ──────────────────────────────────────────────────────────
  onStep5DataChange(data: EnrollmentPaymentData): void {
    if (data.paymentMethod) this.payment.setPaymentMethod(data.paymentMethod);

    const newId = data.selectedDiscountId;
    const currentId = this.payment.selectedDiscountId();
    if (newId !== currentId) {
      if (newId === null) {
        this.payment.clearDiscount();
      } else {
        this.payment.applyPredefinedDiscount(newId);
      }
    } else if (!newId) {
      this.payment.setDiscount(data.discount);
    }
  }

  async onStep5Next(): Promise<void> {
    if (!this.step5Data().canAdvance) return;
    this._isSaving.set(true);
    try {
      const number = await this.enrollment.confirmWithPayment();
      if (number) this.enrollment.goToStep(6);
    } finally {
      this._isSaving.set(false);
    }
  }

  // ── Paso 6: Confirmación + cierre ────────────────────────────────────────
  finishWizard(): void {
    const role = this.auth.currentUser()?.role ?? 'secretaria';
    const dashboard = role === 'admin' ? '/app/admin/dashboard' : '/app/secretaria/dashboard';
    this.enrollment.reset();
    this.docs.reset();
    this.payment.reset();
    this.layoutDrawer.close();
    this.router.navigate([dashboard]);
  }

  onDownloadReceipt(): void {
    // TODO: abrir URL del comprobante de pago cuando esté disponible vía EnrollmentPaymentFacade
  }

  onDownloadContract(): void {
    void this.enrollment.openContractPdf();
  }

  // ── Utils ─────────────────────────────────────────────────────────────────
  private calcAge(birthDate: string): number {
    return calcAge(birthDate) ?? 25;
  }

  private paymentMethodLabel(method: string | null): string {
    const labels: Record<string, string> = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia',
      tarjeta: 'Tarjeta',
      pendiente: 'Pendiente',
    };
    return method ? (labels[method] ?? method) : '—';
  }
}
