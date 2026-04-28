import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { PagosFacade } from '@core/facades/pagos.facade';
import { formatCLP, toISODate } from '@core/utils/date.utils';
import type { AlumnoDeudor } from '@core/models/ui/pagos.model';
import { SelectModule } from 'primeng/select';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';

import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import { AnimateInDirective } from '@core/directives/animate-in.directive';

/** Validador a nivel de FormGroup: suma de canales debe igualar total_amount. */
function sumMatchesTotalValidator(group: AbstractControl): ValidationErrors | null {
  const total = Number(group.get('total_amount')?.value ?? 0);
  if (total <= 0) return null;
  const sum =
    Number(group.get('cash_amount')?.value ?? 0) +
    Number(group.get('transfer_amount')?.value ?? 0) +
    Number(group.get('card_amount')?.value ?? 0) +
    Number(group.get('voucher_amount')?.value ?? 0);
  return Math.abs(sum - total) >= 1 ? { sumMismatch: { total, sum } } : null;
}

/**
 * RegistrarPagoDrawerComponent — Panel lateral para registrar un pago.
 *
 * **Modo Contextual** (enrollmentId !== null): abierto desde la tabla de deudores.
 *   El alumno ya está preseleccionado — se muestra su info en una card de solo lectura.
 *
 * **Modo Global** (enrollmentId === null): abierto desde el botón "+ Registrar Pago".
 *   El usuario debe seleccionar el alumno desde un <select> que itera facade.alumnosConDeuda().
 *   Si el alumno no tiene matrícula activa con saldo, el pago se registra sin vínculo.
 */
