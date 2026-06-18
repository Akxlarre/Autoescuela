import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  signal,
  effect,
  untracked,
  afterNextRender,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { PublicEnrollmentFacade } from '@core/facades/public-enrollment.facade';
import { branchIdToTheme, type SedeTheme } from '@core/utils/sede-theme.utils';
import { formatCLP } from '@core/utils/date.utils';
import { calcAge } from '@core/utils/age.utils';
import { IconComponent } from '@shared/components/icon/icon.component';

// Public step components (dumb)
import { PublicWizardShellComponent } from '@shared/components/public-enrollment-steps/public-wizard-shell/public-wizard-shell.component';
import {
  PublicOrientationComponent,
  type PublicOrientationLink,
} from '@shared/components/public-enrollment-steps/public-orientation/public-orientation.component';
import { PublicLicenseTypeComponent } from '@shared/components/public-enrollment-steps/public-license-type/public-license-type.component';
import { PublicPersonalDataComponent } from '@shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component';
import {
  PublicPaymentModeComponent,
  type PublicPaymentModeOption,
} from '@shared/components/public-enrollment-steps/public-payment-mode/public-payment-mode.component';
import { PublicScheduleComponent } from '@shared/components/public-enrollment-steps/public-schedule/public-schedule.component';
import { PublicDocumentsComponent } from '@shared/components/public-enrollment-steps/public-documents/public-documents.component';
import { PublicContractComponent } from '@shared/components/public-enrollment-steps/public-contract/public-contract.component';
import {
  PublicPaymentComponent,
  type PublicPaymentSummary,
} from '@shared/components/public-enrollment-steps/public-payment/public-payment.component';
import { PsychTestComponent } from '@shared/components/matricula-steps/psych-test/psych-test.component';
import { PublicConfirmationComponent } from '@shared/components/matricula-steps/public-confirmation/public-confirmation.component';

// Models
import type { EnrollmentPersonalData } from '@core/models/ui/enrollment-personal-data.model';
import type {
  EnrollmentAssignmentData,
  PaymentMode,
} from '@core/models/ui/enrollment-assignment.model';
import type { EnrollmentDocumentsData } from '@core/models/ui/enrollment-documents.model';
import type { EnrollmentContractData } from '@core/models/ui/enrollment-contract.model';
import type { PublicEnrollmentContext } from '@core/models/ui/public-enrollment-context.model';
import type { PublicFlowType } from '@core/facades/public-enrollment.facade';

