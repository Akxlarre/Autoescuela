import {
  Directive,
  ElementRef,
  inject,
  afterNextRender,
} from '@angular/core';
import { GsapAnimationsService } from '@core/services/gsap-animations.service';

/**
 * Aplica el efecto hover de card vía GSAP: sombra elevada + y: -2px al hacer hover.
 * Usa tokens del design system (`--card-shadow-hover`, `--border-strong`).
 * Respeta `prefers-reduced-motion` vía GsapAnimationsService.
 *
 * Aplicar sobre cualquier elemento `.card` para consistencia visual automática,
 * sin necesidad de inyectar GsapAnimationsService en cada componente.
 *
 * @example
 * <div class="card" appCardHover>
 *   <h3>KPI Title</h3>
 * </div>
 */
@Directive({
  selector: '[appCardHover]',
  standalone: true,
})
export class CardHoverDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly gsap = inject(GsapAnimationsService);

  constructor() {
    afterNextRender(() => {
      this.gsap.addCardHover(this.el.nativeElement);
    });
  }
}
