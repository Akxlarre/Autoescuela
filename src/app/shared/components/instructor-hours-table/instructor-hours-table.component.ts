import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { InstructorHoursRow } from '@core/models/ui/executive-dashboard.model';
import { formatMinutesAsHours } from '@core/utils/executive-dashboard.utils';
import { IconComponent } from '../icon/icon.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

/**
 * Horas de instrucción por instructor (spec 0044-b, AC16). Dumb: las filas llegan ya
 * ordenadas por el Facade (más horas primero, los de 0 al final).
 */
@Component({
  selector: 'app-instructor-hours-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, EmptyStateComponent],
  template: `
    <div class="flex items-center justify-between gap-2 mb-3 shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <app-icon name="clock" [size]="16" class="text-text-secondary" />
        <h2 class="item-title m-0">Horas de instrucción</h2>
      </div>
      @if (!loading() && rows().length) {
        <span class="text-xs text-text-muted shrink-0">{{ totalLabel() }}</span>
      }
    </div>

    @if (loading()) {
      <div class="flex flex-col gap-3">
        @for (i of [1, 2, 3, 4]; track i) {
          <app-skeleton-block variant="text" width="100%" height="28px" />
        }
      </div>
    } @else if (rows().length === 0) {
      <div class="flex-1 flex items-center justify-center">
        <app-empty-state
          icon="users"
          message="Sin instructores activos"
          subtitle="No hay instructores ni clases en esta sede."
        />
      </div>
    } @else {
      <ul class="m-0 p-0 list-none flex flex-col gap-3 overflow-y-auto min-h-0 flex-1 pr-1">
        @for (r of rows(); track r.instructorId) {
          <li class="flex flex-col gap-1">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-sm text-text-primary truncate">{{ r.nombre }}</span>
              <span class="text-xs text-text-secondary shrink-0">
                {{ r.clases }} {{ r.clases === 1 ? 'clase' : 'clases' }} · {{ r.horasLabel }}
              </span>
            </div>
            <div class="bar-track" aria-hidden="true">
              <div class="bar-fill" [style.width.%]="barPct(r.minutos)"></div>
            </div>
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
      .bar-track {
        height: 6px;
        border-radius: 9999px;
        background: var(--bg-elevated);
        overflow: hidden;
      }
      .bar-fill {
        height: 100%;
        border-radius: 9999px;
        background: var(--color-primary);
      }
    `,
  ],
})
export class InstructorHoursTableComponent {
  readonly rows = input<InstructorHoursRow[]>([]);
  readonly loading = input<boolean>(false);

  private readonly maxMinutes = computed(() => Math.max(0, ...this.rows().map((r) => r.minutos)));

  protected readonly totalLabel = computed(() => {
    const clases = this.rows().reduce((s, r) => s + r.clases, 0);
    const minutos = this.rows().reduce((s, r) => s + r.minutos, 0);
    return `${clases} clases · ${formatMinutesAsHours(minutos)}`;
  });

  protected barPct(minutos: number): number {
    const max = this.maxMinutes();
    return max > 0 ? (minutos / max) * 100 : 0;
  }
}
