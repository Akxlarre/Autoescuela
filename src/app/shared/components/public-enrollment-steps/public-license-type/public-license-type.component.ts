import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { PublicFlowType } from '@core/facades/public-enrollment.facade';

interface FlowCard {
  flow: PublicFlowType;
  label: string;
  description: string;
  icon: string;
  badge: string | null;
  infoNote: string | null;
}

const FLOW_CARDS: Record<PublicFlowType, FlowCard> = {
  class_b: {
    flow: 'class_b',
    label: 'Clase B',
    description: 'Licencia de conducir estándar para vehículos livianos y motocicletas.',
    icon: 'car',
    badge: 'Más popular',
    infoNote: null,
  },
  professional: {
    flow: 'professional',
    label: 'Clase Profesional',
    description:
      'Licencia para conducción profesional: camiones, buses, maquinaria agrícola y más.',
    icon: 'truck',
    badge: null,
    infoNote: 'Pre-inscripción — La escuela te contactará para completar la matrícula.',
  },
};

@Component({
  selector: 'app-public-license-type',
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
          ¿Qué tipo de licencia necesitas?
        </h2>
        <p class="text-sm" style="color: var(--text-secondary);">
          Selecciona el tipo de licencia para ver las opciones disponibles en tu escuela.
        </p>
      </div>

      <!-- Flow cards -->
      <div class="grid gap-3 items-stretch" [class.grid-cols-2]="visibleCards().length > 1">
        @for (card of visibleCards(); track card.flow) {
          <button
            type="button"
            class="relative flex flex-col gap-3 rounded-xl p-5 text-left transition-all cursor-pointer"
            [style.border]="
              selected() === card.flow
                ? '2px solid var(--ds-brand)'
                : '2px solid var(--border-default)'
            "
            [style.background]="
              selected() === card.flow
                ? 'linear-gradient(180deg, var(--color-primary-muted) 0%, var(--bg-surface) 100%)'
                : 'var(--bg-surface)'
            "
            [style.box-shadow]="
              selected() === card.flow
                ? 'var(--shadow-md), 0 0 0 4px color-mix(in srgb, var(--ds-brand) 10%, transparent)'
                : 'var(--shadow-sm)'
            "
            [attr.aria-pressed]="selected() === card.flow"
            [attr.data-llm-action]="'select-license-type-' + card.flow"
            (click)="onSelect(card.flow)"
          >
            <!-- Selected check -->
            @if (selected() === card.flow) {
              <div
                class="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full"
                style="background: var(--ds-brand);"
                aria-hidden="true"
              >
                <app-icon name="check" [size]="12" color="white" />
              </div>
            }

            <!-- Icon -->
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl"
              style="background: var(--gradient-primary);"
              [style.box-shadow]="'0 5px 14px -4px color-mix(in srgb, var(--ds-brand) 50%, transparent)'"
              aria-hidden="true"
            >
              <app-icon [name]="card.icon" [size]="20" color="white" />
            </div>

            <!-- Label + badge -->
            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="font-bold"
                style="font-family: var(--font-display); font-size: 1.05rem; color: var(--text-primary);"
              >
                {{ card.label }}
              </span>
              @if (card.badge) {
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                  style="background: var(--gradient-primary);"
                >
                  {{ card.badge }}
                </span>
              }
            </div>

            <p class="text-xs" style="color: var(--text-secondary); line-height: 1.5;">
              {{ card.description }}
            </p>

            @if (card.infoNote) {
              <div
                class="flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-xs"
                style="
                  background: var(--state-info-bg);
                  border: 1px solid var(--state-info-border);
                  color: var(--state-info);
                "
              >
                <app-icon
                  name="info"
                  [size]="11"
                  color="var(--state-info)"
                  class="mt-0.5 shrink-0"
                />
                {{ card.infoNote }}
              </div>
            }
          </button>
        }
      </div>

      <!-- Continue CTA -->
      <div class="flex justify-end pt-2">
        <button
          type="button"
          class="btn-primary px-7 py-2.5 rounded-xl font-semibold text-sm"
          [disabled]="!selected()"
          data-llm-action="confirm-license-type"
          (click)="onNext()"
        >
          Continuar
        </button>
      </div>
    </div>
  `,
})
export class PublicLicenseTypeComponent {
  readonly availableFlows = input<PublicFlowType[]>(['class_b', 'professional']);
  readonly flowSelect = output<PublicFlowType>();
  readonly next = output<void>();

  protected readonly selected = signal<PublicFlowType | null>(null);

  protected readonly visibleCards = computed<FlowCard[]>(() =>
    this.availableFlows()
      .filter((f) => f in FLOW_CARDS)
      .map((f) => FLOW_CARDS[f]),
  );

  protected onSelect(flow: PublicFlowType): void {
    this.selected.set(flow);
    this.flowSelect.emit(flow);
  }

  protected onNext(): void {
    if (this.selected()) this.next.emit();
  }
}
