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
import { IconComponent } from '@shared/components/icon/icon.component';
import { StatBoxComponent } from '@shared/components/stat-box/stat-box.component';
import { LiquidacionesFacade } from '@core/facades/liquidaciones.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { PagoInstructorPayload } from '@core/models/ui/liquidaciones.model';

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
  selector: 'app-pago-instructor-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, StatBoxComponent],
  template: `
    <div class="flex flex-col h-full">
      <div class="flex-1">
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
                <app-stat-box
                  label="Horas trabajadas"
                  [value]="row()!.totalHours + ' hrs'"
                  variant="surface"
                  [compact]="true"
                  [useMono]="true"
                />
                <app-stat-box
                  label="Valor / hora"
                  [value]="formatCLP(row()!.amountPerHour)"
                  variant="surface"
                  [compact]="true"
                  [useMono]="true"
                />
                <app-stat-box
                  label="Base ganado"
                  [value]="formatCLP(row()!.totalBaseAmount)"
                  variant="surface"
                  [compact]="true"
                  [useMono]="true"
                />
                <app-stat-box
                  label="Descuentos"
                  [value]="'- ' + formatCLP(row()!.totalAdvances)"
                  variant="error"
                  [compact]="true"
                  [useMono]="true"
                />
                <app-stat-box
                  label="Total a pagar"
                  [value]="formatCLP(row()!.finalPaymentAmount)"
                  variant="brand"
                  class="col-span-2"
                />
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
      </div>

      <div class="flex items-center justify-end gap-3 w-full pt-6 mt-6 border-t sticky bottom-0 bg-surface pb-4" style="border-color: var(--border-muted)">
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
    </div>
  `,
})
export class PagoInstructorModalComponent {
  private readonly facade = inject(LiquidacionesFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  readonly row = this.facade.selectedRow;

  protected readonly paymentMethod = signal<'cash' | 'transfer'>('cash');
  protected readonly transferCode = signal<string>('');
  protected readonly showTransferError = signal(false);

  constructor() {
    // Resetear estado interno al cambiar el instructor seleccionado
    effect(() => {
      const row = this.row();
      this.paymentMethod.set('cash');
      this.transferCode.set('');
      this.showTransferError.set(false);
    });
  }

  protected formatCLP(value: number): string {
    return formatCLP(value);
  }

  protected cerrar(): void {
    this.layoutDrawer.close();
  }

  protected async confirmar(): Promise<void> {
    if (this.paymentMethod() === 'transfer' && !this.transferCode().trim()) {
      this.showTransferError.set(true);
      return;
    }
    
    const row = this.row();
    if (!row) return;

    this.showTransferError.set(false);
    
    const payload = {
      paymentMethod: this.paymentMethod(),
      transferCode: this.paymentMethod() === 'transfer' ? this.transferCode().trim() : null,
    };

    const success = await this.facade.registrarPago(row, payload);
    if (success) {
      this.layoutDrawer.close();
    }
  }
}

