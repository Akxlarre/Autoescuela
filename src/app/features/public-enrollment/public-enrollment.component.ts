import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  signal,
  effect,
  untracked,
  afterNextRender,
  viewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
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
import { PsychTestComponent } from '@shared/components/matricula-steps/psych-test/psych-test.component';

// Models
import type { BranchOption } from '@core/models/ui/branch.model';
import type {
  EnrollmentPersonalData,
  CourseCategory,
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
    CurrencyPipe,
    IconComponent,
    SkeletonBlockComponent,
    BranchCourseSelectorComponent,
    PersonalDataComponent,
    AssignmentComponent,
    DocumentsComponent,
    ContractComponent,
    PublicConfirmationComponent,
    PsychTestComponent,
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

          <!-- ═══ Draft restore banner ═══ -->
          @if (facade.hasDraftToRestore()) {
            <div class="space-y-6">
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 rounded-xl bg-brand-muted flex items-center justify-center shrink-0"
                >
                  <app-icon name="file-clock" [size]="22" />
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-primary mb-1">
                    Tienes una solicitud en curso
                  </h2>
                  <p class="text-sm text-secondary">
                    Encontramos una matrícula que iniciaste anteriormente. ¿Deseas retomar donde lo
                    dejaste?
                  </p>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  class="btn-primary flex-1 px-6 py-2.5 rounded-lg font-medium text-sm cursor-pointer flex items-center justify-center gap-2"
                  data-llm-action="restore-enrollment-draft"
                  (click)="onRestoreDraft()"
                >
                  <app-icon name="rotate-ccw" [size]="16" color="white" />
                  Retomar solicitud
                </button>
                <button
                  type="button"
                  class="flex-1 px-6 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary hover:border-(--ds-brand) transition-colors cursor-pointer"
                  data-llm-action="discard-enrollment-draft"
                  (click)="onDiscardDraft()"
                >
                  Empezar de nuevo
                </button>
              </div>
            </div>
          } @else {
            @switch (facade.currentStep()) {
              <!-- ═══ Step: Branch & Flow Selection ═══ -->
              @case ('branch') {
                @if (facade.branches().length === 0) {
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
                      Selecciona cómo deseas pagar tu matrícula. Esto determina la cantidad de
                      clases prácticas que se agendarán inicialmente.
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
                          <app-icon [name]="option.icon" [size]="20" color="var(--ds-brand)" />
                          <p class="text-base font-bold" style="color: var(--text-primary)">
                            {{ option.label }}
                          </p>
                        </div>
                        <p class="text-xs text-secondary">{{ option.description }}</p>
                        <div class="mt-4 pt-3 border-t border-border flex items-baseline gap-1.5">
                          <span class="text-2xl font-bold" style="color: var(--text-primary)">
                            {{ option.sessions }}
                          </span>
                          <span class="text-xs text-secondary">clases prácticas</span>
                        </div>
                      </button>
                    }
                  </div>

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
                  [hidePaymentMode]="true"
                  [stepNumber]="4"
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
                  [stepNumber]="5"
                  (fileSelected)="onFileSelected($event)"
                  (lightboxOpen)="onLightboxOpen($event)"
                  (next)="facade.confirmDocuments()"
                  (back)="facade.goBack()"
                />
              }

              <!-- ═══ Step: Contract (Clase B) ═══ -->
              @case ('contract') {
                <app-contract-step
                  [data]="step5Data()"
                  [loading]="facade.isLoading()"
                  [stepNumber]="6"
                  [isPublic]="true"
                  (generateContract)="onGenerateContract()"
                  (next)="onContractNext()"
                  (back)="facade.goBack()"
                />
              }

              <!-- ═══ Step: Payment — stub Transbank ═══ -->
              @case ('payment') {
                <div class="space-y-6">
                  <div>
                    <h2 class="text-lg font-semibold text-primary mb-2">Proceder al pago</h2>
                    <p class="text-sm text-secondary">
                      Revisa el resumen de tu matrícula antes de continuar.
                    </p>
                  </div>

                  <!-- Resumen -->
                  @if (facade.studentSummary(); as summary) {
                    <div class="card p-4 space-y-3">
                      <!-- Alumno -->
                      <div class="flex items-center gap-3">
                        <div
                          class="w-10 h-10 rounded-full bg-brand-muted flex items-center justify-center text-sm font-bold text-primary shrink-0"
                        >
                          {{ summary.initials }}
                        </div>
                        <div>
                          <p class="text-sm font-semibold text-primary">{{ summary.fullName }}</p>
                          <p class="text-xs text-secondary">{{ summary.courseLabel }}</p>
                        </div>
                      </div>

                      <!-- Sede -->
                      @if (facade.selectedBranch(); as branch) {
                        <div class="flex items-start gap-2 border-t border-border pt-3">
                          <app-icon
                            name="map-pin"
                            [size]="14"
                            class="text-secondary mt-0.5 shrink-0"
                          />
                          <div>
                            <p class="text-sm text-primary font-medium">{{ branch.name }}</p>
                            @if (branch.address) {
                              <p class="text-xs text-secondary">{{ branch.address }}</p>
                            }
                          </div>
                        </div>
                      }

                      <div
                        class="flex items-center justify-between text-sm border-t border-border pt-3"
                      >
                        <span class="text-secondary">Modalidad de pago</span>
                        <span class="font-medium text-primary">
                          {{ facade.paymentMode() === 'partial' ? 'Abono (50%)' : 'Pago total' }}
                        </span>
                      </div>
                      <div class="flex items-center justify-between text-sm">
                        <span class="text-secondary">Clases prácticas agendadas</span>
                        <span class="font-medium text-primary">
                          {{ facade.selectedSlotIds().length }}
                        </span>
                      </div>

                      <!-- Monto a pagar -->
                      <div class="flex items-center justify-between border-t border-border pt-3">
                        <span class="text-sm font-semibold text-primary">Total a pagar ahora</span>
                        <span class="text-lg font-bold text-primary">
                          {{
                            facade.paymentAmount()
                              | currency: 'CLP' : 'symbol-narrow' : '1.0-0' : 'es-CL'
                          }}
                        </span>
                      </div>
                    </div>
                  }

                  <!-- Aviso Webpay -->
                  <div class="flex items-start gap-3 rounded-lg bg-surface p-4 text-sm">
                    <app-icon name="info" [size]="18" color="var(--ds-brand)" />
                    <p class="text-secondary">
                      Serás redirigido a
                      <strong class="text-primary">Webpay</strong> para completar el pago de forma
                      segura. El agendamiento quedará confirmado una vez procesado el pago.
                    </p>
                  </div>

                  <!-- Navigation -->
                  <div class="flex justify-between pt-4">
                    <button
                      type="button"
                      class="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors cursor-pointer"
                      [disabled]="facade.isSubmitting()"
                      (click)="facade.goBack()"
                    >
                      <app-icon name="arrow-left" [size]="16" />
                      Volver
                    </button>
                    <button
                      type="button"
                      class="btn-primary px-6 py-2.5 rounded-lg font-medium text-sm cursor-pointer flex items-center gap-2 disabled:opacity-60"
                      [disabled]="facade.isSubmitting()"
                      data-llm-action="proceed-to-payment"
                      (click)="onPaymentProceed()"
                    >
                      @if (facade.isSubmitting()) {
                        <app-icon
                          name="loader-circle"
                          [size]="16"
                          color="white"
                          class="animate-spin"
                        />
                        Procesando...
                      } @else {
                        <app-icon name="credit-card" [size]="16" color="white" />
                        Proceder al pago
                      }
                    </button>
                  </div>
                </div>
              }

              <!-- ═══ Step: Intro Test Psicológico (Professional) ═══ -->
              @case ('psych-test-intro') {
                <div class="space-y-6">
                  <div class="flex items-start gap-4">
                    <div
                      class="w-12 h-12 rounded-xl bg-brand-muted flex items-center justify-center shrink-0"
                    >
                      <app-icon name="brain" [size]="22" color="var(--ds-brand)" />
                    </div>
                    <div>
                      <h2 class="text-lg font-semibold text-primary mb-1">Test Psicológico EPQ</h2>
                      <p class="text-sm text-secondary">
                        Como parte del proceso de matrícula para Clase Profesional, debes completar
                        un cuestionario psicológico obligatorio.
                      </p>
                    </div>
                  </div>

                  <div class="card p-4 space-y-3">
                    <div class="flex items-start gap-3">
                      <app-icon
                        name="clipboard-list"
                        [size]="16"
                        color="var(--ds-brand)"
                        class="mt-0.5 shrink-0"
                      />
                      <p class="text-sm text-secondary">
                        <span class="font-medium text-primary">81 preguntas</span> de respuesta Sí /
                        No.
                      </p>
                    </div>
                    <div class="flex items-start gap-3">
                      <app-icon
                        name="clock"
                        [size]="16"
                        color="var(--ds-brand)"
                        class="mt-0.5 shrink-0"
                      />
                      <p class="text-sm text-secondary">
                        Tiempo estimado:
                        <span class="font-medium text-primary">10–15 minutos</span>. Responde con
                        calma y sin interrupciones.
                      </p>
                    </div>
                    <div class="flex items-start gap-3">
                      <app-icon
                        name="info"
                        [size]="16"
                        color="var(--ds-brand)"
                        class="mt-0.5 shrink-0"
                      />
                      <p class="text-sm text-secondary">
                        No hay respuestas correctas ni incorrectas. Responde según lo que sientes
                        que describe mejor tu forma de ser.
                      </p>
                    </div>
                  </div>

                  <div class="flex justify-between pt-2">
                    <button
                      type="button"
                      class="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors cursor-pointer"
                      (click)="facade.goBack()"
                    >
                      <app-icon name="arrow-left" [size]="16" />
                      Volver
                    </button>
                    <button
                      type="button"
                      class="btn-primary px-6 py-2.5 rounded-lg font-medium text-sm cursor-pointer flex items-center gap-2"
                      data-llm-action="start-psych-test"
                      (click)="facade.startPsychTest()"
                    >
                      <app-icon name="brain" [size]="16" color="white" />
                      Comenzar test
                    </button>
                  </div>
                </div>
              }

              <!-- ═══ Step: Test Psicológico (Professional) ═══ -->
              @case ('psych-test') {
                <app-psych-test
                  [answers]="facade.psychTestAnswers()"
                  [loading]="facade.isSubmitting()"
                  (answersChange)="onPsychTestAnswersChange($event)"
                  (next)="onPsychTestNext()"
                  (back)="facade.goBack()"
                />
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
          }
        </div>
      </div>

      <!-- Footer -->
      <p class="relative z-10 mt-8 text-xs text-muted text-center">
        Escuela de Conductores Chillán — Matrícula Online
      </p>

      <!-- Lightbox overlay -->
      @if (_lightboxUrl()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada de foto"
          (click)="onLightboxOpen(null)"
        >
          <button
            type="button"
            class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Cerrar vista ampliada"
            (click)="onLightboxOpen(null)"
          >
            <app-icon name="x" [size]="20" color="white" />
          </button>
          <img
            [src]="_lightboxUrl()"
            class="max-h-[85dvh] max-w-full rounded-2xl shadow-2xl object-contain"
            alt="Foto carnet ampliada"
            (click)="$event.stopPropagation()"
          />
        </div>
      }
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
  readonly _lightboxUrl = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      // Siempre cargar branches (necesario con o sin draft)
      void this.facade.loadBranches();

      // Solo resetear si no hay un borrador que ofrecer al usuario
      if (!this.facade.hasDraftToRestore()) {
        this.facade.reset();
      }

      const el = this.headerRef()?.nativeElement;
      if (el) this.gsap.animateHero(el);
    });

    // Auto-load instructors when entering schedule step.
    // If there's a pre-selected instructor (draft restore) and no grid, load it preserving slots.
    effect(() => {
      const step = this.facade.currentStep();
      const branch = this.facade.selectedBranch();
      if (step === 'schedule' && branch) {
        void this.facade.loadInstructors(branch.id);
        const selectedId = untracked(() => this.facade.selectedInstructorId());
        if (selectedId && !untracked(() => this.facade.scheduleGrid())) {
          void this.facade.loadScheduleGrid(selectedId, true);
        }
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Computed: step data models
  // ══════════════════════════════════════════════════════════════════════════════

  readonly step1Data = computed<EnrollmentPersonalData>(() => {
    const form = this._step1Form();
    const flow = this.facade.flowType();
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
    const photoUrl = this.facade.carnetPhotoUrl();
    return {
      view: 'class-b' as const,
      studentSummary: summary,
      isMinor: false,
      photoTab: 'upload' as const,
      cameraState: 'idle' as const,
      carnetPhoto: photoUrl
        ? { source: 'upload' as const, capturedDataUrl: photoUrl, fileName: 'foto-carnet.jpg' }
        : null,
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

  readonly paymentModeOptions = computed(() => {
    const total = this.facade.basePracticalSlotCount() || 12;
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
    this.facade.savePersonalData(this._step1Form());
  }

  onPaymentModeConfirm(): void {
    this.facade.confirmPaymentMode();
  }

  onAssignmentDataChange(data: EnrollmentAssignmentData): void {
    if (data.instructorId !== this.facade.selectedInstructorId()) {
      if (data.instructorId != null) {
        void this.facade.loadScheduleGrid(data.instructorId);
      }
      // Don't restore old slot IDs — loadScheduleGrid already cleared them.
      return;
    }
    this.facade.setSelectedSlots(data.slotSelection.selectedSlotIds);
  }

  async onScheduleNext(): Promise<void> {
    await this.facade.confirmSchedule();
  }

  onLightboxOpen(url: string | null): void {
    this._lightboxUrl.set(url);
  }

  onFileSelected(event: { type: string; file: File }): void {
    if (event.type === 'id_photo') {
      void this.facade.uploadCarnetPhoto(event.file);
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
    this._contractStatus.set('generating');
    // TBD: llamar Edge Function para generar PDF de contrato
    setTimeout(() => this._contractStatus.set('generated'), 1000);
  }

  /** Confirma contrato y avanza al paso de pago (no envía aún). */
  onContractNext(): void {
    this.facade.confirmContract();
  }

  /** Inicia el pago. Actualmente envía directamente; con Transbank redirigirá a Webpay. */
  async onPaymentProceed(): Promise<void> {
    await this.facade.initiatePayment();
  }

  onPsychTestAnswersChange(answers: (boolean | null)[]): void {
    this.facade.savePsychTestAnswers(answers);
  }

  async onPsychTestNext(): Promise<void> {
    const result = await this.facade.submitPreInscription();
    if (result.success) {
      this.facade.confirmPsychTest();
    }
  }

  /** Restaura el borrador guardado y retoma el wizard desde el paso guardado. */
  onRestoreDraft(): void {
    this.facade.restoreDraft();
  }

  /** Descarta el borrador y comienza el wizard desde cero. */
  onDiscardDraft(): void {
    this.facade.discardDraft();
    this.facade.reset();
  }
}
