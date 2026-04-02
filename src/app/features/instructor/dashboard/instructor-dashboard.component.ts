import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { InstructorClasesFacade } from '@core/facades/instructor-clases.facade';
import { InstructorProfileFacade } from '@core/facades/instructor-profile.facade';
import { InstructorHorasFacade } from '@core/facades/instructor-horas.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

@Component({
  selector: 'app-instructor-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TagModule,
    SectionHeroComponent,
    KpiCardVariantComponent,
    EmptyStateComponent,
    AlertCardComponent,
    IconComponent,
    SkeletonBlockComponent,
    BentoGridLayoutDirective,
  ],
  template: `
    <div class="px-6 py-6 pb-20 max-w-7xl mx-auto space-y-6">
      <!-- HERO -->
      <app-section-hero
        #heroRef
        title="Mi Día"
        subtitle="Resumen de tus clases programadas para hoy"
        [actions]="heroActions"
      />

      <!-- KPIs -->
      <div class="bento-grid" appBentoGridLayout #bentoGrid>
        <div class="bento-square">
          <app-kpi-card-variant
            label="Clases de Hoy"
            [value]="clasesFacade.kpis().clasesHoy"
            icon="calendar"
            [loading]="clasesFacade.isLoading()"
          />
        </div>

        <!-- KPI Próxima: muestra hora (texto), no número -->
        <div class="bento-square">
          @if (clasesFacade.isLoading()) {
            <div class="bento-card flex flex-col gap-2 h-full">
              <div class="flex items-start justify-between gap-3 mb-2">
                <app-skeleton-block variant="text" width="60%" height="12px" />
              </div>
              <app-skeleton-block variant="rect" width="80%" height="40px" />
              <div class="flex items-center gap-2 mt-auto pt-2">
                <app-skeleton-block variant="text" width="40%" height="12px" />
              </div>
            </div>
          } @else {
            <div class="bento-card flex flex-col gap-2 h-full">
              <div class="flex items-start justify-between gap-3 mb-2">
                <span class="text-xs font-semibold" style="color: var(--color-primary)">PRÓXIMA</span>
              </div>
              <p class="flex items-baseline gap-1 m-0 truncate">
                <span class="text-3xl md:text-4xl font-bold" style="color: var(--ds-brand)">
                  {{ proximaHora() }}
                </span>
              </p>
              @if (clasesFacade.nextClass(); as next) {
                <div class="flex items-center gap-1 mt-auto flex-wrap pt-2">
                  <span class="text-xs truncate" style="color: var(--text-muted)">{{ next.studentName }}</span>
                </div>
              }
            </div>
          }
        </div>

        <div class="bento-square">
          <app-kpi-card-variant
            label="Completadas (Mes)"
            [value]="completadasMes()"
            icon="check-circle"
            color="success"
            [loading]="horasFacade.isLoading()"
          />
        </div>

        <div class="bento-square">
          <app-kpi-card-variant
            label="Horas Este Mes"
            [value]="horasFacade.liquidacionKpis().totalHorasMes"
            suffix=" hrs"
            icon="clock"
            [loading]="horasFacade.isLoading()"
          />
        </div>
      </div>

      <!-- Main grid: clases + sidebar -->
      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Lista de clases del día (col-span-2) -->
        <div class="lg:col-span-2">
          <div class="card p-0 overflow-hidden">
            <div class="px-6 py-4 border-b border-border-default flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
              <h2 class="text-lg font-semibold text-text-primary">Mis Clases de Hoy</h2>
              @if (profile.vehicle(); as v) {
                <div
                  class="flex items-center gap-2 bg-surface px-3 py-1.5 rounded border border-border-default text-sm text-text-muted w-fit"
                >
                  <app-icon name="car" [size]="16" class="text-brand" />
                  <span class="font-medium text-text-primary">{{ v.plate }} — {{ v.label }}</span>
                </div>
              }
            </div>

            @if (clasesFacade.isLoading()) {
              <div class="p-8 flex justify-center">
                <app-icon
                  name="loader-2"
                  [size]="32"
                  class="text-brand animate-spin"
                />
              </div>
            } @else if (clasesFacade.error()) {
              <div class="p-6">
                <app-alert-card title="Error al cargar clases" severity="error">{{
                  clasesFacade.error()
                }}</app-alert-card>
              </div>
            } @else if (clasesFacade.todayClasses().length === 0) {
              <app-empty-state
                icon="calendar-check"
                message="No tienes clases hoy"
                subtitle="Disfruta tu día libre o revisa tu horario para ver tus próximas clases."
                actionLabel="Ver mi horario semanal"
                actionIcon="calendar"
              />
            } @else {
              <div class="divide-y divide-border-default">
                @for (cls of clasesFacade.todayClasses(); track cls.sessionId) {
                  <div
                    class="p-4 sm:px-6 hover:bg-elevated transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-4"
                    [class.bg-brand-muted]="cls.status === 'in_progress'"
                  >
                    <!-- Hora + tipo + info -->
                    <div class="flex items-start gap-4">
                      <!-- Hora Box -->
                      <div
                        class="w-14 h-14 rounded-lg bg-elevated border border-border-default flex flex-col items-center justify-center shrink-0 shadow-sm"
                      >
                        <span class="text-sm font-bold text-text-primary leading-none">{{
                          cls.timeLabel.split(' - ')[0]
                        }}</span>
                      </div>
                      
                      <!-- Detalle Alumno -->
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1.5">
                          <span
                            class="text-xs px-2.5 py-0.5 rounded-full font-semibold tracking-wide uppercase"
                            style="background: color-mix(in srgb, var(--state-success) 15%, transparent); color: var(--state-success)"
                          >
                            Práctica
                          </span>
                          <p-tag [value]="cls.statusLabel" [severity]="$any(cls.statusColor)" />
                        </div>
                        <h3 class="font-bold text-base text-text-primary">{{ cls.studentName }}</h3>
                        
                        <div
                          class="flex flex-col sm:flex-row sm:flex-wrap gap-1.5 sm:gap-x-4 sm:gap-y-1 mt-1.5 text-sm text-text-muted"
                        >
                          <span class="flex items-center gap-1.5">
                            <app-icon name="clock" [size]="14" />
                            {{ cls.timeLabel }}
                          </span>
                          <span class="flex items-center gap-1.5">
                            <app-icon name="car" [size]="14" />
                            {{ cls.vehiclePlate }}
                          </span>
                          @if (cls.evaluationGrade) {
                            <span class="flex items-center gap-1.5">
                              <app-icon
                                name="star"
                                [size]="14"
                                style="color: var(--state-warning)"
                              />
                              Nota: {{ cls.evaluationGrade }}
                            </span>
                          }
                        </div>
                      </div>
                    </div>

                    <!-- Acciones -->
                    <div
                      class="grid grid-cols-1 sm:flex items-center justify-end gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0"
                    >
                      @if (cls.canStart) {
                        <a
                          [routerLink]="['/app/instructor/clase/iniciar']"
                          [queryParams]="{ sessionId: cls.sessionId }"
                          class="btn-primary w-full sm:w-auto justify-center"
                          data-llm-action="start-class"
                        >
                          <app-icon name="play" [size]="16" />
                          <span>Iniciar</span>
                        </a>
                      }
                      @if (cls.canFinish) {
                        <a
                          [routerLink]="['/app/instructor/clase', cls.sessionId]"
                          class="btn-primary w-full sm:w-auto justify-center animate-pulse"
                          data-llm-action="finish-class"
                        >
                          <app-icon name="external-link" [size]="16" />
                          <span>En Curso</span>
                        </a>
                      }
                      @if (cls.status === 'completed') {
                        <a
                          [routerLink]="['/app/instructor/alumnos', cls.studentId, 'ficha']"
                          class="btn-secondary w-full sm:w-auto justify-center"
                        >
                          <app-icon name="file-text" [size]="16" />
                          <span>Ver Ficha</span>
                        </a>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-4">
          <!-- Próximas Clases -->
          <div class="card p-6">
            <h3 class="text-sm font-bold uppercase tracking-wider text-text-muted mb-4">
              Próximas Clases
            </h3>
            @if (clasesFacade.upcomingDays().length === 0) {
              <p class="text-sm text-text-muted">Sin clases programadas los próximos días</p>
            } @else {
              <div class="space-y-3">
                @for (dia of clasesFacade.upcomingDays(); track dia.fecha) {
                  <div
                    class="flex items-center justify-between p-3 bg-surface rounded border border-border-default"
                  >
                    <p class="text-sm font-medium text-text-primary">{{ dia.fechaLabel }}</p>
                    <span class="text-lg font-bold" style="color: var(--ds-brand)">{{
                      dia.cantidad
                    }}</span>
                  </div>
                }
              </div>
            }
          </div>



          <!-- Recordatorio -->
          <app-alert-card title="Recordatorio" severity="info">
            Recuerda completar las fichas técnicas después de cada clase práctica.
          </app-alert-card>
        </div>
      </div>
    </div>
  `,
})
export class InstructorDashboardComponent implements OnInit, AfterViewInit {
  public clasesFacade = inject(InstructorClasesFacade);
  public profile = inject(InstructorProfileFacade);
  public horasFacade = inject(InstructorHorasFacade);
  private gsap = inject(GsapAnimationsService);
  private destroyRef = inject(DestroyRef);

  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroRef');
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  readonly proximaHora = computed(() => {
    const t = this.clasesFacade.nextClass()?.timeLabel;
    return t ? t.split(' - ')[0] : '--';
  });

  readonly completadasMes = computed(
    () => this.horasFacade.monthlyHours()[0]?.practicalSessions ?? 0,
  );

  readonly heroActions: SectionHeroAction[] = [
    {
      id: 'alumnos',
      label: 'Mis Alumnos',
      icon: 'users',
      primary: false,
      route: '/app/instructor/alumnos',
    },
    {
      id: 'liquidacion',
      label: 'Mis Horas',
      icon: 'file-text',
      primary: false,
      route: '/app/instructor/liquidacion',
    },
    {
      id: 'horario',
      label: 'Ver Horario',
      icon: 'calendar',
      primary: true,
      route: '/app/instructor/horario',
    },
  ];

  async ngOnInit() {
    await this.profile.initialize();
    await this.clasesFacade.initialize();
    await Promise.all([
      this.horasFacade.fetchMonthlyHours(),
      this.clasesFacade.fetchUpcomingDays(),
    ]);
    this.destroyRef.onDestroy(() => this.clasesFacade.dispose());
  }

  ngAfterViewInit() {
    requestAnimationFrame(() => {
      const hero = this.heroRef();
      if (hero) this.gsap.animateHero(hero.nativeElement);

      const grid = this.bentoGrid();
      if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
    });
  }
}
