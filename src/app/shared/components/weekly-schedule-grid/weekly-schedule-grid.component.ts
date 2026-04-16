import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { getStatusVisual, getStatusLabel, getDotStyle } from '@core/utils/schedule-status.utils';
import type { ScheduleBlock, WeekSchedule } from '@core/models/ui/instructor-portal.model';

@Component({
  selector: 'app-weekly-schedule-grid',
  standalone: true,
  imports: [DecimalPipe, IconComponent, SkeletonBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .schedule-grid {
        display: grid;
        grid-template-columns: 72px repeat(var(--days, 5), 1fr);
      }

      .hour-cell {
        height: 80px; /* 1 hora = 80px */
        overflow: visible; /* allow the absolutely-positioned time label (-top-6px) to escape */
      }

      .grid-content {
        display: grid;
        grid-template-columns: repeat(var(--days, 5), 1fr);
        grid-template-rows: repeat(48, 20px); /* 12h × 4 cuartos = 48 filas */
      }

      .overflow-x-auto::-webkit-scrollbar {
        height: 6px;
      }
      .overflow-x-auto::-webkit-scrollbar-track {
        background: transparent;
      }
      .overflow-x-auto::-webkit-scrollbar-thumb {
        background: var(--border-subtle);
        border-radius: 10px;
      }
      .overflow-x-auto::-webkit-scrollbar-thumb:hover {
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
        <div
          class="flex items-center p-1 rounded-xl"
          style="background: var(--bg-elevated); border: 1px solid var(--border-subtle)"
        >
          <button
            class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style="color: var(--text-secondary)"
            (click)="prevWeek.emit()"
            title="Semana anterior"
            data-llm-action="prev-week"
          >
            <app-icon name="chevron-left" [size]="18" />
          </button>
          <button
            class="px-4 h-8 text-sm font-bold rounded-lg transition-colors mx-1"
            style="color: var(--text-primary)"
            (click)="today.emit()"
            data-llm-action="go-today"
          >
            Hoy
          </button>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style="color: var(--text-secondary)"
            (click)="nextWeek.emit()"
            title="Siguiente semana"
            data-llm-action="next-week"
          >
            <app-icon name="chevron-right" [size]="18" />
          </button>
        </div>
      </div>

      <!-- Cuerpo con scroll horizontal -->
      <div class="overflow-x-auto flex-1" style="background: var(--bg-surface)">
        <div
          class="min-w-[900px] schedule-container"
          [style.--days]="schedule()?.days?.length || 5"
        >
          <!-- Header días — sticky -->
          <div
            class="schedule-grid sticky top-0 z-40 pt-5 pb-6"
            style="background: var(--bg-surface); border-bottom: 1px solid var(--border-subtle)"
          >
            <!-- Esquina vacía (alineada con la columna de horas) -->
            <div></div>

            <!-- Columnas de días -->
            @if (isLoading()) {
              @for (i of [1, 2, 3, 4, 5]; track i) {
                <div class="flex flex-col items-center justify-center px-1">
                  <div class="w-full max-w-[80px] py-3 flex flex-col items-center gap-2">
                    <app-skeleton-block variant="text" width="28px" height="10px" />
                    <app-skeleton-block variant="rect" width="44px" height="44px" />
                  </div>
                </div>
              }
            } @else {
              @for (day of schedule()?.days; track day.date) {
                <div class="flex flex-col items-center justify-center px-1">
                  <button
                    class="w-full max-w-[80px] py-3 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 relative group"
                    [style.background]="getDayHeaderBg(day)"
                    (click)="daySelect.emit(day.date)"
                  >
                    <!-- Nombre del día -->
                    <span
                      class="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                      [style.color]="getDayHeaderTextColor(day, 'label')"
                    >
                      {{ day.name }}
                    </span>
                    <!-- Número del día -->
                    <span
                      class="text-3xl font-black leading-none tracking-tighter"
                      [style.color]="getDayHeaderTextColor(day, 'number')"
                    >
                      {{ day.dayNumber }}
                    </span>
                    
                    <!-- Indicador "hoy" sutil -->
                    @if (day.isToday && day.date !== selectedDate()) {
                      <div
                        class="absolute -bottom-1 w-1 h-1 rounded-full"
                        style="background: var(--color-primary)"
                      ></div>
                    }
                  </button>
                </div>
              }
            }
          </div>

          <!-- Cuerpo del grid -->
          <div class="relative schedule-grid schedule-body">
            <!-- Columna de etiquetas horarias -->
            <div class="flex flex-col z-20 pointer-events-none">
              @for (hour of hours; track hour; let isFirst = $first) {
                <div class="hour-cell relative">
                  <span
                    class="text-[10px] font-bold tracking-widest absolute right-4 whitespace-nowrap"
                    [style.top]="isFirst ? '2px' : '-6px'"
                    [style.color]="'var(--text-muted)'"
                  >
                    {{ hour | number: '2.0' }}:00
                  </span>
                </div>
              }
            </div>

            <!-- Celdas del grid con bloques de clase -->
            <div
              class="grid-content relative"
              [style.grid-column]="'span ' + (schedule()?.days?.length || 5)"
            >
              <!-- Today Column Tint -->
              @for (day of schedule()?.days; track day.date; let i = $index) {
                @if (day.isToday) {
                  <div
                    class="absolute top-0 bottom-0 pointer-events-none z-0 rounded-lg"
                    [style.grid-column]="i + 1"
                    style="background: rgba(14, 165, 233, 0.04)"
                  ></div>
                }
              }

              <!-- Líneas horizontales de horas -->
              <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
                @for (hour of hours; track hour; let i = $index) {
                  <div
                    class="absolute w-full"
                    style="border-top: 1px solid var(--border-subtle); opacity: 0.5"
                    [style.top.px]="i * 80"
                  ></div>
                }
              </div>

              <!-- Skeleton: bloques fantasma representativos -->
              @if (isLoading()) {
                @for (ghost of skeletonBlocks; track ghost.col) {
                  <div
                    class="rounded-2xl m-1 p-3 flex flex-col gap-2 pointer-events-none"
                    style="background: var(--bg-elevated); border: 1px solid var(--border-subtle)"
                    [style.grid-column]="ghost.col"
                    [style.grid-row-start]="ghost.rowStart"
                    [style.grid-row-end]="ghost.rowEnd"
                  >
                    <app-skeleton-block variant="text" width="36px" height="8px" />
                    <app-skeleton-block variant="text" width="70%" height="12px" />
                  </div>
                }
              } @else {
                @for (block of schedule()?.blocks; track block.sessionId) {
                  <div
                    [class]="getBlockClass(block)"
                    [style]="getBlockStyle(block)"
                    [style.grid-column]="block.dayOfWeek + 1"
                    [style.grid-row-start]="getRowStart(block)"
                    [style.grid-row-end]="getRowEnd(block)"
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
                    <div
                      class="flex flex-col gap-0.5 h-full min-h-0 overflow-hidden"
                      [class.flex-row]="block.durationMin <= 30"
                      [class.items-center]="block.durationMin <= 30"
                      [class.gap-2]="block.durationMin <= 30"
                    >
                      @if (block.durationMin > 30) {
                        <!-- Layout normal: hora + nombre + footer -->
                        <div class="flex items-center justify-between shrink-0 mb-1">
                          <span
                            class="text-[9px] font-black tracking-widest uppercase"
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
                              class="flex h-1.5 w-1.5 rounded-full indicator-live"
                              style="background: var(--color-primary-text)"
                            ></span>
                          } @else if (getStatusVisual(block.status).icon; as iconName) {
                             <app-icon [name]="iconName" [size]="10" [style.color]="'var(--text-muted)'" />
                          }
                        </div>
                        <div
                          class="text-xs font-bold leading-tight tracking-tight line-clamp-2"
                          [style.color]="
                            block.status === 'in_progress'
                              ? 'var(--color-primary-text)'
                              : 'var(--text-primary)'
                          "
                        >
                          {{ block.studentName }}
                        </div>
                        <div
                          class="mt-auto flex items-center justify-between shrink-0 pt-1"
                          style="opacity: 0.8"
                        >
                          <span
                            class="text-[9px] font-bold uppercase tracking-wider truncate"
                            [style.color]="
                              block.status === 'in_progress'
                                ? 'var(--color-primary-text)'
                                : 'var(--text-muted)'
                            "
                          >
                            #{{ block.classNumber }}
                          </span>
                          <span
                            class="text-[9px] font-black shrink-0 ml-2"
                            [style.color]="
                              block.status === 'in_progress'
                                ? 'var(--color-primary-text)'
                                : 'var(--text-muted)'
                            "
                          >
                            {{ block.durationMin }}'
                          </span>
                        </div>
                      } @else {
                        <!-- Layout ultra-compacto para bloques ≤ 30min -->
                        <span
                          class="text-[9px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-md"
                          style="background: rgba(255,255,255,0.2)"
                          [style.color]="
                            block.status === 'in_progress'
                              ? 'var(--color-primary-text)'
                              : 'var(--text-primary)'
                          "
                        >
                          {{ block.startTime }}
                        </span>
                        <div
                          class="text-[11px] font-bold truncate flex-1"
                          [style.color]="
                            block.status === 'in_progress'
                              ? 'var(--color-primary-text)'
                              : 'var(--text-primary)'
                          "
                        >
                          {{ block.studentName }}
                        </div>
                      }
                    </div>
                  </div>
                }
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Leyenda -->
      <div
        class="px-6 py-4 flex flex-wrap gap-6 items-center"
        style="border-top: 1px solid var(--border-subtle); background: var(--bg-surface)"
      >
        <span
          class="text-[10px] font-bold uppercase tracking-widest mr-1"
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
  daySelect = output<string>();
  blockClick = output<ScheduleBlock>();

  readonly hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  /** Bloques fantasma para skeleton */
  readonly skeletonBlocks = [
    { col: 1, rowStart: 5, rowEnd: 11 },
    { col: 1, rowStart: 25, rowEnd: 29 },
    { col: 2, rowStart: 11, rowEnd: 17 },
    { col: 3, rowStart: 1, rowEnd: 5 },
    { col: 3, rowStart: 21, rowEnd: 27 },
    { col: 4, rowStart: 13, rowEnd: 17 },
    { col: 4, rowStart: 33, rowEnd: 39 },
    { col: 5, rowStart: 7, rowEnd: 13 },
    { col: 5, rowStart: 29, rowEnd: 33 },
  ];

  readonly legendItems = (['scheduled', 'in_progress', 'completed', 'cancelled'] as const).map(s => ({
    label: getStatusLabel(s),
    dotStyle: `background: ${getDotStyle(s)['background']}; border: ${getDotStyle(s)['border']};`,
    emphasis: s === 'in_progress',
  }));

  getRowStart(block: ScheduleBlock): number {
    const hourOffset = block.hour - 8;
    const minuteOffset = Math.floor(block.minuteStart / 15);
    return hourOffset * 4 + minuteOffset + 1;
  }

  getRowEnd(block: ScheduleBlock): number {
    return this.getRowStart(block) + Math.ceil(block.durationMin / 15);
  }

  getDayHeaderBg(day: any): string {
    if (day.isToday) return 'var(--color-primary)';
    if (day.date === this.selectedDate()) return 'var(--color-primary-muted)';
    return 'transparent';
  }

  getDayHeaderTextColor(day: any, type: 'label' | 'number'): string {
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

  getBlockClass(block: ScheduleBlock): string {
    const visual = getStatusVisual(block.status);
    const isShort = block.durationMin <= 45;
    const pad = isShort ? 'p-2 px-3' : 'p-3';
    const cursor = visual.interactive ? 'cursor-pointer' : 'cursor-default';
    const base = `rounded-2xl transition-all duration-200 relative m-1 flex flex-col overflow-hidden ${pad} ${cursor}`;
    
    return block.status === 'in_progress' ? `${base} scale-[1.02] shadow-lg` : base;
  }

  // Wrapper for template
  getStatusVisual(status: any) {
    return getStatusVisual(status);
  }
}
