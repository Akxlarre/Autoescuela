import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  input,
  output,
  signal,
} from '@angular/core';

import { IconComponent } from '@shared/components/icon/icon.component';
import type {
  AlumnoQuickAction,
  AlumnoResult,
  SearchResult,
  SearchResultGroup,
} from '@core/models/ui/global-search.model';

/**
 * SearchPanelComponent — Command Palette global (Dumb).
 *
 * Recibe datos vía `input()` y emite eventos vía `output()`.
 * Sin inyección de facades: toda la lógica de búsqueda vive en
 * GlobalSearchFacade, coordinada desde AppShellComponent.
 *
 * Comportamiento de alumnos:
 * - Click en fila → expande/colapsa menú contextual con acciones rápidas.
 * - Click en chip de acción → emite `resultSelected` con ruta de la acción.
 * - Enter en fila colapsada → expande; Enter en fila expandida → Ver Ficha.
 */
@Component({
  selector: 'app-search-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="search-panel card" role="search" aria-label="Búsqueda global">
      <!-- ── Fila del input ── -->
      <div class="search-panel__input-row">
        <app-icon name="search" [size]="16" class="search-panel__search-icon" aria-hidden="true" />
        <input
          type="search"
          class="search-panel__input"
          placeholder="Busca 'caja', 'agendar', un alumno o RUT..."
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          autofocus
          [value]="query()"
          (input)="onInput($event)"
          (keydown.escape)="closed.emit()"
          (keydown.arrowDown)="focusFirstResult($event)"
          data-llm-description="Global command palette — alumnos, acciones, vistas"
          aria-label="Buscar en la aplicación"
          aria-autocomplete="list"
          aria-haspopup="listbox"
        />
        <kbd class="search-panel__esc">Esc</kbd>
      </div>

      <!-- ── Cuerpo ── -->
      <div class="search-panel__body" role="listbox" aria-label="Resultados de búsqueda">
        @if (query().length === 0) {
          <!-- Sugerencias rápidas -->
          <div class="search-panel__empty-hint">
            <p class="search-panel__hint-title">Accesos rápidos</p>
            <div class="search-panel__quick-chips">
              @for (chip of quickChips; track chip.label) {
                <button
                  type="button"
                  class="search-panel__chip"
                  (click)="onChipClick(chip.query)"
                  data-llm-action="search-quick-chip"
                >
                  <app-icon [name]="chip.icon" [size]="13" aria-hidden="true" />
                  {{ chip.label }}
                </button>
              }
            </div>
          </div>
        } @else if (query().length === 1) {
          <p class="search-panel__hint text-muted">Escribe al menos 2 caracteres para buscar</p>
        } @else if (groups().length === 0) {
          <!-- Sin resultados -->
          <div class="search-panel__no-results">
            <app-icon name="search" [size]="22" class="search-panel__no-results-icon" />
            <span
              >Sin resultados para <strong>"{{ query() }}"</strong></span
            >
          </div>
        } @else {
          <!-- Grupos de resultados -->
          @for (group of groups(); track group.label) {
            <div class="search-panel__group">
              <div class="search-panel__group-header">
                <app-icon [name]="group.icon" [size]="12" aria-hidden="true" />
                <span>{{ group.label }}</span>
              </div>

              <ul class="search-panel__result-list" role="group" [attr.aria-label]="group.label">
                @for (result of group.results; track result.type + result.label) {
                  <li
                    class="search-panel__result-item"
                    role="option"
                    tabindex="0"
                    [attr.aria-label]="result.label"
                    [attr.aria-expanded]="
                      result.type === 'alumno' ? isExpanded(result.studentId) : null
                    "
                    (keydown.arrowDown)="focusNext($event)"
                    (keydown.arrowUp)="focusPrev($event)"
                    data-llm-action="search-result-item"
                  >
                    @if (result.type === 'action') {
                      <!-- Acción de navegación -->
                      <span
                        class="search-panel__result-item-inner"
                        (click)="selectResult(result)"
                        (keydown.enter)="selectResult(result)"
                      >
                        <span class="search-panel__result-icon search-panel__result-icon--action">
                          <app-icon [name]="result.icon" [size]="15" aria-hidden="true" />
                        </span>
                        <span class="search-panel__result-body">
                          <span class="search-panel__result-label">{{ result.label }}</span>
                          <span class="search-panel__result-desc">{{ result.description }}</span>
                        </span>
                        <app-icon
                          name="arrow-right"
                          [size]="14"
                          class="search-panel__result-arrow"
                          aria-hidden="true"
                        />
                      </span>
                    } @else {
                      <!-- Alumno — click expande, Enter expande/navega -->
                      <span
                        class="search-panel__result-item-inner"
                        (click)="toggleAlumno(result)"
                        (keydown.enter)="onResultEnter(result)"
                        data-llm-action="search-alumno-row"
                      >
                        <span class="search-panel__result-icon search-panel__result-icon--alumno">
                          <app-icon name="user" [size]="15" aria-hidden="true" />
                        </span>
                        <span class="search-panel__result-body">
                          <span class="search-panel__result-label">{{ result.label }}</span>
                          <span class="search-panel__result-desc">
                            {{ result.rut }}&nbsp;·&nbsp;<span
                              class="search-panel__status"
                              [attr.data-status]="statusClass(result.status)"
                              >{{ result.status }}</span
                            >
                          </span>
                        </span>
                        <app-icon
                          name="chevron-right"
                          [size]="14"
                          class="search-panel__expand-chevron"
                          [class.search-panel__expand-chevron--open]="isExpanded(result.studentId)"
                          aria-hidden="true"
                        />
                      </span>

                      <!-- Estante de acciones rápidas (expandible) -->
                      <div
                        class="search-panel__action-shelf"
                        [class.search-panel__action-shelf--open]="isExpanded(result.studentId)"
                        [attr.aria-hidden]="!isExpanded(result.studentId)"
                      >
                        <div class="search-panel__action-chips">
                          @for (action of result.quickActions; track action.actionType) {
                            <button
                              type="button"
                              class="search-panel__action-chip"
                              (click)="selectQuickAction(action)"
                              [attr.data-llm-action]="'search-alumno-action-' + action.actionType"
                              tabindex="-1"
                            >
                              <app-icon [name]="action.icon" [size]="12" aria-hidden="true" />
                              {{ action.label }}
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </li>
                }
              </ul>
            </div>
          }
        }
      </div>

      <!-- ── Footer con atajos de teclado ── -->
      @if (query().length > 0 && groups().length > 0) {
        <div class="search-panel__footer">
          <span><kbd>↑↓</kbd> navegar</span>
          <span><kbd>↵</kbd> expandir / abrir</span>
          <span><kbd>Esc</kbd> cerrar</span>
        </div>
      }
    </div>
  `,
  styleUrl: './search-panel.component.scss',
})
export class SearchPanelComponent {
  // ── Inputs ────────────────────────────────────────────────────────────────
  readonly groups = input.required<SearchResultGroup[]>();
  /** Distancia en px desde el borde derecho del viewport (alineación con botón topbar) */
  readonly rightPx = input<number>(24);

  // ── Outputs ───────────────────────────────────────────────────────────────
  readonly queryChange = output<string>();
  readonly closed = output<void>();
  readonly resultSelected = output<SearchResult>();

  /** Estado local del input — pura UI */
  protected readonly query = signal('');

  /** ID del alumno expandido — nil = todos colapsados */
  private readonly _expandedId = signal<string | null>(null);

  @HostBinding('style.right') get rightStyle(): string {
    return `${this.rightPx()}px`;
  }

  protected readonly quickChips = [
    { label: 'Agenda', icon: 'calendar', query: 'agenda' },
    { label: 'Cuadratura', icon: 'landmark', query: 'caja' },
    { label: 'Matricular', icon: 'user-plus', query: 'matricular' },
    { label: 'Flota', icon: 'car', query: 'flota' },
    { label: 'Pagos', icon: 'credit-card', query: 'pagos' },
  ];

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this._expandedId.set(null); // colapsar al cambiar el query
    this.queryChange.emit(value);
  }

  // ── Acciones por tipo de resultado ──────────────────────────────────────

  protected selectResult(result: SearchResult): void {
    this.resultSelected.emit(result);
  }

  /** Toggle del menú contextual del alumno. */
  protected toggleAlumno(result: AlumnoResult): void {
    this._expandedId.update((id) => (id === result.studentId ? null : result.studentId));
  }

  /**
   * Navega a la ruta de la acción rápida reutilizando el output `resultSelected`
   * con un ActionResult sintético. El shell llama a `facade.navigate()` sin cambios.
   */
  protected selectQuickAction(action: AlumnoQuickAction): void {
    this.resultSelected.emit({
      type: 'action',
      id: action.actionType,
      label: action.label,
      description: '',
      icon: action.icon,
      route: action.route,
    });
  }

  /**
   * Enter en un alumno:
   * - colapsado → expande el menú contextual
   * - expandido → ejecuta "Ver Ficha" (primera acción)
   */
  protected onResultEnter(result: AlumnoResult): void {
    if (this.isExpanded(result.studentId)) {
      const view = result.quickActions.at(0);
      if (view) this.selectQuickAction(view);
    } else {
      this.toggleAlumno(result);
    }
  }

  protected isExpanded(studentId: string): boolean {
    return this._expandedId() === studentId;
  }

  protected onChipClick(q: string): void {
    this.query.set(q);
    this.queryChange.emit(q);
  }

  protected statusClass(status: string): string {
    const map: Record<string, string> = {
      Activo: 'success',
      'Pendiente Pago': 'warning',
      'Docs Pendientes': 'warning',
      'Pre-inscrito': 'info',
      Finalizado: 'muted',
      Retirado: 'danger',
      Inactivo: 'muted',
    };
    return map[status] ?? 'muted';
  }

  protected focusFirstResult(event: Event): void {
    event.preventDefault();
    const first = (event.target as HTMLElement)
      .closest('.search-panel')
      ?.querySelector<HTMLElement>('.search-panel__result-item');
    first?.focus();
  }

  protected focusNext(event: Event): void {
    event.preventDefault();
    const el = event.target as HTMLElement;
    const next = el.nextElementSibling as HTMLElement | null;
    if (next?.classList.contains('search-panel__result-item')) {
      next.focus();
    } else {
      const nextGroup = el.closest('.search-panel__group')?.nextElementSibling;
      nextGroup?.querySelector<HTMLElement>('.search-panel__result-item')?.focus();
    }
  }

  protected focusPrev(event: Event): void {
    event.preventDefault();
    const el = event.target as HTMLElement;
    const prev = el.previousElementSibling as HTMLElement | null;
    if (prev?.classList.contains('search-panel__result-item')) {
      prev.focus();
    } else {
      el.closest('.search-panel')?.querySelector<HTMLElement>('.search-panel__input')?.focus();
    }
  }
}
