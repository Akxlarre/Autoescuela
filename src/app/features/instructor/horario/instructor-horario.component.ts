import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  inject,
  viewChild,
} from '@angular/core';
import { InstructorHorasFacade } from '@core/facades/instructor-horas.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { WeeklyScheduleGridComponent } from '@shared/components/weekly-schedule-grid/weekly-schedule-grid.component';
import type { ScheduleBlock } from '@core/models/ui/instructor-portal.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

@Component({
  selector: 'app-instructor-horario',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionHeroComponent, AlertCardComponent, IconComponent, WeeklyScheduleGridComponent],
  template: `
    <div class="px-6 py-6 pb-20 max-w-7xl mx-auto space-y-6">
      <!-- HERO -->
      <section class="bento-hero surface-hero rounded-xl" #heroRef>
        <app-section-hero
          title="Mi Horario"
          subtitle="Visualiza tus clases programadas para esta semana"
          [actions]="heroActions"
        />
      </section>

      @if (facade.isLoading()) {
        <div class="flex justify-center p-12">
          <app-icon
            name="loader-2"
            [size]="32"
            style="color: var(--color-primary)"
            class="animate-spin"
          />
        </div>
      } @else if (facade.error()) {
        <app-alert-card title="Error al cargar horario" severity="error">
          {{ facade.error() }}
        </app-alert-card>
      } @else {
        <app-weekly-schedule-grid
          [schedule]="facade.weeklySchedule()"
          (prevWeek)="changeWeek(-1)"
          (nextWeek)="changeWeek(1)"
          (today)="resetToToday()"
          (blockClick)="onBlockClick($event)"
        />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div class="card p-6">
            <h3 class="text-sm font-bold uppercase tracking-wider text-text-muted mb-4">
              Información Útil
            </h3>
            <ul class="space-y-3 text-sm text-text-primary">
              <li class="flex items-start gap-2">
                <app-icon name="info" [size]="16" class="text-brand-primary shrink-0 mt-0.5" />
                <span
                  >El horario se actualiza automáticamente según las asignaciones de
                  secretaría.</span
                >
              </li>
              <li class="flex items-start gap-2">
                <app-icon name="info" [size]="16" class="text-brand-primary shrink-0 mt-0.5" />
                <span
                  >Las clases agendadas están marcadas en azul. En Curso en amarillo y completadas
                  en verde.</span
                >
              </li>
            </ul>
          </div>
        </div>
      }
    </div>
  `,
})
export class InstructorHorarioComponent implements OnInit, AfterViewInit {
  public facade = inject(InstructorHorasFacade);
  private gsap = inject(GsapAnimationsService);

  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroRef');

  private currentWeekDate: string = new Date().toISOString();

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
  }

  resetToToday() {
    this.currentWeekDate = new Date().toISOString();
    this.facade.fetchWeeklySchedule(this.currentWeekDate);
  }

  onBlockClick(block: ScheduleBlock) {
    if (block.sessionId) {
      console.log('Clic en clase', block);
    }
  }
}
