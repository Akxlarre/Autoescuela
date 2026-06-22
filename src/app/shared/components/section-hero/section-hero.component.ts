import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import type {
  SectionHeroAction,
  SectionHeroChip,
  SectionHeroMenuItem,
} from '@core/models/ui/section-hero.model';

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
      :host-context(.force-compact) {
        .surface-hero {
          padding: 1.25rem !important;
          min-height: unset !important;
          transition: all 0.3s ease !important;
        }

        /* Top bar: wrap si no hay espacio */
        .flex.items-start.justify-between.gap-4 {
          flex-wrap: wrap !important;
          gap: 0.5rem !important;
          align-items: flex-start !important;
        }

        /* Botones de acción: reducir padding para ahorrar espacio */
        [role='group'] button,
        [role='group'] a {
          padding-left: 0.625rem !important;
          padding-right: 0.625rem !important;
          font-size: 0.75rem !important;
          gap: 0.25rem !important;
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
      }

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

      /* ════════════════════════════════════════════════════════════
         MENÚ DESPLEGABLE DE ACCIÓN (panel flotante del DS)
         Mismo lenguaje visual que branch-selector / user-panel.
         OJO: el panel vive dentro de .surface-hero, que reescribe
         --text-* y --border-* a blanco. Hay que restaurar esos tokens
         dentro del panel para que el texto sea legible sobre el glass.
      ════════════════════════════════════════════════════════════ */
      /* Eleva el stacking context del host (creado por view-transition-name)
         por encima de las cards hermanas mientras el menú está abierto, para
         que el panel position:fixed no quede tapado por ellas. */
      :host(.hero-menu-open) {
        position: relative;
        z-index: 1000;
      }

      .hero-menu__chevron {
        opacity: 0.7;
        transition: transform var(--duration-fast) var(--ease-standard);
      }
      .hero-menu__chevron--open {
        transform: rotate(180deg);
      }

      .hero-menu-panel {
        position: fixed;
        z-index: 1000;
        min-width: 248px;
        padding: 6px;
        background: var(--bg-glass-surface);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        overflow: hidden;

        /* Restaurar tokens que .surface-hero pinta de blanco (modo claro). */
        --text-primary: #09090b;
        --text-secondary: #52525b;
        --text-muted: #a1a1aa;
        --border-subtle: rgba(9, 9, 11, 0.06);
        --border-default: rgba(9, 9, 11, 0.12);
      }

      :host-context([data-mode='dark']) .hero-menu-panel {
        --text-primary: #f4f4f5;
        --text-secondary: #a1a1aa;
        --text-muted: #71717a;
        --border-subtle: rgba(255, 255, 255, 0.04);
        --border-default: rgba(255, 255, 255, 0.12);
      }

      .hero-menu-panel__header {
        padding: 8px 10px 4px;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      /* Separación entre el segundo grupo y el primero */
      .hero-menu-panel__header:not(:first-child) {
        margin-top: 4px;
        border-top: 1px solid var(--border-subtle);
        padding-top: 10px;
      }

      .hero-menu-panel__item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 8px 10px;
        border: none;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--text-secondary);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        font-family: var(--font-body);
        text-align: left;
        cursor: pointer;
        transition: var(--transition-color);
      }
      .hero-menu-panel__item:not(:disabled):hover {
        background: var(--bg-elevated);
        color: var(--text-primary);
      }

      .hero-menu-panel__item-icon {
        flex-shrink: 0;
        color: var(--text-muted);
      }
      .hero-menu-panel__item:hover .hero-menu-panel__item-icon {
        color: var(--color-primary);
      }

      .hero-menu-panel__item-body {
        display: flex;
        flex-direction: column;
        gap: 1px;
        flex: 1;
        min-width: 0;
      }
      .hero-menu-panel__item-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hero-menu-panel__item-hint {
        font-size: 11px;
        font-weight: var(--font-normal);
        color: var(--text-muted);
        white-space: normal;
        line-height: 1.3;
      }

      .hero-menu-panel__item-lock {
        flex-shrink: 0;
        color: var(--text-muted);
      }

      .hero-menu-panel__item--disabled,
      .hero-menu-panel__item--disabled:hover {
        background: transparent;
        color: var(--text-muted);
        cursor: not-allowed;
      }
      .hero-menu-panel__item--disabled:hover .hero-menu-panel__item-icon {
        color: var(--text-muted);
      }
    `,
  ],
  host: {
    // HOST = único grid item. bento-hero va aquí, nunca en el div interno.
    class: 'block min-h-0 bento-hero',
    style: 'view-transition-name: section-hero',
    '[attr.title]': 'null',
    // view-transition-name convierte al host en un stacking context atómico:
    // las cards hermanas posteriores pintarían sobre el panel position:fixed.
    // Al abrir el menú elevamos el z-index del host para que su subárbol
    // (incluido el panel) quede por encima de las cards siguientes.
    '[class.hero-menu-open]': 'openMenuId() !== null',
  },
  imports: [IconComponent, RouterLink, AnimateInDirective],
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
      <div class="flex flex-wrap items-start justify-between gap-4 relative z-10">
        <div class="flex-1 min-w-0 flex flex-wrap items-center gap-4">
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
          } @else if (backClickable()) {
            <button
              type="button"
              class="group inline-flex items-center gap-2 py-1.5 px-3 -ml-1 rounded-xl text-xs font-bold uppercase tracking-widest text-white bg-white/10 border border-white/10 backdrop-blur-md hover:bg-white/20 transition-all shadow-sm shrink-0 whitespace-nowrap"
              [attr.aria-label]="'Volver a ' + backLabel()"
              data-llm-nav="back"
              (click)="backClicked.emit()"
            >
              <app-icon
                name="arrow-left"
                [size]="13"
                class="transition-transform group-hover:-translate-x-1"
              />
              <span>{{ backLabel() }}</span>
            </button>
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
              @if (action.menu) {
                <button
                  type="button"
                  [class]="action.primary ? 'btn-primary' : 'btn-secondary'"
                  class="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
                  [disabled]="action.disabled ?? false"
                  [attr.data-llm-action]="action.id"
                  aria-haspopup="menu"
                  [attr.aria-expanded]="openMenuId() === action.id"
                  (click)="toggleMenu(action.id, $event)"
                >
                  @if (action.icon) {
                    <app-icon
                      [name]="action.icon"
                      [size]="16"
                      [class.animate-spin]="action.loading"
                    />
                  }
                  {{ action.label }}
                  <app-icon
                    name="chevron-down"
                    [size]="14"
                    class="hero-menu__chevron"
                    [class.hero-menu__chevron--open]="openMenuId() === action.id"
                  />
                </button>
              } @else if (action.route) {
                <a
                  [routerLink]="action.route"
                  [class]="
                    action.danger
                      ? 'btn-danger-ghost'
                      : action.primary
                        ? 'btn-primary'
                        : 'btn-secondary'
                  "
                  class="no-underline whitespace-nowrap shrink-0"
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
                  [class]="
                    action.danger
                      ? 'btn-danger-ghost'
                      : action.primary
                        ? 'btn-primary'
                        : 'btn-secondary'
                  "
                  class="whitespace-nowrap shrink-0"
                  [disabled]="action.disabled ?? false"
                  [attr.data-llm-action]="action.id"
                  (click)="onActionClick(action.id)"
                >
                  @if (action.icon) {
                    <app-icon
                      [name]="action.icon"
                      [size]="16"
                      [class.animate-spin]="action.loading"
                    />
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

    <!-- ── Panel del menú de acción ──────────────────────────────────────
         Renderizado FUERA de .hero-card a propósito: el lift de hover de la
         card (transform) la convierte en containing block del position:fixed
         y lo recortaría con su overflow. Como hermano del card (hijo del host
         bento-hero, sin transform/overflow), el fixed siempre resuelve contra
         el viewport. ──────────────────────────────────────────────────── -->
    @if (openMenuId()) {
      <div
        appAnimateIn
        role="menu"
        class="hero-menu-panel"
        [style.top.px]="menuPos()?.top"
        [style.right.px]="menuPos()?.right"
      >
        @for (item of openMenuItems(); track item.id) {
          @if (item.header) {
            <div class="hero-menu-panel__header">{{ item.label }}</div>
          } @else {
            <button
              type="button"
              role="menuitem"
              class="hero-menu-panel__item"
              [class.hero-menu-panel__item--disabled]="item.disabled"
              [disabled]="item.disabled ?? false"
              [attr.data-llm-action]="item.id"
              (click)="onMenuItemClick(item)"
            >
              @if (item.icon) {
                <app-icon [name]="item.icon" [size]="15" class="hero-menu-panel__item-icon" />
              }
              <span class="hero-menu-panel__item-body">
                <span class="hero-menu-panel__item-label">{{ item.label }}</span>
                @if (item.hint) {
                  <span class="hero-menu-panel__item-hint">{{ item.hint }}</span>
                }
              </span>
              @if (item.disabled) {
                <app-icon name="lock" [size]="12" class="hero-menu-panel__item-lock" />
              }
            </button>
          }
        }
      </div>
    }
  `,
})
export class SectionHeroComponent implements AfterViewInit, OnDestroy {
  private readonly gsap = inject(GsapAnimationsService);
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  /** Id de la acción cuyo menú desplegable está abierto (null = ninguno). */
  protected readonly openMenuId = signal<string | null>(null);

