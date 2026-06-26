import { TooltipModule } from 'primeng/tooltip';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  afterNextRender,
  ElementRef,
  viewChild,
} from '@angular/core';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { ScrollRevealDirective } from '@core/directives/scroll-reveal.directive';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import type {
  SectionHeroAction,
  SectionHeroChip,
  SectionHeroKpi,
} from '@core/models/ui/section-hero.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { DashboardAlertsFacade } from '@core/facades/dashboard-alerts.facade';
import { LiveClassModel } from '@core/models/ui/dashboard.model';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AdminMatriculaComponent } from '../admin/matricula/admin-matricula.component';
import { AdminAgendaComponent } from '../admin/agenda/admin-agenda.component';
import { RecentActivityDrawerComponent } from './recent-activity-drawer/recent-activity-drawer.component';
import { AlertsDrawerComponent } from './alerts-drawer/alerts-drawer.component';
import { LiveClassesPanelComponent } from '@shared/components/live-classes-panel/live-classes-panel.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { Router, RouterLink } from '@angular/router';
import { AgendaFacade } from '@core/facades/agenda.facade';
import { AgendaSlotDetailDrawerComponent } from '@features/agenda/agenda-slot-detail-drawer.component';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { to24hTime } from '@core/utils/date.utils';

/**
 * DashboardComponent — Página principal de la aplicación.
 *
 * Esta página es la REFERENCIA CANÓNICA del sistema de diseño.
 * Demuestra la composición correcta de todos los patrones del blueprint:
 *
 * ┌── Patrones ilustrados ──────────────────────────────────────────────┐
 * │  app-kpi-card      → métricas con contador GSAP animado            │
 * │  indicator-live    → dot pulsante de estado en tiempo real         │
 * │  app-icon          → iconos Lucide (cero emojis)                   │
 * │  [appCardHover]    → hover GSAP en todas las cards                 │
 * │  [appBentoGridLayout] → grid con FLIP animation en reflow          │
 * │  animateBentoGrid  → stagger de entrada de las celdas              │
 * │  animateHero       → blur + scale en el banner principal           │
 * │  staggerListItems  → entrada escalonada en listas de actividad     │
 * │  skeleton → content → [appAnimateIn] en transición de carga        │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * CÓMO ADAPTAR AL PROYECTO:
 * 1. Reemplaza los `kpis` y `activities` estáticos con señales del Facade.
 * 2. Crea un `DashboardFacade` en `core/services/dashboard.facade.ts`.
 * 3. Expón los datos con `toSignal()` y conéctalos a los inputs de los componentes.
 *
 * @example (en app.routes.ts)
 * {
 *   path: 'dashboard',
 *   loadComponent: () =>
 *     import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
 * }
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dashboard.component.scss',
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
  template: `
    <!-- ═══════════════════════════════════════════════════════════════
         BENTO GRID — contenedor principal del dashboard
         [appBentoGridLayout] habilita FLIP animation en reflows
    ════════════════════════════════════════════════════════════════ -->
    <section class="bento-grid w-full" appBentoGridLayout #bentoGrid aria-label="Panel de control">
      <!-- ── HERO slim — título + KPIs en una sola barra ────────────────── -->
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

      <!-- ── Izquierda: Live Classes (Lista vertical compacta) ─── -->
      <app-live-classes-panel
        class="bento-wide bento-card w-full"
        appScrollReveal
        data-row-span="2"
        [classes]="liveClasses()"
        [loading]="loading()"
        (actionClick)="handleLiveClassAction($event)"
      />

      <!-- ── Derecha Arriba: Actividad reciente ─── -->
      <div
        class="bento-wide bento-card flex flex-col w-full"
        appCardHover
        [appScrollReveal]="{ delay: 0.1 }"
      >
        <!-- Header de sección -->
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

        <!-- Lista de actividad con stagger -->
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
            #activityList
            class="m-0 p-0 list-none flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2"
          >
            @for (item of activities().slice(0, 4); track item.id; let i = $index) {
              <li
                class="flex items-start gap-3 py-2.5 border-b last:border-b-0 border-border-subtle"
                [appAnimateIn]="{ delay: 0.2 + i * 0.05 }"
              >
                <!-- Ícono del evento -->
                <div
                  class="shrink-0 flex items-center justify-center w-8 h-8 rounded-full"
                  [style.background]="item.iconBg"
                  [style.color]="item.iconColor"
                >
                  <app-icon [name]="item.icon" [size]="14" />
                </div>

                <!-- Contenido del evento -->
                <div class="flex-1 min-w-0">
                  <p
                    class="m-0 text-sm font-medium text-text-primary truncate"
                    [pTooltip]="item.title"
                    tooltipPosition="top"
                  >
                    {{ item.title }}
                  </p>
                  <p class="m-0 text-xs text-text-muted truncate" [pTooltip]="item.description" tooltipPosition="bottom">{{ item.description }}</p>
                </div>

                <!-- Timestamp -->
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

      <!-- ── Derecha Abajo: Alertas Importantes ───── -->
      <div
        class="bento-wide bento-card flex flex-col w-full"
        appCardHover
        [appScrollReveal]="{ delay: 0.2 }"
      >
        <!-- Header de sección -->
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
              <li class="flex items-start gap-3 py-2.5 border-b last:border-b-0 border-border-subtle animate-pulse">
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
                <!-- Ícono del evento (según severity) -->
                <div
                  class="shrink-0 flex items-center justify-center w-8 h-8 rounded-full"
                  [style.background]="getAlertBg(alert.severity)"
                  [style.color]="getAlertColor(alert.severity)"
                >
                  <app-icon [name]="getAlertIcon(alert.severity)" [size]="14" />
                </div>

                <!-- Contenido del evento -->
                <div class="flex-1 min-w-0">
                  <p
                    class="m-0 text-sm font-medium text-text-primary truncate"
                    [pTooltip]="alert.title"
                    tooltipPosition="top"
                  >
                    {{ alert.title }}
                  </p>
                  <p class="m-0 text-xs text-text-muted truncate" [pTooltip]="alert.description" tooltipPosition="bottom">{{ alert.description }}</p>
                </div>

                <!-- Botón descartar -->
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
  styles: [
    `
      /* Scrollbar minimalista para las listas */
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
  ],
})
export class DashboardComponent {
  private readonly dashboardFacade = inject(DashboardFacade);
  protected readonly dashboardAlertsFacade = inject(DashboardAlertsFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly auth = inject(AuthFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly authFacade = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly agendaFacade = inject(AgendaFacade);
  private readonly asistenciaFacade = inject(AsistenciaClaseBFacade);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  // ── Estado ────────────────────────────────────────────────────────────────

  readonly loading = computed(() => this.dashboardFacade.loading());
  protected readonly fallbackName = computed(
    () => this.auth.currentUser()?.name || 'Administrador',
  );

  // ── Datos derivados del Facade ────────────────────────────────────────────

  readonly hero = computed(() => this.dashboardFacade.data()?.hero);
  readonly kpis = computed(() => this.dashboardFacade.data()?.kpis ?? []);
  readonly activities = computed(() => this.dashboardFacade.data()?.activities ?? []);
  readonly quickActions = computed(() => this.dashboardFacade.data()?.quickActions ?? []);
  readonly alerts = computed(() => this.dashboardAlertsFacade.activeAlerts());
  readonly liveClasses = computed(() => this.dashboardFacade.data()?.liveClasses ?? []);

  readonly heroSectionTitle = computed(() => `¡Bienvenido, ${this.hero()?.userName ?? ''}!`);
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
      this.branchFacade.selectedBranchId(); // tracking reactivo
      void this.dashboardFacade.initialize();
      void this.dashboardAlertsFacade.initialize();
    });

