import { Injectable, signal } from '@angular/core';

/** Posición del ancla: distancia desde el borde derecho del viewport (en px). */
export type SearchPanelAnchor = { rightPx: number };

/**
 * SearchPanelFacadeService — estado global del panel de búsqueda.
 *
 * Consumido por SearchShortcutDirective (Ctrl+K / Cmd+K).
 * Conecta la directiva de teclado con el componente de UI del buscador.
 *
 * Uso en el componente de búsqueda:
 * ```ts
 * readonly search = inject(SearchPanelFacadeService);
 * // En template: @if (search.isOpen()) { <app-search-panel /> }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class SearchPanelFacadeService {
  private _isOpen = signal(false);
  private _anchor = signal<SearchPanelAnchor | null>(null);

  readonly isOpen = this._isOpen.asReadonly();
  readonly anchor = this._anchor.asReadonly();

  /** Abre el panel (Ctrl+K). Usa posición por defecto si no hay ancla. */
  open(): void {
    this._anchor.set(null);
    this._isOpen.set(true);
  }

  /** Abre el panel alineando su borde derecho con el del elemento ancla. */
  openWithAnchor(anchorEl: HTMLElement): void {
    const rect = anchorEl.getBoundingClientRect();
    this._anchor.set({ rightPx: window.innerWidth - rect.right });
    this._isOpen.set(true);
  }

  close(): void {
    this._isOpen.set(false);
    this._anchor.set(null);
  }

  toggle(anchorEl?: HTMLElement): void {
    if (this._isOpen()) {
      this.close();
    } else if (anchorEl) {
      this.openWithAnchor(anchorEl);
    } else {
      this.open();
    }
  }
}