@Component({
  selector: 'app-registrar-pago-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IconComponent,
    SelectModule,
    SkeletonBlockComponent,
    DrawerContentLoaderComponent,
    AsyncBtnComponent,
    AnimateInDirective,
  ],
  template: `
    <app-drawer-content-loader>
      <ng-template #skeletons>
        <div class="flex flex-col gap-4">
          <app-skeleton-block variant="text" width="100%" height="60px" />
          <app-skeleton-block variant="text" width="100%" height="60px" />
          <app-skeleton-block variant="text" width="100%" height="60px" />
          <app-skeleton-block variant="text" width="100%" height="80px" />
        </div>
      </ng-template>
      <ng-template #content>
      <div class="flex-1 overflow-y-auto p-5">
        <form [formGroup]="form" class="flex flex-col gap-5" (ngSubmit)="onSubmit()">
          <!-- ── MODO GLOBAL: selector de alumno ────────────────────────────── -->
          @if (facade.enrollmentSeleccionado() === null) {
            <div class="flex flex-col gap-1.5" appAnimateIn>
              <label for="pago-enrollment" class="field-label">
                ALUMNO / MATRÍCULA <span style="color: var(--state-error)">*</span>
              </label>
              @if (facade.alumnosConDeuda().length === 0) {
                <p
                  class="text-xs py-2 px-3 rounded-lg"
                  style="
                color: var(--text-muted);
                background: var(--bg-surface);
                border: 1px solid var(--border-muted);
              "
                >
                  No hay alumnos con saldo pendiente. El pago se registrará sin matrícula asociada.
                </p>
              } @else {
                <p-select
                  formControlName="enrollment_id"
                  [options]="enrollmentOptions()"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Selecciona un alumno..."
                  styleClass="w-full"
                  data-llm-description="Selecciona el alumno al que se le asocia el pago"
                  [class.field-input--error]="isInvalid('enrollment_id')"
                />
                @if (isInvalid('enrollment_id')) {
                  <span class="field-error">Selecciona un alumno.</span>
                }
              }

              <!-- Info del alumno seleccionado -->
              @if (selectedAlumno; as alumno) {
                <div class="alumno-info-card" style="margin-top: 4px" appAnimateIn>
                  <div class="flex flex-col gap-0.5">
                    <span
                      class="text-xs font-semibold uppercase tracking-wide"
                      style="color: var(--ds-brand)"
                    >
                      Seleccionado
                    </span>
                    <span class="text-sm font-semibold" style="color: var(--text-primary)">
                      {{ alumno.alumno }}
                    </span>
                    <span class="text-xs" style="color: var(--text-muted)">{{ alumno.rut }}</span>
                  </div>
                  <div class="flex flex-col gap-0.5 text-right">
                    <span
                      class="text-xs font-semibold uppercase tracking-wide"
                      style="color: var(--text-muted)"
                    >
                      Saldo Pendiente
                    </span>
                    <span class="text-base font-bold" style="color: var(--state-warning)">
                      {{ clp(alumno.saldo) }}
                    </span>
                    <span class="text-xs" style="color: var(--text-muted)">
                      Pagado: {{ clp(alumno.pagado) }}
                    </span>
                  </div>
                </div>
              }
            </div>
          }

          <!-- ── MODO CONTEXTUAL: info del alumno preseleccionado ───────────── -->
          @if (facade.enrollmentSeleccionado() !== null && facade.estadoCuentaResumen(); as ctx) {
            <div class="alumno-info-card" appAnimateIn>
              <div class="flex flex-col gap-0.5">
                <span
                  class="text-xs font-semibold uppercase tracking-wide"
                  style="color: var(--ds-brand)"
                >
                  Alumno
                </span>
                <span class="text-sm font-semibold" style="color: var(--text-primary)">
                  {{ ctx.alumno }}
                </span>
              </div>
              <div class="flex flex-col gap-0.5 text-right">
                <span
                  class="text-xs font-semibold uppercase tracking-wide"
                  style="color: var(--text-muted)"
                >
                  Saldo Pendiente
                </span>
                <span class="text-base font-bold" style="color: var(--state-warning)">
                  {{ clp(ctx.saldoPendiente) }}
                </span>
              </div>
            </div>
          } @else if (facade.enrollmentSeleccionado() !== null) {
            <!-- Fallback if details not loaded yet or row source -->
            @if (selectedFromList; as alumno) {
              <div class="alumno-info-card" appAnimateIn>
                <div class="flex flex-col gap-0.5">
                  <span
                    class="text-xs font-semibold uppercase tracking-wide"
                    style="color: var(--ds-brand)"
                    >Alumno</span
                  >
                  <span class="text-sm font-semibold" style="color: var(--text-primary)">{{
                    alumno.alumno
                  }}</span>
                </div>
                <div class="flex flex-col gap-0.5 text-right">
                  <span
                    class="text-xs font-semibold uppercase tracking-wide"
                    style="color: var(--text-muted)"
                    >Saldo Pendiente</span
                  >
                  <span class="text-base font-bold" style="color: var(--state-warning)">{{
                    clp(alumno.saldo)
                  }}</span>
                </div>
              </div>
            }
          }

          <div class="flex flex-col gap-5" [appAnimateIn]="{ useBlur: true, delay: 0.1 }">
            <!-- Fecha de pago -->
            <div class="flex flex-col gap-1.5">
              <label for="pago-date" class="field-label">
                FECHA DE PAGO <span style="color: var(--state-error)">*</span>
              </label>
              <input
                id="pago-date"
                type="date"
                formControlName="payment_date"
                class="field-input"
                data-llm-description="Fecha en que se realiza el pago"
                [class.field-input--error]="isInvalid('payment_date')"
              />
              @if (isInvalid('payment_date')) {
                <span class="field-error">Este campo es obligatorio.</span>
              }
            </div>

            <!-- Tipo / Concepto -->
            <div class="flex flex-col gap-1.5">
              <label for="pago-type" class="field-label">
                CONCEPTO <span style="color: var(--state-error)">*</span>
              </label>
              <p-select
                formControlName="type"
                [options]="tipoConceptoOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Selecciona un concepto..."
                styleClass="w-full"
                data-llm-description="Tipo de pago que se está registrando"
                [class.field-input--error]="isInvalid('type')"
              />
              @if (isInvalid('type')) {
                <span class="field-error">Selecciona un concepto.</span>
              }
            </div>

            <!-- Monto total -->
            <div class="flex flex-col gap-1.5">
              <label for="pago-total" class="field-label">
                MONTO TOTAL <span style="color: var(--state-error)">*</span>
              </label>
              <div class="input-prefix-wrapper">
                <span class="input-prefix">$</span>
                <input
                  id="pago-total"
                  type="number"
                  formControlName="total_amount"
                  class="field-input field-input--prefixed"
                  placeholder="0"
                  min="1"
                  data-llm-description="Monto total del pago en pesos chilenos"
                  [class.field-input--error]="isInvalid('total_amount')"
                />
              </div>
              @if (isInvalid('total_amount')) {
                <span class="field-error">Ingresa un monto válido mayor a 0.</span>
              }
            </div>
          </div>

          <!-- Desglose de métodos de pago -->
          <div class="flex flex-col gap-3" [appAnimateIn]="{ useBlur: true, delay: 0.15 }">
            <span class="field-label">DESGLOSE DE PAGO</span>
            <div class="grid grid-cols-2 gap-3">
              <!-- Efectivo -->
              <div class="flex flex-col gap-1">
                <label for="pago-cash" class="desglose-label">
                  <app-icon name="banknote" [size]="12" />
                  Efectivo
                </label>
                <div class="input-prefix-wrapper">
                  <span class="input-prefix">$</span>
                  <input
                    id="pago-cash"
                    type="number"
                    formControlName="cash_amount"
                    class="field-input field-input--prefixed field-input--sm"
                    placeholder="0"
                    min="0"
                    data-llm-description="Monto pagado en efectivo"
                  />
                </div>
              </div>

              <!-- Transferencia -->
              <div class="flex flex-col gap-1">
                <label for="pago-transfer" class="desglose-label">
                  <app-icon name="landmark" [size]="12" />
                  Transferencia
                </label>
                <div class="input-prefix-wrapper">
                  <span class="input-prefix">$</span>
                  <input
                    id="pago-transfer"
                    type="number"
                    formControlName="transfer_amount"
                    class="field-input field-input--prefixed field-input--sm"
                    placeholder="0"
                    min="0"
                    data-llm-description="Monto pagado por transferencia bancaria"
                  />
                </div>
              </div>

              <!-- Tarjeta -->
              <div class="flex flex-col gap-1">
                <label for="pago-card" class="desglose-label">
                  <app-icon name="credit-card" [size]="12" />
                  Tarjeta
                </label>
                <div class="input-prefix-wrapper">
                  <span class="input-prefix">$</span>
                  <input
                    id="pago-card"
                    type="number"
                    formControlName="card_amount"
                    class="field-input field-input--prefixed field-input--sm"
                    placeholder="0"
                    min="0"
                    data-llm-description="Monto pagado con tarjeta de débito o crédito"
                  />
                </div>
              </div>

              <!-- Voucher / WebPay -->
              <div class="flex flex-col gap-1">
                <label for="pago-voucher" class="desglose-label">
                  <app-icon name="monitor" [size]="12" />
                  WebPay
                </label>
                <div class="input-prefix-wrapper">
                  <span class="input-prefix">$</span>
                  <input
                    id="pago-voucher"
                    type="number"
                    formControlName="voucher_amount"
                    class="field-input field-input--prefixed field-input--sm"
                    placeholder="0"
                    min="0"
                    data-llm-description="Monto pagado a través de WebPay"
                  />
                </div>
              </div>
            </div>

            <!-- Balance check visual -->
            @if (balanceStatus.hasValue) {
              <div
                class="balance-card"
                [class.balance-card--ok]="balanceStatus.ok"
                [class.balance-card--warn]="!balanceStatus.ok"
                appAnimateIn
              >
                <div class="flex items-center gap-2">
                  @if (balanceStatus.ok) {
                    <app-icon name="check-circle" [size]="15" color="var(--state-success)" />
                    <span class="text-xs font-semibold" style="color: var(--state-success)">
                      Los montos cuadran correctamente
                    </span>
                  } @else {
                    <app-icon name="alert-triangle" [size]="15" color="var(--state-warning)" />
                    <span class="text-xs font-semibold" style="color: var(--state-warning)">
                      @if (balanceStatus.diff > 0) {
                        Faltan {{ clp(balanceStatus.diff) }} por asignar a un método
                      } @else {
                        El desglose excede el total en {{ clp(-balanceStatus.diff) }}
                      }
                    </span>
                  }
                </div>
                <div class="flex gap-4 mt-1 pl-5">
                  <span class="text-xs" style="color: var(--text-muted)">
                    Total declarado: <strong>{{ clp(balanceStatus.total) }}</strong>
                  </span>
                  <span class="text-xs" style="color: var(--text-muted)">
                    Suma métodos: <strong>{{ clp(balanceStatus.sum) }}</strong>
                  </span>
                </div>
              </div>
            }
          </div>

          <!-- N° Documento (opcional) -->
          <div class="flex flex-col gap-1.5" [appAnimateIn]="{ useBlur: true, delay: 0.2 }">
            <label for="pago-doc" class="field-label">N° DOCUMENTO (OPCIONAL)</label>
            <input
              id="pago-doc"
              type="text"
              formControlName="document_number"
              class="field-input"
              placeholder="Ej: TRF-00482, REC-01234..."
              data-llm-description="Número de documento de respaldo del pago (boleta, comprobante de transferencia, etc.)"
            />
          </div>

          <!-- Error global -->
          @if (saveError()) {
            <div
              class="flex items-start gap-2 p-3 rounded-lg"
              style="background: color-mix(in srgb, var(--state-error) 8%, transparent)"
              appAnimateIn
            >
              <app-icon name="circle-alert" [size]="15" color="var(--state-error)" />
              <p class="text-sm" style="color: var(--state-error)">{{ saveError() }}</p>
            </div>
          }
        </form>

        <!-- ── Footer ──────────────────────────────────────────────────────────── -->
        <div
          class="p-5 border-t bg-surface flex items-center justify-end gap-3 sticky bottom-0 z-20"
        >
          <button
            type="button"
            class="btn-secondary"
            (click)="onCancel()"
            data-llm-action="cancelar-registro-pago"
          >
            Cancelar
          </button>

          <app-async-btn
            variant="primary"
            label="Guardar Pago"
            loadingLabel="Guardando..."
            icon="check"
            [loading]="isSaving()"
            [disabled]="form.invalid"
            (clicked)="onSubmit()"
          />
        </div>
      </div>
      </ng-template>
    </app-drawer-content-loader>
  `,
  styles: `
    /* ── Alumno info ── */
    .alumno-info-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: color-mix(in srgb, var(--ds-brand) 4%, var(--bg-base));
      margin-bottom: 4px;
    }

    /* ── Fields ── */
    .field-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      letter-spacing: 0.06em;
      color: var(--ds-brand);
    }
    .desglose-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
    }
    .field-input {
      width: 100%;
      padding: 8px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: inherit;
      transition:
        border-color var(--duration-fast),
        box-shadow var(--duration-fast);
      outline: none;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-brand) 12%, transparent);
    }
    .field-input--error {
      border-color: var(--state-error) !important;
    }
    .field-input--sm {
      padding: 6px 10px;
      font-size: var(--text-xs);
    }
    .field-input--prefixed {
      padding-left: 28px;
    }
    .field-select {
      appearance: auto;
      cursor: pointer;
    }

    /* ── Prefix wrapper ── */
    .input-prefix-wrapper {
      position: relative;
    }
    .input-prefix {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-muted);
      pointer-events: none;
    }

    /* ── Field error ── */
    .field-error {
      font-size: var(--text-xs);
      color: var(--state-error);
    }

    /* ── Balance card ── */
    .balance-card {
      padding: 10px 12px;
      border-radius: var(--radius-md);
      border: 1px solid;
      transition:
        background var(--duration-fast),
        border-color var(--duration-fast);
    }
    .balance-card--ok {
      border-color: var(--state-success);
      background: color-mix(in srgb, var(--state-success) 8%, transparent);
    }
    .balance-card--warn {
      border-color: var(--state-warning);
      background: color-mix(in srgb, var(--state-warning) 8%, transparent);
    }
  `,
})
export class RegistrarPagoDrawerComponent {
  readonly tipoConceptoOptions = [
    { label: 'Matrícula', value: 'Matrícula' },
    { label: 'Mensualidad 1/4', value: 'Mensualidad 1/4' },
    { label: 'Mensualidad 2/4', value: 'Mensualidad 2/4' },
    { label: 'Mensualidad 3/4', value: 'Mensualidad 3/4' },
    { label: 'Mensualidad 4/4', value: 'Mensualidad 4/4' },
    { label: 'Abono', value: 'Abono' },
    { label: 'Pago Total', value: 'Pago Total' },
    { label: 'Otro', value: 'Otro' },
  ];

