import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import type { ScheduleBlock, WeekSchedule } from '@core/models/ui/instructor-portal.model';

@Component({
  selector: 'app-weekly-schedule-grid',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card p-0 overflow-hidden relative">
      <div class="px-6 py-4 flex items-center justify-between border-b border-divider bg-surface-hover">
        <h3 class="font-bold text-text-primary text-lg">{{ schedule?.weekLabel || 'Cargando semana...' }}</h3>
        <div class="flex gap-2">
           <button class="btn btn-outline btn-sm" (click)="prevWeek.emit()">
             <lucide-icon name="chevron-left" [size]="16"></lucide-icon>
           </button>
           <button class="btn btn-primary btn-sm" (click)="today.emit()">Hoy</button>
           <button class="btn btn-outline btn-sm" (click)="nextWeek.emit()">
             <lucide-icon name="chevron-right" [size]="16"></lucide-icon>
           </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <div class="min-w-[800px]">
          <!-- Header -->
          <div class="grid grid-cols-8 border-b border-divider bg-surface">
            <!-- Time Column -->
            <div class="p-3 border-r border-divider">
              <span class="text-xs font-semibold uppercase text-text-muted opacity-0">Horario</span>
            </div>
            <!-- Days Columns -->
            <div *ngFor="let day of getDaysOfCurrentWeek(); let i = index" class="p-3 text-center border-r border-divider last:border-0" [class.bg-brand-muted]="isToday(day.date)">
              <div class="text-xs font-bold uppercase" [class.text-brand-primary]="isToday(day.date)" [class.text-text-muted]="!isToday(day.date)">
                {{ day.name }}
              </div>
              <div class="text-xl font-bold mt-0.5" [class.text-brand-primary]="isToday(day.date)" [class.text-text-primary]="!isToday(day.date)">
                {{ day.date.getDate() }}
              </div>
            </div>
          </div>

          <!-- Grid Body -->
          <div class="relative bg-surface">
             <!-- Background Grid Lines -->
             <div class="grid grid-cols-8" *ngFor="let hour of hours">
                <!-- Time Label -->
                <div class="p-2 border-r border-b border-divider text-right text-xs text-text-muted h-16 relative">
                   <span class="absolute right-3 top-[-8px] bg-surface px-1">{{ hour }}:00</span>
                </div>
                <!-- Day Cells -->
                <div *ngFor="let d of [0,1,2,3,4,5,6]" class="border-r border-b border-divider h-16 last:border-r-0 hover:bg-surface-hover/50 transition-colors"></div>
             </div>

             <!-- Bloques de horario renderizados absolutamente -->
             <ng-container *ngIf="schedule">
               <div 
                 *ngFor="let block of schedule.blocks" 
                 class="absolute rounded-md p-2 m-1 border shadow-sm text-xs leading-tight transition-transform hover:scale-[1.02] cursor-pointer flex flex-col justify-between overflow-hidden"
                 [style]="getBlockStyle(block)"
                 (click)="blockClick.emit(block)"
               >
                 <div>
                   <div class="font-bold opacity-90 truncate">{{ block.label }}</div>
                   <div class="opacity-75">{{ block.hour }}:{{ block.minuteStart === 0 ? '00' : block.minuteStart }} - {{ block.hour + 1 }}:{{ block.minuteStart === 0 ? '00' : block.minuteStart }}</div>
                 </div>
                 
                 <!-- Mock indicators based on type, using statusColor just for demo -->
                 <div class="flex items-center gap-1 mt-1 opacity-75">
                    <lucide-icon [name]="block.color === 'info' ? 'clock' : block.color === 'success' ? 'check-circle' : 'circle'" [size]="12"></lucide-icon>
                    <span>{{ getStatusLabel(block.color) }}</span>
                 </div>
               </div>
             </ng-container>
          </div>
        </div>
      </div>
    </div>
  `
})
export class WeeklyScheduleGridComponent {
  @Input() schedule: WeekSchedule | null = null;
  @Output() prevWeek = new EventEmitter<void>();
  @Output() nextWeek = new EventEmitter<void>();
  @Output() today = new EventEmitter<void>();
  @Output() blockClick = new EventEmitter<ScheduleBlock>();

  // Mostramos agenda de 8am a 20pm
  public hours = Array.from({ length: 13 }, (_, i) => i + 8);
  
  getDaysOfCurrentWeek() {
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    if (!this.schedule) {
      // Mock days if no schedule
      return days.map(d => ({ name: d, date: new Date() }));
    }
    
    const start = new Date(this.schedule.weekStart);
    return days.map((name, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return { name, date: d };
    });
  }

  isToday(date: Date) {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  }

  getStatusLabel(color: string) {
     const map: any = {
         'info': 'Programada',
         'warning': 'En Curso',
         'success': 'Completada',
         'error': 'Cancelada'
     };
     return map[color] || 'Ocupado';
  }

  getBlockStyle(block: ScheduleBlock): string {
    // Calculamos el % de offset en base a la columna del día (1 a 8, donde 1 es el horario)
    const colPercentage = 100 / 8;
    const leftOffset = colPercentage * (block.dayOfWeek + 1);
    
    // Calculamos el % de top basado en la hora (cada bloque de hora es h-16 = 64px)
    // Supongamos que height total es 13 horas * 64px = 832px
    // hour index = block.hour - 8
    const hourIndex = block.hour - 8;
    const topPx = (hourIndex * 64) + (block.minuteStart / 60 * 64);
    
    // Altura del bloque: 60 min (64px) o ajustar según `durationMin` (aquí hardcodeado a 1h)
    const heightPx = 64; 

    // Bg colors mappings
    const bgColors: any = {
        'info': '#EFF6FF',
        'warning': '#FEF3C7',
        'success': '#F0FDF4',
        'error': '#FEF2F2',
        'default': '#F3F4F6'
    };
    const borderColors: any = {
        'info': '#BFDBFE',
        'warning': '#FDE68A',
        'success': '#BBF7D0',
        'error': '#FECACA',
        'default': '#E5E7EB'
    };
    const textColors: any = {
        'info': '#1D4ED8',
        'warning': '#B45309',
        'success': '#15803D',
        'error': '#B91C1C',
        'default': '#374151'
    };
    
    const bg = bgColors[block.color] || bgColors['default'];
    const border = borderColors[block.color] || borderColors['default'];
    const text = textColors[block.color] || textColors['default'];

    return `
      left: calc(${leftOffset}% + 4px);
      width: calc(${colPercentage}% - 8px);
      top: ${topPx}px;
      height: ${heightPx - 8}px;
      background-color: ${bg};
      border-color: ${border};
      color: ${text};
    `;
  }
}
