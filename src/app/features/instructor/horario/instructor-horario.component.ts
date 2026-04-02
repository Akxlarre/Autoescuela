import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  inject,
  viewChild,
  signal,
  computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { InstructorHorasFacade } from '@core/facades/instructor-horas.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { WeeklyScheduleGridComponent } from '@shared/components/weekly-schedule-grid/weekly-schedule-grid.component';
import { DailyScheduleTimelineComponent } from '@shared/components/daily-schedule-timeline/daily-schedule-timeline.component';
import type { ScheduleBlock, DaySchedule } from '@core/models/ui/instructor-portal.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

@Component({
  selector: 'app-instructor-horario',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeroComponent, 
    WeeklyScheduleGridComponent, 
    DailyScheduleTimelineComponent
  ],
  template: `
    <div class="px-6 py-6 pb-20 max-w-7xl mx-auto space-y-6">
      <!-- Hero: solo desktop -->
      <div class="hidden md:block">
        <app-section-hero
          #heroRef
          title="Mi Horario"
          subtitle="Visualiza y gestiona tus clases programadas para esta semana"
          [actions]="heroActions"
        />
      </div>

      <!-- DESKTOP: Grid Semanal -->
      <div class="hidden md:block">
        <app-weekly-schedule-grid
          [schedule]="facade.weeklySchedule()"
          [isLoading]="facade.isLoading()"
          (prevWeek)="changeWeek(-1)"
          (nextWeek)="changeWeek(1)"
          (today)="resetToToday()"
          (blockClick)="onBlockClick($event)"
        />
      </div>

      <!-- MOBILE: Timeline Diario -->
      <div class="md:hidden">
        <app-daily-schedule-timeline
          [daySchedule]="todaySchedule()"
          [weekDays]="facade.weeklySchedule()?.days"
          [selectedDateString]="selectedDate()"
          [isLoading]="facade.isLoading()"
          (prevDay)="changeDay(-1)"
          (nextDay)="changeDay(1)"
          (todayNav)="resetToToday()"
          (dateNav)="changeToDate($event)"
          (blockClick)="onBlockClick($event)"
        />
      </div>
    </div>
  `
})
export class InstructorHorarioComponent implements OnInit, AfterViewInit {
  public facade = inject(InstructorHorasFacade);
  private gsap = inject(GsapAnimationsService);
  private router = inject(Router);

  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroRef');
  
  private currentWeekDate: string = new Date().toISOString();
  
  // Mobile day selection
  public selectedDate = signal<string>(new Date().toISOString().split('T')[0]);

  // Derived state for mobile layout
  readonly todaySchedule = computed<DaySchedule | null>(() => {
    const schedule = this.facade.weeklySchedule();
    if (!schedule) return null;
    
    // Convert selectedDate string "YYYY-MM-DD" to matching week day
    const sd = new Date(this.selectedDate() + 'T12:00:00'); // Midday to avoid timezone shifting
    // Because weekSchedule.days has day names and numbers... we can match the exact date if we format it or we use DayOfWeek
    const dayOfWeek = sd.getDay() === 0 ? 6 : sd.getDay() - 1; // 0=Lun, 6=Dom
    
    let targetDayLabel = 'Día';
    let targetDateLabel = '';
    
    // Find matching day in week info
    const dayMeta = schedule.days.find(d => d.date === this.selectedDate());
    if (dayMeta) {
      targetDayLabel = dayMeta.name;
    } else {
      const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      targetDayLabel = dayNames[dayOfWeek] || 'Día';
    }
    
    // Format full date label e.g. "1 de Abril, 2026"
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    targetDateLabel = `${sd.getDate()} de ${monthNames[sd.getMonth()]}, ${sd.getFullYear()}`;
    
    // Blocks for this day
    const blocksForDay = schedule.blocks
      .filter(b => b.dayOfWeek === dayOfWeek)
      .sort((a, b) => (a.hour * 60 + a.minuteStart) - (b.hour * 60 + b.minuteStart));
      
    // Next block logic
    const nextBlock = blocksForDay.find(b => b.status === 'scheduled' || b.status === 'in_progress') ?? null;
      
    return {
      date: this.selectedDate(),
      dayLabel: targetDayLabel,
      dateLabel: targetDateLabel,
      blocks: blocksForDay,
      nextBlock
    };
  });

  readonly heroActions: SectionHeroAction[] = [
    {
      id: 'dashboard',
      label: 'Ir al Dashboard',
      icon: 'monitor',
      primary: false,
      route: '/app/instructor/dashboard',
    },
  ];

  async ngOnInit() {
    await this.facade.initialize();
    await this.facade.fetchWeeklySchedule(this.currentWeekDate);
  }

  ngAfterViewInit() {
    const hero = this.heroRef();
    if (hero) this.gsap.animateHero(hero.nativeElement);
  }

  changeWeek(offset: number) {
    const date = new Date(this.currentWeekDate);
    date.setDate(date.getDate() + offset * 7);
    this.currentWeekDate = date.toISOString();
    this.facade.fetchWeeklySchedule(this.currentWeekDate);
    
    // Also sync the day to the new week's Monday (or keep it if it makes sense)
    this.selectedDate.set(this.currentWeekDate.split('T')[0]);
  }
  
  changeDay(offset: number) {
    // Current selected date string 'YYYY-MM-DD'
    const curDateParts = this.selectedDate().split('-');
    const dt = new Date(parseInt(curDateParts[0], 10), parseInt(curDateParts[1], 10) - 1, parseInt(curDateParts[2], 10), 12, 0, 0);
    dt.setDate(dt.getDate() + offset);
    
    const newDateStr = dt.toISOString().split('T')[0];
    this.selectedDate.set(newDateStr);
    
    // Check if we need to fetch another week (dt is outside of current week range)
    // For simplicity, we can just trigger a fetch of the week containing dt.
    // The facade will handle caching or deduplicating if needed.
    this.currentWeekDate = dt.toISOString();
    this.facade.fetchWeeklySchedule(this.currentWeekDate);
  }

  changeToDate(dateStr: string) {
    this.selectedDate.set(dateStr);
    const dt = new Date(dateStr + 'T12:00:00');
    this.currentWeekDate = dt.toISOString();
    this.facade.fetchWeeklySchedule(this.currentWeekDate);
  }

  resetToToday() {
    const today = new Date();
    this.selectedDate.set(today.toISOString().split('T')[0]);
    this.currentWeekDate = today.toISOString();
    this.facade.fetchWeeklySchedule(this.currentWeekDate);
  }

  onBlockClick(block: ScheduleBlock) {
    if (!block.sessionId) return;

    // Navigation logic based on session status
    if (block.status === 'completed') {
      this.router.navigate([`/app/instructor/alumnos/${block.sessionId}/evaluacion/${block.sessionId}`]);
    } else if (block.status === 'scheduled' || block.status === 'in_progress') {
      this.router.navigate([`/app/instructor/clases/${block.sessionId}/iniciar`]);
    }
  }
}
