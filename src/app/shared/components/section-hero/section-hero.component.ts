import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
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
    'class': 'block min-h-0',
    '[class.bento-hero]': "variant() === 'full'",
    '[class.bento-banner]': "variant() === 'compact'",
  },
  imports: [IconComponent, RouterLink],
  template: `
    <div
      class="bento-card h-full min-h-0 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all duration-300 items-start text-left"
      [class.bento-hero]="variant() === 'full'"
      [class.bento-banner]="variant() === 'compact'"
      [class.card-accent]="variant() === 'full'"
      [class.p-6]="variant() === 'full'"
      [class.md:p-8]="variant() === 'full'"
      [class.p-4]="variant() === 'compact'"
      [class.md:p-5]="variant() === 'compact'"
      role="region"
      [attr.aria-label]="title()"
    >
      <!-- Contenido principal: alineado a la izquierda siempre -->
      <div class="flex flex-col gap-1 min-w-0 flex-1 items-start">
        <!-- Navegación atrás estilo breadcrumb -->
        @if (backRoute()) {
          <a
            [routerLink]="backRoute()"
            class="group flex items-center gap-1.5 w-fit mb-3 py-1 px-2 -ml-2 rounded-md text-xs font-bold uppercase tracking-wider hover:text-[var(--color-primary)] hover:bg-[var(--bg-subtle)] no-underline transition-all duration-200"
            [style.color]="'var(--text-muted)'"
            [attr.aria-label]="'Volver a ' + backLabel()"
            data-llm-nav="back"
          >
            <app-icon
              name="arrow-left"
              [size]="14"
              class="transition-transform group-hover:-translate-x-1"
            />
            <span>{{ backLabel() }}</span>
          </a>
        }

        <!-- Ícono de sección (opcional) — badge visual de marca sobre el título -->
        @if (icon()) {
          <div
            class="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0 mb-2"
          >
            <app-icon [name]="icon()!" [size]="20" class="text-brand" />
          </div>
        }

        <div class="min-w-0 flex flex-col gap-1 items-start">
          @if (contextLine()) {
            <p class="kpi-label m-0 break-words">{{ contextLine() }}</p>
          }
          <h1
            class="font-display font-bold leading-tight text-text-primary tracking-tight m-0"
            [class.text-2xl]="variant() === 'full'"
            [class.md:text-4xl]="variant() === 'full'"
            [class.text-xl]="variant() === 'compact'"
            [class.md:text-2xl]="variant() === 'compact'"
          >
            {{ title() }}
          </h1>
          @if (subtitle()) {
            <p
              class="text-sm md:text-base leading-relaxed m-0 max-w-2xl"
              [style.color]="'var(--text-secondary)'"
              [class.mt-2]="variant() === 'full'"
              [class.mt-1]="variant() === 'compact'"
            >
              {{ subtitle() }}
            </p>
          }
        </div>

        @if (chips().length) {
          <div class="flex flex-wrap items-center gap-2 mt-4">
            @for (chip of chips(); track chip.label) {
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
                [attr.style]="getChipStyle(chip)"
              >
                @if (chip.icon) {
                  <app-icon [name]="chip.icon" [size]="12" />
                }
                {{ chip.label }}
              </span>
            }
          </div>
        }
      </div>

      <!-- Acciones: a la derecha en desktop -->
      @if (actions().length) {
        <div
          class="flex flex-wrap items-center gap-2 shrink-0 mt-2 md:mt-0"
          role="group"
          aria-label="Acciones principales"
        >
          @for (action of actions(); track action.id) {
            @if (action.route) {
              <a
                [routerLink]="action.route"
                class="flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm cursor-pointer transition-all duration-300 border font-bold no-underline shadow-sm hover:shadow-md active:scale-95"
                [class.bg-[var(--color-primary)]]="action.primary"
                [class.text-[var(--color-primary-text)]]="action.primary"
                [class.border-transparent]="action.primary"
                [class.hover:brightness-110]="action.primary"
                [class.bg-transparent]="!action.primary"
                [class.text-[var(--color-primary)]]="!action.primary"
                [class.border-[var(--border-default)]]="!action.primary"
                [class.hover:bg-[var(--bg-subtle)]]="!action.primary"
                [attr.data-llm-nav]="action.id"
              >
                @if (action.icon) {
                  <app-icon [name]="action.icon" [size]="16" />
                }
                {{ action.label }}
              </a>
            } @else {
              <button
                type="button"
                class="flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm cursor-pointer transition-all duration-300 border font-bold shadow-sm hover:shadow-md active:scale-95"
                [class.bg-[var(--color-primary)]]="action.primary"
                [class.text-[var(--color-primary-text)]]="action.primary"
                [class.border-transparent]="action.primary"
                [class.hover:brightness-110]="action.primary"
                [class.bg-transparent]="!action.primary"
                [class.text-[var(--color-primary)]]="!action.primary"
                [class.border-[var(--border-default)]]="!action.primary"
                [class.hover:bg-[var(--bg-subtle)]]="!action.primary"
                [attr.data-llm-action]="action.id"
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
      }
    </div>
  `,
})
export class SectionHeroComponent {
  readonly title = input.required<string>();
  readonly contextLine = input<string>('');
  readonly subtitle = input<string>('');
  /**
   * Nombre del ícono Lucide para el badge de sección (kebab-case, ej: "car", "calendar").
   * Renderiza un badge con color de marca encima del título.
   */
  readonly icon = input<string | null>(null);
  readonly chips = input<SectionHeroChip[]>([]);
  readonly actions = input.required<SectionHeroAction[]>();
  readonly variant = input<'full' | 'compact'>('full');

  /**
   * Ruta opcional para navegación atrás.
   * Si se define, renderiza un botón "Volver" estandarizado.
   */
  readonly backRoute = input<string | null>(null);
  /** Etiqueta opcional para el botón de volver (ej: "Mis Alumnos"). Default: "Volver" */
  readonly backLabel = input<string>('Volver');

  readonly actionClick = output<string>();

  getChipStyle(chip: SectionHeroChip): string {
    switch (chip.style) {
      case 'error':
        return 'background: var(--state-error-bg); color: var(--state-error); border-color: var(--state-error)';
      case 'warning':
        return 'background: var(--state-warning-bg, var(--bg-subtle)); color: var(--state-warning, var(--text-primary)); border-color: var(--state-warning, var(--border-subtle))';
      case 'success':
        return 'background: var(--state-success-bg, var(--bg-subtle)); color: var(--state-success, var(--text-primary)); border-color: var(--state-success, var(--border-subtle))';
      default:
        return 'background: var(--bg-subtle); color: var(--text-secondary); border-color: var(--border-subtle)';
    }
  }

  onActionClick(id: string): void {
    this.actionClick.emit(id);
  }
}
