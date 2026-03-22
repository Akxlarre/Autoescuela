import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  signal,
  effect,
  afterNextRender,
  viewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { PublicEnrollmentFacade } from '@core/facades/public-enrollment.facade';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';

// Step components (dumb)
import { BranchCourseSelectorComponent } from '@shared/components/matricula-steps/branch-course-selector/branch-course-selector.component';
import { PersonalDataComponent } from '@shared/components/matricula-steps/personal-data/personal-data.component';
import { AssignmentComponent } from '@shared/components/matricula-steps/assignment/assignment.component';
import { DocumentsComponent } from '@shared/components/matricula-steps/documents/documents.component';
import { ContractComponent } from '@shared/components/matricula-steps/contract/contract.component';
import { PublicConfirmationComponent } from '@shared/components/matricula-steps/public-confirmation/public-confirmation.component';

// Models
import type { BranchOption } from '@core/models/ui/branch.model';
import type {
  EnrollmentPersonalData,
  CourseCategory,
  CourseType,
} from '@core/models/ui/enrollment-personal-data.model';
import type {
  EnrollmentAssignmentData,
  PaymentMode,
} from '@core/models/ui/enrollment-assignment.model';
import type { EnrollmentDocumentsData } from '@core/models/ui/enrollment-documents.model';
import type {
  EnrollmentContractData,
  ContractStatus,
  SignedContractUpload,
} from '@core/models/ui/enrollment-contract.model';
import type { PublicFlowType } from '@core/facades/public-enrollment.facade';

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
  selector: 'app-public-enrollment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IconComponent,
    SkeletonBlockComponent,
    BranchCourseSelectorComponent,
    PersonalDataComponent,
    AssignmentComponent,
    DocumentsComponent,
    ContractComponent,
    PublicConfirmationComponent,
  ],
  template: `
    <div class="relative flex min-h-dvh flex-col items-center overflow-hidden bg-base px-4 py-8">
      <!-- Orbs decorativos -->
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          class="absolute -left-40 -top-40 h-96 w-96 rounded-full blur-3xl"
          style="background: color-mix(in srgb, var(--ds-brand) 18%, transparent)"
        ></div>
        <div
          class="absolute -bottom-40 -right-20 h-80 w-80 rounded-full blur-3xl"
          style="background: color-mix(in srgb, var(--color-primary-dark) 14%, transparent)"
        ></div>
        <div
          class="absolute left-1/2 top-1/2 h-140 w-140 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style="background: color-mix(in srgb, var(--ds-brand) 6%, transparent)"
        ></div>
      </div>

      <!-- Header -->
      <div #headerRef class="relative z-10 mb-8 text-center">
        <h1 class="text-2xl font-bold text-primary mb-1">Matrícula Online</h1>
        <p class="text-sm text-secondary">Escuela de Conductores — Chillán</p>
      </div>

      <!-- Progress dots -->
      @if (facade.steps().length > 0 && !isConfirmationStep()) {
        <nav class="relative z-10 mb-8 flex items-center gap-2" aria-label="Progreso de matrícula">
          @for (step of facade.steps(); track step.id) {
            <div class="flex items-center gap-2">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all"
                [class.text-white]="step.status === 'active' || step.status === 'completed'"
                [style.background]="
                  step.status === 'active' || step.status === 'completed'
                    ? 'var(--ds-brand)'
                    : 'var(--bg-surface-elevated)'
                "
                [style.color]="
                  step.status === 'active' || step.status === 'completed'
                    ? 'white'
                    : 'var(--text-muted)'
                "
              >
                @if (step.status === 'completed') {
                  <app-icon name="check" [size]="14" color="white" />
                } @else {
                  {{ $index + 1 }}
                }
              </div>
              @if (!$last) {
                <div
                  class="h-0.5 w-6 rounded-full transition-colors"
                  [style.background]="
                    step.status === 'completed' ? 'var(--ds-brand)' : 'var(--border-default)'
                  "
                ></div>
              }
            </div>
          }
        </nav>
      }

      <!-- Step content card -->
      <div class="relative z-10 w-full max-w-2xl">
        <div class="surface-glass rounded-2xl p-6 sm:p-8 shadow-lg">
          <!-- Error banner -->
          @if (facade.error()) {
            <div
              class="mb-6 flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-sm text-secondary"
            >
              <app-icon name="circle-alert" [size]="18" color="var(--color-error)" />
              <span class="flex-1">{{ facade.error() }}</span>
              <button
                type="button"
                class="text-muted hover:text-primary cursor-pointer"
                (click)="facade.clearError()"
              >
                <app-icon name="x" [size]="16" />
              </button>
            </div>
          }

          @switch (facade.currentStep()) {
            <!-- ═══ Step: Branch & Flow Selection ═══ -->
            @case ('branch') {
              @if (facade.isLoading() && facade.branches().length === 0) {
                <div class="space-y-6">
                  <div>
                    <app-skeleton-block variant="text" width="40%" height="24px" />
                    <div class="mt-2">
                      <app-skeleton-block variant="text" width="75%" height="16px" />
                    </div>
                  </div>
                  <div class="grid sm:grid-cols-2 gap-4">
                    <app-skeleton-block variant="rect" width="100%" height="180px" />
                    <app-skeleton-block variant="rect" width="100%" height="180px" />
                  </div>
                </div>
              } @else {
                <app-branch-course-selector
                  [branches]="facade.branches()"
                  [coursePricing]="facade.branchCoursePricing()"
                  (branchSelect)="onBranchSelect($event)"
                  (flowSelect)="onFlowSelect($event)"
                  (confirm)="facade.confirmBranchSelection()"
                />
              }
            }

            <!-- ═══ Step: Personal Data ═══ -->
            @case ('personal-data') {
              <app-personal-data-step
                [data]="step1Data()"
                [branches]="[]"
                [selectedBranchId]="facade.selectedBranch()?.id ?? null"
                [hiddenCategories]="effectiveHiddenCategories()"
                (dataChange)="onPersonalDataChange($event)"
                (next)="onPersonalDataNext()"
                (cancel)="facade.goBack()"
              />
            }

            <!-- ═══ Step: Payment Mode (Clase B) ═══ -->
            @case ('payment-mode') {
              <div class="space-y-6">
                <div>
                  <h2 class="text-lg font-semibold text-primary mb-2">Modalidad de pago</h2>
                  <p class="text-sm text-secondary mb-6">
                    Selecciona cómo deseas pagar tu matrícula. Esto determina la cantidad de clases
                    prácticas que se agendarán inicialmente.
                  </p>
                </div>

                <div class="grid sm:grid-cols-2 gap-4">
                  @for (option of paymentModeOptions(); track option.value) {
                    <button
                      type="button"
                      class="group relative flex flex-col p-5 rounded-xl border-2 text-left transition-all cursor-pointer
                             hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      [class.border-[var(--ds-brand)]]="facade.paymentMode() === option.value"
                      [class.bg-brand-muted]="facade.paymentMode() === option.value"
                      [class.shadow-sm]="facade.paymentMode() === option.value"
                      [class.border-border]="facade.paymentMode() !== option.value"
                      [class.bg-surface]="facade.paymentMode() !== option.value"
                      data-llm-action="select-payment-mode"
                      (click)="facade.setPaymentMode(option.value)"
                    >
                      <div class="flex items-center gap-3 mb-2">
                        <app-icon [name]="option.icon" [size]="20" />
                        <p class="text-base font-bold text-primary">{{ option.label }}</p>
                      </div>
                      <p class="text-xs text-secondary">{{ option.description }}</p>
                      <div class="mt-3 flex items-center gap-2">
                        <span
                          class="text-xs px-2 py-0.5 rounded-full bg-surface-elevated text-secondary font-medium"
                        >
                          {{ option.sessions }} clases prácticas
                        </span>
                      </div>
                    </button>
                  }
                </div>

                <!-- Navigation -->
                <div class="flex justify-between pt-4">
                  <button
                    type="button"
                    class="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors cursor-pointer"
                    (click)="facade.goBack()"
                  >
                    <app-icon name="arrow-left" [size]="16" />
                    Volver
                  </button>
                  @if (facade.paymentMode()) {
                    <button
                      type="button"
                      class="btn-primary px-6 py-2.5 rounded-lg font-medium text-sm cursor-pointer"
                      data-llm-action="confirm-payment-mode"
                      (click)="onPaymentModeConfirm()"
                    >
                      Continuar
                    </button>
                  }
                </div>
              </div>
            }

            <!-- ═══ Step: Schedule / Instructor (Clase B) ═══ -->
            @case ('schedule') {
              <app-assignment-step
                [data]="step2Data()"
                [loading]="facade.isLoading()"
                (dataChange)="onAssignmentDataChange($event)"
                (next)="onScheduleNext()"
                (back)="facade.goBack()"
              />
            }

            <!-- ═══ Step: Documents (Clase B — only carnet photo) ═══ -->
            @case ('documents') {
              <app-documents-step
                [data]="step3Data()"
                [loading]="false"
                (fileSelected)="onFileSelected($event)"
                (next)="facade.confirmDocuments()"
                (back)="facade.goBack()"
              />
            }

            <!-- ═══ Step: Contract (Clase B) ═══ -->
            @case ('contract') {
              <app-contract-step
                [data]="step5Data()"
                [loading]="facade.isLoading()"
                (dataChange)="onContractDataChange($event)"
                (generateContract)="onGenerateContract()"
                (next)="onContractNext()"
                (back)="facade.goBack()"
              />
            }

            <!-- ═══ Step: Course Selection (Professional) ═══ -->
            @case ('course-selection') {
              <div class="space-y-6">
                <div>
                  <h2 class="text-lg font-semibold text-primary mb-2">
                    Selecciona tu curso profesional
                  </h2>
                  <p class="text-sm text-secondary mb-6">
                    Elige la clase de licencia profesional a la que deseas inscribirte.
                  </p>
                </div>

                <div class="grid gap-3">
                  @for (course of professionalCourses(); track course.type) {
                    <button
                      type="button"
                      class="flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all cursor-pointer
                             hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      [class.border-[var(--ds-brand)]]="
                        facade.selectedCourseType() === course.type &&
                        facade.convalidatesSimultaneously() === course.convalidation
                      "
                      [class.bg-brand-muted]="
                        facade.selectedCourseType() === course.type &&
                        facade.convalidatesSimultaneously() === course.convalidation
                      "
                      [class.border-border]="
                        facade.selectedCourseType() !== course.type ||
                        facade.convalidatesSimultaneously() !== course.convalidation
                      "
                      [class.bg-surface]="
                        facade.selectedCourseType() !== course.type ||
                        facade.convalidatesSimultaneously() !== course.convalidation
                      "
                      data-llm-action="select-professional-course"
                      (click)="facade.selectProfessionalCourse(course.type, course.convalidation)"
                    >
                      <div
                        class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-brand-muted"
                      >
                        <app-icon [name]="course.icon" [size]="20" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-primary">{{ course.label }}</p>
                        <p class="text-xs text-secondary">{{ course.description }}</p>
                      </div>
                    </button>
                  }
                </div>

                <!-- Navigation -->
                <div class="flex justify-between pt-4">
                  <button
                    type="button"
                    class="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors cursor-pointer"
                    (click)="facade.goBack()"
                  >
                    <app-icon name="arrow-left" [size]="16" />
                    Volver
                  </button>
                  @if (facade.selectedCourseType()) {
                    <button
                      type="button"
                      class="btn-primary px-6 py-2.5 rounded-lg font-medium text-sm cursor-pointer"
                      data-llm-action="confirm-course-selection"
                      (click)="onCourseSelectionConfirm()"
                    >
                      Enviar pre-inscripción
                    </button>
                  }
                </div>
              </div>
            }

            <!-- ═══ Confirmation (Clase B) ═══ -->
            @case ('confirmation') {
              <app-public-confirmation
                type="class_b"
                [enrollmentNumber]="facade.result()?.enrollmentNumber ?? null"
                [message]="facade.result()?.message ?? null"
              />
            }

            <!-- ═══ Pre-Confirmation (Professional) ═══ -->
            @case ('pre-confirmation') {
              <app-public-confirmation
                type="pre-inscription"
                [enrollmentNumber]="null"
                [message]="facade.result()?.message ?? null"
              />
            }
          }
        </div>
      </div>

      <!-- Footer -->
      <p class="relative z-10 mt-8 text-xs text-muted text-center">
        Escuela de Conductores Chillán — Matrícula Online
      </p>
    </div>
  `,
  host: { style: 'display: contents;' },
})
export class PublicEnrollmentComponent {
  readonly facade = inject(PublicEnrollmentFacade);
  private readonly gsap = inject(GsapAnimationsService);
  readonly headerRef = viewChild<ElementRef<HTMLElement>>('headerRef');

