import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { DrawerComponent } from '@shared/components/drawer/drawer.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { PagosFacade } from '@core/facades/pagos.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { formatCLP, toISODate } from '@core/utils/date.utils';

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
 * Smart component (features/): inyecta PagosFacade para llamar a
 * registrarNuevoPago() y actualizar los Signals reactivos de la vista.
 *
 * Inputs:  isOpen (req), enrollmentId, alumnoNombre, saldoPendiente, pagadoActual
 * Outputs: closed, saved
 */
@Component({
  selector: 'app-registrar-pago-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerComponent, ReactiveFormsModule, IconComponent],
  template: `
    <app-drawer
      [isOpen]="isOpen()"
      title="Registrar Pago"
      icon="credit-card"
      [hasFooter]="true"
      (closed)="onCancel()"
    >
      <!-- ── Info del alumno (solo si hay enrollment vinculado) ─────────────── -->
      @if (alumnoNombre()) {
        <div class="alumno-info-card">
          <div class="flex flex-col gap-0.5">
            <span
              class="text-xs font-semibold uppercase tracking-wide"
              style="color: var(--ds-brand)"
            >
              Alumno
            </span>
            <span class="text-sm font-semibold" style="color: var(--text-primary)">
              {{ alumnoNombre() }}
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
              {{ clp(saldoPendiente()) }}
            </span>
          </div>
        </div>
      }

      <!-- ── Formulario ─────────────────────────────────────────────────────── -->
      <form [formGroup]="form" class="flex flex-col gap-5" (ngSubmit)="onSubmit()">
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
          <select
            id="pago-type"
            formControlName="type"
            class="field-input field-select"
            data-llm-description="Tipo de pago que se está registrando"
            [class.field-input--error]="isInvalid('type')"
          >
            <option value="" disabled>Selecciona un concepto...</option>
            <option value="Matrícula">Matrícula</option>
            <option value="Mensualidad 1/4">Mensualidad 1/4</option>
            <option value="Mensualidad 2/4">Mensualidad 2/4</option>
            <option value="Mensualidad 3/4">Mensualidad 3/4</option>
            <option value="Mensualidad 4/4">Mensualidad 4/4</option>
            <option value="Abono">Abono</option>
            <option value="Pago Total">Pago Total</option>
            <option value="Otro">Otro</option>
          </select>
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

        <!-- Desglose de métodos de pago -->
        <div class="flex flex-col gap-3">
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
        <div class="flex flex-col gap-1.5">
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
          >
            <app-icon name="alert-circle" [size]="15" color="var(--state-error)" />
            <p class="text-sm" style="color: var(--state-error)">{{ saveError() }}</p>
          </div>
        }
      </form>

      <!-- ── Footer ──────────────────────────────────────────────────────────── -->
      <div drawer-footer class="flex items-center justify-end gap-2">
        <button
          type="button"
          class="btn-cancel"
          (click)="onCancel()"
          data-llm-action="cancelar-registro-pago"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-primary"
          [disabled]="form.invalid || isSaving()"
          (click)="onSubmit()"
          data-llm-action="guardar-pago"
        >
          @if (isSaving()) {
            <app-icon name="loader" [size]="14" />
            Guardando...
          } @else {
            <app-icon name="check" [size]="14" />
            Guardar Pago
          }
        </button>
      </div>
    </app-drawer>
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
      margin-bottom: 20px;
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

    /* ── Buttons ── */
    .btn-cancel {
      padding: 7px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-strong);
      background: transparent;
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      cursor: pointer;
      transition: background var(--duration-fast);
    }
    .btn-cancel:hover {
      background: var(--bg-elevated);
    }
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 20px;
      border-radius: var(--radius-md);
      border: none;
      background: var(--ds-brand);
      color: #fff;
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      cursor: pointer;
      transition: opacity var(--duration-fast);
    }
    .btn-primary:hover:not(:disabled) {
      opacity: 0.85;
    }
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class RegistrarPagoDrawerComponent {
  // ── Inputs / Outputs ────────────────────────────────────────────────────────
  readonly isOpen = input.required<boolean>();
  readonly enrollmentId = input<number | null>(null);
  readonly alumnoNombre = input<string>('');
  readonly saldoPendiente = input<number>(0);
  readonly pagadoActual = input<number>(0);
  readonly closed = output<void>();
  readonly saved = output<void>();

  // ── Injections ──────────────────────────────────────────────────────────────
  private readonly facade = inject(PagosFacade);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  // ── Estado local ────────────────────────────────────────────────────────────
  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly clp = formatCLP;

  // ── Formulario reactivo ─────────────────────────────────────────────────────
  protected readonly form = this.fb.group(
    {
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
    // Resetear el formulario cada vez que el drawer se abre
    effect(() => {
      if (this.isOpen()) this.resetForm();
    });
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
    this.resetForm();
    this.closed.emit();
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
      await this.facade.registrarNuevoPago(
        this.enrollmentId(),
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
        this.enrollmentId() !== null
          ? { total_paid: this.pagadoActual(), pending_balance: this.saldoPendiente() }
          : null,
      );

      this.toast.success('Pago registrado correctamente.');
      this.resetForm();
      this.saved.emit();
      this.closed.emit();
    } catch (err) {
      this.saveError.set(
        err instanceof Error ? err.message : 'Error al guardar. Intenta de nuevo.',
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  private resetForm(): void {
    this.form.reset({
      payment_date: toISODate(new Date()),
      type: '',
      total_amount: null,
      cash_amount: 0,
      transfer_amount: 0,
      card_amount: 0,
      voucher_amount: 0,
      document_number: '',
    });
    this.saveError.set(null);
  }
}
