import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Gender } from '@core/models/ui/enrollment-personal-data.model';
import { CursosSingularesFacade } from '@core/facades/cursos-singulares.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { formatRut, validateRut, normalizeRutForStorage } from '@core/utils/rut.utils';
import { calcAge } from '@core/utils/age.utils';
import { formatCLP } from '@core/utils/date.utils';
import type {
  SingularPersonalDataForm,
  SingularPaymentForm,
  SingularPaymentMethod,
} from '@core/models/ui/cursos-singulares.model';

const GENDER_OPTIONS: { value: Exclude<Gender, ''>; label: string }[] = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'X', label: 'Prefiero no especificar' },
];

const EMPTY_PERSONAL: SingularPersonalDataForm = {
  rut: '',
  firstNames: '',
  paternalLastName: '',
  maternalLastName: '',
  email: '',
  phone: '',
  birthDate: '',
  gender: 'M',
  address: '',
};

const PAYMENT_METHODS: {
  value: SingularPaymentMethod;
  label: string;
  icon: string;
  description: string;
}[] = [
  { value: 'efectivo', label: 'Efectivo', icon: 'banknote', description: 'Pago en caja' },
  {
    value: 'transferencia',
    label: 'Transferencia',
    icon: 'landmark',
    description: 'Transferencia bancaria',
  },
  { value: 'tarjeta', label: 'Débito/Crédito', icon: 'credit-card', description: 'Terminal POS' },
  {
    value: 'pendiente',
    label: 'Dejar pago pendiente',
    icon: 'clock',
    description: 'Cobrar después',
  },
];

