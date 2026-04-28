import {
  Component,
  ChangeDetectionStrategy,
  input,
  ElementRef,
  inject,
  afterNextRender,
  viewChild,
  OnDestroy,
} from '@angular/core';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

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
    ></div>
  `,
  styles: [],
})
export class SkeletonBlockComponent implements OnDestroy {
  readonly variant = input<'rect' | 'circle' | 'text'>('rect');
  readonly width = input('100%');
  readonly height = input('16px');

  private readonly block = viewChild.required<ElementRef<HTMLElement>>('block');
  private readonly gsap = inject(GsapAnimationsService);
  private shimmerTimeline: gsap.core.Timeline | null = null;

  constructor() {
    afterNextRender(() => {
      this.shimmerTimeline = this.gsap.createShimmer(this.block().nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.shimmerTimeline?.kill();
    this.shimmerTimeline = null;
  }
}
