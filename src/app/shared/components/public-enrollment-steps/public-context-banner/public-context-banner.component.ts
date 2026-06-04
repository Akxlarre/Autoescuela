import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { PublicEnrollmentContext } from '@core/models/ui/public-enrollment-context.model';

const COURSE_ICON: Record<string, string> = {
  class_b: 'car',
  class_b_sence: 'briefcase',
  professional_a2: 'car',
  professional_a3: 'truck',
  professional_a4: 'bus',
  professional_a5: 'settings',
};

@Component({
  selector: 'app-public-context-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div
      class="rounded-xl mb-6 relative overflow-hidden"
      style="
        background: var(--pe-gradient-badge, linear-gradient(135deg, var(--color-primary-muted) 0%, var(--bg-surface) 100%));
        border: 1px solid color-mix(in srgb, var(--ds-brand) 30%, transparent);
        padding: var(--space-5);
        box-shadow: 0 1px 0 rgba(255,255,255,0.7) inset;
      "
      role="region"
      aria-label="Resumen de tu inscripción"
    >
      <!-- Row: icon + info + price (desktop) / icon + info (mobile top row) -->
      <div class="flex items-center gap-4">
        <!-- Course icon badge -->
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style="
            background: var(--gradient-primary);
            box-shadow: 0 6px 16px -4px color-mix(in srgb, var(--ds-brand) 50%, transparent);
          "
          aria-hidden="true"
        >
          <app-icon [name]="courseIcon()" [size]="22" color="white" />
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <p
            class="text-xs font-bold uppercase tracking-widest"
            style="color: var(--color-primary-dark, var(--color-primary));"
          >
            Tu inscripción
          </p>
          <p
            class="font-bold"
            style="font-family: var(--font-display); font-size: 1.08rem; color: var(--text-primary); white-space: normal;"
          >
            {{ context().courseName }}
          </p>
          <p class="text-xs" style="color: var(--text-secondary);">
            {{ context().branchName }}
            @if (context().branchAddress) {
              <span class="hidden sm:inline">· {{ context().branchAddress }}</span>
            }
          </p>
        </div>

        <!-- Price + edit (solo en sm+) -->
        <div class="hidden sm:flex shrink-0 flex-col items-end">
          <p
            class="font-bold leading-none"
            style="
              font-family: var(--font-display);
              font-size: 1.35rem;
              font-weight: 800;
              background: var(--gradient-primary);
              -webkit-background-clip: text;
              background-clip: text;
              color: transparent;
            "
            aria-label="Precio total: {{ context().priceLabel }}"
          >
            {{ context().priceLabel }}
          </p>
          <button
            type="button"
            class="mt-1 text-xs font-semibold cursor-pointer rounded-full px-2.5 py-1 transition-colors"
            style="color: var(--color-primary-dark, var(--color-primary)); background: rgba(255,255,255,0.6);"
            data-llm-action="edit-enrollment-selection"
            data-llm-description="Edit selected course or license type in the enrollment wizard"
            (click)="editRequested.emit()"
          >
            Editar selección
          </button>
        </div>
      </div>

      <!-- Price + edit (solo en mobile, segunda fila) -->
      <div
        class="flex sm:hidden items-center justify-between mt-3 pt-3"
        style="border-top: 1px solid color-mix(in srgb, var(--ds-brand) 15%, transparent);"
      >
        <p
          class="font-bold"
          style="
            font-family: var(--font-display);
            font-size: 1.25rem;
            font-weight: 800;
            background: var(--gradient-primary);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
          "
          aria-label="Precio total: {{ context().priceLabel }}"
        >
          {{ context().priceLabel }}
        </p>
        <button
          type="button"
          class="text-xs font-semibold cursor-pointer rounded-full px-3 py-1.5 transition-colors"
          style="color: var(--color-primary-dark, var(--color-primary)); background: rgba(255,255,255,0.6);"
          data-llm-action="edit-enrollment-selection"
          data-llm-description="Edit selected course or license type in the enrollment wizard"
          (click)="editRequested.emit()"
        >
          Editar selección
        </button>
      </div>
    </div>
  `,
})
export class PublicContextBannerComponent {
  readonly context = input.required<PublicEnrollmentContext>();
  readonly editRequested = output<void>();

  protected courseIcon(): string {
    return COURSE_ICON[this.context().courseType] ?? 'book-open';
  }
}
