import { Injectable, signal } from '@angular/core';

/**
 * Proporciona el contenedor donde se renderizan los modales para que cubran
 * todo el viewport (incl. topbar). El MainLayout registra el contenedor.
 */
@Injectable({
  providedIn: 'root',
})
export class ModalOverlayService {
  private _container = signal<HTMLElement | null>(null);

  /** Contenedor donde se mueven los modales abiertos. */
  readonly container = this._container.asReadonly();

  setContainer(container: HTMLElement): void {
    this._container.set(container);
  }

  clearContainer(): void {
    this._container.set(null);
  }
}
