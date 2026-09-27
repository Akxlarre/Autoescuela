import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { ExecMonthlyPoint } from '@core/models/ui/executive-dashboard.model';
import {
  buildLinePath,
  formatCompactNumber,
  niceMax,
  pointX,
  pointY,
  yTicks,
} from '@core/utils/line-chart.utils';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';

/** Unidades internas del viewBox. El SVG se estira al contenedor (preserveAspectRatio none). */
const VB_W = 1200;
const VB_H = 300;

/**
 * Gráfico de líneas comparativo de 12 meses: año actual vs año anterior (spec 0044-b,
 * AC13/AC14/AC15). Dumb puro: recibe los puntos ya armados por el Facade.
 *
 * - Año actual: línea sólida en color primario. Año anterior: línea punteada en gris,
 *   así la diferencia no depende solo del color.
 * - Los meses futuros del año actual llegan en null y la línea termina en el mes en curso.
 * - Etiquetas y tooltip en HTML (no se deforman al estirar el SVG); las líneas usan
 *   vector-effect non-scaling-stroke para mantener el grosor.
 * - Llena el alto que le da su celda (host flex).
 */
@Component({
  selector: 'app-line-comparison-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonBlockComponent],
  template: `
    <div class="flex items-start justify-between gap-3 mb-3 shrink-0">
      <div class="min-w-0">
        <h2 class="item-title m-0">{{ title() }}</h2>
        @if (subtitle()) {
          <p class="text-xs text-text-muted m-0 mt-0.5">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex items-center gap-3 shrink-0 text-xs text-text-secondary" aria-hidden="true">
        <span class="flex items-center gap-1.5">
          <span class="legend-line legend-line--current"></span>{{ currentYear() }}
        </span>
        <span class="flex items-center gap-1.5">
          <span class="legend-line legend-line--previous"></span>{{ currentYear() - 1 }}
        </span>
      </div>
    </div>

    @if (loading()) {
      <div class="flex-1 min-h-0 flex flex-col gap-2 justify-end">
        <app-skeleton-block variant="rect" width="100%" height="100%" />
      </div>
    } @else {
      <div
        class="chart-body"
        role="img"
        [attr.aria-label]="ariaSummary()"
        (mouseleave)="hovered.set(null)"
      >
        <!-- Eje Y -->
        <div class="y-axis" aria-hidden="true">
          @for (t of ticks(); track $index) {
            <span class="y-tick" [style.bottom.%]="(t / max()) * 100">{{ formatTick(t) }}</span>
          }
        </div>

        <!-- Área de trazado -->
        <div class="plot">
          <svg
            class="plot-svg"
            [attr.viewBox]="'0 0 ' + vbW + ' ' + vbH"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            @for (t of ticks(); track $index) {
              <line
                x1="0"
                [attr.x2]="vbW"
                [attr.y1]="yOf(t)"
                [attr.y2]="yOf(t)"
                class="grid-line"
                vector-effect="non-scaling-stroke"
              />
            }
            <path
              [attr.d]="previousPath()"
              class="line line--previous"
              vector-effect="non-scaling-stroke"
            />
            <path
              [attr.d]="currentPath()"
              class="line line--current"
              vector-effect="non-scaling-stroke"
            />
          </svg>

          <!-- Columnas de hover + tooltip -->
          <div class="hover-grid">
            @for (p of points(); track p.month; let i = $index) {
              <div class="hover-col" (mouseenter)="hovered.set(i)">
                @if (hovered() === i) {
                  <span class="hover-rule"></span>
                  @if (p.current !== null) {
                    <span
                      class="dot dot--current"
                      [style.bottom.%]="(p.current / max()) * 100"
                    ></span>
                  }
                  <span
                    class="dot dot--previous"
                    [style.bottom.%]="(p.previous / max()) * 100"
                  ></span>
                }
              </div>
            }
          </div>

          @if (hoveredPoint(); as hp) {
            <div
              class="tooltip surface-glass"
              [style.left.%]="tooltipLeftPct()"
              [class.tooltip--flip]="tooltipLeftPct() > 70"
            >
              <p class="micro-label m-0 mb-1">{{ hp.label }}</p>
              <p class="m-0 text-xs text-text-primary">
                {{ currentYear() }}:
                <strong>{{ hp.current === null ? '—' : formatValue(hp.current) }}</strong>
              </p>
              <p class="m-0 text-xs text-text-secondary">
                {{ currentYear() - 1 }}: <strong>{{ formatValue(hp.previous) }}</strong>
              </p>
            </div>
          }
        </div>

        <!-- Eje X -->
        <div class="x-axis" aria-hidden="true">
          @for (p of points(); track p.month) {
            <span class="x-tick">{{ p.label }}</span>
          }
        </div>
      </div>
    }
  `,
  styleUrl: './line-comparison-chart.component.scss',
})
export class LineComparisonChartComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly points = input<ExecMonthlyPoint[]>([]);
  readonly currentYear = input.required<number>();
  /** Formatea los valores como montos CLP (`$`). */
  readonly money = input<boolean>(false);
  readonly loading = input<boolean>(false);

  protected readonly vbW = VB_W;
  protected readonly vbH = VB_H;
  protected readonly hovered = signal<number | null>(null);

  protected readonly max = computed(() => {
    const all = this.points().flatMap((p) => [p.current ?? 0, p.previous]);
    return niceMax(Math.max(0, ...all));
  });

  protected readonly ticks = computed(() => yTicks(this.max(), 4));

  protected readonly currentPath = computed(() =>
    buildLinePath(
      this.points().map((p) => p.current),
      this.max(),
      VB_W,
      VB_H,
    ),
  );

  protected readonly previousPath = computed(() =>
    buildLinePath(
      this.points().map((p) => p.previous),
      this.max(),
      VB_W,
      VB_H,
    ),
  );

  protected readonly hoveredPoint = computed(() => {
    const i = this.hovered();
    return i === null ? null : (this.points()[i] ?? null);
  });

  protected readonly tooltipLeftPct = computed(() => {
    const i = this.hovered() ?? 0;
    return (pointX(i, this.points().length || 12, VB_W) / VB_W) * 100;
  });

  protected readonly ariaSummary = computed(() => {
    const pts = this.points();
    const sumCurr = pts.reduce((s, p) => s + (p.current ?? 0), 0);
    const sumPrev = pts.reduce((s, p) => s + p.previous, 0);
    return `${this.title()}: ${this.currentYear()} acumula ${this.formatValue(sumCurr)}; ${
      this.currentYear() - 1
    } acumuló ${this.formatValue(sumPrev)}.`;
  });

  protected yOf(value: number): number {
    return pointY(value, this.max(), VB_H);
  }

  protected formatTick(value: number): string {
    return formatCompactNumber(value, this.money() ? '$' : '');
  }

  protected formatValue(value: number): string {
    const n = Math.round(value).toLocaleString('es-CL');
    return this.money() ? `$${n}` : n;
  }
}
