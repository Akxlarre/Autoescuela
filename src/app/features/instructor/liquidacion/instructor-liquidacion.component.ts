import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  inject,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { InstructorHorasFacade } from '@core/facades/instructor-horas.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import {
  HorizontalBarChartComponent,
  ChartDataGroup,
} from '@shared/components/horizontal-bar-chart/horizontal-bar-chart.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

@Component({
  selector: 'app-instructor-liquidacion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    SectionHeroComponent,
    KpiCardVariantComponent,
    AlertCardComponent,
    IconComponent,
    HorizontalBarChartComponent,
    BentoGridLayoutDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- HERO -->
      <app-section-hero
        #heroRef
        title="Mis Horas"
        subtitle="Registro de horas trabajadas del mes actual"
        backRoute="/app/instructor/dashboard"
        backLabel="Dashboard"
        [actions]="heroActions"
      />

      @if (facade.isLoading()) {
        <!-- KPI Skeletons como hijos directos del bento-grid -->
        @for (n of [1, 2, 3]; track n) {
          <div class="bento-square">
            <app-kpi-card-variant label="..." [value]="0" [loading]="true" />
          </div>
        }
      } @else if (facade.error()) {
        <div class="bento-banner">
          <app-alert-card title="Error al cargar liquidación" severity="error">
            {{ facade.error() }}
          </app-alert-card>
        </div>
      } @else if (facade.monthlyTarget(); as target) {
        <!-- KPIs como hijos directos del bento-grid -->
        <div class="bento-square">
          <app-kpi-card-variant
            label="Horas Realizadas"
            [value]="target.completedHours"
            [subValue]="'/ ' + target.targetHours + ' hrs meta'"
            suffix=" hrs"
            icon="clock"
          />
        </div>
        <div class="bento-square">
          <app-kpi-card-variant
            label="Clases Completadas (Mes)"
            [value]="target.breakdown[0]?.horas ?? 0"
            [subValue]="target.breakdown[0]?.horas === 1 ? '1 clase' : (target.breakdown[0]?.horas ?? 0) + ' clases'"
            icon="check-circle"
            color="success"
          />
        </div>
        <div class="bento-square">
          <app-kpi-card-variant
            label="Proyección Mensual"
            [value]="target.projectedHours"
            suffix=" hrs"
            icon="trending-up"
            [color]="target.projectedHours >= target.targetHours ? 'success' : 'warning'"
            [trendLabel]="
              target.projectedHours >= target.targetHours
                ? 'Cumplirías la meta'
                : target.targetHours - target.projectedHours + ' hrs restantes'
            "
          />
        </div>

        <!-- Contenido principal -->
        <div class="bento-banner">
          <div class="flex flex-col gap-6">
            <!-- Breakdown Chart -->
            <div class="card p-6">
              <h3 class="text-base font-bold text-text-primary mb-4 border-b border-divider pb-2">
                Desglose de Horas Realizadas
              </h3>
              <app-horizontal-bar-chart [data]="buildChartData(target.breakdown)" />
            </div>

            <!-- Daily Logs Table -->
            <div class="card p-0 overflow-hidden">
              <div
                class="px-6 py-4 border-b border-divider bg-surface-hover flex justify-between items-center"
              >
                <h3 class="text-lg font-bold text-text-primary">Registro Diario (Mes Actual)</h3>
                <button class="btn btn-outline btn-sm" data-llm-action="export-pdf">
                  <app-icon name="download" [size]="14" />
                  Exportar PDF
                </button>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr
                      class="border-b border-divider text-xs text-text-muted uppercase tracking-wider"
                      style="background: var(--bg-subtle)"
                    >
                      <th class="p-4 font-semibold">Fecha</th>
                      <th class="p-4 font-semibold">Tipo de Actividad</th>
                      <th class="p-4 font-semibold">Sesiones</th>
                      <th class="p-4 font-semibold text-right">Horas</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-divider align-top text-sm">
                    @if (facade.sessionsLog().length === 0) {
                      <tr>
                        <td colspan="3" class="p-8 text-center text-text-muted italic">
                          No hay registros de sesiones completadas este mes aún.
                        </td>
                      </tr>
                    } @else {
                      @for (log of facade.sessionsLog(); track log.date) {
                        <tr class="hover:bg-surface-hover/50 transition-colors">
                          <td class="p-4 whitespace-nowrap text-text-primary font-medium">
                            {{ log.date | date: 'dd MMM yyyy' }}
                          </td>
                          <td class="p-4">
                            <div class="flex items-center gap-2">
                              <span
                                class="w-2 h-2 rounded-full"
                                [style.backgroundColor]="getCategoryColor(log.category)"
                              ></span>
                              <span class="text-text-muted"
                                >{{ log.categoryLabel }}</span
                              >
                            </div>
                          </td>
                          <td class="p-4 text-center">
                            <span class="text-xs font-semibold px-2 py-0.5 rounded-full" style="background: color-mix(in srgb, var(--color-primary) 10%, transparent); color: var(--color-primary)">
                              {{ log.quantity }} {{ log.quantity === 1 ? 'sesión' : 'sesiones' }}
                            </span>
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
export class InstructorLiquidacionComponent implements OnInit, AfterViewInit {
  public facade = inject(InstructorHorasFacade);
  private gsap = inject(GsapAnimationsService);

  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroRef');
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  readonly heroActions: SectionHeroAction[] = [];

  async ngOnInit() {
    await this.facade.initialize();
  }

  ngAfterViewInit() {
    const hero = this.heroRef();
    if (hero) this.gsap.animateHero(hero.nativeElement);
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
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
