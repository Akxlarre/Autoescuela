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
  styles: [
    `
      /* ── Solid brand-dark hero ────────────────────────────────────
         surface-hero provee el token cascade (texto/botones blancos).
         hero-card sobreescribe solo el background con brand oscuro sólido
         (~sky-700). Sin gradiente: más limpio, más "app", menos "landing".
      ─────────────────────────────────────────────────────────── */
      .hero-card {
        background: color-mix(in srgb, var(--ds-brand) 80%, black);
        box-shadow: var(--shadow-md);
        transition:
          transform var(--duration-fast, 150ms) ease,
          box-shadow var(--duration-fast, 150ms) ease;

        /* Texto siempre blanco — sin variación entre light/dark mode.
           Se propaga vía herencia CSS a h1, p, section-eyebrow y chips. */
        color: var(--color-primary-text);
        --text-primary: var(--color-primary-text);
        --text-secondary: var(--color-primary-text);
        --text-muted: var(--color-primary-text);
        --color-text-primary: var(--color-primary-text);
        --color-text-secondary: var(--color-primary-text);
        --color-text-muted: var(--color-primary-text);
      }

      .hero-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
      }

      /* Direct color lock — bypasses custom-property cascade failures
         that occur when @layer utilities (Tailwind) or global .section-eyebrow
         rules resolve --text-secondary before the parent override propagates.
         Specificity [0,3,0] beats both global classes and Tailwind layers. */
      .hero-card h1,
      .hero-card p {
        color: var(--color-primary-text);
      }

      :host-context(.force-compact) {
        .hero-card {
          padding: 1.25rem !important;
          min-height: unset !important;
          transition: all 0.3s ease !important;
        }

        /* Top bar: stack vertical en móvil para evitar overlaps */
        .flex.items-start.justify-between.gap-4 {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 1rem !important;
        }

        /* Contenedor de botón Volver: ancho completo */
        .flex-1.min-w-0.flex.items-center {
          width: 100% !important;
          flex: none !important;
        }

        /* Grupo de acciones: alineación izquierda y gap consistente en móvil */
        [role='group'] {
          justify-content: flex-start !important;
          width: 100% !important;
          gap: 0.5rem !important;
        }

        /* Botones de acción: consistencia en móvil */
        [role='group'] button,
        [role='group'] a {
          padding-left: 0.75rem !important;
          padding-right: 0.75rem !important;
          font-size: 0.75rem !important;
          min-height: 2.25rem !important;
          display: inline-flex !important;
          align-items: center !important;
        }

        /* Título más pequeño pero legible */
        h1 {
          font-size: 1.375rem !important;
          line-height: 1.2 !important;
        }

        /* Reducir espaciados internos */
        .flex.flex-col.gap-3.relative.z-10 {
          gap: 0.375rem !important;
        }

        /* Ajustar badge de ícono */
        .w-12.h-12 {
          width: 36px !important;
          height: 36px !important;
        }

        /* Eliminar el spacer */
        .flex-1[aria-hidden='true'] {
          display: none !important;
        }
      }
    `,
  ],
  host: {
    // HOST = único grid item. bento-hero va aquí, nunca en el div interno.
    class: 'block min-h-0 bento-hero',
    style: 'view-transition-name: section-hero',
  },
  imports: [IconComponent, RouterLink],
  template: `
    <!-- ═══════════════════════════════════════════════════════════
         TOAST-STYLE HERO — Fondo state-info + borde + bar.
         Sin surface-hero cascade: tokens usan valores base del modo.
         Misma paleta que el toast de PrimeNG escalada a bento-hero.
    ═══════════════════════════════════════════════════════════ -->
    <div
      #cardRef
      class="surface-hero hero-card rounded-lg min-h-full flex flex-col p-5 md:p-6 gap-3"
      role="region"
      [attr.aria-label]="title()"
    >
      <!-- TOP BAR: navegación atrás (izq) + acciones (der) -->
      <div class="flex items-start justify-between gap-4 relative z-10">
        <div class="flex-1 min-w-0 flex items-center gap-4">
          @if (backRoute()) {
            <a
              [routerLink]="backRoute()"
              class="group inline-flex items-center gap-2 py-1.5 px-3 -ml-1 rounded-xl text-xs font-bold uppercase tracking-widest text-white bg-white/10 border border-white/10 backdrop-blur-md hover:bg-white/20 no-underline transition-all shadow-sm shrink-0 whitespace-nowrap"
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
          <ng-content />
        </div>
        @if (actions().length) {
          <div
            class="flex flex-wrap items-start justify-end gap-2"
            role="group"
            aria-label="Acciones principales"
          >
            @for (action of actions(); track action.id) {
              @if (action.route) {
                <a
                  [routerLink]="action.route"
                  class="no-underline whitespace-nowrap flex-shrink-0"
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
                  class="whitespace-nowrap flex-shrink-0"
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
          <div
            class="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0"
          >
            <app-icon [name]="icon()!" [size]="22" class="text-brand" />
          </div>
        }

        <div class="flex flex-col gap-2">
          @if (contextLine()) {
            <p class="section-eyebrow m-0 wrap-break-word">{{ contextLine() }}</p>
          }
          <h1
            class="font-display font-bold leading-tight tracking-tight m-0 text-2xl md:text-plus-4xl"
          >
            {{ title() }}
          </h1>
          @if (subtitle()) {
            <p class="text-sm md:text-base leading-relaxed m-0 max-w-2xl opacity-85">
              {{ subtitle() }}
            </p>
          }
        </div>

        @if (chips().length) {
          <div class="flex flex-wrap gap-2">
            @for (chip of chips(); track chip.label) {
              <span
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
                [attr.style]="getChipStyle(chip)"
              >
                @if (chip.icon) {
                  <app-icon [name]="chip.icon" [size]="12" [color]="getChipIconColor(chip)" />
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
  // Chips siempre glass blanco + texto blanco. El estado se comunica por el ícono.
  getChipStyle(_chip: SectionHeroChip): string {
    return 'background: var(--bg-subtle); color: var(--color-primary-text); border-color: var(--border-subtle)';
  }

  // Color semántico solo para el ícono — independiente del texto del chip.
  getChipIconColor(chip: SectionHeroChip): string {
    switch (chip.style) {
      case 'error':
        return 'var(--state-error)';
      case 'warning':
        return 'var(--state-warning)';
      case 'success':
        return 'var(--state-success)';
      default:
        return 'var(--color-primary-text)';
    }
  }

  onActionClick(id: string): void {
    this.actionClick.emit(id);
  }
}
