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
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import type { ScheduleBlock, DaySchedule } from '@core/models/ui/instructor-portal.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

@Component({
  selector: 'app-instructor-horario',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeroComponent,
    WeeklyScheduleGridComponent,
    DailyScheduleTimelineComponent,
    KpiCardVariantComponent,
    BentoGridLayoutDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <div class="bento-banner">
        <app-section-hero
          #heroRef
          title="Mi Horario"
          [subtitle]="weekLabel()"
          backRoute="/app/instructor/dashboard"
          backLabel="Dashboard"
          [actions]="heroActions"
          [chips]="heroChips()"
        />
      </div>

      <!-- KPIs -->
      <div class="bento-square">
        <app-kpi-card-variant
          label="Clases Hoy"
          [value]="facade.weeklySchedule()?.kpis?.clasesHoy || 0"
          icon="calendar-check"
          [loading]="facade.isLoading()"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Agendadas"
          [value]="facade.weeklySchedule()?.kpis?.clasesAgendadas || 0"
          icon="calendar-days"
          [loading]="facade.isLoading()"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Completadas"
          [value]="facade.weeklySchedule()?.kpis?.clasesCompletadas || 0"
          icon="check-circle"
          color="success"
          [loading]="facade.isLoading()"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Horas Semana"
          [value]="facade.weeklySchedule()?.kpis?.horasSemana || 0"
          suffix="h"
          icon="clock"
          [loading]="facade.isLoading()"
        />
      </div>

      <!-- Schedule content -->
      <div class="bento-banner">
        <!-- DESKTOP: Grid Semanal -->
        <div class="hidden md:block">
          <app-weekly-schedule-grid
            [schedule]="facade.weeklySchedule()"
            [isLoading]="facade.isLoading()"
            [selectedDate]="selectedDayDate()"
            (prevWeek)="changeWeek(-1)"
            (nextWeek)="changeWeek(1)"
            (today)="resetToToday()"
            (daySelect)="onDaySelect($event)"
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
            (daySelect)="onMobileDaySelect($event)"
            (blockClick)="onBlockClick($event)"
          />
        </div>
      </div>
    </div>
  `,
})
export class InstructorHorarioComponent implements OnInit, AfterViewInit {
  public facade = inject(InstructorHorasFacade);
  private gsap = inject(GsapAnimationsService);
  private router = inject(Router);

  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroRef');
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  private currentWeekDate: string = new Date().toISOString();

  // Mobile day selection
  public selectedDate = signal<string>(new Date().toISOString().split('T')[0]);

  // Desktop day highlighting
  public selectedDayDate = signal<string | null>(null);

  readonly weekLabel = computed(() => {
    const schedule = this.facade.weeklySchedule();
    return schedule ? `Semana del ${schedule.weekLabel}` : 'Cargando horario...';
  });

  readonly heroChips = computed(() => {
    const kpis = this.facade.weeklySchedule()?.kpis;
    if (!kpis) return [];
    return [
      { label: `${kpis.clasesHoy} clases hoy`, variant: 'default' as const },
      { label: `${kpis.horasSemana}h esta semana`, variant: 'default' as const },
    ];
  });

  // Derived state for mobile layout
  readonly todaySchedule = computed<DaySchedule | null>(() => {
    const schedule = this.facade.weeklySchedule();
    if (!schedule) return null;

    // Convert selectedDate string "YYYY-MM-DD" to matching week day
    const sd = new Date(this.selectedDate() + 'T12:00:00'); // Midday to avoid timezone shifting
    // 0=Domingo in JS, but UI expects 0=Lunes, 6=Domingo
    const dayOfWeek = sd.getDay() === 0 ? 6 : sd.getDay() - 1;

    let targetDayLabel = 'Día';
    let targetDateLabel = '';

    // Find matching day in week info
    const dayMeta = schedule.days.find((d) => d.date === this.selectedDate());
    if (dayMeta) {
      targetDayLabel = dayMeta.name;
    } else {
      const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      targetDayLabel = dayNames[dayOfWeek] || 'Día';
    }

    const monthNames = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    targetDateLabel = `${sd.getDate()} de ${monthNames[sd.getMonth()]}, ${sd.getFullYear()}`;

    // Blocks for this day
    const blocksForDay = schedule.blocks
      .filter((b) => b.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.hour * 60 + a.minuteStart - (b.hour * 60 + b.minuteStart));

    // Next block logic
    const nextBlock =
      blocksForDay.find((b) => b.status === 'scheduled' || b.status === 'in_progress') ?? null;

    return {
      date: this.selectedDate(),
      dayLabel: targetDayLabel,
      dateLabel: targetDateLabel,
      blocks: blocksForDay,
      nextBlock,
    };
  });

  readonly heroActions: SectionHeroAction[] = [];

  async ngOnInit() {
    await this.facade.initialize();
    await this.facade.fetchWeeklySchedule(this.currentWeekDate);
  }

  ngAfterViewInit() {
    requestAnimationFrame(() => {
      const hero = this.heroRef();
      if (hero) this.gsap.animateHero(hero.nativeElement);
      const grid = this.bentoGrid();
      if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
    });
  }

  changeWeek(offset: number) {
    const date = new Date(this.currentWeekDate);
    date.setDate(date.getDate() + offset * 7);
    this.currentWeekDate = date.toISOString();
    this.facade.fetchWeeklySchedule(this.currentWeekDate);

    // Also sync the day to the new week's Monday
    this.selectedDate.set(this.currentWeekDate.split('T')[0]);
    this.selectedDayDate.set(null); // Clear desktop selection on week change
  }

  onDaySelect(dateStr: string) {
    this.selectedDayDate.set(dateStr);
  }

  onMobileDaySelect(dateStr: string) {
    this.selectedDate.set(dateStr);

    // Refresh week if we moved outside the current week range
    const dt = new Date(dateStr + 'T12:00:00');
    // If the week of dt is different from currentWeekDate, fetch.
    // For now, simplicity: if the date is far from currentWeekDate, fetch.
    const current = new Date(this.currentWeekDate);
    const diffTime = Math.abs(dt.getTime() - current.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 7) {
      this.currentWeekDate = dt.toISOString();
      this.facade.fetchWeeklySchedule(this.currentWeekDate);
    }
  }

  changeDay(offset: number) {
    const parts = this.selectedDate().split('-');
    const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
    dt.setDate(dt.getDate() + offset);
    this.onMobileDaySelect(dt.toISOString().split('T')[0]);
  }

  resetToToday() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    this.selectedDate.set(todayStr);
    this.selectedDayDate.set(todayStr);
    this.currentWeekDate = today.toISOString();
    this.facade.fetchWeeklySchedule(this.currentWeekDate);
  }

  onBlockClick(block: ScheduleBlock) {
    if (!block.sessionId) return;

    if (block.status === 'completed') {
      this.router.navigate([
        `/app/instructor/alumnos/${block.sessionId}/evaluacion/${block.sessionId}`,
      ]);
    } else if (block.status === 'scheduled' || block.status === 'in_progress') {
      this.router.navigate([`/app/instructor/clases/${block.sessionId}/iniciar`]);
    }
  }
}
