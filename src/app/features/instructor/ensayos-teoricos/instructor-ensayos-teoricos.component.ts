import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { InstructorAlumnosFacade } from '@core/facades/instructor-alumnos.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
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
    SectionHeroComponent,
    KpiCardVariantComponent,
    SkeletonBlockComponent,
    AlertCardComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- HERO -->
      <div class="bento-banner">
        <app-section-hero
          #heroRef
          title="Ensayos Teóricos"
          subtitle="Consulta los puntajes de preparación para el examen municipal"
          backRoute="/app/instructor/dashboard"
          backLabel="Dashboard"
          [actions]="[]"
        />
      </div>

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
          <div class="card p-0 overflow-hidden">
            <div
              class="px-6 py-4 border-b border-divider bg-surface-hover flex items-center justify-between"
            >
              <h3 class="text-lg font-bold text-text-primary">Historial de Puntajes</h3>
            </div>

            @if (isDataLoading()) {
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr
                      class="border-b border-divider text-xs text-text-muted uppercase tracking-wider"
                      style="background: var(--bg-subtle)"
                    >
                      <th class="p-4 font-semibold">Alumno</th>
                      <th class="p-4 font-semibold">RUT</th>
                      <th class="p-4 font-semibold">Puntaje</th>
                      <th class="p-4 font-semibold">Fecha</th>
                      <th class="p-4 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-divider text-sm">
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
                      class="border-b border-divider text-xs text-text-muted uppercase tracking-wider"
                      style="background: var(--bg-subtle)"
                    >
                      <th class="p-4 font-semibold">Alumno</th>
                      <th class="p-4 font-semibold">RUT</th>
                      <th class="p-4 font-semibold">Puntaje</th>
                      <th class="p-4 font-semibold">Fecha</th>
                      <th class="p-4 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-divider text-sm">
                    @for (item of facade.examScores(); track item.id) {
                      <tr class="hover:bg-surface-hover/50 transition-colors">
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
export class InstructorEnsayosTeoricosComponent implements OnInit, AfterViewInit {
  readonly facade = inject(InstructorAlumnosFacade);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroRef');
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  readonly skeletonRows = Array(5);

  /** Verdadero mientras estudiantes O puntajes estén en tránsito. */
  readonly isDataLoading = computed(() => this.facade.isLoading() || this.facade.examLoading());

  readonly kpis = computed(() => {
    const scores = this.facade.examScores();
    const total = scores.length;
    const promedio = total ? Math.round(scores.reduce((acc, r) => acc + r.score, 0) / total) : 0;
    const aprobados = scores.filter((r) => r.score >= 80).length;
    return { total, promedio, aprobados };
  });

  async ngOnInit(): Promise<void> {
    await this.facade.initialize(); // carga enrollmentIds requeridos por loadExamScores
    await this.facade.loadExamScores();
  }

  ngAfterViewInit(): void {
    const hero = this.heroRef();
    if (hero) this.gsap.animateHero(hero.nativeElement);
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  scoreStatus(score: number): { label: string; severity: 'success' | 'warn' | 'danger' } {
    if (score >= 80) return { label: 'Aprobado', severity: 'success' };
    if (score >= 60) return { label: 'Mejora necesaria', severity: 'warn' };
    return { label: 'Reprobado', severity: 'danger' };
  }
}
