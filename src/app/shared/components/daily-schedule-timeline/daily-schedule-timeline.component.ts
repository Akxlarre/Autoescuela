import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChildren,
} from '@angular/core';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { getStatusVisual, getDotStyle } from '@core/utils/schedule-status.utils';
import type { DaySchedule, ScheduleBlock } from '@core/models/ui/instructor-portal.model';
import { IconComponent } from '../icon/icon.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';

@Component({
  selector: 'app-daily-schedule-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, CardHoverDirective],
  template: `
    <div class="space-y-6">
      <!-- ── Day Tab Strip ─────────────────────────────────────────────────── -->
      <div class="flex gap-2 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
        @for (day of weekDays(); track day.date) {
          <button
            class="flex flex-col items-center justify-center px-4 py-3 rounded-2xl shrink-0 min-w-[64px] transition-all duration-200 border"
            [style.background]="getDayPillBg(day)"
            [style.border-color]="getDayPillBorderColor(day)"
            (click)="daySelect.emit(day.date)"
          >
            <span class="text-[10px] font-bold uppercase tracking-widest mb-1"
              [style.color]="getDayPillTextColor(day, 'label')">
              {{ day.name.slice(0, 3) }}
            </span>
            <span class="text-2xl font-black leading-none"
              [style.color]="getDayPillTextColor(day, 'number')">
              {{ day.dayNumber }}
            </span>
            
            <!-- Indicador sutil de "hoy" en pildora no seleccionada -->
            @if (day.isToday && day.date !== selectedDateString()) {
              <div class="absolute -bottom-1 w-1 h-1 rounded-full bg-brand"></div>
            }
          </button>
        }
      </div>

      <!-- ── Selected Date Label ────────────────────────────────────────────── -->
      <div class="flex items-center justify-between pb-2">
        <h2 class="text-2xl font-bold tracking-tight" [style.color]="'var(--text-primary)'">
          {{ daySchedule()?.dateLabel }}
        </h2>
        <div class="flex h-1.5 w-1.5 rounded-full bg-brand" style="box-shadow: 0 0 8px var(--color-primary)"></div>
      </div>

      <!-- ── Loading skeleton ───────────────────────────────────────────────── -->
      @if (isLoading()) {
        <div class="space-y-4">
          <div class="rounded-3xl p-6 bg-elevated border border-dashed opacity-50 animate-pulse">
             <app-skeleton-block variant="rect" width="100%" height="120px" />
          </div>
          @for (i of [1, 2, 3]; track i) {
             <div class="flex gap-4">
                <app-skeleton-block variant="text" width="40px" height="20px" />
                <app-skeleton-block variant="rect" width="100%" height="80px" />
             </div>
          }
        </div>
      } @else {
        <!-- ── Next Class Hero Card ─────────────────────────────────────────── -->
        @if (daySchedule()?.nextBlock; as nextBlock) {
          <div
            appCardHover
            class="rounded-3xl p-6 relative overflow-hidden mb-8 shadow-md cursor-pointer border-l-4"
            [style.background]="'var(--color-primary)'"
            [style.border-left-color]="'var(--state-warning)'"
            (click)="blockClick.emit(nextBlock)"
          >
            <!-- Decoración sutil -->
            <div class="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10" style="background: white"></div>

            <div class="relative z-10 flex flex-col h-full">
              <div class="flex justify-between items-center mb-4">
                <div
                  class="rounded-full px-3 py-1 font-bold text-[11px] tracking-wider"
                  style="background: rgba(255,255,255,0.2); color: var(--color-primary-text)"
                >
                  PRÓXIMA CLASE • {{ nextBlock.startTime }}
                </div>
                <app-icon name="user" [size]="18" [color]="'var(--color-primary-text)'" />
              </div>

              <h4
                class="text-2xl font-black tracking-tight mb-1 leading-tight"
                [style.color]="'var(--color-primary-text)'"
              >
                {{ nextBlock.studentName }}
              </h4>
              <p
                class="text-xs font-semibold mb-6"
                style="color: var(--color-primary-text); opacity: 0.85"
              >
                Clase Nº {{ nextBlock.classNumber }} •
                {{ nextBlock.vehiclePlate || 'S/A' }}
              </p>

              <div class="flex items-center gap-2 text-[11px] font-bold mt-auto"
                [style.color]="'var(--color-primary-text)'">
                <app-icon name="arrow-right" [size]="14" />
                <span class="uppercase tracking-widest">Iniciar sesión ahora</span>
              </div>
            </div>
          </div>
        } @else {
          <!-- Empty day state -->
          <div
            class="rounded-3xl p-8 mb-8 bg-elevated flex flex-col items-center justify-center min-h-[180px] border border-dashed"
            style="border-color: var(--border-subtle)"
          >
            <div class="w-16 h-16 rounded-full bg-surface-base flex items-center justify-center mb-4" style="border: 1px solid var(--border-subtle)">
               <app-icon name="calendar-check" [size]="32" [color]="'var(--text-muted)'" />
            </div>
            <h4 class="text-xl font-bold mb-2" [style.color]="'var(--text-primary)'">Agenda Libre</h4>
            <p class="text-xs font-medium text-center max-w-[200px]" [style.color]="'var(--text-muted)'">
              No tienes actividades programadas para el día seleccionado.
            </p>
          </div>
        }

        <!-- ── Timeline Rail ───────────────────────────────────────────────── -->
        <div class="mt-4 space-y-4">
          @for (block of daySchedule()?.blocks; track block.sessionId; let last = $last) {
            <div #timelineNode class="flex gap-4 items-stretch w-full">
              <!-- Time label -->
              <div class="w-[45px] shrink-0 pt-4 flex justify-end">
                <span
                  class="font-black text-[10px] tracking-tighter"
                  [style.color]="block.status === 'in_progress' ? 'var(--color-primary)' : 'var(--text-muted)'"
                >
                  {{ block.startTime }}
                </span>
              </div>

              <!-- Rail connector + dot -->
              <div class="w-4 shrink-0 relative flex justify-center">
                @if (!last) {
                  <div
                    class="w-[1px] absolute top-6 bottom-[-16px]"
                    style="background: var(--border-subtle); opacity: 0.3"
                  ></div>
                }
                <div
                  class="w-2.5 h-2.5 rounded-full relative z-10 mt-4 transition-transform duration-300"
                  [style]="getDotStyleWrapper(block.status)"
                  [class.scale-125]="block.status === 'in_progress'"
                ></div>
              </div>

              <!-- Session card -->
              <div
                class="flex-1 min-w-0"
                (click)="getStatusVisual(block.status).interactive && blockClick.emit(block)"
              >
                <div
                  class="rounded-2xl p-4 border transition-all duration-300 relative overflow-hidden"
                  [style]="getCardStyle(block)"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span
                      class="text-[9px] font-black tracking-widest uppercase opacity-60"
                      [style.color]="block.status === 'in_progress' ? 'var(--color-primary-text)' : 'var(--text-muted)'"
                    >
                      BLOQUE {{ block.durationMin }} MIN
                    </span>
                    @if (getStatusVisual(block.status).icon; as iconName) {
                      <app-icon [name]="iconName" [size]="14" [style.color]="getStatusVisual(block.status).textColor" />
                    }
                  </div>

                  <h5
                    class="text-[16px] font-bold mb-1 truncate"
                    [style.color]="getStatusVisual(block.status).textColor"
                  >
                    {{ block.studentName }}
                  </h5>

                  <div class="flex items-center gap-2 text-[10px] font-bold opacity-70"
                    [style.color]="getStatusVisual(block.status).textColor">
                    <span>#{{ block.classNumber }}</span>
                    <span>•</span>
                    <span>{{ block.vehiclePlate || 'Sin vehículo' }}</span>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `]
})
export class DailyScheduleTimelineComponent {
  readonly daySchedule = input<DaySchedule | null>(null);
  readonly weekDays = input<{ name: string; date: string; dayNumber: number; isToday: boolean }[] | undefined>();
  readonly selectedDateString = input<string | undefined>();
  readonly isLoading = input<boolean>(false);

