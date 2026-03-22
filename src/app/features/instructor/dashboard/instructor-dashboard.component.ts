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
      <section class="bento-hero surface-hero rounded-xl" #heroRef>
        <app-section-hero
          title="Mi Día"
          subtitle="Resumen de tus clases programadas para hoy"
          [actions]="heroActions"
        />
      </section>

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
            <div class="card h-full p-6 flex flex-col gap-3">
              <app-skeleton-block variant="text" width="50%" height="12px" />
              <app-skeleton-block variant="text" width="70%" height="28px" />
            </div>
          } @else {
            <div class="card h-full p-6 flex flex-col justify-center">
              <span class="kpi-label">Próxima</span>
              <span class="kpi-value" style="color: var(--ds-brand)">{{ proximaHora() }}</span>
              @if (clasesFacade.nextClass(); as next) {
                <span class="text-xs text-text-muted mt-1 truncate">{{ next.studentName }}</span>
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
            <div class="px-6 py-4 border-b border-divider flex items-center justify-between">
              <h2 class="text-lg font-semibold text-text-primary">Mis Clases de Hoy</h2>
              @if (profile.vehicle(); as v) {
                <div
                  class="flex items-center gap-2 bg-surface px-3 py-1.5 rounded border border-divider text-sm text-text-muted"
                >
                  <app-icon name="car" [size]="16" style="color: var(--color-primary)" />
                  <span class="font-medium text-text-primary">{{ v.plate }} — {{ v.label }}</span>
                </div>
              }
            </div>

            @if (clasesFacade.isLoading()) {
              <div class="p-8 flex justify-center">
                <app-icon
                  name="loader-2"
                  [size]="32"
                  style="color: var(--color-primary)"
                  class="animate-spin"
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
              <div class="divide-y divide-divider">
                @for (cls of clasesFacade.todayClasses(); track cls.sessionId) {
                  <div
                    class="p-4 sm:px-6 hover:bg-surface-hover transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    [class.bg-brand-muted]="cls.status === 'in_progress'"
                  >
                    <!-- Hora + tipo + info -->
                    <div class="flex items-start gap-4">
                      <div
                        class="w-14 h-14 rounded-lg bg-surface-elevated border border-divider flex flex-col items-center justify-center shrink-0"
                      >
                        <span class="text-sm font-bold text-text-primary leading-none">{{
                          cls.timeLabel.split(' - ')[0]
                        }}</span>
                      </div>
                      <div>
                        <div class="flex items-center gap-2 mb-1">
                          <span
                            class="text-xs px-2 py-0.5 rounded-full font-medium"
                            style="background: color-mix(in srgb, var(--state-success) 15%, transparent); color: var(--state-success)"
                          >
                            Práctica
                          </span>
                          <p-tag [value]="cls.statusLabel" [severity]="$any(cls.statusColor)" />
                        </div>
                        <h3 class="font-semibold text-text-primary">{{ cls.studentName }}</h3>
                        <div
                          class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-text-muted"
                        >
                          <span class="flex items-center gap-1">
                            <app-icon name="clock" [size]="14" />
                            {{ cls.timeLabel }}
                          </span>
                          <span class="flex items-center gap-1">
                            <app-icon name="car" [size]="14" />
                            {{ cls.vehiclePlate }}
                          </span>
                          @if (cls.evaluationGrade) {
                            <span class="flex items-center gap-1">
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
                      class="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0"
                    >
                      @if (cls.canStart) {
                        <a
                          [routerLink]="['/app/instructor/clase/iniciar']"
                          [queryParams]="{ sessionId: cls.sessionId }"
                          class="btn btn-primary btn-sm"
                          data-llm-action="start-class"
                        >
                          <app-icon name="play" [size]="16" />
                          <span class="hidden sm:inline ml-1">Iniciar</span>
                        </a>
                      }
                      @if (cls.canFinish) {
                        <a
                          [routerLink]="['/app/instructor/clase', cls.sessionId]"
                          class="btn btn-primary btn-sm animate-pulse"
                          data-llm-action="finish-class"
                        >
                          <app-icon name="square" [size]="16" />
                          <span class="hidden sm:inline ml-1">En Curso</span>
                        </a>
                      }
                      @if (cls.status === 'completed') {
                        <a
                          [routerLink]="['/app/instructor/alumnos', cls.studentId, 'ficha']"
                          class="btn btn-outline btn-sm"
                        >
                          <app-icon name="file-text" [size]="16" />
                          <span class="hidden sm:inline ml-1">Ver Ficha</span>
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
                    class="flex items-center justify-between p-3 bg-surface rounded border border-divider"
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

          <!-- Accesos Rápidos -->
          <div class="card p-6">
            <h3 class="text-sm font-bold uppercase tracking-wider text-text-muted mb-4">
              Accesos Rápidos
            </h3>
            <div class="space-y-2">
              <a
                routerLink="/app/instructor/horario"
                class="btn btn-outline w-full justify-start gap-2"
                data-llm-nav="instructor-horario"
              >
                <app-icon name="calendar" [size]="16" />
                Mi Horario Completo
              </a>
              <a
                routerLink="/app/instructor/liquidacion"
                class="btn btn-outline w-full justify-start gap-2"
                data-llm-nav="instructor-liquidacion"
              >
                <app-icon name="file-text" [size]="16" />
                Mis Horas del Mes
              </a>
              <a
                routerLink="/app/instructor/alumnos"
                class="btn btn-outline w-full justify-start gap-2"
                data-llm-nav="instructor-alumnos"
              >
                <app-icon name="users" [size]="16" />
                Mis Alumnos
              </a>
            </div>
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
    const hero = this.heroRef();
    if (hero) this.gsap.animateHero(hero.nativeElement);
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }
}
