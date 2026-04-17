import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';

/**
 * Section Hero — Cabecera de sección reutilizable.
 *
 * Experiencia visual única (el canon):
 *   full    → bento-hero (2 filas). Gradient surface-hero: sky→indigo→violet.
 *             Layout vertical: acciones arriba, título anclado al fondo.
 *             Todos los tokens (texto, botones, badges) se adaptan
 *             automáticamente vía cascade desde .surface-hero en _variables.scss.
 *
 * GSAP: animateHero() se dispara en ngAfterViewInit.
 */
@Component({
  selector: 'app-section-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // HOST = único grid item. bento-hero va aquí, nunca en el div interno.
    class: 'block min-h-0 bento-hero',
  },
  imports: [IconComponent, RouterLink],
  template: `
    <!-- ═══════════════════════════════════════════════════════════
         CANONICAL HERO — Gradient hero, layout vertical
         surface-hero aplica token cascade: texto, botones y badges
         se adaptan al fondo oscuro sin condicionales en el HTML.
    ═══════════════════════════════════════════════════════════ -->
    <div
      #cardRef
      class="surface-hero rounded-lg h-full flex flex-col p-5 md:p-6 gap-3"
      role="region"
      [attr.aria-label]="title()"
    >
      <!-- TOP BAR: navegación atrás (izq) + acciones (der) -->
      <div class="flex items-start justify-between gap-4 relative z-10">
        <div class="flex-1 min-w-0">
          @if (backRoute()) {
            <a
              [routerLink]="backRoute()"
              class="group inline-flex items-center gap-1.5 py-1 px-2 -ml-2 rounded-md text-xs font-bold uppercase tracking-wider text-text-muted hover:text-brand hover:bg-subtle no-underline transition-colors"
              [attr.aria-label]="'Volver a ' + backLabel()"
              data-llm-nav="back"
            >
              <app-icon
                name="arrow-left"
                [size]="13"
                class="transition-transform group-hover:-translate-x-1"
              />
              <span>{{ backLabel() }}</span>
            </a>
          }
        </div>
        @if (actions().length) {
          <div
            class="flex flex-wrap items-center gap-2 shrink-0"
            role="group"
            aria-label="Acciones principales"
          >
            @for (action of actions(); track action.id) {
              @if (action.route) {
                <a
                  [routerLink]="action.route"
                  class="no-underline"
                  [class.btn-primary]="action.primary"
                  [class.btn-secondary]="!action.primary"
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
                  [class.btn-primary]="action.primary"
                  [class.btn-secondary]="!action.primary"
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

      <!-- SPACER: empuja el contenido tipográfico hacia el fondo -->
      <div class="flex-1" aria-hidden="true"></div>

      <!-- BOTTOM: icon badge → eyebrow → título → subtítulo → chips -->
      <div class="flex flex-col gap-3 relative z-10">
        @if (icon()) {
          <!--
            bg-brand/10 + border-brand/20 + text-brand:
            Dentro de surface-hero, --color-brand = white →
            badge se renderiza como glass blanco automáticamente.
          -->
          <div
            class="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0"
          >
            <app-icon [name]="icon()!" [size]="22" class="text-brand" />
          </div>
        }

        <div class="flex flex-col gap-2">
          @if (contextLine()) {
            <!-- section-eyebrow hereda text-secondary → rgba(255,255,255,0.78) aquí -->
            <p class="section-eyebrow m-0 wrap-break-word">{{ contextLine() }}</p>
          }
          <!-- Sin text-text-primary: hereda color blanco de .surface-hero via cascade. -->
          <h1
            class="font-display font-bold leading-tight tracking-tight m-0 text-2xl md:text-plus-4xl"
          >
            {{ title() }}
          </h1>
          @if (subtitle()) {
            <!-- text-text-secondary → rgba(255,255,255,0.78) dentro del gradient -->
            <p class="text-sm md:text-base leading-relaxed m-0 max-w-2xl text-text-secondary">
              {{ subtitle() }}
            </p>
          }
        </div>

        @if (chips().length) {
          <!--
            Chips default: getChipStyle() usa var(--bg-subtle)/var(--border-subtle) →
            glass blanco dentro de surface-hero gracias al token cascade.
          -->
          <div class="flex flex-wrap gap-2">
            @for (chip of chips(); track chip.label) {
              <span
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
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
    </div>
  `,
})
export class SectionHeroComponent implements AfterViewInit {
  private readonly gsap = inject(GsapAnimationsService);

  readonly title = input.required<string>();
  readonly contextLine = input<string>('');
  readonly subtitle = input<string>('');
  /**
   * Nombre del ícono Lucide (kebab-case, ej: "car", "graduation-cap").
   * badge 48px glass (blanco sobre gradient).
   */
  readonly icon = input<string | null>(null);
  readonly chips = input<SectionHeroChip[]>([]);
  readonly actions = input.required<SectionHeroAction[]>();

  /** Ruta para el botón "Volver" con label. */
  readonly backRoute = input<string | null>(null);
  readonly backLabel = input<string>('Volver');

  readonly actionClick = output<string>();

  private readonly cardRef = viewChild<ElementRef<HTMLElement>>('cardRef');

  ngAfterViewInit(): void {
    // Obligatorio: todas las entradas de vista usan GsapAnimationsService.
    this.gsap.animateHero(this.cardRef()?.nativeElement);
  }

  /**
   * Estilos inline para chips usando tokens CSS del DS.
   * Dentro de .surface-hero, var(--bg-subtle) y var(--border-subtle)
   * se resuelven automáticamente como glass blanco (token cascade).
   */
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
