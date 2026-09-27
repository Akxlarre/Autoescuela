import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type {
  ReceivableAgingBucket,
  ReceivablesSummary,
} from '@core/models/ui/executive-dashboard.model';
import { formatCLP } from '@core/utils/date.utils';
import { IconComponent } from '../icon/icon.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

/** Más antigua = más riesgo de no cobrar → escala de color de estado. */
const BUCKET_COLORS: Record<ReceivableAgingBucket['bucket'], string> = {
  '0-30': 'var(--state-success)',
  '31-60': 'var(--state-info, var(--color-primary))',
  '61-90': 'var(--state-warning)',
  '90+': 'var(--state-error)',
};

interface BucketView extends ReceivableAgingBucket {
  color: string;
  pct: number;
  montoLabel: string;
}

/**
 * Cartera por cobrar Clase B por antigüedad de la matrícula (spec 0044-b, AC6).
 * Foto del momento: no depende del filtro de período.
 *
 * No reutiliza app-horizontal-bar-chart: esa leyenda formatea los valores como horas.
 */
@Component({
  selector: 'app-receivables-aging-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, EmptyStateComponent],
  template: `
    <div class="flex items-center gap-2 mb-3 shrink-0">
      <app-icon name="hand-coins" [size]="16" class="text-text-secondary" />
      <h2 class="item-title m-0">Cartera por cobrar</h2>
    </div>

    @if (loading() || !summary()) {
      <div class="flex flex-col gap-3">
        <app-skeleton-block variant="text" width="50%" height="28px" />
        <app-skeleton-block variant="rect" width="100%" height="12px" />
        <app-skeleton-block variant="text" width="100%" height="60px" />
      </div>
    } @else if (summary()!.total === 0) {
      <div class="flex-1 flex items-center justify-center">
        <app-empty-state
          icon="circle-check"
          message="Sin saldos pendientes"
          subtitle="Ningún alumno Clase B debe dinero en esta sede."
        />
      </div>
    } @else {
      <div class="flex items-baseline justify-between gap-3 mb-3">
        <span class="text-2xl font-bold text-text-primary tabular-nums">{{ totalLabel() }}</span>
        <span class="text-xs text-text-muted">
          {{ summary()!.alumnos }} {{ summary()!.alumnos === 1 ? 'alumno' : 'alumnos' }} con saldo
        </span>
      </div>

      <div class="stack" role="img" [attr.aria-label]="ariaSummary()">
        @for (b of buckets(); track b.bucket) {
          @if (b.pct > 0) {
            <span class="stack-seg" [style.width.%]="b.pct" [style.background]="b.color"></span>
          }
        }
      </div>
      <p class="micro-label m-0 mt-3 mb-1">Antigüedad de la matrícula</p>

      <ul class="m-0 p-0 list-none flex flex-col gap-1.5">
        @for (b of buckets(); track b.bucket) {
          <li class="flex items-center justify-between gap-2 text-xs">
            <span class="flex items-center gap-2 min-w-0 text-text-secondary">
              <span class="legend-dot" [style.background]="b.color"></span>
              <span class="truncate">{{ b.label }}</span>
            </span>
            <span class="text-text-primary tabular-nums shrink-0">
              {{ b.montoLabel }}
              <span class="text-text-muted">· {{ b.alumnos }}</span>
            </span>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        height: 100%;
      }
      .stack {
        display: flex;
        height: 10px;
        border-radius: 9999px;
        overflow: hidden;
        background: var(--bg-elevated);
        gap: 2px;
      }
      .stack-seg {
        height: 100%;
      }
      .legend-dot {
        width: 8px;
        height: 8px;
        border-radius: 9999px;
        flex-shrink: 0;
      }
    `,
  ],
})
export class ReceivablesAgingPanelComponent {
  readonly summary = input<ReceivablesSummary | null>(null);
  readonly loading = input<boolean>(false);

  protected readonly totalLabel = computed(() => formatCLP(this.summary()?.total ?? 0));

  protected readonly buckets = computed<BucketView[]>(() => {
    const s = this.summary();
    if (!s) return [];
    return s.buckets.map((b) => ({
      ...b,
      color: BUCKET_COLORS[b.bucket],
      pct: s.total > 0 ? (b.monto / s.total) * 100 : 0,
      montoLabel: formatCLP(b.monto),
    }));
  });

  protected readonly ariaSummary = computed(
    () =>
      `Cartera por cobrar: ${this.buckets()
        .map((b) => `${b.label} ${b.montoLabel}`)
        .join(', ')}`,
  );
}
