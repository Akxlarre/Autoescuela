import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';

/**
 * SkeletonBlockComponent — Átomo de loading placeholder.
 *
 * Dumb component reutilizable para construir skeletons colocated.
 * Soporta formas rectangulares, circulares y texto.
 *
 * @example
 * <!-- Rectángulo (default) -->
 * <app-skeleton-block width="100%" height="120px" />
 *
 * <!-- Círculo (avatar placeholder) -->
 * <app-skeleton-block variant="circle" width="48px" height="48px" />
 *
 * <!-- Línea de texto -->
 * <app-skeleton-block variant="text" width="60%" />
 */
@Component({
  selector: 'app-skeleton-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="relative overflow-hidden rounded-md bg-subtle"
      [class.!rounded-full]="variant() === 'circle'"
      [class.!rounded-sm]="variant() === 'text'"
      [style.width]="width()"
      [style.height]="variant() === 'text' ? '1em' : height()"
      aria-hidden="true"
    >
      <div class="pointer-events-none absolute inset-0 animate-[shimmer_1.5s_ease-in-out_infinite] bg-[linear-gradient(90deg,transparent_0%,var(--bg-elevated)_50%,transparent_100%)]"></div>
    </div>
  `,
  styles: []
})
export class SkeletonBlockComponent {
  readonly variant = input<'rect' | 'circle' | 'text'>('rect');
  readonly width = input('100%');
  readonly height = input('16px');
}