  // ── Outputs ────────────────────────────────────────────────────────────────
  readonly saved = output<void>();

  // ── Injections ──────────────────────────────────────────────────────────────
  protected readonly facade = inject(PagosFacade);
  private readonly fb = inject(FormBuilder);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Estado local ────────────────────────────────────────────────────────────
  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly clp = formatCLP;

  /** Modo global: drawer abierto sin matrícula preseleccionada. */
  protected readonly modoGlobal = computed(() => this.facade.enrollmentSeleccionado() === null);

  protected readonly enrollmentOptions = computed(() =>
    this.facade.alumnosConDeuda().map((a) => ({
      label: `${a.alumno} — ${a.rut}`,
      value: a.enrollmentId,
    })),
  );

  /** Alumno seleccionado en el dropdown (solo modo global). */
  protected get selectedAlumno(): AlumnoDeudor | null {
    if (!this.modoGlobal()) return null;
    const eid = this.form.get('enrollment_id')?.value;
    if (!eid) return null;
    return this.facade.alumnosConDeuda().find((a) => a.enrollmentId === Number(eid)) ?? null;
  }

  /** Alumno coincidente desde la lista de deudores si hay enrollmentSeleccionado. */
  protected get selectedFromList(): AlumnoDeudor | null {
    const eid = this.facade.enrollmentSeleccionado();
    if (eid === null) return null;
    return this.facade.alumnosConDeuda().find((a) => a.enrollmentId === eid) ?? null;
  }

