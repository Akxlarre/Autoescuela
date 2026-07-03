import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { InstructorAlumnosFacade } from '@core/facades/instructor-alumnos.facade';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-instructor-ensayos-teoricos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    TagModule,
    BentoGridLayoutDirective,
    BentoRevealDirective,
    CardHoverDirective,
    SectionHeroComponent,
    KpiCardVariantComponent,
    SkeletonBlockComponent,
    AlertCardComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="bento-grid" appBentoReveal appBentoGridLayout>
      <!-- HERO -->
      <app-section-hero
        class="bento-hero"
        [animateOnInit]="false"
        title="Ensayos Teóricos"
        subtitle="Consulta los puntajes de preparación para el examen municipal"
        backRoute="/app/instructor/dashboard"
        backLabel="Dashboard"
        [actions]="[]"
      />

      <!-- KPIs -->
      <div class="bento-square">
        <app-kpi-card-variant
          label="Total Registros"
          [value]="kpis().total"
          icon="file-check"
          [loading]="isDataLoading()"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Promedio"
          [value]="kpis().promedio"
          suffix="/100"
          icon="bar-chart-2"
          [loading]="isDataLoading()"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Aprobados (80+)"
          [value]="kpis().aprobados"
          icon="award"
          color="success"
          [accent]="true"
          [loading]="isDataLoading()"
        />
      </div>

      <!-- Main content -->
      <div class="bento-banner">
        <div class="flex flex-col gap-6">
          <!-- Error state -->
          @if (facade.error()) {
            <app-alert-card title="Error al cargar puntajes" severity="error">
              {{ facade.error() }}
            </app-alert-card>
          }

          <!-- Tabla de historial -->
          <div class="card p-0 overflow-hidden" appCardHover>
            <div
              class="px-6 py-4 border-b border-border-subtle bg-subtle flex items-center justify-between"
            >
              <h3 class="text-lg font-bold text-text-primary">Historial de Puntajes</h3>
            </div>

            @if (isDataLoading()) {
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr
                      class="border-b border-border-subtle text-xs text-text-muted uppercase tracking-wider bg-subtle"
                    >
                      <th class="p-4 font-semibold">Alumno</th>
                      <th class="p-4 font-semibold">RUT</th>
                      <th class="p-4 font-semibold">Puntaje</th>
                      <th class="p-4 font-semibold">Fecha</th>
                      <th class="p-4 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border-subtle text-sm">
                    @for (_ of skeletonRows; track $index) {
                      <tr>
                        <td class="p-4">
                          <app-skeleton-block variant="text" width="140px" height="14px" />
                        </td>
                        <td class="p-4">
                          <app-skeleton-block variant="text" width="90px" height="14px" />
                        </td>
                        <td class="p-4">
                          <app-skeleton-block variant="text" width="50px" height="14px" />
                        </td>
                        <td class="p-4">
                          <app-skeleton-block variant="text" width="80px" height="14px" />
                        </td>
                        <td class="p-4">
                          <app-skeleton-block variant="rect" width="72px" height="22px" />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else if (facade.examScores().length === 0) {
              <app-empty-state
                icon="file-question"
                message="Sin puntajes registrados"
                subtitle="Aún no hay resultados de ensayos teóricos para tus alumnos."
              />
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr
                      class="border-b border-border-subtle text-xs text-text-muted uppercase tracking-wider bg-subtle"
                    >
                      <th class="p-4 font-semibold">Alumno</th>
                      <th class="p-4 font-semibold">RUT</th>
                      <th class="p-4 font-semibold">Puntaje</th>
                      <th class="p-4 font-semibold">Fecha</th>
                      <th class="p-4 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border-subtle text-sm">
                    @for (item of facade.examScores(); track item.id) {
                      <tr class="hover:bg-subtle/50 transition-colors">
                        <td class="p-4 font-medium text-text-primary">{{ item.studentName }}</td>
                        <td class="p-4 text-text-muted">{{ item.studentRut }}</td>
                        <td class="p-4">
                          <span class="font-bold text-text-primary">{{ item.score }}</span>
                          <span class="text-text-muted font-normal">/100</span>
                        </td>
                        <td class="p-4 text-text-muted">{{ item.date | date: 'dd/MM/yyyy' }}</td>
                        <td class="p-4">
                          <p-tag
                            [value]="scoreStatus(item.score).label"
                            [severity]="scoreStatus(item.score).severity"
                          />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class InstructorEnsayosTeoricosComponent implements OnInit {
  readonly facade = inject(InstructorAlumnosFacade);
  readonly skeletonRows = Array(5);

  private readonly _localLoading = signal(true);

  /** Verdadero si estamos cargando sin tener datos previos (SWR pattern) */
  readonly isDataLoading = computed(() => {
    // Si ya tenemos datos cacheados, no mostramos skeletons, dejamos que se actualice en background
    if (this.facade.examScores().length > 0) {
      return false;
    }
    return this._localLoading() || this.facade.isLoading() || this.facade.examLoading();
  });

  readonly kpis = computed(() => {
    const scores = this.facade.examScores();
    const total = scores.length;
    const promedio = total ? Math.round(scores.reduce((acc, r) => acc + r.score, 0) / total) : 0;
    const aprobados = scores.filter((r) => r.score >= 80).length;
    return { total, promedio, aprobados };
  });

  async ngOnInit(): Promise<void> {
    try {
      await this.facade.initialize(); // carga enrollmentIds requeridos por loadExamScores
      await this.facade.loadExamScores();
    } finally {
      this._localLoading.set(false);
    }
  }

  scoreStatus(score: number): { label: string; severity: 'success' | 'warn' | 'danger' } {
    if (score >= 80) return { label: 'Aprobado', severity: 'success' };
    if (score >= 60) return { label: 'Mejora necesaria', severity: 'warn' };
    return { label: 'Reprobado', severity: 'danger' };
  }
}
