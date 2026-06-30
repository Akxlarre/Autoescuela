import { DestroyRef, Directive, ElementRef, inject, afterNextRender } from '@angular/core';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

/**
 * Aplica el efecto hover de card vía GSAP: sombra elevada + y: -2px al hacer hover.
 * Usa tokens del design system (`--card-shadow-hover`, `--border-strong`).
 * Respeta `prefers-reduced-motion` vía GsapAnimationsService.
 * Limpia listeners automáticamente al destruir el elemento (sin memory leak).
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
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    let cleanup: (() => void) | null = null;

    afterNextRender(() => {
      cleanup = this.gsap.addCardHover(this.el.nativeElement);
    });

    this.destroyRef.onDestroy(() => cleanup?.());
  }
}
