import { Directive, ElementRef, inject, input, effect } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ModalOverlayService } from '@core/services/modal-overlay.service';

/**
 * Mueve el host al contenedor de overlay cuando el modal está abierto,
 * para que el backdrop cubra todo el viewport (incl. topbar).
 * Usar en app-modal: <app-modal appModalOverlay [isOpen]="...">
 */
@Directive({
  selector: '[appModalOverlay]',
  standalone: true,
})
export class ModalOverlayDirective {
  private host = inject(ElementRef<HTMLElement>);
  private overlay = inject(ModalOverlayService);
  private doc = inject(DOCUMENT);

  /** Cuando true, mueve el host al overlay container. */
  appModalOverlay = input<boolean>(false);

  private originalParent: HTMLElement | null = null;
  private originalNextSibling: Node | null = null;
  private wrapper: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const open = this.appModalOverlay();
      const container = this.overlay.container();

      if (open && container) {
        setTimeout(() => this.moveToOverlay(container), 0);
      } else if (!open && this.originalParent) {
        this.moveBack();
      }
    });
  }

  private moveToOverlay(container: HTMLElement): void {
    const el = this.host.nativeElement;
    if (el.parentElement?.classList.contains('modal-overlay__wrapper')) return;

    this.originalParent = el.parentElement;
    this.originalNextSibling = el.nextSibling;

    // Wrapper bloquea fondo, scroll y recibe clics. Estilos en styles.scss (globales)
    // porque document.createElement no recibe encapsulación de Angular.
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'modal-overlay__wrapper';
    this.wrapper.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:auto;overflow:auto;';
    this.wrapper.appendChild(el);
    container.appendChild(this.wrapper);
    this.doc.body.classList.add('modal-open');
  }

  private moveBack(): void {
    const el = this.host.nativeElement;
    const parent = this.originalParent;
    if (!parent) return;

    if (this.originalNextSibling) {
      parent.insertBefore(el, this.originalNextSibling);
    } else {
      parent.appendChild(el);
    }
    this.wrapper?.remove();
    this.wrapper = null;
    this.originalParent = null;
    this.originalNextSibling = null;
    this.doc.body.classList.remove('modal-open');
  }
}