@Component({
  selector: 'app-admin-curso-singular-inscribir-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IconComponent,
    AsyncBtnComponent,
    SkeletonBlockComponent,
    DateInputComponent,
    DrawerFormComponent,
  ],
  template: `
    <app-drawer-form [hasFooter]="false">
      <div class="flex flex-col gap-6 p-1">
        <!-- ── Encabezado del curso ──────────────────────────────────────────── -->
        @if (facade.selectedCurso(); as curso) {
          <div class="flex items-center gap-3 p-3 rounded-xl border bg-brand/8 border-brand/20">
            <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-brand/15">
              <app-icon name="star" [size]="16" color="var(--ds-brand)" />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold truncate text-text-primary">
                {{ curso.nombre }}
              </p>
              <p class="text-xs text-text-muted">
                {{ curso.cupos - curso.inscritos }} cupo{{
                  curso.cupos - curso.inscritos !== 1 ? 's' : ''
                }}
                disponible{{ curso.cupos - curso.inscritos !== 1 ? 's' : '' }}
              </p>
            </div>
          </div>
        }

        <!-- ── Indicador de paso ─────────────────────────────────────────────── -->
        <div class="flex items-center gap-2">
          @for (step of [1, 2]; track step) {
            <div
              class="flex items-center gap-2 text-xs font-semibold"
              [style.color]="facade.wizardStep() >= step ? 'var(--ds-brand)' : 'var(--text-muted)'"
            >
              <div
                class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                [style.background]="
                  facade.wizardStep() >= step ? 'var(--ds-brand)' : 'var(--bg-elevated)'
                "
                [style.color]="facade.wizardStep() >= step ? 'white' : 'var(--text-muted)'"
              >
                {{ step }}
              </div>
              {{ step === 1 ? 'Datos del alumno' : 'Pago' }}
            </div>
            @if (step < 2) {
              <div class="flex-1 h-px bg-border-muted"></div>
            }
          }
        </div>

        <!-- ══════════════════════════════════════════════════════════════════════
           PASO 1 — DATOS DEL ALUMNO
           ══════════════════════════════════════════════════════════════════ -->
        @if (facade.wizardStep() === 1) {
          <div class="flex flex-col gap-5">
            <!-- Búsqueda por RUT -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold uppercase tracking-wide text-text-muted">
                RUT del alumno *
              </label>
              <p class="text-xs leading-relaxed text-text-secondary">
                Puedes inscribir a cualquier persona, sea alumno nuevo o ya registrado. Al buscar el
                RUT, si ya existe en la escuela (Clase B o Profesional) sus datos se pre-cargarán
                automáticamente; si es nuevo, lo registras aquí mismo.
              </p>
              <div class="flex gap-2">
                <input
                  type="text"
                  [(ngModel)]="rutInput"
                  (ngModelChange)="onRutChange($event)"
                  placeholder="12.345.678-9"
                  maxlength="12"
                  class="flex-1 h-10 px-3 text-sm rounded-lg border transition-colors bg-base text-text-primary"
                  [class.border-error]="rutInput().length > 0 && !rutValido()"
                  [class.border-success]="rutValido()"
                  [class.border-border-subtle]="!rutInput().length"
                  data-llm-description="RUT del alumno a inscribir en el curso singular"
                />
                <button
                  type="button"
                  class="h-10 px-4 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  [style.background]="'var(--ds-brand)'"
                  style="color: white"
                  [disabled]="!rutValido() || facade.isSearching()"
                  (click)="onBuscar()"
                  data-llm-action="buscar-alumno-por-rut"
                >
                  @if (facade.isSearching()) {
                    <app-skeleton-block variant="text" width="60px" height="16px" />
                  } @else {
                    <app-icon name="search" [size]="14" color="white" />
                    Buscar
                  }
                </button>
              </div>
              @if (rutInput().length > 0 && !rutValido()) {
                <p class="text-xs text-error flex items-center gap-1 mt-1">
                  <app-icon name="circle-alert" [size]="12" color="var(--state-error)" />
                  RUT inválido — verifica el dígito verificador
                </p>
              } @else if (rutValido()) {
                <p class="text-xs text-success flex items-center gap-1 mt-1">
                  <app-icon name="check-circle" [size]="12" color="var(--state-success)" />
                  RUT válido
                </p>
              } @else {
                <p class="text-xs italic mt-1 text-text-muted">Formato: 12.345.678-9</p>
              }
            </div>

            <!-- Estado de búsqueda -->
            @if (facade.studentSearch(); as found) {
              <div
                class="flex items-center gap-3 p-3 rounded-xl border bg-success/8 border-success/25"
              >
                <app-icon name="check-circle" [size]="18" color="var(--state-success)" />
                <div>
                  <p class="text-sm font-semibold text-text-primary">
                    {{ found.nombreCompleto }}
                  </p>
                  <p class="text-xs text-text-muted">
                    Alumno encontrado — datos pre-cargados. Su identidad está protegida; solo puedes
                    actualizar email, teléfono y dirección.
                  </p>
                </div>
              </div>
            } @else if (facade.studentNotFound()) {
              <div class="flex items-start gap-3 p-3 rounded-xl border bg-info/8 border-info/25">
                <app-icon
                  name="user-plus"
                  [size]="18"
                  color="var(--state-info)"
                  class="mt-0.5 shrink-0"
                />
                <div>
                  <p class="text-sm font-semibold text-text-primary">Alumno nuevo</p>
                  <p class="text-xs leading-relaxed text-text-secondary">
                    Este RUT aún no está registrado en la escuela. Completa sus datos a continuación
                    para registrarlo e inscribirlo en el curso.
                  </p>
                </div>
              </div>
            }

            <!-- Formulario de datos personales (siempre visible tras buscar) -->
            @if (showForm()) {
              <div class="flex flex-col gap-4">
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1 col-span-2 sm:col-span-1">
                    <label class="text-xs font-bold uppercase tracking-wide text-text-muted"
                      >Nombres *</label
                    >
                    <input
                      type="text"
                      [(ngModel)]="form().firstNames"
                      (ngModelChange)="patchForm('firstNames', $event)"
                      [disabled]="esAlumnoExistente()"
                      class="h-10 px-3 text-sm rounded-lg border transition-colors bg-base text-text-primary border-border-subtle disabled:opacity-60"
                      placeholder="Juan Carlos"
                      data-llm-description="Nombres del alumno"
                    />
                  </div>
                  <div class="flex flex-col gap-1 col-span-2 sm:col-span-1">
                    <label class="text-xs font-bold uppercase tracking-wide text-text-muted"
                      >Ap. Paterno *</label
                    >
                    <input
                      type="text"
                      [(ngModel)]="form().paternalLastName"
                      (ngModelChange)="patchForm('paternalLastName', $event)"
                      [disabled]="esAlumnoExistente()"
                      class="h-10 px-3 text-sm rounded-lg border transition-colors bg-base text-text-primary border-border-subtle disabled:opacity-60"
                      placeholder="González"
                      data-llm-description="Apellido paterno del alumno"
                    />
                  </div>
                  <div class="flex flex-col gap-1 col-span-2 sm:col-span-1">
                    <label class="text-xs font-bold uppercase tracking-wide text-text-muted"
                      >Ap. Materno</label
                    >
                    <input
                      type="text"
                      [(ngModel)]="form().maternalLastName"
                      (ngModelChange)="patchForm('maternalLastName', $event)"
                      [disabled]="esAlumnoExistente()"
                      class="h-10 px-3 text-sm rounded-lg border transition-colors bg-base text-text-primary border-border-subtle disabled:opacity-60"
                      placeholder="Pérez"
                    />
                  </div>
                  <div class="flex flex-col gap-1 col-span-2 sm:col-span-1">
                    <label class="text-xs font-bold uppercase tracking-wide text-text-muted"
                      >Teléfono</label
                    >
                    <input
                      type="tel"
                      [(ngModel)]="form().phone"
                      (ngModelChange)="patchForm('phone', $event)"
                      class="h-10 px-3 text-sm rounded-lg border transition-colors bg-base text-text-primary border-border-subtle"
                      placeholder="+56 9 1234 5678"
                    />
                  </div>
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-xs font-bold uppercase tracking-wide text-text-muted"
                    >Email *</label
                  >
                  <input
                    type="email"
                    [(ngModel)]="form().email"
                    (ngModelChange)="patchForm('email', $event)"
                    class="h-10 px-3 text-sm rounded-lg border transition-colors bg-base text-text-primary border-border-subtle"
                    placeholder="alumno@ejemplo.com"
                    data-llm-description="Email del alumno"
                  />
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1">
                    <app-date-input
                      label="Fecha de nacimiento"
                      [value]="form().birthDate"
                      (valueChange)="patchForm('birthDate', $event)"
                    />
                    @if (form().birthDate.length > 0 && !edadValida()) {
                      <p class="text-xs text-state-error flex items-center gap-1">
                        <app-icon name="circle-alert" [size]="12" color="var(--state-error)" />
                        El alumno debe tener al menos 17 años
                      </p>
                    }
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-bold uppercase tracking-wide text-text-muted"
                      >Género</label
                    >
                    <div
                      class="flex rounded-lg overflow-hidden"
                      [style.border]="'1.5px solid var(--border-default)'"
                      role="radiogroup"
                    >
                      @for (opt of genderOptions; track opt.value; let last = $last) {
                        <button
                          type="button"
                          class="flex-1 py-2 text-xs text-center cursor-pointer transition-all"
                          [style.background]="
                            form().gender === opt.value
                              ? 'color-mix(in srgb, var(--ds-brand) 10%, transparent)'
                              : 'var(--bg-surface)'
                          "
                          [style.color]="
                            form().gender === opt.value
                              ? 'var(--ds-brand)'
                              : 'var(--text-secondary)'
                          "
                          [style.font-weight]="form().gender === opt.value ? '600' : '400'"
                          [style.border-right]="!last ? '1px solid var(--border-default)' : 'none'"
                          (click)="patchForm('gender', opt.value)"
                          [attr.aria-pressed]="form().gender === opt.value"
                          [attr.data-llm-action]="'select-gender-' + opt.value"
                        >
                          {{ opt.label }}
                        </button>
                      }
                    </div>
                  </div>
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-xs font-bold uppercase tracking-wide text-text-muted"
                    >Dirección</label
                  >
                  <input
                    type="text"
                    [(ngModel)]="form().address"
                    (ngModelChange)="patchForm('address', $event)"
                    class="h-10 px-3 text-sm rounded-lg border transition-colors bg-base text-text-primary border-border-subtle"
                    placeholder="Calle 123, Chillán"
                  />
                </div>

                @if (facade.error()) {
                  <p class="text-xs px-3 py-2 rounded-lg text-error bg-error/10">
                    {{ facade.error() }}
                  </p>
                }

                <app-async-btn
                  label="Siguiente — Pago"
                  icon="arrow-right"
                  [loading]="facade.isSaving()"
                  [disabled]="!isStep1Valid()"
                  (click)="onStep1Next()"
                  data-llm-action="avanzar-a-pago-curso-singular"
                />
              </div>
            }
          </div>
        }

        <!-- ══════════════════════════════════════════════════════════════════════
           PASO 2 — PAGO
           ══════════════════════════════════════════════════════════════════ -->
        @if (facade.wizardStep() === 2) {
          <div class="flex flex-col gap-5">
            <!-- Resumen del alumno -->
            <div class="p-3 rounded-xl border bg-surface border-border-muted">
              <p class="text-xs font-bold uppercase tracking-wide mb-1 text-text-muted">Alumno</p>
              <p class="text-sm font-semibold text-text-primary">
                {{ nombreAlumnoResumen() }}
              </p>
              <p class="text-xs text-text-muted">{{ form().rut }}</p>
            </div>

            <!-- Resumen financiero -->
            <div class="rounded-2xl p-5 relative overflow-hidden surface-hero">
              <div class="absolute right-0 top-0 p-6 opacity-10 pointer-events-none">
                <app-icon name="banknote" [size]="56" color="white" />
              </div>
              <div class="flex flex-col gap-2.5 relative z-10">
                <div class="flex justify-between items-center">
                  <span class="text-xs" style="color: rgba(255,255,255,0.55)"
                    >Precio base del curso</span
                  >
                  <span class="text-sm font-medium text-white">{{ formatCLP(basePrice()) }}</span>
                </div>
                @if (discountApplied()) {
                  <div class="flex justify-between items-center text-success">
                    <span class="text-xs">{{ discountReason() || 'Descuento aplicado' }}</span>
                    <span class="text-xs font-bold">- {{ formatCLP(discountAmount()) }}</span>
                  </div>
                }
                <div
                  class="flex justify-between items-end pt-3 mt-1"
                  style="border-top: 1px solid rgba(255,255,255,0.1)"
                >
                  <div>
                    <p class="text-xs font-bold uppercase tracking-tighter text-brand">
                      {{ selectedMethod() === 'pendiente' ? 'Total por cobrar' : 'Total a pagar' }}
                    </p>
                    <p class="text-3xl font-black tracking-tight text-white">
                      {{ formatCLP(effectiveTotal()) }}
                    </p>
                  </div>
                  @if (selectedMethod() === 'pendiente') {
                    <span class="text-xs italic" style="color: rgba(255,255,255,0.4)"
                      >Queda pendiente</span
                    >
                  }
                </div>
              </div>
            </div>

            <!-- Descuento manual — se persiste aunque el pago quede pendiente -->
            @if (discountApplied()) {
              <div
                class="flex items-center justify-between p-3 rounded-xl border bg-success/8 border-success/25"
              >
                <div class="flex items-center gap-2">
                  <app-icon name="tag" [size]="15" color="var(--state-success)" />
                  <div>
                    <p class="text-xs font-bold text-success">Descuento aplicado</p>
                    <p class="text-xs text-text-muted">{{ discountReason() }}</p>
                  </div>
                </div>
                <button
                  type="button"
                  class="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors text-error bg-error/10"
                  (click)="clearDiscount()"
                  data-llm-action="quitar-descuento-singular"
                >
                  <app-icon name="x" [size]="12" color="var(--state-error)" />
                </button>
              </div>
            } @else {
              <div class="flex flex-col gap-2">
                <label class="text-xs font-bold uppercase tracking-wide text-text-muted"
                  >Descuento (opcional)</label
                >
                <div class="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    [(ngModel)]="discountAmountInput"
                    min="0"
                    placeholder="Monto $"
                    class="h-10 px-3 text-sm rounded-lg border transition-colors bg-base text-text-primary border-border-subtle"
                    data-llm-description="Monto del descuento en pesos chilenos"
                  />
                  <input
                    type="text"
                    [(ngModel)]="discountReasonInput"
                    placeholder="Motivo"
                    class="h-10 px-3 text-sm rounded-lg border transition-colors bg-base text-text-primary border-border-subtle"
                    data-llm-description="Motivo del descuento aplicado"
                  />
                </div>
                <button
                  type="button"
                  class="w-full h-9 text-xs font-bold rounded-lg border flex items-center justify-center gap-2 transition-all cursor-pointer bg-surface border-border-muted text-text-secondary"
                  [disabled]="!discountAmountInput() || !discountReasonInput()"
                  [style.opacity]="!discountAmountInput() || !discountReasonInput() ? '0.4' : '1'"
                  (click)="applyDiscount()"
                  data-llm-action="aplicar-descuento-singular"
                >
                  <app-icon name="tag" [size]="13" color="var(--text-secondary)" />
                  Aplicar descuento
                </button>
              </div>
            }

            <!-- Método de pago (2x2) -->
            <div class="flex flex-col gap-2">
              <label class="text-xs font-bold uppercase tracking-wide text-text-muted"
                >Método de pago *</label
              >
              <div class="grid grid-cols-2 gap-2">
                @for (method of paymentMethods; track method.value) {
                  <button
                    type="button"
                    class="flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all cursor-pointer"
                    [style.border-color]="
                      selectedMethod() === method.value ? 'var(--ds-brand)' : 'var(--border-muted)'
                    "
                    [style.background]="
                      selectedMethod() === method.value
                        ? 'color-mix(in srgb, var(--ds-brand) 8%, transparent)'
                        : 'var(--bg-surface)'
                    "
                    (click)="selectedMethod.set(method.value)"
                    [attr.data-llm-action]="'seleccionar-metodo-' + method.value"
                  >
                    <div
                      class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                      [style.background]="
                        selectedMethod() === method.value ? 'var(--ds-brand)' : 'var(--bg-elevated)'
                      "
                    >
                      <app-icon
                        [name]="method.icon"
                        [size]="17"
                        [color]="selectedMethod() === method.value ? 'white' : 'var(--text-muted)'"
                      />
                    </div>
                    <div class="min-w-0">
                      <p
                        class="text-xs font-bold truncate transition-colors"
                        [style.color]="
                          selectedMethod() === method.value
                            ? 'var(--ds-brand)'
                            : 'var(--text-primary)'
                        "
                      >
                        {{ method.label }}
                      </p>
                      <p class="text-xs truncate text-text-muted">
                        {{ method.description }}
                      </p>
                    </div>
                  </button>
                }
              </div>
            </div>

            @if (facade.error()) {
              <p class="text-xs px-3 py-2 rounded-lg text-error bg-error/10">
                {{ facade.error() }}
              </p>
            }

            <!-- Acciones -->
            <div class="flex flex-col gap-2">
              <app-async-btn
                label="Confirmar Inscripción"
                icon="user-plus"
                [loading]="facade.isSaving()"
                [disabled]="!isStep2Valid()"
                (click)="onConfirmar()"
                data-llm-action="confirmar-inscripcion-curso-singular"
              />
              <button
                type="button"
                class="flex items-center justify-center gap-2 w-full py-2 text-sm cursor-pointer transition-colors rounded-lg text-text-muted"
                (click)="onVolver()"
              >
                <app-icon name="arrow-left" [size]="14" color="var(--text-muted)" />
                Volver a datos del alumno
              </button>
            </div>
          </div>
        }
      </div>
    </app-drawer-form>
  `,
})
export class AdminCursoSingularInscribirDrawerComponent implements OnInit {
  protected readonly facade = inject(CursosSingularesFacade);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly paymentMethods = PAYMENT_METHODS;
  protected readonly formatCLP = formatCLP;

