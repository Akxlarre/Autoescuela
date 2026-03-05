import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { IconComponent } from '@shared/components/icon/icon.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AdminMatriculaComponent } from '../admin/matricula/admin-matricula.component';

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
    IconComponent,
    KpiCardVariantComponent,
    AlertCardComponent,
  ],
  template: `
    <!-- ═══════════════════════════════════════════════════════════════
         BENTO GRID — contenedor principal del dashboard
         [appBentoGridLayout] habilita FLIP animation en reflows
    ════════════════════════════════════════════════════════════════ -->
    <section class="bento-grid" appBentoGridLayout aria-label="Panel de control">
      <!-- ── HERO — Frosted Split ──────────────────────────── -->
      @if (hero()) {
        <div
          class="bento-hero bento-card p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6"
          appCardHover
        >
          <!-- Contenido Principal -->
          <div class="flex flex-col gap-4">
            <div>
              <p class="text-sm text-text-muted m-0">{{ hero()?.date }}</p>
              <h1 class="text-2xl font-bold text-text-primary m-0 mt-1">
                ¡Bienvenido, {{ hero()?.userName }}!
              </h1>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <span
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md w-fit text-sm font-medium"
                style="background: var(--bg-subtle); color: var(--text-primary)"
              >
                <app-icon name="book-open" [size]="14" />
                <span>{{ hero()?.classesToday }} clases programadas</span>
              </span>
              @if (hero()?.activeAlerts) {
                <span
                  class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md w-fit text-sm font-medium"
                  style="background: var(--state-error-bg); color: var(--state-error)"
                >
                  <app-icon name="alert-triangle" [size]="14" />
                  <span>{{ hero()?.activeAlerts }} alertas urgentes</span>
                </span>
              }
            </div>
          </div>

          <!-- Acciones Rápidas -->
          <div class="flex flex-wrap items-center gap-3">
            @for (action of quickActions(); track action.id; let idx = $index) {
              <button
                class="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm cursor-pointer transition-all duration-150 border font-medium"
                [class.bg-[var(--color-primary)]]="idx === 0"
                [class.text-[var(--color-primary-text)]]="idx === 0"
                [class.border-transparent]="idx === 0"
                [class.hover:bg-[var(--color-primary-hover)]]="idx === 0"
                [class.bg-transparent]="idx !== 0"
                [class.text-[var(--text-primary)]]="idx !== 0"
                [class.border-[var(--border-subtle)]]="idx !== 0"
                [class.hover:bg-[var(--bg-subtle)]]="idx !== 0"
                [attr.data-llm-action]="action.llmAction"
                (click)="handleQuickAction(action.id)"
              >
                @if (action.icon) {
                  <app-icon [name]="action.icon" [size]="16" />
                }
                {{ action.label }}
              </button>
            }
          </div>
        </div>
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
        data-col-span="6"
        data-col-start="7"
        data-row-span="2"
      >
        <div class="flex items-center gap-2 mb-2">
          <app-icon name="bell" [size]="16" style="color: var(--state-warning)" />
          <h2 class="m-0 font-semibold text-text-primary">Alertas Importantes</h2>
        </div>

        <div class="flex flex-col gap-3">
          @for (alert of alerts(); track alert.id) {
            <app-alert-card [severity]="alert.severity" [title]="alert.title">
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
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Estado ────────────────────────────────────────────────────────────────

  readonly loading = computed(() => this.dashboardFacade.loading());

  // ── Datos derivados del Facade ────────────────────────────────────────────

  readonly hero = computed(() => this.dashboardFacade.data()?.hero);
  readonly kpis = computed(() => this.dashboardFacade.data()?.kpis ?? []);
  readonly activities = computed(() => this.dashboardFacade.data()?.activities ?? []);
  readonly quickActions = computed(() => this.dashboardFacade.data()?.quickActions ?? []);
  readonly alerts = computed(() => this.dashboardFacade.data()?.alerts ?? []);
  constructor() {
    // Iniciar la carga de datos del dashboard al construir el componente
    this.dashboardFacade.loadDashboardData();
  }

  handleQuickAction(actionId: string) {
    if (actionId === 'qa1') {
      this.openNuevaMatriculaDrawer();
    }
  }

  openNuevaMatriculaDrawer(): void {
    this.layoutDrawer.open(AdminMatriculaComponent, 'Nueva Matrícula', 'users');
  }

  // Animaciones GSAP deshabilitadas temporalmente — causaban contenido invisible
  // (opacity: 0) cuando había race conditions. Reactivar cuando el flujo sea estable.
}
