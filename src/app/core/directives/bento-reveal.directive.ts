import { Directive, ElementRef, DestroyRef, inject, input, afterNextRender } from '@angular/core';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

/**
 * BentoRevealDirective — Reveal de entrada premium SIN flash para `.bento-grid`.
 *
 * Reemplaza el patrón manual `#bentoGrid viewChild + ngAfterViewInit + animateBentoGrid`
 * por una sola directiva declarativa. Su valor está en **acoplar** dos pasos que antes
 * vivían separados (y por eso producían parpadeo):
 *
 *   1. PRE-HIDE (constructor, pre-paint): añade `.is-reveal-pending`, que el CSS traduce
 *      a `opacity: 0` en las celdas. El constructor de la directiva corre durante la
 *      creación de la vista, ANTES de que el browser pinte → las celdas nunca se ven
 *      "encendidas y luego apagadas".
 *   2. REVEAL (afterNextRender): dispara `animateBentoGrid`, que fija el estado inicial
 *      inline (immediateRender) y retira la clase → la animación arranca seamless.
 *
 * Como hide y reveal son del mismo dueño, es imposible dejar celdas huérfanas en
 * `opacity: 0`. La limpieza del contexto GSAP se registra en `DestroyRef`.
 *
 * Respeta `prefers-reduced-motion` vía `GsapAnimationsService` (y hay un safety net
 * en CSS que fuerza `opacity: 1` bajo reduced-motion aunque el JS tarde).
 *
 * @example Estándar — revela al montar (caso común, contenido presente en el 1er paint)
 * <div class="bento-grid" appBentoReveal appBentoGridLayout>...</div>
 *
 * @example Con View Transition de ruta cubriendo el fade → solo transform (evita doble-fade)
 * <div class="bento-grid" appBentoReveal [skipOpacity]="true" appBentoGridLayout>...</div>
 */
@Directive({
  selector: '[appBentoReveal]',
  standalone: true,
})
export class BentoRevealDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Si una View Transition de ruta ya hace el fade del contenedor, pasar `true`
   * para que el grid anime solo `transform` (evita el doble-fade VT + grid).
   */
  readonly skipOpacity = input<boolean>(false);

  constructor() {
    // Pre-paint: ocultar las celdas antes de que el browser pinte por primera vez.
    this.el.nativeElement.classList.add('is-reveal-pending');

    afterNextRender(() => {
      const cleanup = this.gsap.animateBentoGrid(this.el.nativeElement, {
        skipOpacity: this.skipOpacity(),
      });
      this.destroyRef.onDestroy(cleanup);
    });
  }
}
