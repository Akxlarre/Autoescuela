import {
  Directive,
  ElementRef,
  inject,
  afterNextRender,
  input,
} from '@angular/core';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

/**
 * Animación de entrada automática para elementos que aparecen condicionalmente.
 * Usa `animateSkeletonToContent` para fade + slide suave cuando el elemento se crea.
 * Respeta `prefers-reduced-motion` vía el servicio.
 */
@Directive({
  selector: '[appAnimateIn]',
  standalone: true,
})
export class AnimateInDirective {
  private el = inject(ElementRef<HTMLElement>);
  private gsap = inject(GsapAnimationsService);

  readonly appAnimateIn = input<{ useBlur?: boolean; delay?: number } | ''>('');

  constructor() {
    // Esperar al siguiente frame para asegurar que el elemento está en el DOM y renderizado
    afterNextRender(() => {
      const options = this.appAnimateIn() === '' ? {} : (this.appAnimateIn() as any);
      this.gsap.animateSkeletonToContent(this.el.nativeElement, options);
    });
  }
}
