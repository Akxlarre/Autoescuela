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
 * KpiCardComponent — Molécula de métrica (KPI).
 *
 * Dumb component que combina .kpi-value + .kpi-label + trend indicator + animateCounter().
 * Úsalo dentro de un bento-grid para construir dashboards de nivel premium.
 *
 * La animación del contador va de 0 al valor final en 1.2s (power2.out).
 * Respeta `prefers-reduced-motion` automáticamente.
 *
 * @example
 * <!-- KPI básico -->
 * <app-kpi-card label="Usuarios activos" [value]="24819" />
 *
 * <!-- Con ícono, variante de color y tamaño medio -->
 * <app-kpi-card
 *   label="Alumnos activos"
 *   [value]="142"
 *   icon="users"
 *   color="success"
 *   size="md"
 * />
 *
 * <!-- Con prefijo monetario y card-accent (máx 1 por sección bento) -->
 * <app-kpi-card
 *   label="Ingresos del mes"
 *   [value]="84320"
 *   prefix="$"
 *   [trend]="-3.1"
 *   icon="banknote"
 *   color="error"
 *   [accent]="true"
 * />
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  styleUrl: './kpi-card.component.scss',
  template: `
    <div
      class="kpi-card card card-tinted flex flex-col gap-2 h-full"
      [class.card-accent]="accent()"
      [class.kpi-card--md]="size() === 'md'"
      [class.kpi-card--sm]="size() === 'sm'"
      [class.kpi-card--success]="color() === 'success'"
      [class.kpi-card--warning]="color() === 'warning'"
      [class.kpi-card--error]="color() === 'error'"
    >
      <!-- Header: label (izquierda) + chip de ícono (derecha) -->
      <div class="flex items-start justify-between gap-3">
        <span class="kpi-label">{{ label() }}</span>
        @if (icon(); as iconName) {
          <div class="kpi-card__icon-chip" aria-hidden="true">
            <app-icon [name]="iconName" [size]="16" />
          </div>
        }
      </div>

      <!-- Valor principal — animado por GSAP al montar -->
      <p class="kpi-value flex items-baseline gap-0.5">
        @if (prefix()) {
          <span class="text-2xl font-semibold" style="color: var(--text-secondary)">
            {{ prefix() }}
          </span>
        }
        <span #valueEl>{{ value() }}</span>
        @if (suffix()) {
          <span class="text-2xl font-semibold" style="color: var(--text-secondary)">
            {{ suffix() }}
          </span>
        }
      </p>

      <!-- Trend — pill semántica + label de contexto -->
      @if (trend() !== undefined) {
        <div class="flex items-center gap-2 mt-auto flex-wrap" [attr.aria-label]="trendAriaLabel()">
          <span
            class="kpi-card__trend"
            [class.kpi-card__trend--up]="trendIsUp()"
            [class.kpi-card__trend--down]="!trendIsUp()"
          >
            <app-icon [name]="trendIcon()" [size]="11" />
            <span class="text-xs font-semibold">{{ trendDisplay() }}</span>
          </span>
          @if (trendLabel()) {
            <span class="text-xs" style="color: var(--text-muted)">{{ trendLabel() }}</span>
          }
        </div>
      }
    </div>
  `,
})
export class KpiCardComponent {
  /** Valor numérico principal. Se anima desde 0 al montar. */
  readonly value = input.required<number>();

  /** Etiqueta descriptiva del KPI (ej: "Usuarios activos"). Se muestra en .kpi-label. */
  readonly label = input.required<string>();

  /** Sufijo del valor (ej: '%', 'K', ' hrs'). Aparece fuera del contador animado. */
  readonly suffix = input<string>('');

  /** Prefijo del valor (ej: '$', '€'). Aparece fuera del contador animado. */
  readonly prefix = input<string>('');

  /**
   * Variación porcentual del periodo.
   * Positivo → verde + trending-up. Negativo → rojo + trending-down.
   * Omitir (undefined) → oculta la sección de trend.
   */
  readonly trend = input<number | undefined>(undefined);

  /** Contexto temporal del trend (ej: "vs. mes anterior", "últimas 24 h"). */
  readonly trendLabel = input<string>('');

  /**
   * Activa el borde superior .card-accent con var(--ds-brand).
   * Solo 1 card-accent por sección bento. Default: false.
   */
  readonly accent = input<boolean>(false);

  /** Ícono Lucide opcional (kebab-case). Aparece alineado a la derecha del label. */
  readonly icon = input<string | undefined>(undefined);

  /** Tamaño del valor principal. Default: 'lg' (--text-4xl). */
  readonly size = input<'lg' | 'md' | 'sm'>('lg');

  /** Variante de color semántica — afecta al ícono. Default: 'default'. */
  readonly color = input<'default' | 'success' | 'warning' | 'error'>('default');

  // ── Señales derivadas del trend ───────────────────────────────────────────

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

  protected readonly trendAriaLabel = computed(() => {
    const t = this.trend();
    if (t === undefined) return null;
    const dir = t >= 0 ? 'incremento' : 'descenso';
    return `${dir} de ${Math.abs(t).toFixed(1)}%${this.trendLabel() ? ' ' + this.trendLabel() : ''}`;
  });

  // ── GSAP counter ──────────────────────────────────────────────────────────

  private readonly valueEl = viewChild.required<ElementRef<HTMLElement>>('valueEl');
  private readonly gsap = inject(GsapAnimationsService);

  constructor() {
    // afterNextRender: garantiza que el elemento está en el DOM antes de animar.
    // GsapAnimationsService.animateCounter() respeta prefers-reduced-motion.
    afterNextRender(() => {
      this.gsap.animateCounter(
        this.valueEl().nativeElement,
        this.value(),
        // El suffix se omite aquí porque se renderiza fuera del span animado.
        // Esto evita duplicar el sufijo durante la animación.
        '',
      );
    });
  }
}
