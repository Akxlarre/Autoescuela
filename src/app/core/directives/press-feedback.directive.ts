import {
  Directive,
  ElementRef,
  DestroyRef,
  inject,
  input,
  afterNextRender,
} from '@angular/core';
import { GsapAnimationsService } from '@core/services/gsap-animations.service';

/**
 * Feedback interactivo GSAP sobre cualquier elemento.
 * Respeta `prefers-reduced-motion` vía GsapAnimationsService.
 *
 * Modos:
 * - `'full'` (default): hover (scale 1.02, y: -1) + press (scale 0.98)
 * - `'press'`: solo press, sin hover — ideal para botones PrimeNG que ya tienen hover CSS
 *
 * @example
 * <div appPressFeedback>Elemento con hover + press</div>
 * <p-button appPressFeedback="press">Solo press</p-button>
 */
@Directive({
  selector: '[appPressFeedback]',
  standalone: true,
})
export class PressFeedbackDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly destroyRef = inject(DestroyRef);

  /** 'press' = solo press; cualquier otro valor o vacío = full (hover + press) */
  readonly appPressFeedback = input<string>('full');

  constructor() {
    afterNextRender(() => {
      const mode = this.appPressFeedback() === 'press' ? 'press' : 'full';
      const cleanup =
        mode === 'press'
          ? this.gsap.addPressFeedback(this.el.nativeElement)
          : this.gsap.addInteractiveFeedback(this.el.nativeElement);

      this.destroyRef.onDestroy(() => cleanup());
    });
  }
}
