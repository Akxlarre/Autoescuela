import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { TodayOpsSummary } from '@core/models/ui/executive-dashboard.model';
import { IconComponent } from '../icon/icon.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';

interface OpsItem {
  id: string;
  label: string;
  icon: string;
  value: number;
}

/**
 * Operación de hoy, en formato compacto (spec 0044-b, AC19). Independiente del filtro de
 * período: siempre muestra el día actual.
 */
@Component({
  selector: 'app-today-ops-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent],
  template: `
    <div class="flex items-center gap-2 mb-3 shrink-0">
      <app-icon name="calendar-clock" [size]="16" class="text-text-secondary" />
      <h2 class="item-title m-0">Operación de hoy</h2>
    </div>

    @if (loading() || !ops()) {
      <div class="grid grid-cols-2 gap-3">
        @for (i of [1, 2, 3, 4, 5, 6]; track i) {
          <app-skeleton-block variant="text" width="100%" height="36px" />
        }
      </div>
    } @else {
      <ul class="m-0 p-0 list-none grid grid-cols-2 gap-x-4 gap-y-3">
        @for (item of items(); track item.id) {
          <li class="flex items-center gap-2 min-w-0">
            <app-icon [name]="item.icon" [size]="14" class="text-text-muted shrink-0" />
            <div class="min-w-0">
              <p class="m-0 text-lg font-semibold text-text-primary leading-tight tabular-nums">
                {{ item.value }}
              </p>
              <p class="m-0 text-2xs text-text-muted truncate">{{ item.label }}</p>
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
      }
    `,
  ],
})
export class TodayOpsStripComponent {
  readonly ops = input<TodayOpsSummary | null>(null);
  readonly loading = input<boolean>(false);

  protected readonly items = computed<OpsItem[]>(() => {
    const o = this.ops();
    if (!o) return [];
    return [
      { id: 'prog', label: 'Clases programadas', icon: 'calendar', value: o.clasesProgramadas },
      { id: 'real', label: 'Clases realizadas', icon: 'circle-check', value: o.clasesRealizadas },
      {
        id: 'canc',
        label: 'Canceladas / inasistencias',
        icon: 'circle-x',
        value: o.clasesCanceladas,
      },
      { id: 'inst', label: 'Instructores activos', icon: 'users', value: o.instructoresActivos },
      { id: 'flota', label: 'Vehículos disponibles', icon: 'car', value: o.vehiculosDisponibles },
      { id: 'mant', label: 'En mantención', icon: 'wrench', value: o.vehiculosMantencion },
    ];
  });
}
