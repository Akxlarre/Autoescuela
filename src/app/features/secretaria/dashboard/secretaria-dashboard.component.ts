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
import { Router } from '@angular/router';
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
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type {
  SectionHeroAction,
  SectionHeroChip,
  SectionHeroKpi,
} from '@core/models/ui/section-hero.model';
import type { LiveClassModel } from '@core/models/ui/dashboard.model';
import { to24hTime } from '@core/utils/date.utils';

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
  `,
  template: `
    <section class="bento-grid w-full" appBentoGridLayout #bentoGrid aria-label="Panel de control">
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
        class="bento-wide bento-card w-full"
        appCardHover
        appScrollReveal
        data-row-span="2"
        [classes]="liveClasses()"
        [loading]="loading()"
        (actionClick)="handleLiveClassAction($event)"
      />

      <!-- Actividad reciente -->
      <div
        class="bento-wide bento-card flex flex-col w-full"
        appCardHover
        [appScrollReveal]="{ delay: 0.1 }"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <app-icon name="activity" [size]="16" class="text-brand" />
            <h2 class="m-0 font-semibold text-text-primary">Actividad reciente</h2>
          </div>
          <button
            class="text-xs font-medium cursor-pointer border-none bg-transparent p-0 text-brand transition-colors hover:text-brand-hover"
            (click)="openRecentActivity()"
            data-llm-action="view-all-activity"
          >
            Ver todo
          </button>
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
          <ul
            class="m-0 p-0 list-none flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2"
          >
            @for (item of activities().slice(0, 4); track item.id; let i = $index) {
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
        }
      </div>

      <!-- Alertas Importantes -->
      <div
        class="bento-wide bento-card flex flex-col w-full"
        appCardHover
        [appScrollReveal]="{ delay: 0.2 }"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <app-icon name="bell" [size]="16" class="text-warning" />
            <h2 class="m-0 font-semibold text-text-primary">Alertas Importantes</h2>
          </div>
          <button
            class="text-xs font-medium cursor-pointer border-none bg-transparent p-0 text-brand transition-colors hover:text-brand-hover"
            (click)="openAlerts()"
            data-llm-action="view-all-alerts"
          >
            Ver todo
          </button>
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
          <ul
            class="m-0 p-0 list-none flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2"
          >
            @for (alert of alerts().slice(0, 3); track alert.id; let i = $index) {
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
  private readonly router = inject(Router);
  private readonly agendaFacade = inject(AgendaFacade);
  private readonly asistenciaFacade = inject(AsistenciaClaseBFacade);

  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  readonly loading = computed(() => this.dashboardFacade.loading());
  readonly hero = computed(() => this.dashboardFacade.data()?.hero);
  readonly kpis = computed(() => this.dashboardFacade.data()?.kpis ?? []);
  readonly activities = computed(() => this.dashboardFacade.data()?.activities ?? []);
  readonly quickActions = computed(() => this.dashboardFacade.data()?.quickActions ?? []);
  readonly alerts = computed(() => this.dashboardAlertsFacade.activeAlerts());
  readonly liveClasses = computed(() => this.dashboardFacade.data()?.liveClasses ?? []);

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
    this.quickActions().map((a, i) => ({
      id: a.id,
      label: a.label,
      icon: a.icon,
      primary: i === 0,
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
      void this.router.navigate(['app/secretaria/pagos']);
    }
  }

  async handleLiveClassAction(cls: LiveClassModel): Promise<void> {
    if (cls.type === 'practical' && cls.status === 'pending') {
      const localTime = to24hTime(cls.scheduledAt);
      const row: any = {
        id: cls.originalId,
        classNumber: cls.classNumber,
        alumnoName: cls.studentName,
        instructorName: cls.instructorName,
        horaInicio: localTime,
        status: 'pendiente',
        vehicleBrand: cls.vehicleBrand,
        vehicleModel: cls.vehicleModel,
        vehiclePlate: cls.vehiclePlate,
      };
      this.asistenciaFacade.selectPractica(row);
      const { AdminIniciarClaseDrawerComponent } =
        await import('../../admin/asistencia/admin-iniciar-clase-drawer.component');
      this.layoutDrawer.open(AdminIniciarClaseDrawerComponent, 'Iniciar Clase Práctica', 'play');
    } else {
      const slot: any = {
        id: cls.id,
        date: cls.scheduledAt.split('T')[0],
        startTime: cls.scheduledAt.split('T')[1].substring(0, 5),
        endTime: '',
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
