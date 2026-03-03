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

/**
 * KpiCardVariantComponent — Variante de molécula de métrica (KPI) con subtexto estadístico.
 *
 * Dumb component creado específicamente para el dashboard de admin para mostrar 
 * KPI principales con detalles extra, como "12 prácticas, 6 teóricas".
 */
@Component({
    selector: 'app-kpi-card-variant',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [IconComponent],
    template: `
    <div
      class="card card-tinted flex flex-col gap-2 h-full"
      style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--card-radius); padding: var(--card-padding);"
      [class.card-accent]="accent()"
      [attr.data-color-variant]="color()"
    >
      <!-- Header: label (izquierda) + chip de ícono (derecha) -->
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

      <!-- Valor principal — animado por GSAP al montar -->
      <p class="flex items-baseline gap-1 m-0">
        @if (prefix()) {
          <span class="text-3xl font-bold" style="color: var(--text-primary)">
            {{ prefix() }}
          </span>
        }
        <span #valueEl class="text-4xl font-bold" style="color: var(--text-primary)">{{ value() }}</span>
        @if (suffix()) {
          <span class="text-3xl font-bold" style="color: var(--text-primary)">
            {{ suffix() }}
          </span>
        }
      </p>

      <!-- SubValor / Trend -->
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
          <span class="text-xs" style="color: var(--text-muted)">{{ subValue() || trendLabel() }}</span>
        }
      </div>
    </div>
  `,
    styles: [`
    .card-accent {
      border-top: 3px solid var(--ds-brand) !important;
    }
  `]
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

    // Computed styles based on color variant
    protected readonly labelColor = computed(() => {
        switch (this.color()) {
            case 'success': return 'var(--state-success)';
            case 'warning': return 'var(--state-warning)';
            case 'error': return 'var(--state-error)';
            case 'default':
            default: return 'var(--color-primary)';
        }
    });

    protected readonly iconBg = computed(() => {
        switch (this.color()) {
            case 'success': return 'var(--state-success-bg, rgba(34, 197, 94, 0.1))';
            case 'warning': return 'var(--state-warning-bg, rgba(245, 158, 11, 0.1))';
            case 'error': return 'var(--state-error-bg, rgba(239, 68, 68, 0.1))';
            case 'default':
            default: return 'var(--color-primary-muted, rgba(59, 130, 246, 0.1))';
        }
    });

    protected readonly iconColorStyle = computed(() => {
        switch (this.color()) {
            case 'success': return 'var(--state-success, rgb(34, 197, 94))';
            case 'warning': return 'var(--state-warning, rgb(245, 158, 11))';
            case 'error': return 'var(--state-error, rgb(239, 68, 68))';
            case 'default':
            default: return 'var(--color-primary, rgb(59, 130, 246))';
        }
    });

    // Trend calculations
    protected readonly trendIsUp = computed(() => (this.trend() ?? 0) >= 0);
    protected readonly trendIcon = computed(() => this.trendIsUp() ? 'trending-up' : 'trending-down');
    protected readonly trendColor = computed(() => (this.trend() ?? 0) >= 0 ? 'var(--state-success)' : 'var(--state-error)');

    protected readonly trendDisplay = computed(() => {
        const t = this.trend() ?? 0;
        const sign = t >= 0 ? '+' : '';
        const abs = Math.abs(t);
        return `${sign}${abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(1)}%`;
    });

    private readonly valueEl = viewChild.required<ElementRef<HTMLElement>>('valueEl');
    private readonly gsap = inject(GsapAnimationsService);

    constructor() {
        afterNextRender(() => {
            this.gsap.animateCounter(this.valueEl().nativeElement, this.value(), '');
        });
    }
}
