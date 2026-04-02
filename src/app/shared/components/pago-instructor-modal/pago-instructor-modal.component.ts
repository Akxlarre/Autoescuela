import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { LiquidacionRow, PagoInstructorPayload } from '@core/models/ui/liquidaciones.model';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Componente ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-pago-instructor-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (row()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-40"
        style="background: rgba(0,0,0,0.45); backdrop-filter: blur(2px)"
        aria-hidden="true"
        (click)="cerrar()"
      ></div>

      <!-- Panel -->
      <div
        class="fixed z-50 flex flex-col overflow-hidden"
        style="
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: min(520px, calc(100vw - 32px));
          max-height: calc(100vh - 64px);
          background: var(--bg-surface);
          border: 1px solid var(--border-muted);
          border-radius: var(--radius-lg, 12px);
          box-shadow: 0 24px 64px rgba(0,0,0,0.22);
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="pago-modal-title"
      >
        <!-- ── Header ────────────────────────────────────────────────────── -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style="border-color: var(--border-muted)"
        >
          <div class="flex items-center gap-3">
            <app-icon name="banknote" [size]="18" color="var(--ds-brand)" />
            <div>
              <h2 id="pago-modal-title" class="text-base font-semibold text-primary">
                Registrar Liquidación
              </h2>
              <p class="text-xs text-muted mt-0.5">{{ row()!.nombre }}</p>
            </div>
          </div>
          <button
            class="p-1.5 rounded-lg transition-colors cursor-pointer"
            style="color: var(--text-muted)"
            (click)="cerrar()"
            aria-label="Cerrar modal"
          >
            <app-icon name="x" [size]="16" />
          </button>
        </div>

        <!-- ── Cuerpo ────────────────────────────────────────────────────── -->
        <div class="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-5">
          <!-- Resumen de liquidación -->
          <section>
            <h3 class="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">
              Resumen
            </h3>
            <div class="grid grid-cols-2 gap-3">
              <div
                class="rounded-lg px-4 py-3"
                style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color)"
              >
                <p class="text-xs text-muted mb-1">Horas trabajadas</p>
                <p class="text-sm font-semibold text-primary">{{ row()!.totalHours }} hrs</p>
              </div>
              <div
                class="rounded-lg px-4 py-3"
                style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color)"
              >
                <p class="text-xs text-muted mb-1">Valor por hora</p>
                <p class="text-sm font-semibold text-primary">
                  {{ formatCLP(row()!.amountPerHour) }}
                </p>
              </div>
              <div
                class="rounded-lg px-4 py-3"
                style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color)"
              >
                <p class="text-xs text-muted mb-1">Base ganado</p>
                <p class="text-sm font-semibold text-primary">
                  {{ formatCLP(row()!.totalBaseAmount) }}
                </p>
              </div>
              <div
                class="rounded-lg px-4 py-3"
                style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color)"
              >
                <p class="text-xs text-muted mb-1">Anticipos descontados</p>
                <p class="text-sm font-semibold" style="color: var(--color-error)">
                  - {{ formatCLP(row()!.totalAdvances) }}
                </p>
              </div>
              <div
                class="col-span-2 rounded-lg px-4 py-3"
                style="background: color-mix(in srgb, var(--ds-brand) 8%, var(--bg-surface-elevated)); border: 1px solid var(--border-color)"
              >
                <p class="text-xs text-muted mb-1">Total a pagar</p>
                <p class="text-base font-bold" style="color: var(--ds-brand)">
                  {{ formatCLP(row()!.finalPaymentAmount) }}
                </p>
              </div>
            </div>
          </section>

          <!-- Método de pago -->
          <section>
            <h3 class="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">
              Método de Pago
            </h3>

            <!-- Selector método -->
            <div class="flex gap-2 mb-4">
              <button
                class="flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border transition-all cursor-pointer text-sm font-medium"
                [style.border-color]="
                  paymentMethod() === 'cash' ? 'var(--ds-brand)' : 'var(--border-muted)'
                "
                [style.background]="
                  paymentMethod() === 'cash'
                    ? 'color-mix(in srgb, var(--ds-brand) 8%, var(--bg-surface))'
                    : 'var(--bg-surface-elevated)'
                "
                [style.color]="
                  paymentMethod() === 'cash' ? 'var(--ds-brand)' : 'var(--text-secondary)'
                "
                (click)="paymentMethod.set('cash')"
                data-llm-action="select-payment-method-cash"
                aria-label="Pago en efectivo"
              >
                <app-icon name="banknote" [size]="15" />
                Efectivo
              </button>
              <button
                class="flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border transition-all cursor-pointer text-sm font-medium"
                [style.border-color]="
                  paymentMethod() === 'transfer' ? 'var(--ds-brand)' : 'var(--border-muted)'
                "
                [style.background]="
                  paymentMethod() === 'transfer'
                    ? 'color-mix(in srgb, var(--ds-brand) 8%, var(--bg-surface))'
                    : 'var(--bg-surface-elevated)'
                "
                [style.color]="
                  paymentMethod() === 'transfer' ? 'var(--ds-brand)' : 'var(--text-secondary)'
                "
                (click)="paymentMethod.set('transfer')"
                data-llm-action="select-payment-method-transfer"
                aria-label="Pago por transferencia"
              >
                <app-icon name="arrow-right-left" [size]="15" />
                Transferencia
              </button>
            </div>

            <!-- Código de transferencia (condicional) -->
            @if (paymentMethod() === 'transfer') {
              <div>
                <label class="block text-xs font-medium text-secondary mb-1.5" for="transfer-code">
                  Código / N° de transferencia
                </label>
                <input
                  id="transfer-code"
                  type="text"
                  class="w-full px-3 py-2 text-sm rounded-lg"
                  style="
                    background: var(--bg-surface-elevated);
                    border: 1px solid var(--border-muted);
                    color: var(--text-primary);
                    outline: none;
                  "
                  placeholder="Ej: 123456789"
                  [value]="transferCode()"
                  (input)="transferCode.set($any($event.target).value)"
                  data-llm-description="Transfer code or reference number for instructor payment"
                  aria-label="Código o número de transferencia"
                />
                @if (showTransferError()) {
                  <p class="text-xs mt-1" style="color: var(--color-error)">
                    Ingresa el código de la transferencia.
                  </p>
                }
              </div>
            }
          </section>
        </div>

        <!-- ── Footer ────────────────────────────────────────────────────── -->
        <div
          class="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0"
          style="border-color: var(--border-muted)"
        >
          <button
            class="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors"
            style="
              background: var(--bg-surface-elevated);
              border: 1px solid var(--border-muted);
              color: var(--text-secondary);
            "
            (click)="cerrar()"
            data-llm-action="cancelar-pago-instructor"
            aria-label="Cancelar"
          >
            Cancelar
          </button>
          <button
            class="btn-primary flex items-center gap-2 text-sm px-4 py-2 rounded-lg cursor-pointer"
            (click)="confirmar()"
            data-llm-action="confirmar-pago-instructor"
            aria-label="Confirmar pago"
          >
            <app-icon name="check" [size]="15" />
            Confirmar Pago
          </button>
        </div>
      </div>
    }
  `,
})
export class PagoInstructorModalComponent {
  row = input<LiquidacionRow | null>(null);
  confirmed = output<PagoInstructorPayload>();
  closed = output<void>();

  protected readonly paymentMethod = signal<'cash' | 'transfer'>('cash');
  protected readonly transferCode = signal<string>('');
  protected readonly showTransferError = signal(false);

  constructor() {
    // Resetear estado interno al cerrar/abrir
    effect(() => {
      if (!this.row()) {
        this.paymentMethod.set('cash');
        this.transferCode.set('');
        this.showTransferError.set(false);
      }
    });
  }

  protected formatCLP(value: number): string {
    return formatCLP(value);
  }

  protected cerrar(): void {
    this.closed.emit();
  }

  protected confirmar(): void {
    if (this.paymentMethod() === 'transfer' && !this.transferCode().trim()) {
      this.showTransferError.set(true);
      return;
    }
    this.showTransferError.set(false);
    this.confirmed.emit({
      paymentMethod: this.paymentMethod(),
      transferCode: this.paymentMethod() === 'transfer' ? this.transferCode().trim() : null,
    });
  }
}