  // ── Estado local — Step 1 ─────────────────────────────────────────────────
  protected readonly genderOptions = GENDER_OPTIONS;

  protected readonly rutInput = signal('');
  protected readonly form = signal<SingularPersonalDataForm>({ ...EMPTY_PERSONAL });

  // ── Estado local — Step 2 ─────────────────────────────────────────────────
  protected readonly selectedMethod = signal<SingularPaymentMethod>('efectivo');
  protected readonly discountAmountInput = signal<number | ''>('');
  protected readonly discountReasonInput = signal('');
  protected readonly discountAmount = signal(0);
  protected readonly discountReason = signal('');
  protected readonly discountApplied = signal(false);

  // ── Computed ──────────────────────────────────────────────────────────────
  protected readonly rutValido = computed(() => validateRut(this.rutInput()));

  protected readonly showForm = computed(
    () => this.facade.studentSearch() !== null || this.facade.studentNotFound(),
  );

  /** Alumno ya registrado: su identidad queda protegida (solo lectura). */
  protected readonly esAlumnoExistente = computed(() => this.facade.studentSearch() !== null);

  protected readonly nombreAlumnoResumen = computed(() => {
    const f = this.form();
    return `${f.firstNames} ${f.paternalLastName} ${f.maternalLastName}`.trim();
  });