  // ── Formulario reactivo ─────────────────────────────────────────────────────
  protected readonly form = this.fb.group(
    {
      enrollment_id: [null as number | null],
      payment_date: [toISODate(new Date()), Validators.required],
      type: ['', Validators.required],
      total_amount: [null as number | null, [Validators.required, Validators.min(1)]],
      cash_amount: [0, Validators.min(0)],
      transfer_amount: [0, Validators.min(0)],
      card_amount: [0, Validators.min(0)],
      voucher_amount: [0, Validators.min(0)],
      document_number: [''],
    },
    { validators: sumMatchesTotalValidator },
  );

  constructor() {
    this.resetForm();
  }

  // ── Balance check (getter — se re-evalúa con cada CD del form) ───────────────
  protected get balanceStatus(): {
    total: number;
    sum: number;
    diff: number;
    ok: boolean;
    hasValue: boolean;
  } {
    const v = this.form.getRawValue();
    const total = Number(v.total_amount ?? 0);
    const sum =
      Number(v.cash_amount ?? 0) +
      Number(v.transfer_amount ?? 0) +
      Number(v.card_amount ?? 0) +
      Number(v.voucher_amount ?? 0);
    return {
      total,
      sum,
      diff: total - sum,
      ok: total > 0 && Math.abs(total - sum) < 1,
      hasValue: total > 0,
    };
  }