  readonly daySelect = output<string>();
  readonly blockClick = output<ScheduleBlock>();

  private readonly gsap = inject(GsapAnimationsService);
  private readonly nodes = viewChildren<ElementRef<HTMLElement>>('timelineNode');

  constructor() {
    effect(() => {
      const elements = this.nodes().map((n) => n.nativeElement);
      if (elements.length > 0) {
        untracked(() => this.gsap.staggerListItems(elements));
      }
    });
  }

  getDayPillBg(day: any): string {
    if (day.date === this.selectedDateString()) return 'var(--color-primary)';
    if (day.isToday) return 'var(--color-primary-muted)';
    return 'var(--bg-surface)';
  }

  getDayPillTextColor(day: any, type: 'label' | 'number'): string {
    if (day.date === this.selectedDateString()) return 'var(--color-primary-text)';
    if (day.isToday) return 'var(--color-primary)';
    return type === 'label' ? 'var(--text-muted)' : 'var(--text-primary)';
  }

  getDayPillBorderColor(day: any): string {
    if (day.date === this.selectedDateString()) return 'var(--color-primary)';
    if (day.isToday) return 'var(--color-primary)';
    return 'var(--border-subtle)';
  }

  getDotStyleWrapper(status: any) {
    const style = getDotStyle(status);
    return {
      background: style['background'],
      border: style['border'],
      'box-shadow': style['box-shadow']
    };
  }

  getCardStyle(block: ScheduleBlock): Record<string, string> {
    const visual = getStatusVisual(block.status);
    let style: Record<string, string> = {
      'border-left': `4px solid ${visual.borderColor}`,
      'background': block.status === 'in_progress' ? 'var(--color-primary)' : 'var(--bg-surface)',
      'opacity': String(visual.opacity),
      'border-color': block.status === 'in_progress' ? 'var(--color-primary)' : 'var(--border-subtle)'
    };
    
    if (block.status === 'in_progress') {
       style['box-shadow'] = '0 8px 24px color-mix(in srgb, var(--color-primary) 20%, transparent)';
    }

    return style;
  }

  getStatusVisual(status: any) {
    return getStatusVisual(status);
  }
}
