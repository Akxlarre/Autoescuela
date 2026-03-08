import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { StepperModule } from 'primeng/stepper';
import { ButtonModule } from 'primeng/button';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { EnrollmentFacade } from '@core/facades/enrollment.facade';
import { EnrollmentDocumentsFacade } from '@core/facades/enrollment-documents.facade';
import { EnrollmentPaymentFacade } from '@core/facades/enrollment-payment.facade';

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
  regionCode: '16',
  communeValue: 'chillan',
  courseCategory: 'non-professional',
  courseType: 'class_b',
  singularCourseCode: null,
  senceCode: null,
  currentLicense: null,
  licenseDate: null,
  validationA2A4: false,
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
  ],
  styleUrls: ['./secretaria-matricula.component.scss'],
  templateUrl: './secretaria-matricula.component.html',
})
export class SecretariaMatriculaComponent implements OnInit, OnDestroy {
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly auth = inject(AuthFacade);
  readonly enrollment = inject(EnrollmentFacade);
  readonly docs = inject(EnrollmentDocumentsFacade);
  readonly payment = inject(EnrollmentPaymentFacade);

  // ── activeStep (0-indexed para p-stepper, derivado del facade 1-based) ───
  readonly activeStep = computed(() => this.enrollment.currentStep() - 1);

  constructor() {
    effect(() => {
      const step = this.enrollment.currentStep();
      const pd = this.enrollment.personalData();
      const branchId = this.auth.currentUser()?.branchId;

      // Paso 2: carga instructores al entrar (Clase B)
      if (step === 2 && pd?.courseCategory === 'non-professional' && branchId != null) {
        this.enrollment.loadInstructors(branchId);
      }

      // Paso 4: recalcula pricing (reactivo a cambio de paymentMode)
      if (step === 4 && pd) {
        const course = this.enrollment.courseOptions().find((c) => c.type === pd.courseType);
        const paymentMode = this.enrollment.paymentMode();
        if (course) {
          const SESSION_MIN = 45;
          const totalSessions = course.practicalHours
            ? Math.round((course.practicalHours * 60) / SESSION_MIN)
            : 12;
          this.payment.computePricing({
            courseLabel: course.label,
            basePrice: course.basePrice,
            practicalClassesIncluded: totalSessions,
            isDeposit: paymentMode === 'deposit',
          });
        }
      }
    });
  }

  // ── Estado de guardado (spinner en botones Next) ──────────────────────────
  private readonly _isSaving = signal(false);
  readonly isSaving = this._isSaving.asReadonly();

  // ── Estado local del formulario paso 1 (datos no persistidos aún) ────────
  private readonly _step1Form = signal<EnrollmentPersonalData>(DEFAULT_PERSONAL_DATA);

  // ── Estado local del contrato (generación + firma) ────────────────────────
  private readonly _contractPdfUrl = signal<string | null>(null);
  private readonly _contractStatus = signal<ContractStatus>('pending');
  /** Almacena el objeto completo de firma (digital o archivo físico). */
  private readonly _signedContractUpload = signal<SignedContractUpload | null>(null);

  // ── Datos computados por paso (desde facades) ─────────────────────────────

