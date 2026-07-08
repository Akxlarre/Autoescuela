import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="badgeClass()">
      <ng-content></ng-content>
    </span>
  `,
})
export class BadgeComponent {
  variant = input<'success' | 'warning' | 'error' | 'info' | 'neutral' | 'brand'>('neutral');

  // Clases literales completas a propósito (no `'badge-' + variant()`): Tailwind v4
  // poda las clases @utility por contenido escaneado igual que las utilidades
  // normales — una concatenación dinámica no es detectable por el scanner.
  protected readonly badgeClass = computed(() => {
    switch (this.variant()) {
      case 'success':
        return 'badge-success';
      case 'warning':
        return 'badge-warning';
      case 'error':
        return 'badge-error';
      case 'info':
        return 'badge-info';
      case 'neutral':
        return 'badge-neutral';
      case 'brand':
        return 'badge-brand';
    }
  });
}
