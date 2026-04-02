import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  AfterViewInit,
  inject,
  ElementRef,
  viewChildren,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { DaySchedule, ScheduleBlock } from '@core/models/ui/instructor-portal.model';

@Component({
  selector: 'app-daily-schedule-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, DecimalPipe],
  template: `
    <div class="space-y-6">
      <!-- Day Header -->
      <div class="mb-8">
        <h2 class="text-4xl font-extrabold text-text-primary tracking-tight mb-6">
          {{ daySchedule()?.dayLabel }}
        </h2>

        <div class="flex gap-2">
          <!-- Botón de Calendario expandido y profesional -->
          <div
            class="flex-1 relative flex items-center bg-surface-hover rounded-2xl border border-divider shadow-sm hover:shadow-md transition-all overflow-hidden"
          >
            <input
              type="date"
              class="absolute inset-0 w-full h-full opacity-0 cursor-default z-10"
              title="Seleccionar Fecha"
              (change)="onDateSelected($event)"
            />
            <div
              class="w-full flex items-center justify-between px-4 py-3 pointer-events-none group"
            >
              <div class="flex flex-col">
                <span class="text-xs uppercase font-bold tracking-widest text-text-muted mb-0.5"
                  >Fecha Seleccionada</span
                >
                <span
                  class="text-base font-bold text-text-primary group-hover:text-brand transition-colors"
                  >{{ daySchedule()?.dateLabel }}</span
                >
              </div>
              <div
                class="w-8 h-8 rounded-full bg-surface border border-divider flex items-center justify-center text-text-secondary shadow-sm"
              >
                <app-icon name="calendar" [size]="16" />
              </div>
            </div>
          </div>

          <!-- Controles Rápidos Prev / Next -->
          <div class="flex flex-col gap-1 w-12 shrink-0">
            <button
              class="flex-1 flex items-center justify-center bg-surface-hover rounded-t-xl rounded-b-md border border-divider text-text-muted hover:text-text-primary transition-colors"
              (click)="prevDay.emit()"
            >
              <app-icon name="chevron-up" [size]="18" />
            </button>
            <button
              class="flex-1 flex items-center justify-center bg-surface-hover rounded-b-xl rounded-t-md border border-divider text-text-muted hover:text-text-primary transition-colors"
              (click)="nextDay.emit()"
            >
              <app-icon name="chevron-down" [size]="18" />
            </button>
          </div>
        </div>
      </div>

      <!-- Content -->
      @if (isLoading()) {
        <!-- Hero skeleton: misma estructura que el hero real (sin altura fija) -->
        <h3 class="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3 ml-2">
          Próxima Clase
        </h3>
        <div
          class="rounded-3xl p-6 relative overflow-hidden mb-8 shadow-sm bg-brand/10 border border-brand/20 border-l-4 border-l-brand/40 flex flex-col"
        >
          <div class="flex justify-between items-center mb-6">
            <app-skeleton-block
              variant="rect"
              width="120px"
              height="22px"
              class="rounded-full opacity-60"
            />
            <app-skeleton-block variant="circle" width="20px" height="20px" class="opacity-50" />
          </div>
          <app-skeleton-block variant="text" width="65%" height="32px" class="mb-2 opacity-70" />
          <app-skeleton-block variant="text" width="78%" height="14px" class="mb-6 opacity-55" />
          <div class="flex items-center gap-2 mt-2">
            <app-skeleton-block variant="circle" width="16px" height="16px" class="opacity-50" />
            <app-skeleton-block variant="text" width="100px" height="12px" class="opacity-60" />
          </div>
        </div>

        <!-- Timeline skeleton: estructura 1:1 con las cards reales -->
        <div class="mt-8">
          @for (i of [1, 2, 3, 4]; track i; let last = $last) {
            <div class="flex gap-4 items-stretch w-full mb-4">
              <!-- Time Label column (matches real pt-[22px]) -->
              <div class="w-[45px] shrink-0 pt-[22px] flex justify-end">
                <app-skeleton-block variant="text" width="32px" height="10px" class="opacity-40" />
              </div>

              <!-- Rail Line + Dot column (matches real dot mt-[22px]) -->
              <div class="w-4 shrink-0 relative flex justify-center">
                <div
                  class="w-[1px] bg-divider/20 absolute top-0 bottom-[-16px]"
                  [class.hidden]="last"
                ></div>
                <div
                  class="w-3 h-3 rounded-full relative z-10 mt-[22px] bg-surface-hover border-2 border-divider/40"
                ></div>
              </div>

              <!-- Session Card: misma forma que getCardClass() default -->
              <div class="flex-1 w-full">
                <div
                  class="rounded-xl p-5 border border-divider border-l-4 border-l-divider/40 bg-surface shadow-sm flex flex-col gap-3"
                >
                  <div class="flex items-start justify-between">
                    <app-skeleton-block
                      variant="text"
                      width="80px"
                      height="8px"
                      class="opacity-45"
                    />
                    <app-skeleton-block
                      variant="circle"
                      width="14px"
                      height="14px"
                      class="opacity-40"
                    />
                  </div>
                  <app-skeleton-block variant="text" width="68%" height="20px" class="opacity-55" />
                  <div class="flex items-center gap-4">
                    <div class="flex items-center gap-1.5 opacity-45">
                      <app-skeleton-block variant="circle" width="12px" height="12px" />
                      <app-skeleton-block variant="text" width="30px" height="10px" />
                    </div>
                    <div class="flex items-center gap-1.5 opacity-45">
                      <app-skeleton-block variant="circle" width="12px" height="12px" />
                      <app-skeleton-block variant="text" width="40px" height="10px" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      } @else {
        <!-- Next Class Hero Card -->
        @if (daySchedule()?.nextBlock; as nextBlock) {
          <h3 class="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3 ml-2">
            Próxima Clase
          </h3>
          <div
            class="rounded-3xl p-6 relative overflow-hidden mb-8 shadow-sm cursor-pointer hover:scale-[1.02] transition-transform duration-300 bg-brand group"
            (click)="blockClick.emit(nextBlock)"
          >
            <div class="absolute inset-0 bg-black/5 z-0"></div>

            <div class="relative z-10 flex flex-col h-full">
              <div class="flex justify-between items-center mb-6">
                <div
                  class="bg-black/20 rounded-full px-3 py-1 font-bold text-[11px] text-brand-contrast tracking-wider"
                >
                  {{ nextBlock.startTime }} — {{ nextBlock.endTime }}
                </div>
                <app-icon name="car" [size]="20" class="text-brand-contrast opacity-80" />
              </div>

              <h4
                class="text-3xl lg:text-4xl font-extrabold text-brand-contrast tracking-tight mb-2 leading-none"
              >
                {{ nextBlock.studentName }}
              </h4>
              <p class="text-sm font-medium text-brand-contrast/90 mb-6">
                Clase Nº {{ nextBlock.classNumber }} •
                {{ nextBlock.vehiclePlate || 'Vehículo sin asignar' }}
              </p>

              <div class="flex items-center gap-2 text-brand-contrast text-sm font-bold mt-auto">
                <app-icon name="map-pin" [size]="16" />
                <span>Punto de partida</span>
              </div>
            </div>
          </div>
        } @else {
          <h3 class="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3 ml-2">
            Próxima Clase
          </h3>
          <div
            class="rounded-3xl p-6 relative overflow-hidden mb-8 shadow-sm bg-surface-hover/50 border border-divider/50 group flex flex-col items-center justify-center min-h-[160px]"
          >
            <app-icon name="calendar-check" [size]="48" class="text-text-muted opacity-50 mb-3" />
            <h4 class="text-lg font-bold text-text-primary mb-1">Día Libre</h4>
            <p class="text-xs font-medium text-text-secondary text-center">
              No hay clases programadas para continuar hoy.
            </p>
          </div>
        }

        <!-- Timeline Rail Segura usando Flex -->
        <div class="mt-8">
          @for (block of daySchedule()?.blocks; track block.sessionId; let last = $last) {
            <div
              #timelineNode
              class="flex gap-4 items-stretch w-full animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both mb-4 group/rail"
            >
              <!-- Time Label column -->
              <div class="w-[45px] shrink-0 pt-[22px] flex justify-end">
                <span
                  class="font-bold text-[11px]"
                  [class]="block.status === 'in_progress' ? 'text-brand' : 'text-text-muted'"
                >
                  {{ block.startTime }}
                </span>
              </div>

              <!-- Rail Line + Dot column -->
              <div class="w-4 shrink-0 relative flex justify-center">
                <div
                  class="w-[1px] bg-divider/40 absolute top-0 bottom-[-16px]"
                  [class.hidden]="last"
                ></div>
                <div
                  class="w-3 h-3 rounded-full relative z-10 transition-colors mt-[22px]"
                  [class]="getDotClass(block)"
                ></div>
              </div>

              <!-- Session Card column -->
              <div
                class="flex-1 w-full"
                (click)="block.status !== 'cancelled' && blockClick.emit(block)"
              >
                <div [class]="getCardClass(block)">
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] font-bold tracking-widest uppercase text-brand/80">
                        SESSION #{{ block.classNumber | number: '2.0' }}
                      </span>
                    </div>

                    @if (block.status === 'in_progress') {
                      <app-icon name="user" [size]="16" class="text-brand" />
                    } @else if (block.status === 'completed') {
                      <app-icon name="check" [size]="16" class="text-text-muted" />
                    }
                  </div>

                  <h5
                    class="text-[17px] font-bold text-text-primary mb-3 line-clamp-1"
                    [class.line-through]="block.status === 'cancelled'"
                  >
                    {{ block.studentName }}
                  </h5>

                  <div
                    class="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-text-muted"
                  >
                    <div class="flex items-center gap-1.5">
                      <app-icon name="clock" [size]="14" class="opacity-70" />
                      <span>{{ block.durationMin }}m</span>
                    </div>
                    <div class="flex items-center gap-1.5 whitespace-nowrap">
                      <app-icon name="settings-2" [size]="14" class="opacity-70" />
                      <span>Mecánico</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class DailyScheduleTimelineComponent implements AfterViewInit {
  daySchedule = input<DaySchedule | null>(null);
  weekDays = input<
    { name: string; date: string; dayNumber: number; isToday: boolean }[] | undefined
  >();
  selectedDateString = input<string | undefined>();
  isLoading = input<boolean>(false);

  prevDay = output<void>();
  nextDay = output<void>();
  todayNav = output<void>();
  dateNav = output<string>();
  blockClick = output<ScheduleBlock>();

  private gsap = inject(GsapAnimationsService);
  private nodes = viewChildren<ElementRef<HTMLElement>>('timelineNode');

  onDateSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.dateNav.emit(input.value);
    }
  }

  ngAfterViewInit() {
    this.animateNodes();
  }

  // Trigger animation when the schedule updates
  animateNodes() {
    setTimeout(() => {
      const elements = this.nodes().map((n) => n.nativeElement);
      if (elements.length > 0) {
        this.gsap.staggerListItems(elements);
      }
    }, 50); // Small delay to let Angular render the DOM elements out of @for
  }

  getDotClass(block: ScheduleBlock): string {
    switch (block.status) {
      case 'in_progress':
        return 'bg-brand ring-4 ring-bg-base z-20 shadow-sm shadow-brand/40';
      case 'completed':
      case 'cancelled':
      case 'no_show':
        return 'bg-surface border-2 border-divider/50 ring-4 ring-bg-base z-20 shadow-sm';
      default: // scheduled
        return 'bg-surface border-2 border-brand/50 text-brand ring-4 ring-bg-base z-20 shadow-sm';
    }
  }

  getCardClass(block: ScheduleBlock): string {
    const isInteractive = block.status !== 'cancelled' && block.status !== 'no_show';
    const base =
      'flex-1 rounded-xl p-5 border backdrop-blur-sm transition-all duration-300 relative group overflow-hidden ' +
      (isInteractive ? 'cursor-pointer hover:shadow-md hover:-translate-y-1 ' : 'cursor-default ');

    switch (block.status) {
      case 'in_progress':
        return (
          base + 'bg-surface border-state-warning/30 border-l-4 !border-l-state-warning shadow-md'
        );
      case 'completed':
        return (
          base +
          'bg-surface border-divider border-l-4 !border-l-state-success/30 opacity-70 hover:opacity-100 hover:border-state-success/40'
        );
      case 'cancelled':
      case 'no_show':
        return 'flex-1 rounded-xl p-5 transition-all bg-surface-hover/30 border border-dashed border-divider opacity-60 cursor-default';
      default: // scheduled
        return (
          base +
          'bg-surface border-divider border-l-4 !border-l-brand-primary shadow-sm hover:border-brand-primary/30'
        );
    }
  }
}