  readonly step1Data = computed<EnrollmentPersonalData>(() => ({
    ...(this.enrollment.personalData() ?? this._step1Form()),
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
    const requiredCount = paymentMode === 'deposit' ? Math.ceil(totalSessions / 2) : totalSessions;

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
        isComplete: slotIds.length >= requiredCount,
      },
      promotionId: this.enrollment.selectedPromotionCourseId(),
      promotionGroups: this.enrollment.promotionGroups(),
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
      uploadedDocuments: this.docs.documents(),
      requiredDocuments:
        view === 'professional'
          ? this.docs.getRequirements('professional', pd ? this.calcAge(pd.birthDate) < 18 : false)
          : [],
      hvcValidation: this.docs.hvcValidation(),
      notarialAuthorization: this.docs.documents().get('autorizacion_notarial') ?? null,
    };
  });

  readonly step4Data = computed<EnrollmentPaymentData>(() => {
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

  readonly step5Data = computed<EnrollmentContractData>(() => ({
    studentSummary: this.enrollment.studentSummary() ?? EMPTY_SUMMARY,
    contractGeneration: {
      status: this._contractStatus(),
      pdfUrl: this._contractPdfUrl(),
      generatedAt: null,
      errorMessage: this.enrollment.error() ?? null,
    },
    signedContract: this._signedContractUpload(),
    // Habilita "Continuar" cuando hay archivo listo para subir o la BD ya confirmó
    canAdvance: !!this._signedContractUpload()?.file || this.enrollment.contractAccepted(),
  }));

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
                text: 'El alumno puede comenzar sus clases teóricas desde hoy.',
                highlights: ['clases teóricas'],
              },
              {
                text: 'Las clase prácticas están agendadas según el horario acordado.',
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

  readonly progressLabel = computed(() => {
    const labels = [
      'Datos Personales',
      'Asignación',
      'Documentos',
      'Pago',
      'Contrato',
      'Confirmación',
    ];
    return labels[this.activeStep()] ?? '';
  });

  ngOnInit(): void {
    this.setupDrawerActions();
    this.initWizard();
  }

  ngOnDestroy(): void {
    this.layoutDrawer.setActions([]);
  }

  private initWizard(): void {
    const branchId = this.auth.currentUser()?.branchId ?? 1;
    this.enrollment.reset();
    this.docs.reset();
    this.payment.reset();
    this._step1Form.set(DEFAULT_PERSONAL_DATA);
    this.enrollment.loadCourses(branchId);
  }

  private setupDrawerActions(): void {
    this.layoutDrawer.setActions([
      { label: 'Ayuda', icon: 'help-circle', callback: () => console.log('Ayuda') },
      { label: 'Reiniciar', icon: 'rotate-ccw', callback: () => this.resetWizard() },
    ]);
  }

  private resetWizard(): void {
    this.enrollment.reset();
    this.docs.reset();
    this.payment.reset();
    this._step1Form.set(DEFAULT_PERSONAL_DATA);
    this._contractPdfUrl.set(null);
    this._contractStatus.set('pending');
    this._signedContractUpload.set(null);
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

  async onStep1Next(): Promise<void> {
    this._isSaving.set(true);
    try {
      const branchId = this.auth.currentUser()?.branchId ?? 1;
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
      await this.enrollment.saveAssignment();
    } finally {
      this._isSaving.set(false);
    }
  }

  // ── Paso 3: Documentos ────────────────────────────────────────────────────
  async onDocFileSelected(event: { type: string; file: File }): Promise<void> {
    const { enrollmentId } = this.enrollment.draft();
    if (!enrollmentId) return;
    if (event.type === 'id_photo') {
      const dataUrl = await this.fileToDataUrl(event.file);
      await this.docs.uploadCarnetPhoto(dataUrl, event.file.name, enrollmentId);
    } else {
      await this.docs.uploadDocument(event.type as DocumentType, event.file, enrollmentId);
    }
  }

  async onStep3Next(): Promise<void> {
    this._isSaving.set(true);
    try {
      const { enrollmentId } = this.enrollment.draft();
      if (enrollmentId) await this.docs.markDocsComplete(enrollmentId, true);
      // Carga descuentos disponibles para el paso 4 (fire-and-forget)
      const pd = this.enrollment.personalData();
      if (pd) void this.payment.loadAvailableDiscounts(pd.courseType);
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

  // ── Paso 4: Pago ──────────────────────────────────────────────────────────
  onStep4DataChange(data: EnrollmentPaymentData): void {
    if (data.paymentMethod) this.payment.setPaymentMethod(data.paymentMethod);

    // Descuento predefinido: rutar al facade (calcula monto automáticamente)
    const newId = data.selectedDiscountId;
    const currentId = this.payment.selectedDiscountId();
    if (newId !== currentId) {
      if (newId === null) {
        this.payment.clearDiscount();
      } else {
        this.payment.applyPredefinedDiscount(newId);
      }
    } else if (!newId) {
      // Descuento manual: el dumb component ya calculó el monto
      this.payment.setDiscount(data.discount);
    }
  }

  async onStep4Next(): Promise<void> {
    if (!this.step4Data().canAdvance) return;
    this._isSaving.set(true);
    try {
      const { enrollmentId, userId } = this.enrollment.draft();
      const ok = await this.payment.recordPayment(enrollmentId, userId);
      if (ok) this.enrollment.goToStep(5);
    } finally {
      this._isSaving.set(false);
    }
  }

  // ── Paso 5: Contrato ──────────────────────────────────────────────────────
  async onGenerateContract(): Promise<void> {
    this._contractStatus.set('generating');
    const url = await this.enrollment.generateContract();
    this._contractPdfUrl.set(url);
    this._contractStatus.set(url ? 'generated' : 'error');
  }

  onStep5DataChange(data: EnrollmentContractData): void {
    if (data.signedContract) this._signedContractUpload.set(data.signedContract);
  }

  async onStep5Next(): Promise<void> {
    const upload = this._signedContractUpload();
    if (!upload?.file) return;
    this._isSaving.set(true);
    try {
      await this.enrollment.uploadSignedContract(upload.file);
    } finally {
      this._isSaving.set(false);
    }
  }

  // ── Paso 6: Confirmación + cierre ────────────────────────────────────────
  async finishWizard(): Promise<void> {
    if (this.activeStep() === 5) {
      this._isSaving.set(true);
      try {
        await this.enrollment.confirmEnrollment();
      } finally {
        this._isSaving.set(false);
      }
    }
    this.layoutDrawer.close();
  }

  onDownloadReceipt(): void {
    // TODO: abrir URL del comprobante de pago cuando esté disponible vía EnrollmentPaymentFacade
  }

  onDownloadContract(): void {
    // TODO: abrir URL del contrato PDF cuando esté disponible vía EnrollmentFacade
  }

  // ── Utils ─────────────────────────────────────────────────────────────────
  private calcAge(birthDate: string): number {
    if (!birthDate) return 25;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
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
