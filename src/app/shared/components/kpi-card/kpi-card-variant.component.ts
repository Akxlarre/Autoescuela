import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { IconComponent } from '../icon/icon.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';

/**
 * KpiCardVariantComponent — Variante de molécula de métrica (KPI) con subtexto estadístico.
 */
@Component({
  selector: 'app-kpi-card-variant',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, CardHoverDirective],
  template: `
    <div
      appCardHover
      class="bento-card flex flex-col gap-2 h-full"
      [class.card-accent]="accent()"
      [attr.data-color-variant]="color()"
      [attr.aria-busy]="loading()"
    >
      @if (loading()) {
        <!-- Skeleton fiel: misma estructura que el contenido real -->
        <!-- Fila 1: label + icono -->
        <div class="flex items-start justify-between gap-3">
          <app-skeleton-block variant="text" width="55%" height="12px" />
          <app-skeleton-block variant="rect" width="28px" height="28px" />
        </div>
        <!-- Fila 2: valor KPI — altura = text-3xl md:text-4xl (~44px) -->
        <app-skeleton-block variant="rect" width="70%" height="44px" />
        <!-- Fila 3: subtexto — mt-auto igual que el contenido real -->
        <div class="mt-auto pt-2" style="border-top: 1px solid var(--border-subtle)">
          <app-skeleton-block variant="text" width="45%" height="12px" />
        </div>
      } @else {
        <!-- Modo Contenido Real -->
        <div class="flex items-start justify-between gap-3 mb-2">
          <span class="text-xs font-semibold" [style.color]="labelColor()">{{ label() }}</span>
          @if (icon(); as iconName) {
            <div
              class="flex items-center justify-center rounded-md w-7 h-7"
              [style.background]="iconBg()"
              [style.color]="iconColorStyle()"
              aria-hidden="true"
            >
              <app-icon [name]="iconName" [size]="14" />
            </div>
          }
        </div>

        <p class="flex items-baseline gap-1 m-0 min-w-0 w-full overflow-hidden">
          @if (prefix()) {
            <span class="text-2xl md:text-3xl font-bold align-baseline" style="color: var(--text-primary)">
              {{ prefix() }}
            </span>
          }
          <span
            #valueEl
            class="font-display font-bold align-baseline truncate"
            style="color: var(--text-primary); font-size: clamp(var(--text-2xl), 8vw, var(--text-4xl));"
            title="{{ value() }}"
            >{{ value() }}</span
          >
          @if (suffix()) {
            <span class="text-2xl md:text-3xl font-bold align-baseline" style="color: var(--text-primary)">
              {{ suffix() }}
            </span>
          }
        </p>

        <div class="flex items-center gap-1 mt-auto flex-wrap pt-2">
          @if (trend() !== undefined) {
            <span
              class="flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded"
              [style.color]="trendColor()"
            >
              <app-icon [name]="trendIcon()" [size]="12" />
              <span>{{ trendDisplay() }}</span>
            </span>
          }
          @if (subValue() || trendLabel()) {
            <span class="text-xs" style="color: var(--text-muted)">{{
              subValue() || trendLabel()
            }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
    `,
  ],
})
export class KpiCardVariantComponent {
  readonly value = input.required<number>();
  readonly label = input.required<string>();
  readonly suffix = input<string>('');
  readonly prefix = input<string>('');
  readonly trend = input<number | undefined>(undefined);
  readonly trendLabel = input<string>('');
  readonly subValue = input<string>('');
  readonly accent = input<boolean>(false);
  readonly icon = input<string | undefined>(undefined);
  readonly color = input<'default' | 'success' | 'warning' | 'error'>('default');
  readonly loading = input<boolean>(false);

  protected readonly labelColor = computed(() => {
    switch (this.color()) {
      case 'success':
        return 'var(--state-success)';
      case 'warning':
        return 'var(--state-warning)';
      case 'error':
        return 'var(--state-error)';
      case 'default':
      default:
        return 'var(--color-primary)';
    }
  });

  protected readonly iconBg = computed(() => {
    switch (this.color()) {
      case 'success':
        return 'rgba(34, 197, 94, 0.1)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.1)';
      case 'error':
        return 'rgba(239, 68, 68, 0.1)';
      case 'default':
      default:
        return 'rgba(14, 165, 233, 0.1)';
    }
  });

  protected readonly iconColorStyle = computed(() => {
    switch (this.color()) {
      case 'success':
        return 'var(--state-success)';
      case 'warning':
        return 'var(--state-warning)';
      case 'error':
        return 'var(--state-error)';
      case 'default':
      default:
        return 'var(--color-primary)';
    }
  });

  protected readonly trendIsUp = computed(() => (this.trend() ?? 0) >= 0);
  protected readonly trendIcon = computed(() =>
    this.trendIsUp() ? 'trending-up' : 'trending-down',
  );
  protected readonly trendColor = computed(() =>
    (this.trend() ?? 0) >= 0 ? 'var(--state-success)' : 'var(--state-error)',
  );

  protected readonly trendDisplay = computed(() => {
    const t = this.trend() ?? 0;
    const sign = t >= 0 ? '+' : '';
    const abs = Math.abs(t);
    return `${sign}${abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(1)}%`;
  });

  private readonly valueEl = viewChild<ElementRef<HTMLElement>>('valueEl');
  private readonly gsap = inject(GsapAnimationsService);

  constructor() {
    afterNextRender(() => {
      const el = this.valueEl();
      if (el) {
        this.gsap.animateCounter(el.nativeElement, this.value(), '');
      }
    });
  }
}
