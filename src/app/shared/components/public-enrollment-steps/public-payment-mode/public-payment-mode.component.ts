import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { PaymentMode } from '@core/models/ui/enrollment-assignment.model';

export interface PublicPaymentModeOption {
  value: PaymentMode;
  label: string;
  description: string;
  icon: string;
  price: number;
  priceLabel: string;
  sessions: number;
  badge: string | null;
}

@Component({
  selector: 'app-public-payment-mode',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="space-y-5">
      <div>
        <h2
          class="font-bold mb-1"
          style="font-family: var(--font-display); font-size: 1.3rem; color: var(--text-primary);"
        >
          ¿Cómo quieres pagar?
        </h2>
        <p class="text-sm" style="color: var(--text-secondary);">
          Siempre agendas tus 12 clases prácticas. La modalidad solo define cuánto pagas ahora.
        </p>
      </div>

      <!-- Payment option cards -->
      <div class="grid sm:grid-cols-2 gap-4">
        @for (option of options(); track option.value) {
          <button
            type="button"
            class="relative flex flex-col gap-3 rounded-xl p-5 text-left transition-all cursor-pointer"
            [style.border]="
              selected() === option.value
                ? '2px solid var(--ds-brand)'
                : '2px solid var(--border-default)'
            "
            [style.background]="
              selected() === option.value
                ? 'linear-gradient(180deg, var(--color-primary-muted) 0%, var(--bg-surface) 100%)'
                : 'var(--bg-surface)'
            "
            [style.box-shadow]="
              selected() === option.value
                ? 'var(--shadow-md), 0 0 0 4px color-mix(in srgb, var(--ds-brand) 10%, transparent)'
                : 'var(--shadow-sm)'
            "
            [attr.aria-pressed]="selected() === option.value"
            [attr.data-llm-action]="'select-payment-mode-' + option.value"
            (click)="onSelect(option.value)"
          >
            <!-- Selected check -->
            @if (selected() === option.value) {
              <div
                class="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full"
                style="background: var(--ds-brand);"
                aria-hidden="true"
              >
                <app-icon name="check" [size]="12" color="white" />
              </div>
            }

            <!-- Header: icon + label + badge -->
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                style="background: var(--gradient-primary);"
                aria-hidden="true"
              >
                <app-icon [name]="option.icon" [size]="18" color="white" />
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <span
                  class="font-bold"
                  style="font-family: var(--font-display); font-size: 1rem; color: var(--text-primary);"
                >
                  {{ option.label }}
                </span>
                @if (option.badge) {
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                    style="background: var(--gradient-primary);"
                  >
                    {{ option.badge }}
                  </span>
                }
              </div>
            </div>

            <p class="text-xs" style="color: var(--text-secondary); line-height: 1.5;">
              {{ option.description }}
            </p>

            <!-- Price footer -->
            <div class="pt-3" style="border-top: 1px solid var(--border-subtle);">
              <span
                class="font-bold leading-none"
                style="
                  font-family: var(--font-display);
                  font-size: 1.5rem;
                  font-weight: 800;
                  background: var(--gradient-primary);
                  -webkit-background-clip: text;
                  background-clip: text;
                  color: transparent;
                "
                [attr.aria-label]="option.priceLabel"
              >
                {{ option.priceLabel }}
              </span>
            </div>
          </button>
        }
      </div>

      <!-- Security note -->
      @if (selected() === 'partial') {
        <div
          class="flex items-start gap-3 rounded-xl p-4 text-sm"
          style="background: var(--bg-surface); border: 1px solid var(--border-subtle);"
        >
          <app-icon name="info" [size]="16" color="var(--ds-brand)" class="mt-0.5 shrink-0" />
          <p style="color: var(--text-secondary);">
            Con el abono reservas tu cupo y agendas igualmente tus {{ reservedSessions() }} clases.
            El saldo lo pagas desde tu portal de alumno cuando quieras.
          </p>
        </div>
      }

      <!-- Nav -->
      <div class="flex justify-between pt-2 border-t" style="border-color: var(--border-subtle);">
        <button
          type="button"
          class="flex items-center gap-1.5 text-sm font-medium cursor-pointer transition-colors"
          style="color: var(--text-secondary);"
          (click)="back.emit()"
        >
          <app-icon name="arrow-left" [size]="16" />
          Volver
        </button>
        <button
          type="button"
          class="btn-primary px-7 py-2.5 rounded-xl font-semibold text-sm"
          [disabled]="!selected()"
          data-llm-action="confirm-payment-mode"
          (click)="onNext()"
        >
          Continuar
        </button>
      </div>
    </div>
  `,
})
export class PublicPaymentModeComponent {
  readonly options = input.required<PublicPaymentModeOption[]>();
  readonly modeSelect = output<PaymentMode>();
  readonly next = output<void>();
  readonly back = output<void>();

  protected readonly selected = signal<PaymentMode | null>(null);

  protected readonly reservedSessions = computed(
    () => this.options().find((o) => o.value === 'partial')?.sessions ?? 0,
  );

  protected onSelect(mode: PaymentMode): void {
    this.selected.set(mode);
    this.modeSelect.emit(mode);
  }

  protected onNext(): void {
    if (this.selected()) this.next.emit();
  }
}
