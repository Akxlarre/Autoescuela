import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import {
  passwordStrengthLabel,
  type PasswordRequirement,
  type PasswordStrength,
} from '@core/utils/password-policy.utils';

/** Cuántos de los 4 tramos de la barra se pintan por nivel. */
const FILLED_SEGMENTS: Record<PasswordStrength, number> = {
  empty: 0,
  weak: 1,
  fair: 2,
  good: 3,
  strong: 4,
};

/**
 * Requisitos de la contraseña y su fortaleza, mientras la persona escribe (spec 0050-b).
 * Presentacional: recibe el resultado de evaluatePassword() y no decide nada sobre la regla.
 * El estado nunca depende solo del color: cada requisito lleva ícono y texto (AC-E1).
 */
@Component({
  selector: 'app-password-requirements',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2" data-llm-description="password requirements checklist">
      <div class="flex items-center gap-3">
        <div class="flex flex-1 gap-1" aria-hidden="true">
          @for (segment of segments; track segment) {
            <span
              class="h-1.5 flex-1 rounded-full transition-colors"
              [class.bg-subtle]="segment >= filled()"
              [class.bg-error]="segment < filled() && strength() === 'weak'"
              [class.bg-warning]="segment < filled() && strength() === 'fair'"
              [class.bg-success]="
                segment < filled() && (strength() === 'good' || strength() === 'strong')
              "
            ></span>
          }
        </div>
        <span class="text-xs font-semibold text-text-secondary min-w-20 text-right">
          {{ strengthLabel() }}
        </span>
      </div>

      <ul class="m-0 flex list-none flex-col gap-1 p-0" aria-live="polite">
        @for (requirement of requirements(); track requirement.id) {
          <li
            class="flex items-center gap-2 text-xs"
            [class.text-success]="requirement.met"
            [class.text-text-muted]="!requirement.met"
          >
            <app-icon [name]="requirement.met ? 'circle-check' : 'circle'" [size]="14" />
            <span>{{ requirement.label }}</span>
            <span class="sr-only">{{ requirement.met ? '(cumplido)' : '(pendiente)' }}</span>
          </li>
        }
      </ul>
    </div>
  `,
})
export class PasswordRequirementsComponent {
  readonly requirements = input.required<PasswordRequirement[]>();
  readonly strength = input.required<PasswordStrength>();

  protected readonly segments = [0, 1, 2, 3];
  protected readonly filled = computed(() => FILLED_SEGMENTS[this.strength()]);
  protected readonly strengthLabel = computed(() => passwordStrengthLabel(this.strength()));
}
