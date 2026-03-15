import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';

/**
 * Section Hero — Cabecera de sección reutilizable (Dashboard, Alumnos, etc.).
 * Una vista principal = un hero. Una sola acción primaria. Botones custom con tokens.
 * Ver docs/SECTION-HERO-PATTERN.md.
 */
@Component({
  selector: 'app-section-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-0',
    '[class.bento-hero]': 'variant() === "full"',
    '[class.bento-banner]': 'variant() === "compact"',
  },
  imports: [CardHoverDirective, IconComponent, RouterLink],
  template: `
    <div
      class="bento-card h-full min-h-0 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all duration-300"
      [class.p-6]="variant() === 'full'"
      [class.md:p-8]="variant() === 'full'"
      [class.p-4]="variant() === 'compact'"
      [class.md:p-5]="variant() === 'compact'"
      appCardHover
      role="region"
      [attr.aria-label]="title()"
    >
      <!-- Contenido principal: jerarquía premium (tokens + .kpi-label / font-display) -->
      <div class="flex flex-col gap-3 min-w-0 flex-1">
        <div class="min-w-0 flex flex-col gap-1">
          @if (contextLine()) {
            <p class="kpi-label m-0 break-words">{{ contextLine() }}</p>
          }
          <h1
            class="font-display font-bold leading-tight text-text-primary tracking-tight m-0"
            [class.text-2xl]="variant() === 'full'"
            [class.md:text-3xl]="variant() === 'full'"
            [class.text-xl]="variant() === 'compact'"
            [class.md:text-2xl]="variant() === 'compact'"
            [class.mt-2]="contextLine() && variant() === 'full'"
            [class.mt-1]="contextLine() && variant() === 'compact'"
          >
            {{ title() }}
          </h1>
          @if (subtitle()) {
            <p class="text-sm text-text-secondary leading-relaxed m-0" [class.mt-2]="variant() === 'full'" [class.mt-1]="variant() === 'compact'">{{ subtitle() }}</p>
          }
        </div>

        @if (chips().length) {
          <div class="flex flex-wrap items-center gap-3">
            @for (chip of chips(); track chip.label) {
              <span
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md w-fit text-sm font-medium"
                [attr.style]="getChipStyle(chip)"
              >
                @if (chip.icon) {
                  <app-icon [name]="chip.icon" [size]="14" />
                }
                <span>{{ chip.label }}</span>
              </span>
            }
          </div>
        }
      </div>

      <!-- Acciones: shrink-0 para que no compriman la columna de contenido -->
      <div class="flex flex-wrap items-center gap-3 shrink-0" role="group" aria-label="Acciones principales">
        @for (action of actions(); track action.id) {
          @if (action.route) {
            <a
              [routerLink]="action.route"
              class="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm cursor-pointer transition-all duration-150 border font-medium no-underline"
              [class.bg-[var(--color-primary)]]="action.primary"
              [class.text-[var(--color-primary-text)]]="action.primary"
              [class.border-transparent]="action.primary"
              [class.hover:bg-[var(--color-primary-hover)]]="action.primary"
              [class.bg-transparent]="!action.primary"
              [class.text-[var(--text-primary)]]="!action.primary"
              [class.border-[var(--border-subtle)]]="!action.primary"
              [class.hover:bg-[var(--bg-subtle)]]="!action.primary"
            >
              @if (action.icon) {
                <app-icon [name]="action.icon" [size]="16" />
              }
              {{ action.label }}
            </a>
          } @else {
            <button
              type="button"
              class="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm cursor-pointer transition-all duration-150 border font-medium"
              [class.bg-[var(--color-primary)]]="action.primary"
              [class.text-[var(--color-primary-text)]]="action.primary"
              [class.border-transparent]="action.primary"
              [class.hover:bg-[var(--color-primary-hover)]]="action.primary"
              [class.bg-transparent]="!action.primary"
              [class.text-[var(--text-primary)]]="!action.primary"
              [class.border-[var(--border-subtle)]]="!action.primary"
              [class.hover:bg-[var(--bg-subtle)]]="!action.primary"
              (click)="onActionClick(action.id)"
            >
              @if (action.icon) {
                <app-icon [name]="action.icon" [size]="16" />
              }
              {{ action.label }}
            </button>
          }
        }
      </div>
    </div>
  `,
})
export class SectionHeroComponent {
  readonly title = input.required<string>();
  readonly contextLine = input<string>('');
  readonly subtitle = input<string>('');
  readonly chips = input<SectionHeroChip[]>([]);
  readonly actions = input.required<SectionHeroAction[]>();
  readonly variant = input<'full' | 'compact'>('full');

  readonly actionClick = output<string>();

  getChipStyle(chip: SectionHeroChip): string {
    switch (chip.style) {
      case 'error':
        return 'background: var(--state-error-bg); color: var(--state-error)';
      case 'warning':
        return 'background: var(--state-warning-bg, var(--bg-subtle)); color: var(--state-warning, var(--text-primary))';
      case 'success':
        return 'background: var(--state-success-bg, var(--bg-subtle)); color: var(--state-success, var(--text-primary))';
      default:
        return 'background: var(--bg-subtle); color: var(--text-primary)';
    }
  }

  onActionClick(id: string): void {
    this.actionClick.emit(id);
  }
}
