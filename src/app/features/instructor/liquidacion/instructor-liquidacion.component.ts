import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { InstructorHorasFacade } from '@core/facades/instructor-horas.facade';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import {
  HorizontalBarChartComponent,
  ChartDataGroup,
} from '@shared/components/horizontal-bar-chart/horizontal-bar-chart.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { ScrollRevealDirective } from '@core/directives/scroll-reveal.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { formatKpiEsCl } from '@core/utils/kpi-es-cl-format.util';
import { BadgeComponent } from '@shared/components/badge/badge.component';

@Component({
  selector: 'app-instructor-liquidacion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    DatePipe,
    SectionHeroComponent,
    AlertCardComponent,
    IconComponent,
    HorizontalBarChartComponent,
    BentoGridLayoutDirective,
    ScrollRevealDirective,
    CardHoverDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- HERO -->
      <app-section-hero
        [animateOnInit]="false"
        title="Mis Horas"
        subtitle="Registro de horas trabajadas del mes actual"
        backRoute="/app/instructor/dashboard"
        backLabel="Dashboard"
        [actions]="heroActions"
        density="slim"
        [kpis]="heroKpis()"
        [loading]="facade.isLoading()"
        [loadingKpiCount]="3"
      />

      @if (facade.error()) {
        <div class="bento-banner">
          <app-alert-card title="Error al cargar liquidación" severity="error">
            {{ facade.error() }}
          </app-alert-card>
        </div>
      } @else if (facade.monthlyTarget(); as target) {
        <!-- Contenido principal -->
        <div class="bento-banner">
          <div class="flex flex-col gap-6">
            <!-- Breakdown Chart -->
            <div class="card p-6" appCardHover appScrollReveal>
              <h3
                class="text-base font-bold text-text-primary mb-4 border-b border-border-subtle pb-2"
              >
                Desglose de Horas Realizadas
              </h3>
              <app-horizontal-bar-chart [data]="buildChartData(target.breakdown)" />
            </div>

            <!-- Daily Logs Table -->
            <div class="card p-0 overflow-hidden" appCardHover [appScrollReveal]="{ delay: 0.1 }">
              <div
                class="px-6 py-4 border-b border-border-subtle bg-subtle flex justify-between items-center"
              >
                <h3 class="text-lg font-bold text-text-primary">Registro Diario (Mes Actual)</h3>
                <button class="btn-secondary text-xs" data-llm-action="export-pdf">
                  <app-icon name="download" [size]="14" />
                  Exportar PDF
                </button>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="micro-label border-b border-border-subtle bg-subtle">
                      <th class="p-4 font-semibold">Fecha</th>
                      <th class="p-4 font-semibold">Tipo de Actividad</th>
                      <th class="p-4 font-semibold">Sesiones</th>
                      <th class="p-4 font-semibold text-right">Horas</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border-subtle align-top text-sm">
                    @if (facade.sessionsLog().length === 0) {
                      <tr>
                        <td colspan="3" class="p-8 text-center text-text-muted italic">
                          No hay registros de sesiones completadas este mes aún.
                        </td>
                      </tr>
                    } @else {
                      @for (log of facade.sessionsLog(); track log.date) {
                        <tr class="hover:bg-subtle/50 transition-colors">
                          <td class="p-4 whitespace-nowrap text-text-primary font-medium">
                            {{ log.date | date: 'dd MMM yyyy' }}
                          </td>
                          <td class="p-4">
                            <div class="flex items-center gap-2">
                              <span
                                class="w-2 h-2 rounded-full"
                                [style.backgroundColor]="getCategoryColor(log.category)"
                              ></span>
                              <span class="text-text-muted">{{ log.categoryLabel }}</span>
                            </div>
                          </td>
                          <td class="p-4 text-center">
                            <app-badge variant="brand">
                              {{ log.quantity }} {{ log.quantity === 1 ? 'sesión' : 'sesiones' }}
                            </app-badge>
                          </td>
                          <td class="p-4 text-right">
                            <span class="font-medium text-text-primary">{{ log.hours }} hrs</span>
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class InstructorLiquidacionComponent implements OnInit {
  public facade = inject(InstructorHorasFacade);
  readonly heroActions: SectionHeroAction[] = [];

  /**
   * KPIs del strip del hero slim (antes: 3 celdas `bento-square` sueltas).
   * Los valores van pre-formateados: el strip renderiza `{{ kpi.value }}` crudo
   * y no pasa por `animateCounter`, que era quien localizaba a es-CL.
   *
   * El texto de proyección viaja en `subValue` y no en `trendLabel`: el strip
   * solo pinta `trendLabel` cuando existe un `trend` numérico, que acá no hay.
   */
  readonly heroKpis = computed<SectionHeroKpi[]>(() => {
    const target = this.facade.monthlyTarget();
    if (!target) return [];

    const clases = target.breakdown[0]?.horas ?? 0;
    const cumpleMeta = target.projectedHours >= target.targetHours;

    return [
      {
        id: 'horas-realizadas',
        label: 'Horas Realizadas',
        value: formatKpiEsCl(target.completedHours),
        suffix: ' hrs',
        subValue: `/ ${formatKpiEsCl(target.targetHours)} hrs meta`,
      },
      {
        id: 'clases-mes',
        label: 'Clases Completadas (Mes)',
        value: formatKpiEsCl(clases),
        subValue: clases === 1 ? '1 clase' : `${formatKpiEsCl(clases)} clases`,
        color: 'success',
      },
      {
        id: 'proyeccion',
        label: 'Proyección Mensual',
        value: formatKpiEsCl(target.projectedHours),
        suffix: ' hrs',
        color: cumpleMeta ? 'success' : 'warning',
        subValue: cumpleMeta
          ? 'Cumplirías la meta'
          : `${formatKpiEsCl(target.targetHours - target.projectedHours)} hrs restantes`,
      },
    ];
  });

  async ngOnInit() {
    await this.facade.initialize();
  }

  getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      practica: 'var(--color-primary)',
      teorico: 'var(--state-info, var(--color-primary))',
      ensayo: 'var(--state-success)',
      administrativo: 'var(--state-warning)',
    };
    return colors[category] || 'var(--text-muted)';
  }

  buildChartData(breakdown: { categoria: string; horas: number }[]): ChartDataGroup[] {
    const total = breakdown.reduce((acc, curr) => acc + curr.horas, 0);
    if (total === 0) return [];

    const labels: Record<string, string> = {
      practica: 'Clases Prácticas',
      teorico: 'Clases Teóricas',
      ensayo: 'Ensayos Asistidos',
      administrativo: 'Administrativo',
    };

    return breakdown
      .map((item) => ({
        label: labels[item.categoria] || item.categoria,
        value: item.horas,
        color: item.categoria as ChartDataGroup['color'],
        percent: (item.horas / total) * 100,
      }))
      .sort((a, b) => b.value - a.value);
  }
}
