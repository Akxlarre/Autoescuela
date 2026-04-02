import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import type { ScheduleBlock, WeekSchedule } from '@core/models/ui/instructor-portal.model';

@Component({
  selector: 'app-weekly-schedule-grid',
  standalone: true,
  imports: [CommonModule, IconComponent, SkeletonBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bg-surface rounded-[2rem] overflow-hidden relative shadow-[0_4px_24px_rgba(0,0,0,0.02)] ring-1 ring-border-subtle/50 flex flex-col h-full bg-clip-border"
    >
      <!-- Toolbar Premium -->
      <div class="px-8 py-6 flex items-center justify-between bg-surface z-30">
        <div class="flex flex-col">
          <h3 class="font-extrabold text-text-primary text-xl tracking-tight">
            @if (isLoading()) {
              <app-skeleton-block variant="text" width="180px" height="28px" />
            } @else {
              {{ schedule()?.weekLabel || 'Horario Semanal' }}
            }
          </h3>
          <p class="text-xs font-medium text-text-muted mt-1">
            Visualización de clases programadas
          </p>
        </div>

        <div class="flex items-center">
          <div class="flex p-1 bg-surface-hover/50 border border-divider/50 rounded-xl shadow-sm">
            <button
              class="w-8 h-8 flex items-center justify-center hover:bg-surface rounded-lg transition-all text-text-secondary hover:text-text-primary hover:shadow-sm"
              (click)="prevWeek.emit()"
              title="Semana anterior"
            >
              <app-icon name="chevron-left" [size]="18" />
            </button>
            <button
              class="px-4 h-8 text-sm font-bold hover:bg-surface rounded-lg transition-all text-text-primary mx-1 hover:shadow-sm"
              (click)="today.emit()"
            >
              Hoy
            </button>
            <button
              class="w-8 h-8 flex items-center justify-center hover:bg-surface rounded-lg transition-all text-text-secondary hover:text-text-primary hover:shadow-sm"
              (click)="nextWeek.emit()"
              title="Siguiente semana"
            >
              <app-icon name="chevron-right" [size]="18" />
            </button>
          </div>
        </div>
      </div>
      <div class="overflow-x-auto flex-1 bg-surface relative">
        <div
          class="min-w-[900px] schedule-container"
          [style.--days]="schedule()?.days?.length || 5"
        >
          <!-- Grid Header Premium -->
          <div class="schedule-grid sticky top-0 z-40 bg-surface/80 backdrop-blur-md pt-6 pb-8">
            <!-- Time Corner -->
            <div></div>

            <!-- Day Columns: skeleton vs real -->
            @if (isLoading()) {
              @for (i of [1, 2, 3, 4, 5]; track i) {
                <div class="flex flex-col items-center justify-center px-1">
                  <div
                    class="w-full max-w-[85px] py-4 rounded-3xl flex flex-col items-center justify-center gap-2.5 opacity-50"
                  >
                    <app-skeleton-block variant="text" width="32px" height="10px" />
                    <app-skeleton-block
                      variant="rect"
                      width="44px"
                      height="44px"
                      class="rounded-2xl"
                    />
                  </div>
                </div>
              }
            } @else {
              @for (day of schedule()?.days; track day.date) {
                <div class="flex flex-col items-center justify-center px-1">
                  <div
                    class="w-full max-w-[85px] py-4 rounded-3xl flex flex-col items-center justify-center transition-all duration-500 group relative"
                    [class.bg-brand]="day.isToday"
                    [class.text-brand-contrast]="day.isToday"
                    [class.shadow-2xl]="day.isToday"
                    [class.shadow-brand/25]="day.isToday"
                    [class.hover:bg-surface-hover]="!day.isToday"
                  >
                    <div
                      class="text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5 opacity-60"
                      [class.text-text-muted]="!day.isToday"
                      [class.text-brand-contrast/90]="day.isToday"
                    >
                      {{ day.name }}
                    </div>
                    <div
                      class="text-3xl font-black flex items-center justify-center leading-none tracking-tighter"
                      [class.text-text-primary]="!day.isToday"
                    >
                      {{ day.dayNumber }}
                    </div>

                    @if (day.isToday) {
                      <div
                        class="absolute -bottom-2 w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_10px_var(--color-brand)]"
                      ></div>
                    }
                  </div>
                </div>
              }
            }
          </div>

          <!-- Grid Body -->
          <div class="relative schedule-grid schedule-body">
            <!-- Time Labels Column -->
            <!-- Time Labels Column (Minimalist) -->
            <div class="flex flex-col z-20 pointer-events-none">
              @for (hour of hours; track hour) {
                <div class="hour-cell relative flex items-start justify-end pr-6">
                  <span
                    class="text-[10px] text-text-muted/60 font-bold tracking-widest absolute -top-[6px]"
                  >
                    {{ hour | number: '2.0' }}:00
                  </span>
                </div>
              }
            </div>

            <!-- Grid Cells -->
            <div
              class="grid-content relative"
              [style.grid-column]="'span ' + (schedule()?.days?.length || 5)"
            >
              <!-- Full Floating Grid: No horizontal lines as requested -->
              <div class="absolute inset-0 pointer-events-none"></div>

              <!-- Skeleton: ghost blocks posicionados en el CSS grid (grid-template-rows: repeat(48,20px)) -->
              <!-- Fórmula: row = (hour-8)*4 + minuteOffset + 1 | 60min=4rows, 90min=6rows -->
              @if (isLoading()) {
                <!-- Lunes: 9:00 90min -->
                <div
                  class="rounded-[1.5rem] bg-surface-hover/60 ring-1 ring-border-subtle/30 m-1 p-4 flex flex-col gap-2 pointer-events-none"
                  style="grid-column:1; grid-row-start:5; grid-row-end:11;"
                >
                  <app-skeleton-block variant="text" width="38px" height="8px" class="opacity-50" />
                  <app-skeleton-block
                    variant="text"
                    width="72%"
                    height="13px"
                    class="opacity-60 mt-1"
                  />
                </div>
                <!-- Lunes: 14:00 60min -->
                <div
                  class="rounded-[1.5rem] bg-surface-hover/60 ring-1 ring-border-subtle/30 m-1 p-3 flex flex-col gap-2 pointer-events-none"
                  style="grid-column:1; grid-row-start:25; grid-row-end:29;"
                >
                  <app-skeleton-block variant="text" width="38px" height="8px" class="opacity-50" />
                  <app-skeleton-block
                    variant="text"
                    width="60%"
                    height="13px"
                    class="opacity-55 mt-1"
                  />
                </div>
                <!-- Martes: 10:30 90min -->
                <div
                  class="rounded-[1.5rem] bg-surface-hover/60 ring-1 ring-border-subtle/30 m-1 p-4 flex flex-col gap-2 pointer-events-none"
                  style="grid-column:2; grid-row-start:11; grid-row-end:17;"
                >
                  <app-skeleton-block variant="text" width="38px" height="8px" class="opacity-50" />
                  <app-skeleton-block
                    variant="text"
                    width="80%"
                    height="13px"
                    class="opacity-60 mt-1"
                  />
                </div>
                <!-- Miércoles: 8:00 60min -->
                <div
                  class="rounded-[1.5rem] bg-surface-hover/60 ring-1 ring-border-subtle/30 m-1 p-3 flex flex-col gap-2 pointer-events-none"
                  style="grid-column:3; grid-row-start:1; grid-row-end:5;"
                >
                  <app-skeleton-block variant="text" width="38px" height="8px" class="opacity-50" />
                  <app-skeleton-block
                    variant="text"
                    width="65%"
                    height="13px"
                    class="opacity-55 mt-1"
                  />
                </div>
                <!-- Miércoles: 13:00 90min -->
                <div
                  class="rounded-[1.5rem] bg-surface-hover/60 ring-1 ring-border-subtle/30 m-1 p-4 flex flex-col gap-2 pointer-events-none"
                  style="grid-column:3; grid-row-start:21; grid-row-end:27;"
                >
                  <app-skeleton-block variant="text" width="38px" height="8px" class="opacity-50" />
                  <app-skeleton-block
                    variant="text"
                    width="75%"
                    height="13px"
                    class="opacity-60 mt-1"
                  />
                </div>
                <!-- Jueves: 11:00 60min -->
                <div
                  class="rounded-[1.5rem] bg-surface-hover/60 ring-1 ring-border-subtle/30 m-1 p-3 flex flex-col gap-2 pointer-events-none"
                  style="grid-column:4; grid-row-start:13; grid-row-end:17;"
                >
                  <app-skeleton-block variant="text" width="38px" height="8px" class="opacity-50" />
                  <app-skeleton-block
                    variant="text"
                    width="55%"
                    height="13px"
                    class="opacity-55 mt-1"
                  />
                </div>
                <!-- Jueves: 16:00 90min -->
                <div
                  class="rounded-[1.5rem] bg-surface-hover/60 ring-1 ring-border-subtle/30 m-1 p-4 flex flex-col gap-2 pointer-events-none"
                  style="grid-column:4; grid-row-start:33; grid-row-end:39;"
                >
                  <app-skeleton-block variant="text" width="38px" height="8px" class="opacity-50" />
                  <app-skeleton-block
                    variant="text"
                    width="70%"
                    height="13px"
                    class="opacity-60 mt-1"
                  />
                </div>
                <!-- Viernes: 9:30 90min -->
                <div
                  class="rounded-[1.5rem] bg-surface-hover/60 ring-1 ring-border-subtle/30 m-1 p-4 flex flex-col gap-2 pointer-events-none"
                  style="grid-column:5; grid-row-start:7; grid-row-end:13;"
                >
                  <app-skeleton-block variant="text" width="38px" height="8px" class="opacity-50" />
                  <app-skeleton-block
                    variant="text"
                    width="85%"
                    height="13px"
                    class="opacity-60 mt-1"
                  />
                </div>
                <!-- Viernes: 15:00 60min -->
                <div
                  class="rounded-[1.5rem] bg-surface-hover/60 ring-1 ring-border-subtle/30 m-1 p-3 flex flex-col gap-2 pointer-events-none"
                  style="grid-column:5; grid-row-start:29; grid-row-end:33;"
                >
                  <app-skeleton-block variant="text" width="38px" height="8px" class="opacity-50" />
                  <app-skeleton-block
                    variant="text"
                    width="60%"
                    height="13px"
                    class="opacity-55 mt-1"
                  />
                </div>
              } @else {
                @for (block of schedule()?.blocks; track block.sessionId) {
                  <div
                    [class]="getBlockCardClass(block)"
                    [style.grid-column]="block.dayOfWeek + 1"
                    [style.grid-row-start]="getRowStart(block)"
                    [style.grid-row-end]="getRowEnd(block)"
                    (click)="
                      block.status !== 'cancelled' &&
                        block.status !== 'no_show' &&
                        blockClick.emit(block)
                    "
                  >
                    <!-- Card content anatomy Optimized for variable heights -->
                    <div
                      class="flex flex-col gap-0.5 h-full min-h-0 overflow-hidden"
                      [class.flex-row]="block.durationMin <= 30"
                      [class.items-center]="block.durationMin <= 30"
                      [class.gap-2]="block.durationMin <= 30"
                    >
                      @if (block.durationMin > 30) {
                        <div
                          class="flex items-center justify-between pointer-events-none shrink-0 mb-1"
                        >
                          <span
                            class="text-[9px] font-black tracking-[0.1em] uppercase opacity-90"
                            [class]="
                              block.status === 'in_progress' ? 'text-brand-contrast' : 'text-brand'
                            "
                          >
                            {{ block.startTime }}
                          </span>
                          @if (block.status === 'in_progress') {
                            <span
                              class="flex h-1.5 w-1.5 rounded-full bg-brand-contrast shadow-[0_0_8px_#fff]"
                            ></span>
                          }
                        </div>

                        <div
                          class="text-xs font-black leading-tight tracking-tight line-clamp-2"
                          [class]="
                            block.status === 'in_progress'
                              ? 'text-brand-contrast'
                              : 'text-text-primary'
                          "
                        >
                          {{ block.studentName }}
                        </div>

                        <div
                          class="mt-auto flex items-center justify-between opacity-80 shrink-0 pt-1"
                        >
                          <div
                            class="text-[9px] font-bold uppercase tracking-wider truncate"
                            [class]="
                              block.status === 'in_progress'
                                ? 'text-brand-contrast'
                                : 'text-text-muted'
                            "
                          >
                            Linea #{{ block.classNumber }}
                          </div>
                          <div
                            class="text-[9px] font-black shrink-0 ml-2"
                            [class]="
                              block.status === 'in_progress'
                                ? 'text-brand-contrast'
                                : 'text-text-muted'
                            "
                          >
                            {{ block.durationMin }}'
                          </div>
                        </div>
                      } @else {
                        <!-- Ultra-compact layout for 30min blocks -->
                        <span
                          class="text-[9px] font-black tracking-[0.1em] uppercase px-1.5 py-0.5 rounded bg-brand/10 text-brand"
                          [class.bg-brand-contrast/20]="block.status === 'in_progress'"
                          [class.text-brand-contrast]="block.status === 'in_progress'"
                        >
                          {{ block.startTime }}
                        </span>
                        <div
                          class="text-[11px] font-bold truncate flex-1"
                          [class]="
                            block.status === 'in_progress'
                              ? 'text-brand-contrast'
                              : 'text-text-primary'
                          "
                        >
                          {{ block.studentName }}
                        </div>
                        <div
                          class="text-[9px] font-bold opacity-60 shrink-0"
                          [class]="
                            block.status === 'in_progress'
                              ? 'text-brand-contrast'
                              : 'text-text-muted'
                          "
                        >
                          {{ block.durationMin }}'
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

      <!-- Legend -->
      <div
        class="px-8 py-5 bg-surface flex flex-wrap gap-8 items-center z-30 relative border-t border-divider/30"
      >
        <span class="text-[10px] font-bold text-text-muted uppercase tracking-widest mr-2"
          >Leyenda</span
        >
        <div class="flex items-center gap-2">
          <span
            class="w-2.5 h-2.5 rounded-full bg-surface border-2 border-brand/50 shadow-sm"
          ></span>
          <span class="text-xs font-medium text-text-secondary">Programada</span>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="w-2.5 h-2.5 rounded-full bg-brand shadow-[0_0_8px_var(--color-brand)] shadow-brand/40"
          ></span>
          <span class="text-xs font-bold text-text-primary">En curso</span>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="w-2.5 h-2.5 rounded-full bg-surface-hover border border-border-subtle opacity-70"
          ></span>
          <span class="text-xs font-medium text-text-muted">Completada</span>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="w-2.5 h-2.5 rounded-full bg-transparent border border-dashed border-divider/50"
          ></span>
          <span class="text-xs font-medium text-text-muted">Cancelada</span>
        </div>
      </div>
    </div>

    <style>
      .schedule-grid {
        display: grid;
        grid-template-columns: 60px repeat(var(--days, 5), 1fr);
      }

      .hour-cell,
      .hour-row {
        height: 80px; /* 1 hour = 80px */
      }

      .grid-content {
        display: grid;
        grid-template-columns: repeat(var(--days, 5), 1fr);
        grid-template-rows: repeat(48, 20px); /* 12h * 4 quarters = 48 rows. Each quarter = 20px */
      }

      /* Webkit scrollbar for premium look */
      .overflow-x-auto::-webkit-scrollbar {
        height: 6px;
      }
      .overflow-x-auto::-webkit-scrollbar-track {
        background: transparent;
      }
      .overflow-x-auto::-webkit-scrollbar-thumb {
        background: var(--divider);
        border-radius: 10px;
      }
      .overflow-x-auto::-webkit-scrollbar-thumb:hover {
        background: var(--text-muted);
      }
    </style>
  `,
})
export class WeeklyScheduleGridComponent {
  schedule = input<WeekSchedule | null>(null);
  isLoading = input(false);

  // Outputs
  prevWeek = output<void>();
  nextWeek = output<void>();
  today = output<void>();
  blockClick = output<ScheduleBlock>();

  // Use 12 hours grid (8:00 to 20:00)
  readonly hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  /**
   * Calculates the starting row for a block (1-based index)
   * We have 4 rows per hour (15min each)
   */
  getRowStart(block: ScheduleBlock): number {
    const hourOffset = block.hour - 8;
    const minuteOffset = Math.floor(block.minuteStart / 15);
    return hourOffset * 4 + minuteOffset + 1;
  }

  /**
   * Calculates the ending row / span
   */
  getRowEnd(block: ScheduleBlock): number {
    const span = Math.ceil(block.durationMin / 15);
    return this.getRowStart(block) + span;
  }

  /**
   * Dynamic classes replacing static CSS rules
   */
  getBlockCardClass(block: ScheduleBlock): string {
    const isInteractive = block.status !== 'cancelled' && block.status !== 'no_show';
    const isShort = block.durationMin <= 45;

    // Base: very rounded, dynamic padding based on duration
    const base =
      'rounded-[1.5rem] transition-all duration-300 relative group z-10 m-1 flex flex-col overflow-hidden ' +
      (isShort ? 'p-2 px-3 ' : 'p-4 ') +
      (isInteractive ? 'cursor-pointer hover:scale-[1.03] ' : 'cursor-default ');

    switch (block.status) {
      case 'in_progress':
        return (
          base +
          'bg-brand text-brand-contrast shadow-[0_12px_40px_-12px_rgba(var(--color-brand-rgb),0.6)] shadow-brand/40 ring-1 ring-white/20'
        );
      case 'completed':
        return (
          base +
          'bg-surface-hover/30 text-text-secondary ring-1 ring-divider/10 opacity-40 hover:opacity-100 grayscale hover:grayscale-0 lg:p-2'
        );
      case 'cancelled':
      case 'no_show':
        return (
          base +
          'bg-transparent border-2 border-dashed border-divider/10 text-text-muted opacity-30'
        );
      default: // scheduled
        return (
          base +
          'bg-surface text-text-primary shadow-[0_4px_20px_rgba(0,0,0,0.03)] ring-1 ring-border-subtle/30 hover:shadow-[0_15px_30px_rgba(0,0,0,0.06)]'
        );
    }
  }
}
