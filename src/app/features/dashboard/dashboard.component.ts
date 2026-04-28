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
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { DashboardAlertsFacade } from '@core/facades/dashboard-alerts.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AdminMatriculaComponent } from '../admin/matricula/admin-matricula.component';
import { AdminAgendaComponent } from '../admin/agenda/admin-agenda.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

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
    BentoGridLayoutDirective,
    CardHoverDirective,
    ScrollRevealDirective,
    AnimateInDirective,
    IconComponent,
    KpiCardVariantComponent,
    AlertCardComponent,
    SectionHeroComponent,
  ],
  template: `
    <!-- ═══════════════════════════════════════════════════════════════
         BENTO GRID — contenedor principal del dashboard
         [appBentoGridLayout] habilita FLIP animation en reflows
    ════════════════════════════════════════════════════════════════ -->
    <section class="bento-grid" appBentoGridLayout #bentoGrid aria-label="Panel de control">
      <!-- ── HERO — Section Hero reutilizable ──────────────────────────── -->
      @if (hero()) {
        <app-section-hero
          [title]="heroSectionTitle()"
          [contextLine]="heroContextLine()"
          [chips]="heroChips()"
          [actions]="heroActions()"
          (actionClick)="handleQuickAction($event)"
        />
      }

      <!-- ── KPIs — 4 métricas en celdas square ──────────────────────
           app-kpi-card encapsula: .kpi-value + .kpi-label + trend + animateCounter()
           Solo 1 card-accent por sección bento → va en la primera KPI.
      ──────────────────────────────────────────────────────────── -->
      @for (kpi of kpis(); track kpi.id) {
        <div class="bento-square">
          <app-kpi-card-variant
            [label]="kpi.label"
            [value]="kpi.value"
            [suffix]="kpi.suffix ?? ''"
            [prefix]="kpi.prefix ?? ''"
            [trend]="kpi.trend"
            [trendLabel]="kpi.trendLabel ?? ''"
            [subValue]="kpi.subValue ?? ''"
            [accent]="kpi.accent ?? false"
            [icon]="kpi.icon"
            [color]="kpi.color ?? 'default'"
            [loading]="loading()"
          />
        </div>
      }

      <!-- ── Izquierda: Actividad reciente (comparte altura con Alertas) ───
           6 columnas, 2 filas. Clase bento-activity-lg fuerza 50% ancho en desktop.
      ──────────────────────────────────────────────────────────── -->
      <div
        class="bento-wide bento-card bento-activity-lg"
        appCardHover
        appScrollReveal
        data-col-span="6"
        data-col-start="1"
        data-row-span="2"
      >
        <!-- Header de sección -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <app-icon name="activity" [size]="16" style="color: var(--ds-brand)" />
            <h2 class="m-0 font-semibold text-text-primary">Actividad reciente</h2>
          </div>
          <button
            class="text-xs font-medium cursor-pointer border-none bg-transparent p-0"
            style="color: var(--color-primary)"
            data-llm-action="view-all-activity"
          >
            Ver todo
          </button>
        </div>

        <!-- Lista de actividad con stagger -->
        <ul #activityList class="m-0 p-0 list-none flex flex-col gap-1">
          @for (item of activities(); track item.id) {
            <li
              class="flex items-start gap-3 py-2.5 border-b last:border-b-0"
              style="border-color: var(--border-subtle)"
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
                <p class="m-0 text-sm font-medium text-text-primary truncate">{{ item.title }}</p>
                <p class="m-0 text-xs text-text-muted">{{ item.description }}</p>
              </div>

              <!-- Timestamp -->
              <span class="shrink-0 text-xs text-text-muted self-center">{{ item.time }}</span>
            </li>
          }
        </ul>
      </div>

      <!-- ── Derecha: Alertas Importantes (misma altura que Actividad) ─────
           6 columnas, 2 filas. Clase bento-alerts-lg fuerza 50% ancho en desktop.
      ──────────────────────────────────────────────────────────── -->
      <div
        class="bento-wide bento-card bento-alerts-lg flex flex-col gap-3"
        appCardHover
        [appScrollReveal]="{ delay: 0.1 }"
        data-col-span="6"
        data-col-start="7"
        data-row-span="2"
      >
        <div class="flex items-center gap-2 mb-2">
          <app-icon name="bell" [size]="16" style="color: var(--state-warning)" />
          <h2 class="m-0 font-semibold text-text-primary">Alertas Importantes</h2>
        </div>

        <div class="flex flex-col gap-3">
          @for (alert of alerts(); track alert.id; let i = $index) {
            <app-alert-card 
              [severity]="alert.severity" 
              [title]="alert.title"
              [appAnimateIn]="{ delay: 0.2 + (i * 0.05) }"
            >
              {{ alert.description }}
            </app-alert-card>
          }
        </div>
      </div>
    </section>
  `,
})
export class DashboardComponent {
  // ── Servicios ─────────────────────────────────────────────────────────────
  private readonly dashboardFacade = inject(DashboardFacade);
  private readonly dashboardAlertsFacade = inject(DashboardAlertsFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  // ── Estado ────────────────────────────────────────────────────────────────

  readonly loading = computed(() => this.dashboardFacade.loading());

  // ── Datos derivados del Facade ────────────────────────────────────────────

  readonly hero = computed(() => this.dashboardFacade.data()?.hero);
  readonly kpis = computed(() => this.dashboardFacade.data()?.kpis ?? []);
  readonly activities = computed(() => this.dashboardFacade.data()?.activities ?? []);
  readonly quickActions = computed(() => this.dashboardFacade.data()?.quickActions ?? []);
  readonly alerts = computed(() => this.dashboardAlertsFacade.activeAlerts());

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
    }
  }
}
