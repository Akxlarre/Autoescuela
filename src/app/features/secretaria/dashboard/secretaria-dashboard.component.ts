import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnInit,
  viewChild,
} from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { ScrollRevealDirective } from '@core/directives/scroll-reveal.directive';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { LiveClassesPanelComponent } from '@shared/components/live-classes-panel/live-classes-panel.component';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { DashboardAlertsFacade } from '@core/facades/dashboard-alerts.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { AgendaFacade } from '@core/facades/agenda.facade';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { PagosFacade } from '@core/facades/pagos.facade';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { LayoutService } from '@core/services/ui/layout.service';
import { sliceByBudget } from '@core/utils/layout-tier.utils';
import type {
  SectionHeroAction,
  SectionHeroChip,
  SectionHeroKpi,
} from '@core/models/ui/section-hero.model';
import type { LiveClassModel } from '@core/models/ui/dashboard.model';
import { to24hTime, addMinutesToTime } from '@core/utils/date.utils';
import { resolveLiveClassActionPlan } from '@core/utils/live-class-action.utils';

@Component({
  selector: 'app-secretaria-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TooltipModule,
    BentoGridLayoutDirective,
    CardHoverDirective,
    ScrollRevealDirective,
    AnimateInDirective,
    IconComponent,
    SectionHeroComponent,
    EmptyStateComponent,
    LiveClassesPanelComponent,
  ],
  styles: `
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background-color: var(--border-subtle);
      border-radius: 4px;
    }
    .custom-scrollbar:hover::-webkit-scrollbar-thumb {
      background-color: var(--text-muted);
    }

    /* Fade inferior: insinúa que la lista tiene más contenido para scrollear */
    .scroll-fade {
      position: relative;
    }
    .scroll-fade::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 28px;
      background: linear-gradient(to bottom, transparent, var(--card-bg));
      pointer-events: none;
    }
  `,
  template: `
    <section
      class="bento-grid bento-grid--fill-screen-2 w-full"
      [class.force-compact]="isDrawerOpen()"
      appBentoGridLayout
      #bentoGrid
      aria-label="Panel de control"
    >
      <app-section-hero
        [title]="heroSectionTitle()"
        [contextLine]="heroContextLine()"
        [chips]="heroChips()"
        [actions]="heroActions()"
        [animateOnInit]="false"
        density="slim"
        [kpis]="heroKpis()"
        [loading]="loading()"
        (actionClick)="handleQuickAction($event)"
      />

      <app-live-classes-panel
        class="bento-wide bento-card bento-fill w-full"
        appCardHover
        appScrollReveal
        data-row-span-md="2"
        data-row-span="2"
        [classes]="liveClasses()"
        [loading]="loading()"
        [maxItems]="liveClassesBudget()"
        (actionClick)="handleLiveClassAction($event)"
        (viewAllClick)="openAgenda()"
      />

      <!-- Actividad reciente -->
      <div
        class="bento-wide bento-card bento-fill flex flex-col w-full h-full overflow-hidden"
        appCardHover
        [appScrollReveal]="{ delay: 0.1 }"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <app-icon name="activity" [size]="16" class="text-brand" />
            <h2 class="m-0 font-semibold text-text-primary">Actividad reciente</h2>
          </div>
        </div>

        @if (loading()) {
          <ul class="m-0 p-0 list-none flex flex-col gap-1 overflow-hidden">
            @for (i of [1, 2, 3, 4]; track i) {
              <li
                class="flex items-start gap-3 py-2.5 border-b last:border-b-0 border-border-subtle animate-pulse"
              >
                <div class="shrink-0 w-8 h-8 rounded-full bg-border-subtle"></div>
                <div class="flex-1 min-w-0 flex flex-col gap-2 py-1">
                  <div class="h-3.5 bg-border-subtle rounded w-2/3"></div>
                  <div class="h-2.5 bg-border-subtle rounded w-1/3"></div>
                </div>
              </li>
            }
          </ul>
        } @else {
          <div class="scroll-fade flex-1 min-h-0">
            <ul
              class="m-0 p-0 list-none flex flex-col gap-1 h-full overflow-y-auto custom-scrollbar pr-2"
            >
              @for (item of visibleActivities(); track item.id; let i = $index) {
                <li
                  class="flex items-start gap-3 py-2.5 border-b last:border-b-0 border-border-subtle"
                  [appAnimateIn]="{ delay: 0.2 + i * 0.05 }"
                >
                  <div
                    class="shrink-0 flex items-center justify-center w-8 h-8 rounded-full"
                    [style.background]="item.iconBg"
                    [style.color]="item.iconColor"
                  >
                    <app-icon [name]="item.icon" [size]="14" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="m-0 text-sm font-medium text-text-primary truncate"
                      [pTooltip]="item.title"
                      tooltipPosition="top"
                    >
                      {{ item.title }}
                    </p>
                    <p
                      class="m-0 text-xs text-text-muted truncate"
                      [pTooltip]="item.description"
                      tooltipPosition="bottom"
                    >
                      {{ item.description }}
                    </p>
                  </div>
                  <span class="shrink-0 text-xs text-text-muted self-center">{{ item.time }}</span>
                </li>
              } @empty {
                <li class="flex-1 flex flex-col justify-center py-6">
                  <app-empty-state
                    icon="activity"
                    message="Sin actividad reciente"
                    subtitle="Aún no hay registros en la escuela."
                  />
                </li>
              }
            </ul>
          </div>
          <!-- Footer fijo: siempre visible, fuera del área scrolleable -->
          <div class="pt-2 mt-1 border-t border-border-subtle shrink-0">
            <button
              class="btn-ghost w-full flex items-center justify-center font-medium transition-colors cursor-pointer"
              (click)="openRecentActivity()"
              data-llm-action="view-all-activity"
            >
              Ver toda la actividad
            </button>
          </div>
        }
      </div>

      <!-- Alertas Importantes -->
      <div
        class="bento-wide bento-card bento-fill flex flex-col w-full h-full overflow-hidden"
        appCardHover
        [appScrollReveal]="{ delay: 0.2 }"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <app-icon name="bell" [size]="16" class="text-warning" />
            <h2 class="m-0 font-semibold text-text-primary">Alertas Importantes</h2>
          </div>
        </div>

        @if (loading()) {
          <ul class="m-0 p-0 list-none flex flex-col gap-1 overflow-hidden">
            @for (i of [1, 2, 3]; track i) {
              <li
                class="flex items-start gap-3 py-2.5 border-b last:border-b-0 border-border-subtle animate-pulse"
              >
                <div class="shrink-0 w-8 h-8 rounded-full bg-border-subtle"></div>
                <div class="flex-1 min-w-0 flex flex-col gap-2 py-1">
                  <div class="h-3.5 bg-border-subtle rounded w-2/3"></div>
                  <div class="h-2.5 bg-border-subtle rounded w-1/3"></div>
                </div>
              </li>
            }
          </ul>
        } @else {
          <div class="scroll-fade flex-1 min-h-0">
            <ul
              class="m-0 p-0 list-none flex flex-col gap-1 h-full overflow-y-auto custom-scrollbar pr-2"
            >
              @for (alert of visibleAlerts(); track alert.id; let i = $index) {
                <li
                  class="flex items-start gap-3 py-2.5 border-b last:border-b-0 border-border-subtle"
                  [appAnimateIn]="{ delay: 0.2 + i * 0.05 }"
                >
                  <div
                    class="shrink-0 flex items-center justify-center w-8 h-8 rounded-full"
                    [style.background]="getAlertBg(alert.severity)"
                    [style.color]="getAlertColor(alert.severity)"
                  >
                    <app-icon [name]="getAlertIcon(alert.severity)" [size]="14" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="m-0 text-sm font-medium text-text-primary truncate"
                      [pTooltip]="alert.title"
                      tooltipPosition="top"
                    >
                      {{ alert.title }}
                    </p>
                    <p
                      class="m-0 text-xs text-text-muted truncate"
                      [pTooltip]="alert.description"
                      tooltipPosition="bottom"
                    >
                      {{ alert.description }}
                    </p>
                  </div>
                  <button
                    aria-label="Descartar"
                    class="shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-none bg-transparent cursor-pointer text-text-muted hover:bg-subtle hover:text-text-primary transition-colors self-center"
                    (click)="dashboardAlertsFacade.dismissAlert(alert.id)"
                    pTooltip="Descartar"
                  >
                    <app-icon name="x" [size]="12" />
                  </button>
                </li>
              } @empty {
                <li class="flex-1 flex flex-col justify-center py-6">
                  <app-empty-state
                    icon="bell"
                    message="Todo en orden"
                    subtitle="No hay alertas importantes por revisar."
                  />
                </li>
              }
            </ul>
          </div>
          <!-- Footer fijo: siempre visible, fuera del área scrolleable -->
          <div class="pt-2 mt-1 border-t border-border-subtle shrink-0">
            <button
              class="btn-ghost w-full flex items-center justify-center font-medium transition-colors cursor-pointer"
              (click)="openAlerts()"
              data-llm-action="view-all-alerts"
            >
              Ver todas las alertas
            </button>
          </div>
        }
      </div>
    </section>
  `,
})
export class SecretariaDashboardComponent implements OnInit {
  private readonly dashboardFacade = inject(DashboardFacade);
  protected readonly dashboardAlertsFacade = inject(DashboardAlertsFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly agendaFacade = inject(AgendaFacade);
  private readonly asistenciaFacade = inject(AsistenciaClaseBFacade);
  private readonly pagosFacade = inject(PagosFacade);
  private readonly cuadraturaFacade = inject(CuadraturaFacade);
  private readonly layoutService = inject(LayoutService);

  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  readonly loading = computed(() => this.dashboardFacade.loading());
  protected readonly isDrawerOpen = computed(() => this.layoutDrawer.isOpen());
  readonly hero = computed(() => this.dashboardFacade.data()?.hero);
  readonly kpis = computed(() => this.dashboardFacade.data()?.kpis ?? []);
  readonly activities = computed(() => this.dashboardFacade.data()?.activities ?? []);
  readonly quickActions = computed(() => this.dashboardFacade.data()?.quickActions ?? []);
  readonly alerts = computed(() => this.dashboardAlertsFacade.activeAlerts());
  readonly liveClasses = computed(() => this.dashboardFacade.data()?.liveClasses ?? []);

  // ── Densidad adaptativa (spec 0028, portado de dashboard.component.ts): ──
  // desktop = sin límite (scroll interno); tablet/mobile = resumen + "Ver todas".
  private readonly isDesktopTier = computed(() => this.layoutService.tier() === 'desktop');
  readonly liveClassesBudget = computed(() => (this.isDesktopTier() ? null : 4));
  readonly visibleActivities = computed(() =>
    sliceByBudget(this.activities(), this.isDesktopTier() ? null : 3),
  );
  readonly visibleAlerts = computed(() =>
    sliceByBudget(this.alerts(), this.isDesktopTier() ? null : 3),
  );

  readonly heroSectionTitle = computed(
    () => `¡Bienvenido, ${this.hero()?.userName ?? this.authFacade.currentUser()?.name ?? ''}!`,
  );
  readonly heroContextLine = computed(() => this.hero()?.date ?? '');

  readonly heroChips = computed((): SectionHeroChip[] => {
    const h = this.hero();
    if (!h) return [];
    const chips: SectionHeroChip[] = [
      { label: `${h.classesToday} clases programadas`, icon: 'book-open', style: 'default' },
    ];
    const alertCount = this.dashboardAlertsFacade.alertCount();
    if (alertCount > 0) {
      chips.push({
        label: `${alertCount} alertas urgentes`,
        icon: 'alert-triangle',
        style: 'error',
      });
    }
    return chips;
  });

  readonly heroActions = computed((): SectionHeroAction[] =>
    this.quickActions().map((a) => ({
      id: a.id,
      label: a.label,
      icon: a.icon,
      primary: a.id === 'qa1' || a.id === 'qa3',
      route: undefined,
    })),
  );

  readonly heroKpis = computed((): SectionHeroKpi[] =>
    this.kpis().map((k) => ({
      id: k.id,
      label: k.label,
      value: k.value,
      prefix: k.prefix,
      suffix: k.suffix,
      trend: k.trend,
      trendLabel: k.trendLabel,
      color: k.color as SectionHeroKpi['color'],
      icon: k.icon,
    })),
  );

  constructor() {
    effect(() => {
      const isReady = !this.loading();
      const el = this.bentoGrid()?.nativeElement;
      if (isReady && el) {
        Promise.resolve().then(() => this.gsap.animateBentoGrid(el));
      }
    });
  }

  ngOnInit(): void {
    void this.dashboardFacade.initialize();
    void this.dashboardAlertsFacade.initialize();
  }

  handleQuickAction(actionId: string): void {
    if (actionId === 'qa1') {
      void import('../../admin/matricula/admin-matricula.component').then(
        ({ AdminMatriculaComponent }) => {
          this.layoutDrawer.open(AdminMatriculaComponent, 'Nueva Matrícula', 'users');
        },
      );
    } else if (actionId === 'qa2') {
      void import('../../admin/agenda/admin-agenda.component').then(({ AdminAgendaComponent }) => {
        this.layoutDrawer.open(AdminAgendaComponent, 'Agenda Semanal', 'calendar-days');
      });
    } else if (actionId === 'qa3') {
      this.pagosFacade.seleccionarParaPago(null);
      void this.pagosFacade.initialize();
      void import('../../admin/pagos/registrar-pago-drawer.component').then(
        ({ RegistrarPagoDrawerComponent }) => {
          this.layoutDrawer.open(RegistrarPagoDrawerComponent, 'Registrar Pago', 'credit-card');
        },
      );
    } else if (actionId === 'qa4') {
      this.cuadraturaFacade.egresoTipoPreset.set('combustible');
      void import('../../admin/contabilidad-cuadratura/registrar-egreso-drawer.component').then(
        ({ RegistrarEgresoDrawerComponent }) => {
          this.layoutDrawer.open(RegistrarEgresoDrawerComponent, 'Registrar Egreso', 'wallet');
        },
      );
    }
  }

  async handleLiveClassAction(cls: LiveClassModel): Promise<void> {
    const plan = resolveLiveClassActionPlan(cls);

    if (plan.flow === 'iniciar') {
      this.asistenciaFacade.selectPractica(plan.row as any);
      const { AdminIniciarClaseDrawerComponent } =
        await import('../../admin/asistencia/admin-iniciar-clase-drawer.component');
      this.layoutDrawer.open(AdminIniciarClaseDrawerComponent, 'Iniciar Clase Práctica', 'play');
    } else if (plan.flow === 'finalizar') {
      this.asistenciaFacade.selectPractica(plan.row as any);
      const { AdminFinalizarClaseDrawerComponent } =
        await import('../../admin/asistencia/admin-finalizar-clase-drawer.component');
      this.layoutDrawer.open(AdminFinalizarClaseDrawerComponent, 'Finalizar Clase', 'flag');
    } else {
      const startTime = to24hTime(cls.scheduledAt);
      const slot: any = {
        id: cls.id,
        date: cls.scheduledAt.split('T')[0],
        startTime,
        endTime: addMinutesToTime(startTime, 45),
        status: cls.status,
        instructorId: 0,
        instructorName: cls.instructorName,
        vehicleId: 0,
        vehiclePlate: cls.vehicle || '',
        studentName: cls.studentName,
        classNumber: 0,
      };
      this.agendaFacade.setSelectedSlot(slot);
      const title = cls.studentName ? `Clase: ${cls.studentName}` : 'Detalle de clase';
      const { AgendaSlotDetailDrawerComponent } =
        await import('../../agenda/agenda-slot-detail-drawer.component');
      this.layoutDrawer.open(AgendaSlotDetailDrawerComponent, title, 'calendar-clock');
    }
  }

  async openRecentActivity(): Promise<void> {
    const { RecentActivityDrawerComponent } =
      await import('../../dashboard/recent-activity-drawer/recent-activity-drawer.component');
    this.layoutDrawer.open(RecentActivityDrawerComponent, 'Actividad Reciente', 'activity');
  }

  async openAlerts(): Promise<void> {
    const { AlertsDrawerComponent } =
      await import('../../dashboard/alerts-drawer/alerts-drawer.component');
    this.layoutDrawer.open(AlertsDrawerComponent, 'Todas las Alertas', 'bell');
  }

  async openAgenda(): Promise<void> {
    const { DailyAgendaDrawerComponent } =
      await import('../../dashboard/daily-agenda-drawer/daily-agenda-drawer.component');
    this.layoutDrawer.open(DailyAgendaDrawerComponent, 'Agenda de Hoy', 'calendar-clock');
  }

  getAlertIcon(severity: string): string {
    switch (severity) {
      case 'warning':
        return 'triangle-alert';
      case 'error':
        return 'octagon-alert';
      case 'success':
        return 'check-circle';
      default:
        return 'info';
    }
  }

  getAlertColor(severity: string): string {
    switch (severity) {
      case 'warning':
        return 'var(--state-warning)';
      case 'error':
        return 'var(--state-error)';
      case 'success':
        return 'var(--state-success)';
      default:
        return 'var(--text-primary)';
    }
  }

  getAlertBg(severity: string): string {
    switch (severity) {
      case 'warning':
        return 'var(--state-warning-bg)';
      case 'error':
        return 'var(--state-error-bg)';
      case 'success':
        return 'var(--state-success-bg)';
      default:
        return 'var(--bg-subtle)';
    }
  }
}
