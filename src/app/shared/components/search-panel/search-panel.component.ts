import {
  Component,
  ChangeDetectionStrategy,
  HostBinding,
  inject,
  output,
  signal,
} from '@angular/core';

import { SearchPanelFacadeService } from '@core/services/ui/search-panel.service';
import { IconComponent } from '@shared/components/icon/icon.component';

/**
 * SearchPanelComponent — panel de búsqueda global.
 *
 * - `query` es estado local de UI (signal interno).
 * - La apertura/cierre y la animación de entrada se gestionan en TopbarComponent.
 * - Ctrl+K se maneja via [appSearchShortcut]. El posicionamiento usa SearchPanelFacadeService.anchor.
 *
 * Emite `queryChange` al escribir y `closed` al pulsar Escape.
 */
@Component({
  selector: 'app-search-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="search-panel card" role="search" aria-label="Búsqueda global">
      <!-- Input row -->
      <div class="search-panel__input-row">
        <app-icon name="search" [size]="16" class="search-panel__search-icon" aria-hidden="true" />
        <input
          type="search"
          class="search-panel__input"
          placeholder="Buscar alumnos, clases, vehículos..."
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          autofocus
          [value]="query()"
          (input)="onInput($event)"
          (keydown.escape)="closed.emit()"
          data-llm-description="Global search input — alumnos, clases, vehículos, instructores"
          aria-label="Buscar en la aplicación"
          aria-autocomplete="list"
        />
        <kbd class="search-panel__esc">Esc</kbd>
      </div>

      <!-- Cuerpo — resultados / estado vacío -->
      <div class="search-panel__body">
        @if (query().length === 0) {
          <p class="search-panel__hint text-muted">Escribe para buscar en toda la aplicación</p>
        } @else {
          <div class="search-panel__empty">
            <app-icon name="search" [size]="22" />
            <span
              >Sin resultados para <strong>"{{ query() }}"</strong></span
            >
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './search-panel.component.scss',
})
export class SearchPanelComponent {
  private readonly search = inject(SearchPanelFacadeService);

  /** Estado local del query — pura UI, sin Facade */
  protected readonly query = signal('');

  readonly queryChange = output<string>();
  readonly closed = output<void>();

  /** Borde derecho alineado con el botón de búsqueda; por defecto 24px si no hay ancla. */
  @HostBinding('style.right') get rightStyle(): string {
    const a = this.search.anchor();
    return a ? `${a.rightPx}px` : '24px';
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.queryChange.emit(value);
  }
}