  /** Ítems del menú de la acción actualmente abierta (para el panel raíz único). */
  protected readonly openMenuItems = computed<SectionHeroMenuItem[]>(() => {
    const id = this.openMenuId();
    if (!id) return [];
    return this.actions().find((a) => a.id === id)?.menu ?? [];
  });

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
  /** Si es false, no se anima al montar. Útil cuando el padre orquesta la entrada (ej: bento-grid). */
  readonly animateOnInit = input<boolean>(true);

  readonly actionClick = output<string>();
  readonly backClicked = output<void>();

  /** Muestra el botón "Volver" como <button> (sin ruta). Útil para vistas inline como Papelera. */
  readonly backClickable = input<boolean>(false);

  private readonly cardRef = viewChild<ElementRef<HTMLElement>>('cardRef');

  ngAfterViewInit(): void {
    if (this.animateOnInit()) {
      this.gsap.animateHero(this.cardRef()?.nativeElement);
    }
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

  // ── Menú desplegable de acción (panel flotante del DS) ──────────────────────

  /**
   * Posición fija del panel (top/right en px). Se usa `position: fixed` porque el
   * panel vive dentro de `.surface-hero`, que tiene `overflow: hidden` (recorta
   * cualquier panel `absolute`). Con `fixed` escapa de ese clipping; las
   * coordenadas se calculan desde el rect del botón disparador.
   */
  protected readonly menuPos = signal<{ top: number; right: number } | null>(null);
  private triggerEl: HTMLElement | null = null;

  /**
   * Listener en BUBBLE PHASE (no capture) para cerrar el menú al click fuera.
   * El trigger usa stopPropagation para que este listener no reciba el mismo
   * click que abrió el panel. Mismo patrón que `BranchSelectorComponent`.
   */
  private readonly outsideListener = (event: MouseEvent): void => {
    if (this.openMenuId() === null) return;
    if (this.hostEl.nativeElement.contains(event.target as Node)) return;
    this.closeMenu();
  };

  /** Reposiciona el panel al hacer scroll/resize mientras está abierto. */
  private readonly repositionListener = (): void => this.updateMenuPos();

  constructor() {
    document.addEventListener('click', this.outsideListener);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.outsideListener);
    this.detachReposition();
  }

  protected toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.openMenuId() === id) {
      this.closeMenu();
      return;
    }
    this.triggerEl = event.currentTarget as HTMLElement;
    this.openMenuId.set(id);
    this.updateMenuPos();
    window.addEventListener('scroll', this.repositionListener, true);
    window.addEventListener('resize', this.repositionListener);
  }

  private closeMenu(): void {
    this.openMenuId.set(null);
    this.menuPos.set(null);
    this.triggerEl = null;
    this.detachReposition();
  }

  private detachReposition(): void {
    window.removeEventListener('scroll', this.repositionListener, true);
    window.removeEventListener('resize', this.repositionListener);
  }

  private updateMenuPos(): void {
    if (!this.triggerEl) return;
    const r = this.triggerEl.getBoundingClientRect();
    this.menuPos.set({ top: r.bottom + 6, right: window.innerWidth - r.right });
  }

  protected onMenuItemClick(item: SectionHeroMenuItem): void {
    if (item.disabled || item.header) return;
    this.closeMenu();
    this.actionClick.emit(item.id);
  }
}