  protected readonly basePrice = computed(() => this.facade.selectedCurso()?.precio ?? 0);

  protected readonly effectiveTotal = computed(() =>
    Math.max(0, this.basePrice() - this.discountAmount()),
  );

  /** Espejo del CHECK de BD: birth_date NOT NULL y edad mínima 17 años. */
  protected readonly edadValida = computed(() => {
    const age = calcAge(this.form().birthDate);
    return age !== null && age >= 17;
  });

  protected readonly isStep1Valid = computed(() => {
    const f = this.form();
    return (
      validateRut(f.rut) &&
      f.firstNames.trim().length >= 2 &&
      f.paternalLastName.trim().length >= 2 &&
      f.email.trim().includes('@') &&
      this.edadValida()
    );
  });

  protected readonly isStep2Valid = computed(() => !!this.selectedMethod());

  private readonly activeBranchId = computed(() => {
    const user = this.auth.currentUser();
    if (user?.role === 'admin') {
      return this.branchFacade.selectedBranchId() ?? this.branchFacade.branches()[0]?.id ?? 1;
    }
    return user?.branchId ?? 1;
  });

  ngOnInit(): void {
    this.facade.resetWizard();
  }

  protected onRutChange(raw: string): void {
    const formatted = formatRut(raw);
    this.rutInput.set(formatted);
    this.patchForm('rut', normalizeRutForStorage(formatted));
    // Si ya había datos de una búsqueda anterior, limpiarlos para evitar
    // mezclar el RUT nuevo con el nombre/email del alumno previo.
    if (this.facade.studentSearch() !== null || this.facade.studentNotFound()) {
      this.facade.resetWizard();
      this.form.set({ ...EMPTY_PERSONAL, rut: normalizeRutForStorage(formatted) });
    }
  }

