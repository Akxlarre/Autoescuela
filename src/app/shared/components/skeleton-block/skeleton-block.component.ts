import {
  Component,
  ChangeDetectionStrategy,
  input,
  ElementRef,
  inject,
  afterNextRender,
  viewChild,
} from '@angular/core';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

/**
 * SkeletonBlockComponent — Átomo de loading placeholder.
 * 
 * Ahora usa GSAP para un shimmer sincronizado y de alta performance.
 */
@Component({
  selector: 'app-skeleton-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #block
      class="relative overflow-hidden rounded-md bg-subtle"
      [class.!rounded-full]="variant() === 'circle'"
      [class.!rounded-sm]="variant() === 'text'"
      [style.width]="width()"
      [style.height]="variant() === 'text' ? '1em' : height()"
      aria-hidden="true"
    >
      <!-- El shimmer se inyecta dinámicamente vía GSAP -->
    </div>
  `,
  styles: []
})
export class SkeletonBlockComponent {
  readonly variant = input<'rect' | 'circle' | 'text'>('rect');
  readonly width = input('100%');
  readonly height = input('16px');

  private readonly block = viewChild.required<ElementRef<HTMLElement>>('block');
  private readonly gsap = inject(GsapAnimationsService);

  constructor() {
    afterNextRender(() => {
      this.gsap.createShimmer(this.block().nativeElement);
    });
  }
}