const DEFAULT_PERSONAL_DATA: EnrollmentPersonalData = {
  rut: '',
  firstNames: '',
  paternalLastName: '',
  maternalLastName: '',
  email: '',
  phone: '',
  birthDate: '',
  gender: '',
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
    IconComponent,
    PublicWizardShellComponent,
    PublicOrientationComponent,
    PublicLicenseTypeComponent,
    PublicPersonalDataComponent,
    PublicPaymentModeComponent,
    PublicScheduleComponent,
    PublicDocumentsComponent,
    PublicContractComponent,
    PublicPaymentComponent,
    PsychTestComponent,
    PublicConfirmationComponent,
  ],
  template: `
    @if (resolving()) {
      <!-- ═══ Resolviendo entrada (carga inicial) ═══ -->
      <div class="flex min-h-dvh items-center justify-center px-4">
        <div class="flex flex-col items-center gap-3">
          <app-icon name="loader-circle" [size]="32" color="var(--ds-brand)" class="animate-spin" />
          <p class="text-sm" style="color: var(--text-secondary);">Cargando tu inscripción…</p>
        </div>
      </div>
    } @else if (facade.hasDraftToRestore()) {
      <!-- ═══ Retomar borrador ═══ -->
      <div class="flex min-h-dvh items-center justify-center px-4 py-8">
        <div
          class="w-full max-w-md surface-glass rounded-2xl p-6 sm:p-8 space-y-6"
          style="box-shadow: var(--pe-shadow-xl, var(--shadow-lg));"
        >
          <div class="flex items-start gap-4">
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              style="background: var(--color-primary-muted);"
            >
              <app-icon name="file-clock" [size]="22" color="var(--ds-brand)" />
            </div>
            <div>
              <h2
                class="font-bold mb-1"
                style="font-family: var(--font-display); font-size: 1.15rem; color: var(--text-primary);"
              >
                Tienes una solicitud en curso
              </h2>
              @if (facade.draftMeta(); as meta) {
                <p class="text-sm" style="color: var(--text-secondary);">
                  Guardado
                  <strong style="color: var(--text-primary);">{{ meta.savedAtHuman }}</strong> ·
                  Paso: <strong style="color: var(--text-primary);">{{ meta.stepLabel }}</strong>
                </p>
              } @else {
                <p class="text-sm" style="color: var(--text-secondary);">
                  Encontramos una matrícula que iniciaste antes. ¿Deseas retomarla?
                </p>
              }
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              class="btn-primary flex-1 px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
              data-llm-action="restore-enrollment-draft"
              (click)="onRestoreDraft()"
            >
              <app-icon name="rotate-ccw" [size]="16" color="white" />
              Retomar
            </button>
            <button
              type="button"
              class="btn-secondary flex-1 px-6 py-2.5 rounded-xl font-semibold text-sm"
              data-llm-action="discard-enrollment-draft"
              (click)="onDiscardDraft()"
            >
              Empezar de nuevo
            </button>
          </div>
        </div>
      </div>
    } @else if (facade.entryState() === 'orientation') {
      <!-- ═══ Orientación (sin sede válida) — AC-E1/AC-E3 ═══ -->
      <div class="flex min-h-dvh items-center justify-center px-4 py-8">
        <div
          class="w-full max-w-md surface-glass rounded-2xl p-6 sm:p-8"
          style="box-shadow: var(--pe-shadow-xl, var(--shadow-lg));"
        >
          <app-public-orientation [siteLinks]="siteLinks()" />
        </div>
      </div>
    } @else {
      <!-- ═══ Wizard (sede resuelta) ═══ -->
      <app-public-wizard-shell
        [steps]="facade.steps()"
        [currentStep]="facade.currentStep()"
        [title]="shellTitle()"
        [subtitle]="shellSubtitle()"
        [brandName]="brandName()"
        [whatsappUrl]="whatsappUrl()"
        (helpClick)="onHelpClick()"
      >
        <!-- Error banner -->
        @if (facade.error()) {
          <div
            class="mb-5 flex items-center gap-3 rounded-xl p-3 text-sm"
            style="
              background: var(--state-error-bg);
              border: 1px solid var(--state-error-border);
              color: var(--state-error);
            "
            role="alert"
          >
            <app-icon name="circle-alert" [size]="18" color="var(--state-error)" />
            <span class="flex-1">{{ facade.error() }}</span>
            <button
              type="button"
              class="cursor-pointer"
              style="color: var(--state-error);"
              aria-label="Cerrar error"
              (click)="facade.clearError()"
            >
              <app-icon name="x" [size]="16" color="var(--state-error)" />
            </button>
          </div>
        }

        @switch (facade.currentStep()) {
          @case ('license-type') {
            <app-public-license-type
              [availableFlows]="facade.availableFlows()"
              [currentFlow]="facade.flowType()"
              (flowSelect)="onFlowSelect($event)"
              (next)="onLicenseTypeNext()"
            />
          }

          @case ('personal-data') {
            <app-public-personal-data
              [data]="step1Data()"
              [context]="context()"
              (dataChange)="onPersonalDataChange($event)"
              (next)="onPersonalDataNext()"
              (back)="facade.goBack()"
            />
          }

          @case ('payment-mode') {
            <app-public-payment-mode
              [options]="paymentModeOptions()"
              (modeSelect)="facade.setPaymentMode($event)"
              (next)="onPaymentModeConfirm()"
              (back)="facade.goBack()"
            />
          }

          @case ('schedule') {
            <app-public-schedule
              [data]="step2Data()"
              [loading]="facade.isLoading() || facade.isSubmitting()"
              (dataChange)="onAssignmentDataChange($event)"
              (next)="onScheduleNext()"
              (back)="facade.goBack()"
            />
          }

          @case ('documents') {
            <app-public-documents
              [data]="step3Data()"
              [isUploading]="facade.isLoading()"
              (fileSelected)="onFileSelected($event)"
              (clearPhoto)="facade.clearCarnetPhoto()"
              (next)="facade.confirmDocuments()"
              (back)="facade.goBack()"
            />
          }

          @case ('contract') {
            <app-public-contract
              [data]="step5Data()"
              (contractSigned)="onContractSigned($event)"
              (goBack)="facade.goBack()"
            />
          }

          @case ('payment') {
            <app-public-payment
              [summary]="paymentSummary()"
              (proceed)="onPaymentProceed()"
              (back)="facade.goBack()"
            />
          }

          @case ('psych-test-intro') {
            <div class="space-y-5">
              <div class="flex items-start gap-4">
                <div
                  class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  style="background: var(--color-primary-muted);"
                >
                  <app-icon name="brain" [size]="22" color="var(--ds-brand)" />
                </div>
                <div>
                  <h2
                    class="font-bold mb-1"
                    style="font-family: var(--font-display); font-size: 1.3rem; color: var(--text-primary);"
                  >
                    Test Psicológico EPQ
                  </h2>
                  <p class="text-sm" style="color: var(--text-secondary);">
                    Como parte del proceso para Clase Profesional, debes completar un cuestionario
                    psicológico obligatorio.
                  </p>
                </div>
              </div>

              <div
                class="rounded-xl p-4 space-y-3"
                style="background: var(--bg-surface); border: 1px solid var(--border-default);"
              >
                <div class="flex items-start gap-3 text-sm" style="color: var(--text-secondary);">
                  <app-icon
                    name="clipboard-list"
                    [size]="16"
                    color="var(--ds-brand)"
                    class="mt-0.5 shrink-0"
                  />
                  <span
                    ><strong style="color: var(--text-primary);">81 preguntas</strong> de respuesta
                    Sí / No.</span
                  >
                </div>
                <div class="flex items-start gap-3 text-sm" style="color: var(--text-secondary);">
                  <app-icon
                    name="clock"
                    [size]="16"
                    color="var(--ds-brand)"
                    class="mt-0.5 shrink-0"
                  />
                  <span
                    >Tiempo estimado:
                    <strong style="color: var(--text-primary);">10–15 minutos</strong>.</span
                  >
                </div>
                <div class="flex items-start gap-3 text-sm" style="color: var(--text-secondary);">
                  <app-icon
                    name="info"
                    [size]="16"
                    color="var(--ds-brand)"
                    class="mt-0.5 shrink-0"
                  />
                  <span
                    >No hay respuestas correctas ni incorrectas. Responde según tu forma de
                    ser.</span
                  >
                </div>
              </div>

              <div class="flex justify-between pt-2">
                <button
                  type="button"
                  class="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
                  style="color: var(--text-secondary);"
                  (click)="facade.goBack()"
                >
                  <app-icon name="arrow-left" [size]="16" />
                  Volver
                </button>
                <button
                  type="button"
                  class="btn-primary flex items-center gap-2 px-7 py-2.5 rounded-xl font-semibold text-sm"
                  data-llm-action="start-psych-test"
                  (click)="facade.startPsychTest()"
                >
                  <app-icon name="brain" [size]="16" color="white" />
                  Comenzar test
                </button>
              </div>
            </div>
          }

          @case ('psych-test') {
            <app-psych-test
              [answers]="facade.psychTestAnswers()"
              [loading]="facade.isSubmitting()"
              (answersChange)="onPsychTestAnswersChange($event)"
              (next)="onPsychTestNext()"
              (back)="facade.goBack()"
            />
          }

          @case ('confirmation') {
            <app-public-confirmation
              type="class_b"
              [enrollmentNumber]="facade.result()?.enrollmentNumber ?? null"
              [message]="facade.result()?.message ?? null"
            />
          }

          @case ('pre-confirmation') {
            <app-public-confirmation
              type="pre-inscription"
              [enrollmentNumber]="null"
              [message]="facade.result()?.message ?? null"
            />
          }
        }
      </app-public-wizard-shell>
    }
  `,
  host: {
    '[attr.data-public-theme]': 'theme()',
  },
})
export class PublicEnrollmentComponent {
  readonly facade = inject(PublicEnrollmentFacade);
  private readonly route = inject(ActivatedRoute);

