import { Injectable, signal, computed } from '@angular/core';
import type { LayoutTier } from '@core/models/ui/layout.model';
import { widthToTier } from '@core/utils/layout-tier.utils';

/**
 * LayoutService - Estado del layout responsive
 *
 * Controla sidebar drawer en mobile (hamburger).
 * Desktop: sidebar siempre visible. Mobile: overlay controlado por sidebarOpen.
 *
 * Tier por contenedor (spec 0028): `tier` deriva del ancho REAL de `<main>`
 * (container `layoutmain`) vía ResizeObserver — el layout-drawer angosta
 * <main> sin cambiar el viewport, y la densidad debe reaccionar igual.
 * `AppShellComponent` registra el observer una sola vez con `observeMain()`.
 */
@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  private _sidebarOpen = signal(false);
  private _mainWidth = signal<number | null>(null);

  readonly sidebarOpen = this._sidebarOpen.asReadonly();
  readonly mainWidth = this._mainWidth.asReadonly();
  readonly tier = computed<LayoutTier>(() => widthToTier(this._mainWidth()));

  /**
   * Observa el ancho de `<main>` y alimenta `mainWidth`/`tier`.
   * Retorna el cleanup para registrar en `DestroyRef.onDestroy`.
   * SSR-safe: sin ResizeObserver retorna un no-op (tier queda 'desktop').
   */
  observeMain(el: HTMLElement): () => void {
    if (typeof ResizeObserver === 'undefined') {
      return () => {};
    }

    if (el.clientWidth > 0) {
      this._mainWidth.set(el.clientWidth);
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (typeof width === 'number') {
        this._mainWidth.set(width);
      }
    });
    observer.observe(el);

    return () => observer.disconnect();
  }

  openSidebar(): void {
    this._sidebarOpen.set(true);
  }

  closeSidebar(): void {
    this._sidebarOpen.set(false);
  }

  toggleSidebar(): void {
    this._sidebarOpen.update((v) => !v);
  }
}
