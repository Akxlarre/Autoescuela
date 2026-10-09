import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  effect,
  inject,
  viewChild,
  signal,
  computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { InstructorHorasFacade } from '@core/facades/instructor-horas.facade';
import { InstructorClasesFacade } from '@core/facades/instructor-clases.facade';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { WeeklyScheduleGridComponent } from '@shared/components/weekly-schedule-grid/weekly-schedule-grid.component';
import { DailyScheduleTimelineComponent } from '@shared/components/daily-schedule-timeline/daily-schedule-timeline.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import type { ScheduleBlock, DaySchedule } from '@core/models/ui/instructor-portal.model';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { formatKpiEsCl } from '@core/utils/kpi-es-cl-format.util';
import { addDaysIso, diffDaysIso, weekdayOfIso } from '@core/utils/chile-time.utils';
import { todayIso } from '@core/utils/date.utils';
import { LayoutService } from '@core/services/ui/layout.service';

@Component({
  selector: 'app-instructor-horario',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeroComponent,
    WeeklyScheduleGridComponent,
    DailyScheduleTimelineComponent,
    BentoGridLayoutDirective,
    BentoRevealDirective,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen" appBentoReveal appBentoGridLayout>
      <app-section-hero
        [animateOnInit]="false"
        title="Mi Horario"
        [subtitle]="weekLabel()"
        backRoute="/app/instructor/dashboard"
        backLabel="Dashboard"
        [actions]="heroActions"
        [chips]="heroChips()"
        density="slim"
        [kpis]="heroKpis()"
        [loading]="isDataLoading()"
        [loadingKpiCount]="4"
      />

      <!-- Schedule content -->
      <div class="bento-banner bento-fill flex flex-col h-full">
        @if (isDesktopLayout()) {
          <!-- DESKTOP: Grid Semanal — solo se monta con ancho de CONTENEDOR real (tier
               desktop), no por viewport: la grilla necesita ~900px reales para sus 7
               columnas; con un drawer abierto angostando <main>, cae a timeline (fix-145-b) -->
          <app-weekly-schedule-grid
            class="h-full"
            [schedule]="facade.weeklySchedule()"
            [isLoading]="isDataLoading()"
            [selectedDate]="selectedDayDate()"
            (prevWeek)="changeWeek(-1)"
            (nextWeek)="changeWeek(1)"
            (today)="resetToToday()"
            (blockClick)="onBlockClick($event)"
          />
        } @else {
          <!-- MOBILE/TABLET (o contenedor angostado por drawer): Timeline Diario -->
          <app-daily-schedule-timeline
            [daySchedule]="todaySchedule()"
            [weekDays]="facade.weeklySchedule()?.days"
            [selectedDateString]="selectedDate()"
            [isLoading]="isDataLoading()"
            (daySelect)="onMobileDaySelect($event)"
            (blockClick)="onBlockClick($event)"
            (prevWeek)="changeWeek(-1)"
            (nextWeek)="changeWeek(1)"
          />
        }
      </div>
    </div>
  `,
})
export class InstructorHorarioComponent implements OnInit {
  public facade = inject(InstructorHorasFacade);

  private readonly _localLoading = signal(true);
  readonly isDataLoading = computed(() => {
    if (this.facade.weeklySchedule()) return false;
    return this._localLoading() || this.facade.isLoading();
  });
  private router = inject(Router);
  private readonly clasesFacade = inject(InstructorClasesFacade);
  /** Un día (fecha pura) de la semana que se está mostrando. */
  private currentWeekDate: string = todayIso();

  constructor() {
    // fix-236-m: evaluar/ver una clase completada abre el Drawer en vez de navegar, así que
    // la grilla queda montada y no se refresca sola. Recargamos la semana en silencio cuando
    // InstructorClasesFacade avisa que se guardó una evaluación.
    effect(() => {
      const tick = this.clasesFacade.evaluationSavedTick();
      if (tick === 0) return;
      this.facade.fetchWeeklySchedule(this.currentWeekDate);
    });
  }

  /** Switch grilla/timeline por ancho de CONTENEDOR (fix-145-b), no por viewport `md:` —
   *  la grilla necesita ~900px reales de <main>, que un drawer abierto puede angostar aunque
   *  el viewport siga siendo ancho. */
  private readonly layoutService = inject(LayoutService);
  protected readonly isDesktopLayout = computed(() => this.layoutService.tier() === 'desktop');

  // Mobile day selection
  public selectedDate = signal<string>(todayIso());

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
    const [year, month, day] = this.selectedDate().split('-').map(Number);
    // weekdayOfIso: 0=Domingo, but UI expects 0=Lunes, 6=Domingo
    const dayOfWeek = (weekdayOfIso(this.selectedDate()) + 6) % 7;

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
    targetDateLabel = `${day} de ${monthNames[month - 1]}, ${year}`;

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

  /**
   * KPIs del strip del hero slim (antes: 4 celdas `bento-square` sueltas).
   * Los valores van pre-formateados: el strip renderiza `{{ kpi.value }}` crudo
   * y no pasa por `animateCounter`, que era quien localizaba a es-CL.
   */
  readonly heroKpis = computed<SectionHeroKpi[]>(() => {
    const k = this.facade.weeklySchedule()?.kpis;
    return [
      { id: 'hoy', label: 'Clases Hoy', value: formatKpiEsCl(k?.clasesHoy ?? 0) },
      { id: 'agendadas', label: 'Agendadas', value: formatKpiEsCl(k?.clasesAgendadas ?? 0) },
      {
        id: 'completadas',
        label: 'Completadas',
        value: formatKpiEsCl(k?.clasesCompletadas ?? 0),
        color: 'success',
      },
      {
        id: 'horas-semana',
        label: 'Horas Semana',
        value: formatKpiEsCl(k?.horasSemana ?? 0),
        suffix: 'h',
      },
    ];
  });

  async ngOnInit() {
    try {
      await this.facade.initialize();
      await this.facade.fetchWeeklySchedule(this.currentWeekDate);
    } finally {
      this._localLoading.set(false);
    }
  }

  changeWeek(offset: number) {
    this.currentWeekDate = addDaysIso(this.currentWeekDate, offset * 7);
    this.facade.fetchWeeklySchedule(this.currentWeekDate);

    // Also sync the day to the new week
    this.selectedDate.set(this.currentWeekDate);
    this.selectedDayDate.set(null); // Clear desktop selection on week change
  }

  onMobileDaySelect(dateStr: string) {
    this.selectedDate.set(dateStr);

    // Refresh week if we moved outside the current week range
    // If the week of dateStr is different from currentWeekDate, fetch.
    // For now, simplicity: if the date is far from currentWeekDate, fetch.
    const diffDays = Math.abs(diffDaysIso(this.currentWeekDate, dateStr));

    if (diffDays > 7) {
      this.currentWeekDate = dateStr;
      this.facade.fetchWeeklySchedule(this.currentWeekDate);
    }
  }

  changeDay(offset: number) {
    this.onMobileDaySelect(addDaysIso(this.selectedDate(), offset));
  }

  resetToToday() {
    const todayStr = todayIso();
    this.selectedDate.set(todayStr);
    this.selectedDayDate.set(todayStr);
    this.currentWeekDate = todayStr;
    this.facade.fetchWeeklySchedule(this.currentWeekDate);
  }

  onBlockClick(block: ScheduleBlock) {
    if (!block.sessionId) return;

    if (block.status === 'completed') {
      // fix-236-m: abre la evaluación en el Drawer lateral en vez de navegar a otra página.
      this.clasesFacade.openEvaluacionDrawer(block.sessionId);
    } else if (block.status === 'scheduled') {
      this.router.navigate(['/app/instructor/clase/iniciar'], {
        queryParams: { sessionId: block.sessionId },
      });
    } else if (block.status === 'in_progress') {
      this.router.navigate(['/app/instructor/clase', block.sessionId]);
    }
  }
}
