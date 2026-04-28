import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { BranchOption } from '@core/models/ui/branch.model';

/**
 * BranchSelectorComponent — Selector de sede.
 *
 * Dos modos de uso:
 * - topbarMode=true (default): dropdown compacto tipo chip con panel flotante glassmorphism.
 *   En mobile muestra solo dot + chevron (sin label) para no competir con otros botones.
 * - topbarMode=false (wizard de matrícula): pills horizontales clásicas.
 *
 * Nota: no usa appClickOutside porque esa directiva usa capture:true lo que intercepta
 * el mismo click que abre el panel y lo cierra inmediatamente. En cambio, registramos
 * un listener propio en bubble phase y usamos stopPropagation en el trigger.
 *
 * Dumb: inputs/outputs solamente — inyecta solo ElementRef para el click-outside.
 */
@Component({
  selector: 'app-branch-selector',
  standalone: true,
  imports: [IconComponent, AnimateInDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (topbarMode()) {
      <!-- ── MODO TOPBAR: dropdown compacto ── -->
      <div class="relative">
        <!-- Trigger pill -->
        <button
          type="button"
          class="branch-trigger"
          [class.branch-trigger--active]="isOpen()"
          (click)="toggle($event)"
          [attr.aria-expanded]="isOpen()"
          aria-haspopup="listbox"
          [attr.aria-label]="'Sede activa: ' + selectedLabel()"
          data-llm-action="toggle-branch-dropdown"
        >
          <!-- Mobile: ícono building-2 con affordance clara -->
          <app-icon name="building-2" [size]="15" class="branch-trigger__icon-mobile" />
          <!-- Desktop: dot de color semántico -->
          <span
            class="branch-trigger__dot"
            [class.branch-trigger__dot--all]="selectedBranchId() === null"
          ></span>
          <span class="branch-trigger__label">{{ selectedLabel() }}</span>
          <app-icon
            name="chevron-down"
            [size]="13"
            class="branch-trigger__chevron"
            [class.branch-trigger__chevron--open]="isOpen()"
          />
        </button>

        <!-- Dropdown panel -->
        @if (isOpen()) {
          <div
            appAnimateIn
            role="listbox"
            [attr.aria-label]="'Seleccionar sede'"
            class="branch-panel"
          >
            <!-- Header del panel -->
            <div class="branch-panel__header">
              <app-icon name="building-2" [size]="12" />
              <span>Sede activa</span>
            </div>

            <!-- Razón de bloqueo (cuando el selector está restringido) -->
            @if (lockReason()) {
              <div class="branch-panel__reason">
                <app-icon name="info" [size]="11" />
                <span>{{ lockReason() }}</span>
              </div>
            }

            <!-- Opción: Todas las escuelas -->
            @if (showAllOption()) {
              <button
                type="button"
                role="option"
                class="branch-panel__item"
                [class.branch-panel__item--selected]="
                  selectedBranchId() === null && !allOptionDisabled()
                "
                [class.branch-panel__item--disabled]="allOptionDisabled()"
                [disabled]="allOptionDisabled()"
                [attr.title]="allOptionDisabled() ? lockReason() : null"
                (click)="select(null)"
                data-llm-action="select-branch-all"
              >
                <span class="branch-panel__item-dot branch-panel__item-dot--all"></span>
                <span class="branch-panel__item-label">Todas las escuelas</span>
                @if (allOptionDisabled()) {
                  <app-icon name="lock" [size]="11" class="branch-panel__item-lock" />
                } @else if (selectedBranchId() === null) {
                  <app-icon name="check" [size]="13" class="branch-panel__item-check" />
                }
              </button>
            }

            <!-- Separador -->
            @if (showAllOption() && branches().length > 0) {
              <div class="branch-panel__divider"></div>
            }

            <!-- Sedes individuales -->
            @for (branch of branches(); track branch.id) {
              <button
                type="button"
                role="option"
                class="branch-panel__item"
                [class.branch-panel__item--selected]="selectedBranchId() === branch.id"
                [class.branch-panel__item--disabled]="disabledBranchIds().includes(branch.id)"
                [disabled]="disabledBranchIds().includes(branch.id)"
                [attr.title]="disabledBranchIds().includes(branch.id) ? lockReason() : null"
                (click)="select(branch.id)"
                [attr.data-llm-action]="'select-branch-' + branch.slug"
              >
                <span class="branch-panel__item-dot"></span>
                <span class="branch-panel__item-label">{{ branch.name }}</span>
                @if (disabledBranchIds().includes(branch.id)) {
                  <app-icon name="lock" [size]="11" class="branch-panel__item-lock" />
                } @else if (selectedBranchId() === branch.id) {
                  <app-icon name="check" [size]="13" class="branch-panel__item-check" />
                }
              </button>
            }
          </div>
        }
      </div>
    } @else {
      <!-- ── MODO WIZARD: pills horizontales ── -->
      <div class="flex flex-col gap-1">
        <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Sede</p>
        <div class="flex gap-2 flex-wrap">
          @if (showAllOption()) {
            <button
              type="button"
              class="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all"
              [class.border-brand]="selectedBranchId() === null"
              [class.bg-brand-muted]="selectedBranchId() === null"
              [class.text-brand]="selectedBranchId() === null"
              [class.border-border-default]="selectedBranchId() !== null"
              [class.bg-surface]="selectedBranchId() !== null"
              [class.text-text-secondary]="selectedBranchId() !== null"
              (click)="select(null)"
              data-llm-action="select-branch-all"
            >
              <app-icon name="globe" [size]="14" />
              Todas las escuelas
            </button>
          }
          @for (branch of branches(); track branch.id) {
            <button
              type="button"
              class="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all"
              [class.border-brand]="selectedBranchId() === branch.id"
              [class.bg-brand-muted]="selectedBranchId() === branch.id"
              [class.text-brand]="selectedBranchId() === branch.id"
              [class.border-border-default]="selectedBranchId() !== branch.id"
              [class.bg-surface]="selectedBranchId() !== branch.id"
              [class.text-text-secondary]="selectedBranchId() !== branch.id"
              (click)="select(branch.id)"
              [attr.data-llm-action]="'select-branch-' + branch.slug"
            >
              <app-icon name="building-2" [size]="14" />
              {{ branch.name }}
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      /* ── Trigger pill ───────────────────────────────────────────
       Mobile: ícono building-2 + chevron (affordance clara, ~36px).
       Desktop (md+): dot de color + label + chevron.
    ─────────────────────────────────────────────────────────── */
      .branch-trigger {
        display: flex;
        align-items: center;
        gap: 4px;
        /* Mobile: solo dot + chevron */
        padding: 6px 7px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-default);
        background: var(--bg-surface);
        color: var(--text-secondary);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        font-family: var(--font-body);
        cursor: pointer;
        transition: var(--transition-btn);
        white-space: nowrap;
        box-shadow: var(--shadow-sm);
      }

      @media (min-width: 768px) {
        .branch-trigger {
          gap: 6px;
          padding: 5px 10px 5px 8px;
          max-width: 220px;
        }
      }

      .branch-trigger:hover {
        border-color: var(--border-strong);
        color: var(--text-primary);
        background: var(--bg-elevated);
      }

      .branch-trigger--active {
        border-color: var(--accent-border);
        background: var(--color-primary-muted);
        color: var(--color-primary);
        box-shadow: var(--shadow-focus);
      }

      /* Ícono mobile: visible en mobile, oculto en desktop */
      .branch-trigger__icon-mobile {
        display: inline-flex;
        flex-shrink: 0;
        color: var(--ds-brand);
      }

      @media (min-width: 768px) {
        .branch-trigger__icon-mobile {
          display: none;
        }
      }

      /* Dot de estado: oculto en mobile, visible en desktop */
      .branch-trigger__dot {
        display: none;
        width: 7px;
        height: 7px;
        border-radius: var(--radius-full);
        background: var(--ds-brand);
        flex-shrink: 0;
      }

      @media (min-width: 768px) {
        .branch-trigger__dot {
          display: inline-block;
        }
      }

      .branch-trigger__dot--all {
        background: var(--text-muted);
      }

      /* ── Label: oculto en mobile, visible en desktop ── */
      .branch-trigger__label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        display: none;
      }

      @media (min-width: 768px) {
        .branch-trigger__label {
          display: block;
        }
      }

      /* Chevron con rotación animada */
      .branch-trigger__chevron {
        flex-shrink: 0;
        opacity: 0.5;
        transition:
          transform var(--duration-fast) var(--ease-standard),
          opacity var(--duration-fast) var(--ease-standard);
      }

      .branch-trigger__chevron--open {
        transform: rotate(180deg);
        opacity: 1;
      }

      /* ── Panel flotante glassmorphism ── */
      .branch-panel {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        z-index: 60;
        min-width: 200px;
        background: var(--bg-glass-surface);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        padding: 6px;
        overflow: hidden;
      }

      /* Header del panel */
      .branch-panel__header {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px 8px;
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      /* Separador */
      .branch-panel__divider {
        height: 1px;
        background: var(--border-subtle);
        margin: 4px;
      }

      /* Item de opción */
      .branch-panel__item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 10px;
        border-radius: var(--radius-md);
        border: none;
        background: transparent;
        color: var(--text-secondary);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        font-family: var(--font-body);
        cursor: pointer;
        text-align: left;
        transition: var(--transition-color);
      }

      .branch-panel__item:hover {
        background: var(--bg-elevated);
        color: var(--text-primary);
      }

      .branch-panel__item--selected {
        background: var(--color-primary-muted);
        color: var(--color-primary);
      }

      .branch-panel__item--selected:hover {
        background: var(--color-primary-muted);
        color: var(--color-primary);
      }

      /* Dot dentro del item */
      .branch-panel__item-dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: var(--radius-full);
        background: var(--ds-brand);
        flex-shrink: 0;
      }

      .branch-panel__item-dot--all {
        background: var(--text-muted);
      }

      .branch-panel__item-label {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Check de selección activa */
      .branch-panel__item-check {
        flex-shrink: 0;
        color: var(--color-primary);
      }

      /* Item deshabilitado */
      .branch-panel__item--disabled,
      .branch-panel__item--disabled:hover {
        opacity: 0.45;
        cursor: not-allowed;
        background: transparent;
        color: var(--text-secondary);
      }

      /* Ícono lock en items deshabilitados */
      .branch-panel__item-lock {
        flex-shrink: 0;
        color: var(--text-muted);
      }

      /* Razón de bloqueo — badge informativo bajo el header */
      .branch-panel__reason {
        display: flex;
        align-items: center;
        gap: 5px;
        margin: 0 6px 4px;
        padding: 5px 8px;
        border-radius: var(--radius-md);
        background: var(--state-warning-bg, rgba(234, 179, 8, 0.08));
        color: var(--state-warning-text, #92400e);
        font-size: 10px;
        font-weight: var(--font-medium);
        font-family: var(--font-body);
        line-height: 1.4;
      }
    `,
  ],
})
export class BranchSelectorComponent implements OnDestroy {
  readonly branches = input.required<BranchOption[]>();
  readonly selectedBranchId = input<number | null>(null);
  /** Muestra la opción "Todas las escuelas" que emite null. Usar en Topbar admin. */
  readonly showAllOption = input(false);
  /** true = dropdown compacto (topbar). false = pills horizontales (wizard). */
  readonly topbarMode = input(true);
  /** IDs de sedes deshabilitadas (ej: sedes sin Clase Profesional en vistas profesional-only). */
  readonly disabledBranchIds = input<number[]>([]);
  /** Deshabilita la opción "Todas las escuelas" (ej: en vistas que requieren sede concreta). */
  readonly allOptionDisabled = input(false);
  /** Texto de contexto que explica por qué el selector está restringido. */
  readonly lockReason = input<string | null>(null);

  readonly branchChange = output<number | null>();

  protected readonly isOpen = signal(false);

  protected readonly selectedLabel = computed(() => {
    const id = this.selectedBranchId();
    if (id === null) return 'Todas las sedes';
    return this.branches().find((b) => b.id === id)?.name ?? 'Sede';
  });

  private readonly hostEl = inject(ElementRef<HTMLElement>);

  /**
   * Listener en BUBBLE PHASE (no capture).
   * El trigger usa stopPropagation para que este listener no reciba
   * el mismo click que abrió el panel.
   */
  private readonly outsideListener = (event: MouseEvent): void => {
    if (!this.isOpen()) return;
    if (this.hostEl.nativeElement.contains(event.target as Node)) return;
    this.isOpen.set(false);
  };

  constructor() {
    document.addEventListener('click', this.outsideListener);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.outsideListener);
  }

  /**
   * Toggle del panel con stopPropagation para bloquear al outsideListener.
   */
  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.update((v) => !v);
  }

  protected select(id: number | null): void {
    this.branchChange.emit(id);
    this.isOpen.set(false);
  }
}