  // ── URL context (sede tenant) ──
  private readonly _urlBranchIdentifier = signal<number | string | null>(null);
  private _urlCourseId: number | null = null;

  /** true mientras se resuelve la entrada (loadBranches + resolveEntry) en init. */
  readonly resolving = signal(true);

  // ── Local form state (pre-save) ──
  private readonly _step1Form = signal<EnrollmentPersonalData>(DEFAULT_PERSONAL_DATA);

  /** Tema de sede para `[data-public-theme]` — desde la sede resuelta o el branchId de la URL. */
  readonly theme = computed<SedeTheme>(() => {
    const resolvedBranchId = this.facade.selectedBranch()?.id;
    if (resolvedBranchId) return branchIdToTheme(resolvedBranchId);

    const urlId = this._urlBranchIdentifier();
    return typeof urlId === 'number' ? branchIdToTheme(urlId) : branchIdToTheme(null);
  });

  constructor() {
    // Capturar params de la URL de forma síncrona
    const branchIdParam = this.route.snapshot.queryParamMap.get('branchId');
    const sedeParam = this.route.snapshot.queryParamMap.get('sede');
    const courseIdParam = this.route.snapshot.queryParamMap.get('courseId');
    const resumeParam = this.route.snapshot.queryParamMap.get('resume');

    const parsedBranch = branchIdParam ? parseInt(branchIdParam, 10) : null;
    const identifier = sedeParam ?? (Number.isFinite(parsedBranch) ? parsedBranch : null);

    const parsedCourse = courseIdParam ? parseInt(courseIdParam, 10) : null;
    this._urlBranchIdentifier.set(identifier);
    this._urlCourseId = Number.isFinite(parsedCourse) ? parsedCourse : null;

    afterNextRender(() => {
      void this.facade.loadBranches().then(async () => {
        // Si hay borrador, verificar si choca con la sede de la URL. Si es distinta, se descarta.
        const draftMeta = this.facade.draftMeta();
        if (draftMeta && identifier !== null) {
          const branches = this.facade.branches();
          const draftBranchId = branches.find((b) => b.slug === draftMeta.branchSlug)?.id;
          const targetBranchId =
            typeof identifier === 'number'
              ? identifier
              : branches.find((b) => b.slug === identifier)?.id;

          if (draftBranchId && targetBranchId && draftBranchId !== targetBranchId) {
            this.facade.discardDraft();
            this.facade.reset();
          }
        }

        // Si hay borrador válido para esta sede, ofrecer retomarlo antes de resolver la entrada por URL.
        if (this.facade.hasDraftToRestore()) {
          if (resumeParam === 'true') {
            await this.facade.restoreDraft();
          }
        } else {
          await this.facade.resolveEntry(this._urlBranchIdentifier(), this._urlCourseId);
        }
        this.resolving.set(false);
      });
    });

    // Auto-cargar instructores al entrar al paso de horario.
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

    // Sincronizar el borrador restaurado (o datos guardados) hacia el formulario local.
    // Esto asegura que al presionar "Volver" hacia el paso 1, los datos se mantengan.
    effect(() => {
      const draftData = this.facade.personalData();
      if (draftData) {
        untracked(() => this._step1Form.set(draftData));
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Computed: shell + context
  // ══════════════════════════════════════════════════════════════════════════════

  readonly brandName = computed<string>(() => this.facade.selectedBranch()?.name ?? 'Autoescuela');

  /** WhatsApp de la sede — usando el teléfono de la sede si existe, o uno por defecto */
  readonly whatsappUrl = computed<string | null>(() => {
    const branch = this.facade.selectedBranch();
    if (!branch?.phone) return 'https://wa.me/';
    const cleanPhone = branch.phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanPhone}`;
  });

  /** Enlaces a las webs de cada escuela para la pantalla de orientación (AC-E1). */
  readonly siteLinks = computed<PublicOrientationLink[]>(() =>
    this.facade.branches().map((b) => ({
      label: b.name,
      // TODO(spec-0009): URL real de cada landing Astro (config pendiente).
      url: '#',
      theme: branchIdToTheme(b.id),
    })),
  );

  readonly shellTitle = computed<string>(() => {
    switch (this.facade.currentStep()) {
      case 'payment':
        return 'Revisa y confirma';
      case 'psych-test-intro':
      case 'psych-test':
        return 'Evaluación psicológica';
      case 'confirmation':
      case 'pre-confirmation':
        return '¡Felicitaciones!';
      default:
        return 'Completa tu matrícula';
    }
  });

  readonly shellSubtitle = computed<string | null>(() => {
    switch (this.facade.currentStep()) {
      case 'license-type':
        return 'Elige el tipo de licencia para comenzar.';
      case 'personal-data':
        return 'Estás a pocos pasos de asegurar tu cupo.';
      case 'payment-mode':
        return 'Define cómo y cuánto pagar ahora.';
      case 'schedule':
        return 'Agenda tus clases prácticas.';
      case 'documents':
        return 'Sube tu foto carnet.';
      case 'contract':
        return 'Revisa y firma tu contrato.';
      case 'payment':
        return 'Este es el resumen antes de pagar.';
      default:
        return null;
    }
  });

  /** Contexto curso + escuela + precio para el banner (AC3/AC5). */
  readonly context = computed<PublicEnrollmentContext | null>(() => {
    const branch = this.facade.selectedBranch();
    if (!branch) return null;
    const flow = this.facade.flowType();
    const pd = this.facade.personalData();
    const opts = this.facade.courseOptions();

    // Para profesional: precio mínimo entre todos los cursos disponibles.
    // El alumno aún no eligió subtipo (A2/A3/A4/A5) — la escuela lo define al contactarlo.
    if (flow === 'professional') {
      const profCourses = opts.filter((o) => o.category === 'professional');
      if (!profCourses.length) return null;
      const minPrice = Math.min(...profCourses.map((c) => c.basePrice));
      const maxPrice = Math.max(...profCourses.map((c) => c.basePrice));
      const priceLabel =
        minPrice === maxPrice ? formatCLP(minPrice) : `desde ${formatCLP(minPrice)}`;
      return {
        courseName: 'Clase Profesional',
        courseType: profCourses[0].type,
        branchName: branch.name,
        branchAddress: branch.address ?? '',
        theme: this.theme(),
        price: minPrice,
        priceLabel,
        canEdit: this.facade.availableFlows().length > 1,
      };
    }

    let course = pd ? opts.find((o) => o.type === pd.courseType) : undefined;
    if (!course) course = opts.find((o) => o.type === 'class_b');
    if (!course) return null;

    return {
      courseName: course.label,
      courseType: course.type,
      branchName: branch.name,
      branchAddress: branch.address ?? '',
      theme: this.theme(),
      price: course.basePrice,
      priceLabel: formatCLP(course.basePrice),
      // "Editar selección" solo tiene sentido si hay más de un flujo que elegir.
      canEdit: this.facade.availableFlows().length > 1,
    };
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Computed: step data models (reutilizan los modelos UI compartidos)
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
    return { ...form, courseCategory, courseType, courses: this.facade.courseOptions() };
  });

  readonly step2Data = computed<EnrollmentAssignmentData>(() => {
    const summary = this.facade.studentSummary() ?? EMPTY_SUMMARY;
    const slotIds = this.facade.selectedSlotIds();
    const required = this.facade.requiredSlotCount();
    return {
      view: 'class-b' as const,
      studentSummary: summary,
      paymentMode: this.facade.paymentMode(),
      totalSessions: required,
      instructorId: this.facade.selectedInstructorId(),
      instructors: this.facade.instructors(),
      scheduleGrid: this.facade.scheduleGrid(),
      scheduleLoading: this.facade.isLoading(),
      slotSelection: {
        selectedSlotIds: slotIds,
        requiredCount: required,
        currentCount: slotIds.length,
        maxClassesPerDay: this.facade.maxClassesPerDay(),
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

  readonly step5Data = computed<EnrollmentContractData>(() => {
    const pd = this.facade.personalData() ?? this._step1Form();
    const birthDateStr = pd?.birthDate;
    const minor = birthDateStr ? (calcAge(birthDateStr) ?? 99) < 18 : false;
    return {
      studentSummary: this.facade.studentSummary() ?? EMPTY_SUMMARY,
      contractGeneration: {
        status: 'pending',
        pdfUrl: null,
        generatedAt: null,
        errorMessage: null,
      },
      signedContract: null,
      isMinor: minor,
      canAdvance: minor || !!this.facade.contractSignatureBase64(),
    };
  });

  readonly paymentModeOptions = computed<PublicPaymentModeOption[]>(() => {
    const total = this.facade.basePracticalSlotCount() || 12;
    const fullPrice = this.context()?.price ?? 0;
    const halfPrice = Math.ceil(fullPrice / 2);
    return [
      {
        value: 'total',
        label: 'Pago completo',
        description: `Pagas el valor completo hoy y agendas tus ${total} clases prácticas.`,
        icon: 'credit-card',
        price: fullPrice,
        priceLabel: formatCLP(fullPrice),
        sessions: total,
        badge: 'Recomendado',
      },
      {
        value: 'partial',
        label: 'Abono inicial',
        description: `Pagas el 50% ahora y agendas igualmente tus ${total} clases. El saldo lo completas cuando quieras desde tu portal o presencialmente.`,
        icon: 'wallet',
        price: halfPrice,
        priceLabel: formatCLP(halfPrice),
        sessions: total,
        badge: null,
      },
    ];
  });

  readonly paymentSummary = computed<PublicPaymentSummary>(() => {
    const grid = this.facade.scheduleGrid();
    const selected = new Set(this.facade.selectedSlotIds());
    const slots = grid ? grid.slots.filter((s) => selected.has(s.id)) : [];
    const amount = this.facade.paymentAmount();
    return {
      studentSummary: this.facade.studentSummary() ?? EMPTY_SUMMARY,
      branchName: this.facade.selectedBranch()?.name ?? '',
      courseName: this.context()?.courseName ?? '',
      paymentModeLabel: this.facade.paymentMode() === 'partial' ? 'Abono (50%)' : 'Pago total',
      scheduledSlots: slots,
      totalAmount: amount,
      totalLabel: formatCLP(amount),
      isSubmitting: this.facade.isSubmitting(),
    };
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Event handlers
  // ══════════════════════════════════════════════════════════════════════════════

  onHelpClick(): void {
    const url = this.whatsappUrl();
    if (url) window.open(url, '_blank', 'noopener');
  }

  onFlowSelect(flow: PublicFlowType): void {
    this.facade.selectFlowType(flow);
  }

  onLicenseTypeNext(): void {
    this.facade.confirmLicenseType();
  }

  onPersonalDataChange(data: EnrollmentPersonalData): void {
    this._step1Form.set(data);
  }

  async onPersonalDataNext(): Promise<void> {
    await this.facade.savePersonalData(this.step1Data());
    if (this.facade.error()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  onPaymentModeConfirm(): void {
    this.facade.confirmPaymentMode();
  }

  onAssignmentDataChange(data: EnrollmentAssignmentData): void {
    if (data.instructorId !== this.facade.selectedInstructorId()) {
      if (data.instructorId != null) {
        void this.facade.loadScheduleGrid(data.instructorId);
      }
      return;
    }
    this.facade.setSelectedSlots(data.slotSelection.selectedSlotIds);
  }

  async onScheduleNext(): Promise<void> {
    await this.facade.confirmSchedule();
  }

  onFileSelected(event: { type: string; file: File }): void {
    if (event.type === 'id_photo' && event.file) {
      void this.facade.uploadCarnetPhoto(event.file);
    }
  }

  onContractSigned(base64: string): void {
    this.facade.setSignedContract(base64);
    this.facade.confirmContract();
  }

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

  onRestoreDraft(): void {
    void this.facade.restoreDraft();
  }

  onDiscardDraft(): void {
    this.facade.discardDraft();
    this.facade.reset();
    void this.facade.resolveEntry(this._urlBranchIdentifier(), this._urlCourseId);
  }
}