  // ── Helpers de template ──────────────────────────────────────────────────────
  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  protected onCancel(): void {
    this.layoutDrawer.back();
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.saveError.set(null);

    try {
      const v = this.form.getRawValue();

      // Resuelve qué enrollmentId usar según el modo
      const enrollmentId = this.modoGlobal()
        ? (v.enrollment_id ?? null)
        : this.facade.enrollmentSeleccionado();

      // Resuelve montosActuales según el modo
      let montosActuales: { total_paid: number; pending_balance: number } | null = null;
      if (enrollmentId !== null) {
        // Prioridad 1: Estado de cuenta (más fiable)
        const res = this.facade.estadoCuentaResumen();
        if (res && res.enrollmentId === enrollmentId) {
          montosActuales = { total_paid: res.totalPagado, pending_balance: res.saldoPendiente };
        } else {
          // Prioridad 2: Buscar en la lista de deudores
          const alumno = this.facade.alumnosConDeuda().find((a) => a.enrollmentId === enrollmentId);
          if (alumno) {
            montosActuales = { total_paid: alumno.pagado, pending_balance: alumno.saldo };
          }
        }
      }

      await this.facade.registrarNuevoPago(
        enrollmentId,
        {
          payment_date: v.payment_date!,
          type: v.type!,
          total_amount: v.total_amount!,
          cash_amount: v.cash_amount ?? 0,
          transfer_amount: v.transfer_amount ?? 0,
          card_amount: v.card_amount ?? 0,
          voucher_amount: v.voucher_amount ?? 0,
          document_number: v.document_number || null,
        },
        montosActuales,
      );

      this.facade.showSuccess('Pago registrado correctamente.');
      this.saved.emit();
      this.layoutDrawer.back();
    } catch (err) {
      this.saveError.set(
        err instanceof Error ? err.message : 'Error al guardar. Intenta de nuevo.',
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  private resetForm(): void {
    // Ajusta validators del campo enrollment_id según el modo activo
    const eidCtrl = this.form.get('enrollment_id')!;
    if (this.modoGlobal() && this.facade.alumnosConDeuda().length > 0) {
      eidCtrl.setValidators(Validators.required);
      eidCtrl.setValue(null);
    } else {
      eidCtrl.clearValidators();
      eidCtrl.setValue(this.modoGlobal() ? null : this.facade.enrollmentSeleccionado());
    }
    eidCtrl.updateValueAndValidity();

    this.form.patchValue({
      payment_date: toISODate(new Date()),
      type: '',
      total_amount: null,
      cash_amount: 0,
      transfer_amount: 0,
      card_amount: 0,
      voucher_amount: 0,
      document_number: '',
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.saveError.set(null);
  }
}
