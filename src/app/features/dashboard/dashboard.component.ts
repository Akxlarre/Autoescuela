import { TooltipModule } from 'primeng/tooltip';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  ElementRef,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { TabsComponent, type TabOption } from '@shared/components/tabs/tabs.component';
import { ExecPeriodFilterComponent } from '@shared/components/exec-period-filter/exec-period-filter.component';
import { LineComparisonChartComponent } from '@shared/components/line-comparison-chart/line-comparison-chart.component';
import { InstructorHoursTableComponent } from '@shared/components/instructor-hours-table/instructor-hours-table.component';
import { StudentStagesPanelComponent } from '@shared/components/student-stages-panel/student-stages-panel.component';
import { ReceivablesAgingPanelComponent } from '@shared/components/receivables-aging-panel/receivables-aging-panel.component';
import { TodayOpsStripComponent } from '@shared/components/today-ops-strip/today-ops-strip.component';
import { ExecutiveDashboardFacade } from '@core/facades/executive-dashboard.facade';
import { DashboardAlertsFacade } from '@core/facades/dashboard-alerts.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutService } from '@core/services/ui/layout.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { ExecRangeChange } from '@core/models/ui/executive-dashboard.model';
import {
  buildExecKpiCards,
  chileTodayIso,
  describeRange,
  toHeroKpi,
} from '@core/utils/executive-dashboard.utils';
import { AlertsDrawerComponent } from './alerts-drawer/alerts-drawer.component';

type ExecTab = 'tendencias' | 'instructores' | 'alumnos' | 'hoy';

