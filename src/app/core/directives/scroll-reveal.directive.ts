import {
  Directive,
  ElementRef,
  DestroyRef,
  inject,
  input,
  afterNextRender,
} from '@angular/core';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

/**
 * ScrollRevealDirective — Revelar elementos al entrar al viewport via ScrollTrigger.
 *
 * Aplica automáticamente una animación fade+slide-up cuando el elemento
 * entra al área visible del scroll. Limpia el ScrollTrigger al destruir.
 * Respeta `prefers-reduced-motion` vía GsapAnimationsService.
 *
 * @example
 * <!-- Reveal estándar (32px desplazamiento) -->
 * <div appScrollReveal class="card p-5">...</div>
 *
 * <!-- Con opciones personalizadas -->
 * <div [appScrollReveal]="{ y: 48, delay: 0.1, threshold: 0.2 }">...</div>
 *
 * <!-- Stagger manual: aplica delay incremental a items de una lista -->
 * @for (item of items; track item.id; let i = $index) {
 *   <div [appScrollReveal]="{ delay: i * 0.05 }">{{ item.label }}</div>
 * }
 */
@Directive({
  selector: '[appScrollReveal]',
  standalone: true,
})
export class ScrollRevealDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Opciones opcionales para customizar el reveal.
   * Acepta un objeto o se puede usar como attribute selector sin valor.
   */
  readonly appScrollReveal = input<{ y?: number; delay?: number; threshold?: number } | ''>('');

  constructor() {
    afterNextRender(() => {
      const opts = this.appScrollReveal();
      const options = typeof opts === 'object' ? opts : undefined;

      const cleanup = this.gsap.animateScrollReveal(this.el.nativeElement, options);
      this.destroyRef.onDestroy(cleanup);
    });
  }
}