    // SWR Lifecycle Hook: animar grid cuando sale de loading (o de inmediato si hubo hit map de caché)
    effect(() => {
      const isReady = !this.loading();
      const el = this.bentoGrid()?.nativeElement;

      if (isReady && el) {
        Promise.resolve().then(() => {
          this.gsap.animateBentoGrid(el);
        });
      }
    });
  }

  handleQuickAction(actionId: string): void {
    if (actionId === 'qa1') {
      this.layoutDrawer.open(AdminMatriculaComponent, 'Nueva Matrícula', 'users');
    } else if (actionId === 'qa2') {
      this.layoutDrawer.open(AdminAgendaComponent, 'Agenda Semanal', 'calendar-days');
    } else if (actionId === 'qa3') {
      const role = this.authFacade.currentUser()?.role;
      const route = role === 'secretaria' ? 'app/secretaria/pagos' : 'app/admin/pagos';
      void this.router.navigate([route]);
    }
  }

  async handleLiveClassAction(cls: LiveClassModel) {
    if (cls.type === 'practical' && cls.status === 'pending') {
      // Flujo real de Iniciar Clase
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
        vehiclePlate: cls.vehiclePlate
      };
      
      this.asistenciaFacade.selectPractica(row);
      const { AdminIniciarClaseDrawerComponent } = await import(
        '../admin/asistencia/admin-iniciar-clase-drawer.component'
      );
      this.layoutDrawer.open(
        AdminIniciarClaseDrawerComponent,
        'Iniciar Clase Práctica',
        'play'
      );
    } else {
      // Flujo normal informativo
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
        classNumber: 0
      };
      
      this.agendaFacade.setSelectedSlot(slot);
      const title = cls.studentName ? `Clase: ${cls.studentName}` : 'Detalle de clase';
      this.layoutDrawer.open(AgendaSlotDetailDrawerComponent, title, 'calendar-clock');
    }
  }

  openRecentActivity() {
    this.layoutDrawer.open(RecentActivityDrawerComponent, 'Actividad Reciente', 'activity');
  }

  openAlerts() {
    this.layoutDrawer.open(AlertsDrawerComponent, 'Todas las Alertas', 'bell');
  }

  getAlertIcon(severity: string): string {
    switch (severity) {
      case 'warning': return 'triangle-alert';
      case 'error': return 'octagon-alert';
      case 'success': return 'check-circle';
      case 'info':
      default: return 'info';
    }
  }

  getAlertColor(severity: string): string {
    switch (severity) {
      case 'warning': return 'var(--state-warning)';
      case 'error': return 'var(--state-error)';
      case 'success': return 'var(--state-success)';
      default: return 'var(--text-primary)';
    }
  }

  getAlertBg(severity: string): string {
    switch (severity) {
      case 'warning': return 'var(--state-warning-bg)';
      case 'error': return 'var(--state-error-bg)';
      case 'success': return 'var(--state-success-bg)';
      default: return 'var(--bg-subtle)';
    }
  }
}
