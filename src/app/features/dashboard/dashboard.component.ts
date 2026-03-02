import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthFacade } from '@core/services/auth.facade';
import { GsapAnimationsService } from '@core/services/gsap-animations.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { IconComponent } from '@shared/components/icon/icon.component';
import { KpiCardComponent } from '@shared/components/kpi-card/kpi-card.component';
import { KpiCardSkeletonComponent } from '@shared/components/kpi-card/kpi-card-skeleton.component';

/**
 * DashboardComponent — Página principal de la aplicación.
 *
 * Esta página es la REFERENCIA CANÓNICA del sistema de diseño.
 * Demuestra la composición correcta de todos los patrones del blueprint:
 *
 * ┌── Patrones ilustrados ──────────────────────────────────────────────┐
 * │  surface-hero      → bento-hero con gradiente de marca             │
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
  imports: [
    DatePipe,
    BentoGridLayoutDirective,
    CardHoverDirective,
    IconComponent,
    KpiCardComponent,
    KpiCardSkeletonComponent,
  ],
  template: `
    <!-- ═══════════════════════════════════════════════════════════════
         BENTO GRID — contenedor principal del dashboard
         [appBentoGridLayout] habilita FLIP animation en reflows
    ════════════════════════════════════════════════════════════════ -->
    <section #gridEl class="bento-grid" appBentoGridLayout aria-label="Panel de control">
      <!-- ── HERO — Banner principal con surface-hero ────────────────
           surface-hero aplica el gradiente de marca + radial glow.
           El texto SIEMPRE en var(--color-primary-text) (blanco).
           Solo UNA surface-hero por vista.
      ──────────────────────────────────────────────────────────── -->
      <div
        #heroEl
        class="bento-hero surface-hero rounded-2xl p-8 flex flex-col justify-between gap-4"
        data-llm-nav="dashboard-hero"
      >
        <!-- Fila superior: saludo + indicador de estado -->
        <div class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-1">
            <p class="m-0 text-sm font-medium" style="color: rgba(255,255,255,0.7)">
              {{ today | date: 'EEEE, d MMMM y' : '' : 'es' }}
            </p>
            <h1 class="m-0 text-3xl font-bold" style="color: var(--color-primary-text)">
              Hola, {{ userName() }}
            </h1>
            <p class="m-0 text-base" style="color: rgba(255,255,255,0.8)">
              Aquí tienes el resumen de hoy.
            </p>
          </div>

          <!-- Indicador de sistema activo -->
          <div
            class="indicator-live text-sm flex-shrink-0 rounded-full px-3 py-1"
            style="background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.9)"
          >
            Sistema activo
          </div>
        </div>

        <!-- Fila inferior: acciones rápidas del hero -->
        <div class="flex items-center gap-3 flex-wrap">
          <button
            class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border-none cursor-pointer transition-all duration-200"
            style="background: rgba(255,255,255,0.2); color: var(--color-primary-text); backdrop-filter: blur(8px)"
            data-llm-action="open-new-report"
          >
            <app-icon name="plus" [size]="14" />
            Nuevo informe
          </button>
          <button
            class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border-none cursor-pointer"
            style="background: transparent; color: rgba(255,255,255,0.75)"
            data-llm-action="view-all-reports"
          >
            Ver todos los informes
            <app-icon name="arrow-right" [size]="14" />
          </button>
        </div>
      </div>

      <!-- ── KPIs — 4 métricas en celdas square ──────────────────────
           app-kpi-card encapsula: .kpi-value + .kpi-label + trend + animateCounter()
           Solo 1 card-accent por sección bento → va en la primera KPI.
      ──────────────────────────────────────────────────────────── -->
      @for (kpi of kpis(); track kpi.id) {
        <div class="bento-square" appCardHover>
          @if (loading()) {
            <app-kpi-card-skeleton />
          } @else {
            <app-kpi-card
              [label]="kpi.label"
              [value]="kpi.value"
              [suffix]="kpi.suffix ?? ''"
              [prefix]="kpi.prefix ?? ''"
              [trend]="kpi.trend"
              [trendLabel]="kpi.trendLabel ?? ''"
              [accent]="kpi.accent ?? false"
              [icon]="kpi.icon"
              [color]="kpi.color ?? 'default'"
            />
          }
        </div>
      }

      <!-- ── FEATURE — Actividad reciente ───────────────────────────
           bento-feature: 8 columnas de ancho, 2 filas de alto.
           Lista con stagger GSAP al montar.
      ──────────────────────────────────────────────────────────── -->
      <div class="bento-feature card" appCardHover>
        <!-- Header de sección -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <app-icon name="activity" [size]="16" style="color: var(--ds-brand)" />
            <h2 class="m-0 text-base font-semibold text-text-primary">Actividad reciente</h2>
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
                class="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full"
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
              <span class="flex-shrink-0 text-xs text-text-muted self-center">{{ item.time }}</span>
            </li>
          }
        </ul>
      </div>

      <!-- ── TALL — Acciones rápidas ─────────────────────────────────
           bento-tall: 3 columnas, 2 filas. Panel de acciones frecuentes.
      ──────────────────────────────────────────────────────────── -->
      <div class="bento-tall card flex flex-col gap-3" appCardHover>
        <div class="flex items-center gap-2 mb-1">
          <app-icon name="plus" [size]="16" style="color: var(--ds-brand)" />
          <h2 class="m-0 text-base font-semibold text-text-primary">Acciones rápidas</h2>
        </div>

        @for (action of quickActions(); track action.id) {
          <button
            class="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer border text-left transition-all duration-150"
            style="background: var(--bg-elevated); border-color: var(--border-subtle); color: var(--text-secondary)"
            [attr.data-llm-action]="action.llmAction"
          >
            <div
              class="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md"
              [style.background]="action.iconBg"
              [style.color]="action.iconColor"
            >
              <app-icon [name]="action.icon" [size]="14" />
            </div>
            {{ action.label }}
            <app-icon
              name="chevron-right"
              [size]="14"
              class="ml-auto"
              style="color: var(--text-muted)"
            />
          </button>
        }
      </div>

      <!-- ── WIDE — Estado del sistema ──────────────────────────────
           bento-wide: ancho completo de media pantalla, 1 fila.
           Muestra el estado de servicios con indicator-live.
      ──────────────────────────────────────────────────────────── -->
      <div class="bento-wide card flex items-center justify-between gap-4" appCardHover>
        <div class="flex items-center gap-3">
          <div class="indicator-live text-sm font-medium text-text-secondary">
            Todos los sistemas operativos
          </div>
        </div>

        <div class="flex items-center gap-6 flex-wrap">
          @for (service of systemStatus(); track service.name) {
            <div class="flex items-center gap-1.5">
              <div
                class="w-2 h-2 rounded-full flex-shrink-0"
                [style.background]="service.ok ? 'var(--state-success)' : 'var(--state-error)'"
              ></div>
              <span class="text-xs text-text-muted">{{ service.name }}</span>
            </div>
          }
        </div>

        <div class="flex-shrink-0 text-xs text-text-muted">Actualizado hace 2 min</div>
      </div>
    </section>
  `,
})
export class DashboardComponent {
  // ── Servicios ─────────────────────────────────────────────────────────────
  private readonly auth = inject(AuthFacade);

  // ── Estado ────────────────────────────────────────────────────────────────

  /** true mientras los datos se cargan. Reemplazar con toSignal(facade.loading$). */
  readonly loading = signal(false);

  readonly today = new Date();

  readonly userName = computed(() => this.auth.currentUser()?.name?.split(' ')[0] ?? 'Equipo');

  // ── Datos de ejemplo — reemplazar con señales del DashboardFacade ─────────

  /**
   * KPIs del dashboard.
   * TODO: Reemplazar con: readonly kpis = toSignal(this.dashboardFacade.kpis$, { initialValue: [] });
   */
  readonly kpis = signal([
    {
      id: 'users',
      label: 'Usuarios totales',
      value: 24819,
      trend: 12.4,
      trendLabel: 'vs. mes anterior',
      accent: true,
      icon: 'users',
    },
    {
      id: 'revenue',
      label: 'Ingresos del mes',
      value: 84320,
      prefix: '$',
      trend: 8.1,
      trendLabel: 'vs. mes anterior',
      icon: 'credit-card',
      color: 'success' as const,
    },
    {
      id: 'conversion',
      label: 'Tasa de conversión',
      value: 4, // 4.7% — animateCounter usa Math.round()
      suffix: '%',
      trend: -0.3,
      trendLabel: 'vs. mes anterior',
      icon: 'bar-chart-2',
      color: 'warning' as const,
    },
    {
      id: 'sessions',
      label: 'Sesiones activas',
      value: 1204,
      trend: 22.5,
      icon: 'activity',
      color: 'success' as const,
    },
  ]);

  readonly activities = signal([
    {
      id: 'a1',
      icon: 'user',
      title: 'Nuevo usuario registrado',
      description: 'carlos.mendez@empresa.com se unió al plan Pro',
      time: 'hace 5 min',
      iconBg: 'var(--color-primary-muted)',
      iconColor: 'var(--color-primary)',
    },
    {
      id: 'a2',
      icon: 'check-circle',
      title: 'Pago procesado correctamente',
      description: 'Factura #1042 por $840 — Plan Enterprise',
      time: 'hace 18 min',
      iconBg: 'var(--state-success-bg)',
      iconColor: 'var(--state-success)',
    },
    {
      id: 'a3',
      icon: 'alert-circle',
      title: 'Alerta de uso elevado',
      description: 'El equipo "Desarrollo" superó el 85% de su cuota',
      time: 'hace 1 h',
      iconBg: 'var(--state-warning-bg)',
      iconColor: 'var(--state-warning)',
    },
    {
      id: 'a4',
      icon: 'download',
      title: 'Exportación completada',
      description: 'Reporte mensual de usuarios descargado',
      time: 'hace 2 h',
      iconBg: 'var(--bg-subtle)',
      iconColor: 'var(--text-secondary)',
    },
    {
      id: 'a5',
      icon: 'settings',
      title: 'Configuración actualizada',
      description: 'Política de retención de datos ajustada a 90 días',
      time: 'hace 3 h',
      iconBg: 'var(--bg-subtle)',
      iconColor: 'var(--text-secondary)',
    },
  ]);

  readonly quickActions = signal([
    {
      id: 'qa1',
      icon: 'users',
      label: 'Invitar usuario',
      llmAction: 'invite-user',
      iconBg: 'var(--color-primary-muted)',
      iconColor: 'var(--color-primary)',
    },
    {
      id: 'qa2',
      icon: 'download',
      label: 'Exportar datos',
      llmAction: 'export-data',
      iconBg: 'var(--bg-subtle)',
      iconColor: 'var(--text-secondary)',
    },
    {
      id: 'qa3',
      icon: 'bar-chart-2',
      label: 'Ver analíticas',
      llmAction: 'view-analytics',
      iconBg: 'var(--bg-subtle)',
      iconColor: 'var(--text-secondary)',
    },
    {
      id: 'qa4',
      icon: 'settings',
      label: 'Configuración',
      llmAction: 'open-settings',
      iconBg: 'var(--bg-subtle)',
      iconColor: 'var(--text-secondary)',
    },
  ]);

  readonly systemStatus = signal([
    { name: 'API', ok: true },
    { name: 'Base de datos', ok: true },
    { name: 'Auth', ok: true },
    { name: 'Storage', ok: true },
    { name: 'Realtime', ok: true },
  ]);

  // Animaciones GSAP deshabilitadas temporalmente — causaban contenido invisible
  // (opacity: 0) cuando había race conditions. Reactivar cuando el flujo sea estable.
}