  // ── Local form state (pre-save) ──
  private readonly _step1Form = signal<EnrollmentPersonalData>(DEFAULT_PERSONAL_DATA);
  private readonly _contractStatus = signal<ContractStatus>('pending');
  private readonly _contractPdfUrl = signal<string | null>(null);
  private readonly _signedContractUpload = signal<SignedContractUpload | null>(null);

  constructor() {
    // Load branches on init
    afterNextRender(() => {
      this.facade.reset();
      void this.facade.loadBranches();

      const el = this.headerRef()?.nativeElement;
      if (el) this.gsap.animateHero(el);
    });

    // Auto-load instructors when entering schedule step
    effect(() => {
      const step = this.facade.currentStep();
      const branch = this.facade.selectedBranch();
      if (step === 'schedule' && branch) {
        void this.facade.loadInstructors(branch.id);
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Computed: step data models
  // ══════════════════════════════════════════════════════════════════════════════

  readonly step1Data = computed<EnrollmentPersonalData>(() => {
    const form = this._step1Form();
    const flow = this.facade.flowType();
    // Override category/type based on selected flow so the personal-data step
    // pre-selects the correct category and hides the irrelevant one.
    const courseCategory =
      flow === 'professional' ? 'professional' : form.courseCategory || 'non-professional';
    const courseType =
      flow === 'professional' && form.courseType === 'class_b'
        ? 'professional_a2'
        : form.courseType;

    return {
      ...form,
      courseCategory,
      courseType,
      courses: this.facade.courseOptions(),
    };
  });

  readonly step2Data = computed<EnrollmentAssignmentData>(() => {
    const pd = this.facade.personalData();
    const summary = this.facade.studentSummary() ?? EMPTY_SUMMARY;
    const slotIds = this.facade.selectedSlotIds();
    const paymentMode = this.facade.paymentMode();
    const required = this.facade.requiredSlotCount();

    return {
      view: 'class-b' as const,
      studentSummary: summary,
      paymentMode,
      totalSessions: required,
      instructorId: this.facade.selectedInstructorId(),
      instructors: this.facade.instructors(),
      scheduleGrid: this.facade.scheduleGrid(),
      scheduleLoading: this.facade.isLoading(),
      slotSelection: {
        selectedSlotIds: slotIds,
        requiredCount: required,
        currentCount: slotIds.length,
        isComplete: slotIds.length >= required,
      },
      promotionId: null,
      promotionGroups: [],
      convalidatesSimultaneously: false,
      convalidatedLicense: null,
    };
  });

  readonly step3Data = computed<EnrollmentDocumentsData>(() => {
    const summary = this.facade.studentSummary() ?? EMPTY_SUMMARY;
    return {
      view: 'class-b' as const,
      studentSummary: summary,
      isMinor: false,
      photoTab: 'upload' as const,
      cameraState: 'idle' as const,
      carnetPhoto: null,
      uploadedDocuments: new Map(),
      requiredDocuments: [],
      hvcValidation: null,
      notarialAuthorization: null,
    };
  });

  readonly step5Data = computed<EnrollmentContractData>(() => ({
    studentSummary: this.facade.studentSummary() ?? EMPTY_SUMMARY,
    contractGeneration: {
      status: this._contractStatus(),
      pdfUrl: this._contractPdfUrl(),
      generatedAt: null,
      errorMessage: this.facade.error() ?? null,
    },
    signedContract: this._signedContractUpload(),
    canAdvance: !!this._signedContractUpload()?.file,
  }));

  /** Hides the opposite category based on the selected flow, plus always hides singular. */
  readonly effectiveHiddenCategories = computed<CourseCategory[]>(() => {
    const base = this.facade.hiddenCourseCategories();
    const flow = this.facade.flowType();
    const hidden = new Set<CourseCategory>(base);
    if (flow === 'class_b') hidden.add('professional');
    if (flow === 'professional') hidden.add('non-professional');
    hidden.add('singular');
    return [...hidden];
  });

  readonly isConfirmationStep = computed(
    () =>
      this.facade.currentStep() === 'confirmation' ||
      this.facade.currentStep() === 'pre-confirmation',
  );

  /** Payment mode options derived from facade state. */
  readonly paymentModeOptions = computed(() => {
    const total = this.facade.requiredSlotCount() || 12;
    return [
      {
        value: 'total' as PaymentMode,
        label: 'Pago total',
        description: 'Paga el valor completo del curso y agenda todas tus clases prácticas.',
        icon: 'credit-card',
        sessions: total,
      },
      {
        value: 'partial' as PaymentMode,
        label: 'Abono (50%)',
        description: 'Paga la mitad del curso y agenda la primera mitad de tus clases prácticas.',
        icon: 'wallet',
        sessions: Math.ceil(total / 2),
      },
    ];
  });

  /** Professional course options for the course-selection step. */
  readonly professionalCourses = computed(() => {
    const courses = this.facade.courseOptions();
    const professional = courses.filter((c) => c.category === 'professional');
    const result: {
      type: CourseType;
      label: string;
      description: string;
      icon: string;
      convalidation: boolean;
    }[] = [];

    for (const c of professional) {
      if (c.type === 'professional_a2') {
        result.push({
          type: c.type,
          label: 'Clase A2',
          description: 'Taxis, vehículos de transporte de pasajeros.',
          icon: 'car',
          convalidation: false,
        });
        result.push({
          type: c.type,
          label: 'Clase A2 + convalidación A4',
          description: 'A2 con convalidación simultánea de Clase A4.',
          icon: 'car',
          convalidation: true,
        });
      } else if (c.type === 'professional_a3') {
        result.push({
          type: c.type,
          label: 'Clase A3',
          description: 'Vehículos de transporte de carga.',
          icon: 'truck',
          convalidation: false,
        });
      } else if (c.type === 'professional_a4') {
        result.push({
          type: c.type,
          label: 'Clase A4',
          description: 'Transporte escolar y de trabajadores.',
          icon: 'bus',
          convalidation: false,
        });
      } else if (c.type === 'professional_a5') {
        result.push({
          type: c.type,
          label: 'Clase A5',
          description: 'Vehículos de emergencia y maquinaria especial.',
          icon: 'settings',
          convalidation: false,
        });
        result.push({
          type: c.type,
          label: 'Clase A5 + convalidación A3',
          description: 'A5 con convalidación simultánea de Clase A3.',
          icon: 'settings',
          convalidation: true,
        });
      }
    }

    return result;
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Event handlers
  // ══════════════════════════════════════════════════════════════════════════════

  onBranchSelect(branch: BranchOption): void {
    void this.facade.selectBranch(branch);
  }

  onFlowSelect(flow: PublicFlowType): void {
    this.facade.selectFlowType(flow);
  }

  onPersonalDataChange(data: EnrollmentPersonalData): void {
    this._step1Form.set(data);
  }

  onPersonalDataNext(): void {
    const form = this._step1Form();
    this.facade.savePersonalData(form);
  }

  onPaymentModeConfirm(): void {
    this.facade.confirmPaymentMode();
  }

  onAssignmentDataChange(data: EnrollmentAssignmentData): void {
    // Sync instructor selection
    if (data.instructorId !== this.facade.selectedInstructorId()) {
      if (data.instructorId != null) {
        void this.facade.loadScheduleGrid(data.instructorId);
      }
    }
    // Sync slot selection
    this.facade.setSelectedSlots(data.slotSelection.selectedSlotIds);
  }

  onScheduleNext(): void {
    this.facade.confirmSchedule();
  }

  onFileSelected(event: { type: string; file: File }): void {
    if (event.type === 'carnet_photo') {
      this.facade.setCarnetPhoto(event.file);
    }
  }

  onContractDataChange(data: EnrollmentContractData): void {
    if (data.signedContract) {
      this._signedContractUpload.set(data.signedContract);
      if (data.signedContract.file) {
        this.facade.setSignedContract(data.signedContract.file);
      }
    }
  }

  onGenerateContract(): void {
    // TBD: Call Edge Function to generate contract PDF
    this._contractStatus.set('generating');
    // For now, mark as generated immediately (placeholder)
    setTimeout(() => this._contractStatus.set('generated'), 1000);
  }

  async onContractNext(): Promise<void> {
    this.facade.confirmContract();
    // Submit the complete enrollment
    await this.facade.submitClaseBEnrollment();
  }

  async onCourseSelectionConfirm(): Promise<void> {
    this.facade.confirmCourseSelection();
    // Submit the pre-inscription
    await this.facade.submitPreInscription();
  }
}
