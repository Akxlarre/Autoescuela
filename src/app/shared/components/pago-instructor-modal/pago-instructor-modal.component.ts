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
import { DrawerComponent } from '@shared/components/drawer/drawer.component';
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
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, DrawerComponent],
  template: `
    <app-drawer
      [isOpen]="isOpen()"
      title="Registrar Liquidación"
      icon="banknote"
      [hasFooter]="true"
      (closed)="cerrar()"
    >
      @if (row()) {
        <!-- ── Subtítulo Contextual ── -->
        <div class="mb-5 pb-5 border-b" style="border-color: var(--border-muted)">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
              [style.background]="row()!.avatarColor"
            >
              {{ row()!.initials }}
            </div>
            <div>
              <h3 class="text-base font-bold text-primary leading-tight">{{ row()!.nombre }}</h3>
              <p class="text-xs text-muted mt-0.5">{{ row()!.rut }}</p>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-6">
          <!-- Resumen de liquidación -->
          <section>
            <h3 class="text-[11px] font-bold text-secondary uppercase tracking-widest mb-3">
              Resumen Financiero
            </h3>
            <div class="grid grid-cols-2 gap-3">
              <div
                class="rounded-xl px-4 py-3 border"
                style="background: var(--bg-surface-elevated); border-color: var(--border-color)"
              >
                <p class="text-[10px] uppercase font-bold text-muted mb-1 tracking-wider">Horas trabajadas</p>
                <p class="text-sm font-semibold text-primary font-mono">{{ row()!.totalHours }} hrs</p>
              </div>
              <div
                class="rounded-xl px-4 py-3 border"
                style="background: var(--bg-surface-elevated); border-color: var(--border-color)"
              >
                <p class="text-[10px] uppercase font-bold text-muted mb-1 tracking-wider">Valor / hora</p>
                <p class="text-sm font-semibold text-primary font-mono">
                  {{ formatCLP(row()!.amountPerHour) }}
                </p>
              </div>
              <div
                class="rounded-xl px-4 py-3 border"
                style="background: var(--bg-surface-elevated); border-color: var(--border-color)"
              >
                <p class="text-[10px] uppercase font-bold text-muted mb-1 tracking-wider">Base ganado</p>
                <p class="text-sm font-bold text-primary font-mono">
                  {{ formatCLP(row()!.totalBaseAmount) }}
                </p>
              </div>
              <div
                class="rounded-xl px-4 py-3 border"
                style="background: var(--bg-surface-elevated); border-color: color-mix(in srgb, var(--state-error) 20%, var(--border-color))"
              >
                <p class="text-[10px] uppercase font-bold text-muted mb-1 tracking-wider">Descuentos</p>
                <p class="text-sm font-bold font-mono" style="color: var(--state-error)">
                  - {{ formatCLP(row()!.totalAdvances) }}
                </p>
              </div>
              <div
                class="col-span-2 rounded-xl px-5 py-4 border mt-1"
                style="background: color-mix(in srgb, var(--ds-brand) 5%, var(--bg-surface-elevated)); border-color: color-mix(in srgb, var(--ds-brand) 30%, var(--border-color))"
              >
                <div class="flex items-center justify-between">
                  <p class="text-[11px] font-bold text-primary uppercase tracking-widest">Total a pagar</p>
                  <p class="text-2xl font-black tracking-tight" style="color: var(--ds-brand)">
                    {{ formatCLP(row()!.finalPaymentAmount) }}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <!-- Método de pago -->
          <section>
            <h3 class="text-[11px] font-bold text-secondary uppercase tracking-widest mb-3">
              Método de Pago
            </h3>

            <!-- Selector método -->
            <div class="flex gap-2 mb-4">
              <button
                class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer text-sm font-bold"
                [style.border-color]="
                  paymentMethod() === 'cash' ? 'var(--ds-brand)' : 'transparent'
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
                <app-icon name="banknote" [size]="16" />
                Efectivo
              </button>
              <button
                class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer text-sm font-bold"
                [style.border-color]="
                  paymentMethod() === 'transfer' ? 'var(--ds-brand)' : 'transparent'
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
                <app-icon name="arrow-right-left" [size]="16" />
                Transferencia
              </button>
            </div>

            <!-- Código de transferencia (condicional) -->
            @if (paymentMethod() === 'transfer') {
              <div class="mt-2">
                <label class="block text-xs font-bold text-secondary mb-2" for="transfer-code">
                  Código / N° de transferencia
                </label>
                <input
                  id="transfer-code"
                  type="text"
                  class="w-full px-4 py-3 text-sm rounded-xl font-mono"
                  style="
                    background: var(--bg-surface-elevated);
                    border: 1px solid var(--border-muted);
                    color: var(--text-primary);
                    outline: none;
                    transition: border-color 0.2s;
                  "
                  onfocus="this.style.borderColor='var(--ds-brand)'"
                  onblur="this.style.borderColor='var(--border-muted)'"
                  placeholder="Ej: 123456789"
                  [value]="transferCode()"
                  (input)="transferCode.set($any($event.target).value)"
                  data-llm-description="Transfer code or reference number for instructor payment"
                  aria-label="Código o número de transferencia"
                />
                @if (showTransferError()) {
                  <p class="text-xs font-medium mt-2 flex items-center gap-1.5" style="color: var(--state-error)">
                    <app-icon name="alert-circle" [size]="14" />
                    Ingresa el código de la transferencia para continuar.
                  </p>
                }
              </div>
            }
          </section>
        </div>
      }

      <div drawer-footer class="flex items-center justify-end gap-3 w-full">
        <button
          class="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-colors hover:opacity-80"
          style="
            background: transparent;
            color: var(--text-secondary);
          "
          (click)="cerrar()"
          data-llm-action="cancelar-pago-instructor"
          aria-label="Cancelar"
        >
          Cancelar
        </button>
        <button
          class="btn-primary flex items-center justify-center gap-2 text-sm px-6 py-2.5 rounded-xl cursor-pointer shadow-sm font-bold"
          (click)="confirmar()"
          data-llm-action="confirmar-pago-instructor"
          aria-label="Confirmar pago"
        >
          <app-icon name="check" [size]="16" />
          Confirmar Pago
        </button>
      </div>
    </app-drawer>
  `,
})
export class PagoInstructorModalComponent {
  row = input<LiquidacionRow | null>(null);
  confirmed = output<PagoInstructorPayload>();
  closed = output<void>();

  isOpen = computed(() => this.row() !== null);

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

