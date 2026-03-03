import { Injectable, signal, computed } from '@angular/core';

/**
 * LayoutService - Estado del layout responsive
 *
 * Controla sidebar drawer en mobile (hamburger).
 * Desktop: sidebar siempre visible. Mobile: overlay controlado por sidebarOpen.
 */
@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  private _sidebarOpen = signal(false);

  readonly sidebarOpen = this._sidebarOpen.asReadonly();

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