/**
 * Dashboard Ejecutivo de Admin (spec 0044-b) — `/admin/dashboard`.
 *
 * Vista de negocio para el dueño: KPIs financieros y operativos de Clase B con comparación
 * contra el período anterior y el año anterior, tendencias de 12 meses, productividad de
 * instructores, estado de alumnos, cartera y un resumen compacto de la operación de hoy.
 *
 * App-like: hero + 2 filas de KPIs + una celda .bento-fill con tabs que scrollea por dentro.
 * El dashboard de secretaría es otro componente y no cambia (AC21).
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dashboard.component.scss',
  imports: [
    TooltipModule,
    BentoGridLayoutDirective,
    IconComponent,
    SectionHeroComponent,
    EmptyStateComponent,
    KpiCardVariantComponent,
    TabsComponent,
    ExecPeriodFilterComponent,
    LineComparisonChartComponent,
    InstructorHoursTableComponent,
    StudentStagesPanelComponent,
    ReceivablesAgingPanelComponent,
    TodayOpsStripComponent,
  ],
  template: `
    <section
      class="bento-grid bento-grid--fill-screen-kpi exec-grid w-full"
      [class.force-compact]="isDrawerOpen()"
      appBentoGridLayout
      #bentoGrid
      aria-label="Dashboard ejecutivo"
    >
      <!-- ── Hero slim: título + contexto (sede y período) ── -->
      <app-section-hero
        title="Dashboard ejecutivo"
        [contextLine]="contextLine()"
        [actions]="[]"
        [animateOnInit]="false"
        density="slim"
        [kpis]="heroKpis()"
        [loading]="kpisLoading()"
        [loadingKpiCount]="4"
      />

      <!-- ── KPIs (2 filas × 4) ── -->
      @if (facade.sectionError('kpis') && !facade.kpis()) {
        <div class="bento-banner card flex items-center justify-center">
          <app-empty-state
            icon="triangle-alert"
            message="No se pudieron cargar los indicadores"
            [subtitle]="facade.sectionError('kpis') ?? ''"
            actionLabel="Reintentar"
            actionIcon="refresh-cw"
            (action)="retry()"
          />
        </div>
      } @else {
        <div class="bento-banner flex flex-col gap-3">
          <!-- Filtro de período: vive acá porque el hero slim no proyecta contenido -->
          <div class="flex flex-wrap items-end justify-between gap-2">
            <p class="micro-label m-0">Indicadores del período · Clase B</p>
            <app-exec-period-filter
              [preset]="facade.preset()"
              [range]="facade.range()"
              [today]="today"
              (rangeChange)="onRangeChange($event)"
            />
          </div>
          <div class="exec-kpis">
            @for (card of financeCards(); track card.id; let first = $first) {
              <div class="exec-kpi" [pTooltip]="card.tooltip" tooltipPosition="bottom">
                <app-kpi-card-variant
                  [label]="card.label"
                  [value]="card.value"
                  [prefix]="card.prefix"
                  [suffix]="card.suffix"
                  [icon]="card.icon"
                  [color]="card.color"
                  [accent]="first"
                  [trend]="card.trend"
                  [trendLabel]="card.trendLabel"
                  [secondaryTrend]="card.secondaryTrend"
                  [secondaryTrendLabel]="card.secondaryTrendLabel"
                  [invertTrend]="card.invertTrend"
                  [subValue]="card.subValue"
                  [compact]="true"
                  [loading]="kpisLoading()"
                />
              </div>
            } @empty {
              @for (i of placeholderCards; track i) {
                <div class="exec-kpi">
                  <app-kpi-card-variant label="" [value]="0" [compact]="true" [loading]="true" />
                </div>
              }
            }
          </div>
        </div>
      }

      <!-- ── Celda protagonista: tabs con scroll interno ── -->
      <div class="bento-banner bento-card bento-fill flex flex-col min-h-0 overflow-hidden">
        <div class="shrink-0 border-b border-border-subtle mb-4">
          <app-tabs [tabs]="tabs" [activeId]="activeTab()" (activeIdChange)="setTab($event)" />
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto pr-1">
          @switch (activeTab()) {
            @case ('tendencias') {
              @if (facade.sectionError('series')) {
                <div class="h-full flex items-center justify-center">
                  <app-empty-state
                    icon="triangle-alert"
                    message="No se pudieron cargar las tendencias"
                    actionLabel="Reintentar"
                    actionIcon="refresh-cw"
                    (action)="retry()"
                  />
                </div>
              } @else {
                <div class="exec-split" [class.exec-split--row]="isDesktopLayout()">
                  <app-line-comparison-chart
                    class="exec-split__item"
                    title="Ventas mensuales Clase B"
                    subtitle="Pagos recibidos por mes"
                    [points]="facade.series()?.ingresos ?? []"
                    [currentYear]="seriesYear()"
                    [money]="true"
                    [loading]="loading()"
                  />
                  <app-line-comparison-chart
                    class="exec-split__item"
                    title="Matrículas y estacionalidad"
                    subtitle="Nuevas matrículas Clase B por mes"
                    [points]="facade.series()?.matriculas ?? []"
                    [currentYear]="seriesYear()"
                    [loading]="loading()"
                  />
                </div>
              }
            }
            @case ('instructores') {
              @if (facade.sectionError('instructores')) {
                <div class="h-full flex items-center justify-center">
                  <app-empty-state
                    icon="triangle-alert"
                    message="No se pudieron cargar las horas de instrucción"
                    actionLabel="Reintentar"
                    actionIcon="refresh-cw"
                    (action)="retry()"
                  />
                </div>
              } @else {
                <app-instructor-hours-table
                  class="h-full"
                  [rows]="facade.instructorHours()"
                  [loading]="loading()"
                />
              }
            }
            @case ('alumnos') {
              <div class="exec-split" [class.exec-split--row]="isDesktopLayout()">
                <app-student-stages-panel
                  class="exec-split__item"
                  [stages]="facade.stages()"
                  [examPassRate]="facade.kpis()?.aprobacionEnsayosPct ?? null"
                  [loading]="loading()"
                />
                @if (facade.sectionError('cartera')) {
                  <div class="exec-split__item flex items-center justify-center">
                    <app-empty-state
                      icon="triangle-alert"
                      message="No se pudo cargar la cartera"
                      actionLabel="Reintentar"
                      actionIcon="refresh-cw"
                      (action)="retry()"
                    />
                  </div>
                } @else {
                  <app-receivables-aging-panel
                    class="exec-split__item"
                    [summary]="facade.receivables()"
                    [loading]="loading()"
                  />
                }
              </div>
            }
            @case ('hoy') {
              <div class="exec-split" [class.exec-split--row]="isDesktopLayout()">
                @if (facade.sectionError('hoy')) {
                  <div class="exec-split__item flex items-center justify-center">
                    <app-empty-state
                      icon="triangle-alert"
                      message="No se pudo cargar la operación de hoy"
                      actionLabel="Reintentar"
                      actionIcon="refresh-cw"
                      (action)="retry()"
                    />
                  </div>
                } @else {
                  <app-today-ops-strip
                    class="exec-split__item"
                    [ops]="facade.todayOps()"
                    [loading]="loading()"
                  />
                }

                <div class="exec-split__item flex flex-col min-h-0">
                  <div class="flex items-center justify-between gap-2 mb-3 shrink-0">
                    <div class="flex items-center gap-2">
                      <app-icon name="bell" [size]="16" class="text-text-secondary" />
                      <h2 class="item-title m-0">Alertas</h2>
                    </div>
                    @if (alerts().length) {
                      <button
                        class="btn-ghost cursor-pointer"
                        (click)="openAlerts()"
                        data-llm-action="ver-todas-alertas-dashboard"
                      >
                        Ver todas
                      </button>
                    }
                  </div>
                  <ul class="m-0 p-0 list-none flex flex-col gap-1">
                    @for (alert of visibleAlerts(); track alert.id) {
                      <li
                        class="flex items-start gap-3 py-2 border-b last:border-b-0 border-border-subtle"
                      >
                        <app-icon
                          [name]="alertIcon(alert.severity)"
                          [size]="14"
                          class="shrink-0 mt-0.5"
                          [style.color]="alertColor(alert.severity)"
                        />
                        <div class="flex-1 min-w-0">
                          <p class="m-0 text-sm text-text-primary truncate">{{ alert.title }}</p>
                          <p class="m-0 text-xs text-text-muted truncate">
                            {{ alert.description }}
                          </p>
                        </div>
                      </li>
                    } @empty {
                      <li class="py-4">
                        <app-empty-state
                          icon="bell"
                          message="Todo en orden"
                          subtitle="No hay alertas importantes por revisar."
                        />
                      </li>
                    }
                  </ul>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </section>
  `,
})
export class DashboardComponent {
  protected readonly facade = inject(ExecutiveDashboardFacade);
  private readonly alertsFacade = inject(DashboardAlertsFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutService = inject(LayoutService);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  protected readonly today = chileTodayIso();
  protected readonly placeholderCards = [1, 2, 3, 4];

  protected readonly tabs: TabOption[] = [
    { id: 'tendencias', label: 'Tendencias', icon: 'trending-up' },
    { id: 'instructores', label: 'Instructores', icon: 'users' },
    { id: 'alumnos', label: 'Alumnos y cartera', shortLabel: 'Alumnos', icon: 'graduation-cap' },
    { id: 'hoy', label: 'Operación de hoy', shortLabel: 'Hoy', icon: 'calendar-clock' },
  ];
  protected readonly activeTab = signal<ExecTab>('tendencias');

  // ── Estado derivado ─────────────────────────────────────────────────────────
  protected readonly loading = computed(() => this.facade.isLoading());
  protected readonly kpisLoading = computed(() => this.loading() && !this.facade.kpis());
  protected readonly isDrawerOpen = computed(() => this.layoutDrawer.isOpen());
  /** Switch de layout por CONTENEDOR (visual-system: nunca por lg: de Tailwind). */
  protected readonly isDesktopLayout = computed(() => this.layoutService.tier() === 'desktop');

  protected readonly kpiCards = computed(() => {
    const kpis = this.facade.kpis();
    return kpis ? buildExecKpiCards(kpis, this.facade.receivables()) : [];
  });
  /** Plata (ingresos, gastos, resultado, cartera) → tarjetas grandes. */
  protected readonly financeCards = computed(() => this.kpiCards().slice(0, 4));
  /** Operación (matrículas, alumnos, clases, cancelación) → tira de KPIs del hero slim. */
  protected readonly heroKpis = computed(() => this.kpiCards().slice(4).map(toHeroKpi));

  protected readonly seriesYear = computed(
    () => this.facade.series()?.currentYear ?? Number(this.facade.range().to.slice(0, 4)),
  );

  protected readonly contextLine = computed(() => {
    const branchId = this.branchFacade.selectedBranchId();
    const sede = branchId === null ? 'Todas las escuelas' : this.branchFacade.selectedBranchLabel();
    return `Clase B · ${sede} · ${describeRange(this.facade.range())}`;
  });

  protected readonly alerts = computed(() => this.alertsFacade.activeAlerts());
  protected readonly visibleAlerts = computed(() => this.alerts().slice(0, 5));

  constructor() {
    // Branch-scoped (facades.md §7): recarga al cambiar de sede. SWR dentro del Facade.
    // Solo la sede es dependencia: reload()/initialize() leen signals (rango, datos) antes de su
    // primer await y, sin untracked(), cada cambio de período re-dispararía este effect (fix-173-b).
    effect(() => {
      this.branchFacade.selectedBranchId(); // tracking
      untracked(() => {
        void this.facade.reload();
        void this.alertsFacade.initialize();
      });
    });

    // Animar el grid una sola vez, cuando termina la primera carga.
    let gridAnimated = false;
    effect(() => {
      const ready = !this.loading();
      const el = this.bentoGrid()?.nativeElement;
      if (ready && el && !gridAnimated) {
        gridAnimated = true;
        Promise.resolve().then(() => this.gsap.animateBentoGrid(el));
      }
    });
  }

  protected onRangeChange(change: ExecRangeChange): void {
    void this.facade.applyRange(change.range, change.preset);
  }

  protected setTab(id: string): void {
    this.activeTab.set(id as ExecTab);
  }

  protected retry(): void {
    void this.facade.reload();
  }

  protected openAlerts(): void {
    this.layoutDrawer.open(AlertsDrawerComponent, 'Todas las Alertas', 'bell');
  }

  protected alertIcon(severity: string): string {
    if (severity === 'warning') return 'triangle-alert';
    if (severity === 'error') return 'circle-x';
    if (severity === 'success') return 'check-circle';
    return 'info';
  }

  protected alertColor(severity: string): string {
    if (severity === 'warning') return 'var(--state-warning)';
    if (severity === 'error') return 'var(--state-error)';
    if (severity === 'success') return 'var(--state-success)';
    return 'var(--text-secondary)';
  }
}