  protected async onBuscar(): Promise<void> {
    await this.facade.searchByRut(this.rutInput());
    const found = this.facade.studentSearch();
    if (found) {
      // Pre-cargar TODOS los datos existentes: lo que el formulario no
      // muestre con valor real terminaría sobrescribiendo la ficha del alumno.
      this.form.set({
        rut: found.rut,
        firstNames: found.firstNames,
        paternalLastName: found.paternalLastName,
        maternalLastName: found.maternalLastName,
        email: found.email,
        phone: found.phone,
        birthDate: found.birthDate,
        gender: found.gender,
        address: found.address,
      });
    } else {
      this.form.set({ ...EMPTY_PERSONAL, rut: normalizeRutForStorage(this.rutInput()) });
    }
  }

  protected patchForm<K extends keyof SingularPersonalDataForm>(
    key: K,
    value: SingularPersonalDataForm[K],
  ): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected applyDiscount(): void {
    const amount = Number(this.discountAmountInput()) || 0;
    if (amount <= 0 || !this.discountReasonInput().trim()) return;
    this.discountAmount.set(Math.min(amount, this.basePrice()));
    this.discountReason.set(this.discountReasonInput().trim());
    this.discountApplied.set(true);
  }

  protected clearDiscount(): void {
    this.discountAmount.set(0);
    this.discountReason.set('');
    this.discountApplied.set(false);
    this.discountAmountInput.set('');
    this.discountReasonInput.set('');
  }

  protected onStep1Next(): void {
    this.facade.savePersonalData(this.form(), this.activeBranchId());
  }

  protected async onConfirmar(): Promise<void> {
    const curso = this.facade.selectedCurso();
    if (!curso) return;
    const method = this.selectedMethod();
    const payload: SingularPaymentForm = {
      amountPaid: method === 'pendiente' ? 0 : this.effectiveTotal(),
      paymentMethod: method,
      paymentStatus: method === 'pendiente' ? 'pending' : 'paid',
      // El descuento acordado se persiste aunque el pago quede pendiente:
      // el cobro posterior será precio − descuento.
      discountAmount: this.discountApplied() ? this.discountAmount() : 0,
      discountReason: this.discountApplied() ? this.discountReason() : null,
    };
    const ok = await this.facade.inscribirAlumno(curso.id, payload);
    if (ok) this.layoutDrawer.back();
  }

  protected onVolver(): void {
    this.facade.goToWizardStep(1);
  }
}
