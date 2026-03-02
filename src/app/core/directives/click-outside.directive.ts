import {
  Directive,
  ElementRef,
  DestroyRef,
  inject,
  output,
  input,
} from '@angular/core';

/**
 * Emite `clickOutside` cuando el usuario hace clic fuera del elemento host.
 * Útil para cerrar panels, dropdowns y menús custom sin depender de PrimeNG.
 *
 * Soporta activación condicional con `clickOutsideEnabled` para evitar
 * registrar listeners cuando el panel está cerrado.
 *
 * `clickOutsideExclude`: selector(es) de elementos que no cuentan como "fuera"
 * (ej. panel desplegable renderizado fuera del host).
 *
 * @example
 * <div
 *   [appClickOutside]
 *   [clickOutsideEnabled]="search.isOpen()"
 *   [clickOutsideExclude]="'app-search-panel'"
 *   (clickOutside)="search.close()"
 * ></div>
 */
@Directive({
  selector: '[appClickOutside]',
  standalone: true,
})
export class ClickOutsideDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  /** Activa o desactiva el listener. Pasar `panelOpen()` para no escuchar en cerrado. */
  readonly clickOutsideEnabled = input<boolean>(true);

  /** Selector(es) de elementos que no deben considerarse "fuera" (ej: panel desplegable). */
  readonly clickOutsideExclude = input<string | string[]>([]);

  /** Emite cuando se detecta un clic fuera del host. */
  readonly clickOutside = output<void>();

  private readonly listener = (event: MouseEvent) => {
    if (!this.clickOutsideEnabled()) return;
    const target = event.target as Node;
    if (this.el.nativeElement.contains(target)) return;

    const exclude = this.clickOutsideExclude();
    if (exclude) {
      const selectors = Array.isArray(exclude) ? exclude : [exclude];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el?.contains(target)) return;
      }
    }

    this.clickOutside.emit();
  };

  constructor() {
    // capture:true intercepta antes que los listeners internos del panel
    document.addEventListener('click', this.listener, true);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('click', this.listener, true);
    });
  }
}
