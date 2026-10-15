import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { initialFocusTarget, trapTabTarget } from '@core/utils/focus-trap.utils';

/**
 * Foco del teclado en un modal (fix-390-m). Va en el elemento con role dialog, que debe vivir
 * dentro de un bloque condicional: la directiva nace cuando el modal se abre y muere cuando se
 * cierra.
 *
 * - Al abrir: recuerda quién tenía el foco y lo lleva adentro (al elemento marcado con
 *   data-modal-autofocus, o al primero que lo recibe).
 * - Abierto: Tab y Shift+Tab no salen del modal.
 * - Al cerrar: devuelve el foco a quien lo tenía, si sigue en pantalla.
 *
 * No cierra el modal: Escape sigue a cargo de cada modal.
 */
@Directive({
  selector: '[appModalFocus]',
  standalone: true,
  host: { '(keydown)': 'onKeydown($event)' },
})
export class ModalFocusDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);

  /** Control que tenía el foco al abrirse el modal. */
  private readonly opener: HTMLElement | null;
  private destroyed = false;

  constructor() {
    const active = this.doc.activeElement;
    this.opener = active instanceof HTMLElement && active !== this.doc.body ? active : null;
    // El contenedor recibe el foco solo si adentro no hay nada que lo reciba.
    if (!this.host.nativeElement.hasAttribute('tabindex')) {
      this.host.nativeElement.setAttribute('tabindex', '-1');
    }
  }

  ngAfterViewInit(): void {
    // Un tick: appModalOverlay mueve el modal de contenedor al abrirlo, y un elemento que se mueve
    // pierde el foco. El segundo intento cubre el caso en que ese movimiento ocurra después.
    setTimeout(() => {
      this.focusInside();
      requestAnimationFrame(() => this.focusInside());
    }, 0);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    const opener = this.opener;
    if (!opener) return;
    // Después de que Angular quite el modal: recién ahí el foco quedó libre.
    setTimeout(() => {
      const active = this.doc.activeElement;
      const focusIsFree =
        !active || active === this.doc.body || this.host.nativeElement.contains(active);
      if (opener.isConnected && focusIsFree) opener.focus({ preventScroll: true });
    }, 0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const target = trapTabTarget(this.host.nativeElement, this.doc.activeElement, event.shiftKey);
    if (!target) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
  }

  private focusInside(): void {
    const root = this.host.nativeElement;
    if (this.destroyed || root.contains(this.doc.activeElement)) return;
    initialFocusTarget(root).focus({ preventScroll: true });
  }
}
