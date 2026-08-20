import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { getStatusVisual, getStatusLabel } from '@core/utils/schedule-status.utils';
import { filterVisibleWeekDays } from '@core/utils/schedule-week-days.utils';
import type {
  ScheduleBlock,
  ScheduleDay,
  WeekSchedule,
} from '@core/models/ui/instructor-portal.model';

@Component({
  selector: 'app-weekly-schedule-grid',
  standalone: true,
  imports: [IconComponent, SkeletonBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .overflow-y-auto::-webkit-scrollbar {
        width: 6px;
      }
      .overflow-y-auto::-webkit-scrollbar-track {
        background: transparent;
      }
      .overflow-y-auto::-webkit-scrollbar-thumb {
        background: var(--border-subtle);
        border-radius: 10px;
      }
      .overflow-y-auto::-webkit-scrollbar-thumb:hover {
        background: var(--text-muted);
      }
    `,
  ],
  template: `
    <div class="card overflow-x-clip flex flex-col h-full" style="border-radius: var(--radius-xl)">
      <!-- Toolbar -->
      <div
        class="px-6 py-5 flex items-center justify-between"
        style="border-bottom: 1px solid var(--border-subtle)"
      >
        <div class="flex flex-col gap-1">
          <h3 class="font-bold text-lg tracking-tight" [style.color]="'var(--text-primary)'">
            @if (isLoading()) {
              <app-skeleton-block variant="text" width="180px" height="22px" />
            } @else {
              {{ schedule()?.weekLabel || 'Horario Semanal' }}
            }
          </h3>
          <p class="text-xs font-medium" [style.color]="'var(--text-muted)'">
            Selecciona un día para ver el detalle en mobile o visualizarlo aquí
          </p>
        </div>

        <!-- Navegación de semana -->
        <div class="flex items-center p-1 rounded-xl bg-elevated border border-border-subtle">
          <button
            aria-label="Semana anterior"
            class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-text-secondary cursor-pointer hover:bg-subtle"
            (click)="prevWeek.emit()"
            title="Semana anterior"
            data-llm-action="prev-week"
          >
            <app-icon name="chevron-left" [size]="18" />
          </button>
          <button
            class="item-title px-4 h-8 rounded-lg transition-colors mx-1 cursor-pointer hover:bg-subtle"
            (click)="today.emit()"
            data-llm-action="go-today"
          >
            Hoy
          </button>
          <button
            aria-label="Siguiente semana"
            class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-text-secondary cursor-pointer hover:bg-subtle"
            (click)="nextWeek.emit()"
            title="Siguiente semana"
            data-llm-action="next-week"
          >
            <app-icon name="chevron-right" [size]="18" />
          </button>
        </div>
      </div>

      <!-- Cuerpo: columnas por día (sin franja horaria), Lun-Sáb -->
      <div class="overflow-y-auto flex-1 bg-surface">
        <!-- Header días — sticky -->
        <div
          class="flex gap-3 sticky top-0 z-10 px-4 pt-5 pb-4 bg-surface"
          style="border-bottom: 1px solid var(--border-subtle)"
        >
          @if (isLoading()) {
            @for (i of skeletonDayIndexes; track i) {
              <div class="flex-1 min-w-0 flex flex-col items-center gap-2 py-3">
                <app-skeleton-block variant="text" width="28px" height="10px" />
                <app-skeleton-block variant="rect" width="36px" height="36px" />
              </div>
            }
          } @else {
            @for (day of visibleWeekDays(); track day.date) {
              <div
                class="flex-1 min-w-0 py-3 rounded-2xl flex flex-col items-center justify-center relative"
                [style.background]="getDayHeaderBg(day)"
              >
                <span
                  class="text-2xs font-bold uppercase tracking-widest mb-1.5"
                  [style.color]="getDayHeaderTextColor(day, 'label')"
                >
                  {{ day.name.slice(0, 3) }}
                </span>
                <span
                  class="text-2xl font-black leading-none tracking-tighter"
                  [style.color]="getDayHeaderTextColor(day, 'number')"
                >
                  {{ day.dayNumber }}
                </span>

                <!-- Indicador "hoy" sutil -->
                @if (day.isToday && day.date !== selectedDate()) {
                  <div class="absolute -bottom-1 w-1 h-1 rounded-full bg-brand"></div>
                }
              </div>
            }
          }
        </div>

        <!-- Columnas de día: cada una lista solo sus clases reales, sin filas de hora vacías -->
        <div class="flex gap-3 items-start px-4 py-4">
          @if (isLoading()) {
            @for (count of skeletonColumnCounts; track $index) {
              <div class="flex-1 min-w-0 flex flex-col gap-2">
                @for (n of times(count); track n) {
                  <div
                    class="rounded-2xl p-3 flex flex-col gap-2 bg-elevated border border-border-subtle"
                  >
                    <app-skeleton-block variant="text" width="36px" height="8px" />
                    <app-skeleton-block variant="text" width="70%" height="12px" />
                  </div>
                }
              </div>
            }
          } @else {
            @for (day of visibleWeekDays(); track day.date; let i = $index) {
              <div
                class="flex-1 min-w-0 flex flex-col gap-2 rounded-xl p-1"
                [class.bg-brand-tint]="day.isToday"
              >
                @for (block of getBlocksForDay(i); track block.sessionId) {
                  <div
                    [class]="getCardClass(block)"
                    [style]="getBlockStyle(block)"
                    [attr.data-llm-action]="
                      block.status === 'scheduled' || block.status === 'in_progress'
                        ? 'open-class-' + block.sessionId
                        : null
                    "
                    (click)="
                      block.status !== 'cancelled' &&
                        block.status !== 'no_show' &&
                        blockClick.emit(block)
                    "
                  >
                    <div class="flex items-center justify-between mb-1.5">
                      <span
                        class="text-sm font-black uppercase tracking-wide"
                        [style.color]="
                          block.status === 'in_progress'
                            ? 'var(--color-primary-text)'
                            : 'var(--color-primary)'
                        "
                      >
                        {{ block.startTime }}
                      </span>
                      @if (block.status === 'in_progress') {
                        <span
                          class="flex h-1.5 w-1.5 rounded-full indicator-live bg-text-primary"
                        ></span>
                      } @else if (getStatusVisual(block.status).icon; as iconName) {
                        <app-icon
                          [name]="iconName"
                          [size]="11"
                          [style.color]="getStatusVisual(block.status).textColor"
                        />
                      }
                    </div>

                    <!-- N° de matrícula: dato principal de la card -->
                    <div
                      class="text-lg font-black leading-none mb-1"
                      [style.color]="getStatusVisual(block.status).textColor"
                    >
                      {{ block.enrollmentNumber ? '#' + block.enrollmentNumber : '—' }}
                    </div>

                    <!-- Alumno: dato secundario -->
                    <div
                      class="text-2xs font-semibold truncate mb-1.5 opacity-80"
                      [style.color]="getStatusVisual(block.status).textColor"
                    >
                      {{ block.studentName }}
                    </div>

                    <div
                      class="flex items-center justify-between text-2xs font-bold opacity-70"
                      [style.color]="getStatusVisual(block.status).textColor"
                    >
                      <span class="truncate">
                        Clase {{ block.classNumber ?? '—' }} · {{ block.vehiclePlate || 'S/V' }}
                      </span>
                      <span class="shrink-0 ml-1">{{ block.durationMin }}'</span>
                    </div>
                  </div>
                } @empty {
                  <div class="flex items-center justify-center py-6">
                    <span class="text-2xs font-medium" [style.color]="'var(--text-muted)'">
                      Sin clases
                    </span>
                  </div>
                }
              </div>
            }
          }
        </div>
      </div>

      <!-- Leyenda -->
      <div
        class="px-6 py-4 flex flex-wrap gap-6 items-center bg-surface"
        style="border-top: 1px solid var(--border-subtle)"
      >
        <span
          class="text-2xs font-bold uppercase tracking-widest mr-1"
          [style.color]="'var(--text-muted)'"
        >
          Leyenda
        </span>
        @for (item of legendItems; track item.label) {
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" [attr.style]="item.dotStyle"></span>
            <span
              class="text-xs font-medium"
              [style.color]="item.emphasis ? 'var(--text-primary)' : 'var(--text-secondary)'"
            >
              {{ item.label }}
            </span>
          </div>
        }
      </div>
    </div>
  `,
})
export class WeeklyScheduleGridComponent {
  schedule = input<WeekSchedule | null>(null);
  isLoading = input(false);
  selectedDate = input<string | null>(null);

  prevWeek = output<void>();
  nextWeek = output<void>();
  today = output<void>();
  blockClick = output<ScheduleBlock>();

  /** Lun-Sáb — el domingo nunca tiene clases (regla de negocio, ver core/utils). */
  readonly visibleWeekDays = computed(() => filterVisibleWeekDays(this.schedule()?.days));

  readonly skeletonDayIndexes = [0, 1, 2, 3, 4, 5];
  /** Cantidad de cards fantasma por columna durante el loading — solo variedad visual. */
  readonly skeletonColumnCounts = [2, 1, 2, 3, 1, 2];

  readonly legendItems = (
    ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'] as const
  ).map((s) => {
    const borderColor = getStatusVisual(s).borderColor;
    return {
      label: getStatusLabel(s),
      dotStyle: `background: ${borderColor}; border: 2px solid ${borderColor};`,
      emphasis: s === 'in_progress',
    };
  });

  times(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  /**
   * Bloques del día `dayIndex` (0=Lun...5=Sáb), ordenados por hora. `dayIndex` corresponde a la
   * posición dentro de `visibleWeekDays()`, que preserva el orden Lun-Sáb del backend tras
   * excluir Domingo — coincide 1:1 con `ScheduleBlock.dayOfWeek`.
   */
  getBlocksForDay(dayIndex: number): ScheduleBlock[] {
    return (this.schedule()?.blocks ?? [])
      .filter((b) => b.dayOfWeek === dayIndex)
      .sort((a, b) => a.hour * 60 + a.minuteStart - (b.hour * 60 + b.minuteStart));
  }

  getDayHeaderBg(day: ScheduleDay): string {
    if (day.isToday) return 'var(--color-primary)';
    if (day.date === this.selectedDate()) return 'var(--color-primary-muted)';
    return 'transparent';
  }

  getDayHeaderTextColor(day: ScheduleDay, type: 'label' | 'number'): string {
    if (day.isToday) return 'var(--color-primary-text)';
    if (day.date === this.selectedDate()) return 'var(--color-primary)';
    return type === 'label' ? 'var(--text-muted)' : 'var(--text-primary)';
  }

  getBlockStyle(block: ScheduleBlock): string {
    const visual = getStatusVisual(block.status);
    let style = `border-left: 3px solid ${visual.borderColor}; opacity: ${visual.opacity};`;

    if (block.status === 'in_progress') {
      style += ` background: var(--color-primary); box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 30%, transparent); z-index: 20;`;
    } else {
      style += ` background: var(--bg-surface); border: 1px solid var(--border-subtle); border-left-width: 3px;`;
    }

    return style;
  }

  getCardClass(block: ScheduleBlock): string {
    const visual = getStatusVisual(block.status);
    const cursor = visual.interactive ? 'cursor-pointer' : 'cursor-default';
    const base = `rounded-2xl p-3 transition-all duration-200 relative overflow-hidden ${cursor}`;

    return block.status === 'in_progress' ? `${base} scale-[1.02] shadow-lg` : base;
  }

  // Wrapper for template
  getStatusVisual(status: ScheduleBlock['status']) {
    return getStatusVisual(status);
  }
}
