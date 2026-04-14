import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { BranchFacade } from '@core/facades/branch.facade';
import { ArchivoFacade } from '@core/facades/archivo-profesional.facade';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-admin-profesional-archivo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    SelectModule,
    TooltipModule,
    SectionHeroComponent,
    KpiCardVariantComponent,
    SkeletonBlockComponent,
    IconComponent,
  ],
  template: `
    <!-- ═══ Hero ═══ -->
    <app-section-hero
      title="Archivo · Clase Profesional"
      subtitle="Historial completo de promociones finalizadas — asistencia y evaluaciones"
      [actions]="[]"
    />

    <!-- ═══ Selectores en cascada ═══ -->
    <section class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted"
          >Promoción finalizada</label
        >
        @if (facade.isLoading()) {
          <app-skeleton-block variant="rect" width="100%" height="40px" />
        } @else {
          <p-select
            [options]="facade.promociones()"
            optionLabel="label"
            optionValue="id"
            placeholder="Seleccionar promoción archivada..."
            [ngModel]="facade.selectedPromocionId()"
            (ngModelChange)="onPromoChange($event)"
            styleClass="w-full"
            [style]="{ height: '40px' }"
            data-llm-description="select archived professional promotion"
          />
        }
      </div>
      <div>
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted"
          >Curso</label
        >
        <p-select
          [options]="facade.cursos()"
          optionLabel="label"
          optionValue="id"
          placeholder="Seleccionar curso..."
          [ngModel]="facade.selectedCursoId()"
          (ngModelChange)="onCursoChange($event)"
          styleClass="w-full"
          [style]="{ height: '40px' }"
          [disabled]="facade.cursos().length === 0"
          data-llm-description="select course within archived promotion"
        />
      </div>
    </section>

    <!-- ═══ Info de la promoción seleccionada ═══ -->
    @if (selectedPromocion()) {
      @let promo = selectedPromocion()!;
      <div
        class="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-border px-4 py-3 bg-surface"
      >
        <app-icon name="archive" [size]="16" color="var(--text-muted)" />
        <div class="flex-1 min-w-0">
          <span class="text-sm font-semibold text-primary">{{ promo.name }}</span>
          <span
            class="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded"
            style="background: var(--bg-elevated); color: var(--text-muted);"
          >
            {{ promo.code }}
          </span>
        </div>
        <div class="flex items-center gap-1.5 text-xs text-secondary">
          <app-icon name="calendar" [size]="13" />
          {{ promo.startDate | date: 'dd/MM/yyyy' }}
          @if (promo.endDate) {
            → {{ promo.endDate | date: 'dd/MM/yyyy' }}
          }
        </div>
        <!-- Cursos disponibles como pills -->
        <div class="flex items-center gap-1">
          @for (curso of facade.cursos(); track curso.id) {
            <button
              class="curso-pill text-xs font-semibold px-2 py-0.5 rounded-full border transition-all"
              [class.curso-pill--active]="facade.selectedCursoId() === curso.id"
              (click)="onCursoChange(curso.id)"
              [title]="curso.courseName"
              data-llm-action="select-archived-course"
            >
              {{ curso.licenseClass }}
            </button>
          }
        </div>
      </div>
    }

    <!-- ═══ Estado vacío (nada seleccionado) ═══ -->
    @if (!facade.isLoading() && !facade.selectedPromocionId()) {
      <div class="mt-16 flex flex-col items-center gap-4 text-center">
        @if (facade.promociones().length === 0) {
          <app-icon name="folder-open" [size]="52" color="var(--text-muted)" />
          <div>
            <p class="text-sm font-medium text-primary">No hay promociones archivadas</p>
            <p class="mt-1 text-xs text-muted">
              Las promociones aparecerán aquí una vez que cambien a estado "Finalizada".
            </p>
          </div>
        } @else {
          <app-icon name="history" [size]="52" color="var(--text-muted)" />
          <div>
            <p class="text-sm font-medium text-primary">Selecciona una promoción</p>
            <p class="mt-1 text-xs text-muted">
              Elige una promoción del desplegable para consultar su historial de asistencia y notas.
            </p>
          </div>
        }
      </div>
    }

    <!-- ═══ Seleccionada promoción pero sin curso ═══ -->
    @if (facade.selectedPromocionId() && !facade.selectedCursoId() && !facade.isLoadingAlumnos()) {
      <div class="mt-12 flex flex-col items-center gap-3 text-center">
        <app-icon name="book-open" [size]="44" color="var(--text-muted)" />
        <p class="text-sm text-muted">Selecciona un curso para ver el historial de alumnos.</p>
      </div>
    }

    <!-- ═══ KPIs (cuando hay curso seleccionado) ═══ -->
    @if (facade.selectedCursoId()) {
      <section class="grid grid-cols-2 gap-4 mt-6 md:grid-cols-4">
        <app-kpi-card-variant
          label="Total alumnos"
          [value]="facade.kpis().totalAlumnos"
          icon="users"
          [loading]="facade.isLoadingAlumnos()"
          data-llm-description="Total de alumnos en el curso archivado"
        />
        <app-kpi-card-variant
          label="Aprobados"
          [value]="facade.kpis().aprobados"
          icon="check-circle"
          color="success"
          [loading]="facade.isLoadingAlumnos()"
          data-llm-description="Alumnos que aprobaron el curso"
        />
        <app-kpi-card-variant
          label="Reprobados"
          [value]="facade.kpis().reprobados"
          icon="x-circle"
          color="error"
          [loading]="facade.isLoadingAlumnos()"
          data-llm-description="Alumnos que reprobaron el curso"
        />
        <app-kpi-card-variant
          label="% Aprobación"
          [value]="facade.kpis().pctAprobacion"
          suffix="%"
          icon="trending-up"
          [loading]="facade.isLoadingAlumnos()"
          data-llm-description="Porcentaje de aprobación del curso"
        />
      </section>
    }

    <!-- ═══ Tabla de alumnos ═══ -->
    @if (facade.selectedCursoId()) {
      <section class="mt-6">
        <div class="mb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <app-icon name="list-checks" [size]="16" color="var(--ds-brand)" />
            <h2 class="text-sm font-semibold text-primary">Resultados por alumno</h2>
            <span class="text-xs text-muted ml-1">
              {{ cursoLabel() }}
            </span>
          </div>
          <div class="flex items-center gap-3 text-xs text-secondary">
            <span class="flex items-center gap-1.5">
              <span
                class="h-2.5 w-2.5 rounded-full"
                style="background: var(--state-success)"
              ></span>
              Aprobado (≥75)
            </span>
            <span class="flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-full" style="background: var(--state-error)"></span>
              Reprobado (&lt;75)
            </span>
          </div>
        </div>

        <!-- Skeleton de carga -->
        @if (facade.isLoadingAlumnos()) {
          <div class="card p-4 flex flex-col gap-3">
            @for (i of skeletonRows; track $index) {
              <app-skeleton-block variant="text" width="100%" height="44px" />
            }
          </div>
        } @else if (facade.alumnos().length === 0) {
          <div class="card p-10 text-center">
            <app-icon name="users" [size]="40" color="var(--text-muted)" class="mb-3" />
            <p class="text-sm font-medium text-primary">Sin alumnos en este curso</p>
            <p class="mt-1 text-xs text-muted">
              No hay matrículas registradas para este curso archivado.
            </p>
          </div>
        } @else {
          <!-- Tabla con scroll horizontal para los 7 módulos -->
          <div class="card overflow-hidden">
            <div class="overflow-x-auto">
              <table class="archivo-table w-full">
                <thead>
                  <tr>
                    <th class="text-left sticky-col">Alumno</th>
                    <!-- Asistencia -->
                    <th
                      class="text-center"
                      [pTooltip]="'Sesiones teóricas asistidas / total'"
                      tooltipPosition="top"
                    >
                      Teoría
                    </th>
                    <th
                      class="text-center"
                      [pTooltip]="'Sesiones prácticas asistidas / total'"
                      tooltipPosition="top"
                    >
                      Práctica
                    </th>
                    <!-- Módulos 1-7 -->
                    @for (name of facade.moduleNames(); track $index) {
                      <th
                        class="text-center"
                        style="min-width: 72px"
                        [pTooltip]="name"
                        tooltipPosition="top"
                      >
                        M{{ $index + 1 }}
                      </th>
                    }
                    <!-- Promedio + estado -->
                    <th class="text-center" style="min-width: 88px">Promedio</th>
                    <th class="text-center" style="min-width: 110px">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (alumno of facade.alumnos(); track alumno.enrollmentId) {
                    <tr>
                      <!-- Alumno -->
                      <td class="sticky-col">
                        <div class="flex items-center gap-2.5">
                          <div class="initials-avatar">{{ alumno.initials }}</div>
                          <div class="min-w-0">
                            <p class="text-sm font-medium text-primary truncate">
                              {{ alumno.nombre }}
                            </p>
                            <p class="text-xs text-muted">{{ alumno.rut }}</p>
                          </div>
                        </div>
                      </td>

                      <!-- Asistencia Teoría -->
                      <td class="text-center">
                        <div class="flex flex-col items-center gap-0.5">
                          <span class="text-xs text-secondary font-medium">
                            {{ alumno.teoriaAsistida }}/{{ alumno.teoriaTotal }}
                          </span>
                          @if (alumno.pctTeoria !== null) {
                            <span
                              class="pct-badge"
                              [class.pct-ok]="alumno.pctTeoria >= 75"
                              [class.pct-warn]="alumno.pctTeoria >= 50 && alumno.pctTeoria < 75"
                              [class.pct-danger]="alumno.pctTeoria < 50"
                            >
                              {{ alumno.pctTeoria }}%
                            </span>
                          } @else {
                            <span class="text-xs text-muted">—</span>
                          }
                        </div>
                      </td>

                      <!-- Asistencia Práctica -->
                      <td class="text-center">
                        <div class="flex flex-col items-center gap-0.5">
                          <span class="text-xs text-secondary font-medium">
                            {{ alumno.practicaAsistida }}/{{ alumno.practicaTotal }}
                          </span>
                          @if (alumno.pctPractica !== null) {
                            <span
                              class="pct-badge"
                              [class.pct-ok]="alumno.pctPractica >= 75"
                              [class.pct-warn]="alumno.pctPractica >= 50 && alumno.pctPractica < 75"
                              [class.pct-danger]="alumno.pctPractica < 50"
                            >
                              {{ alumno.pctPractica }}%
                            </span>
                          } @else {
                            <span class="text-xs text-muted">—</span>
                          }
                        </div>
                      </td>

                      <!-- Notas de módulos (7 celdas) -->
                      @for (nota of alumno.notas; track nota.moduleNumber) {
                        <td class="text-center px-1">
                          @if (nota.grade !== null) {
                            <span
                              class="grade-cell"
                              [class.grade-pass]="nota.passed === true"
                              [class.grade-fail]="nota.passed === false"
                            >
                              {{ nota.grade }}
                            </span>
                          } @else {
                            <span class="grade-cell grade-empty">—</span>
                          }
                        </td>
                      }

                      <!-- Promedio -->
                      <td class="text-center">
                        @if (alumno.notaPromedio !== null) {
                          <span
                            class="promedio-badge"
                            [class.promedio-pass]="alumno.promedioAprobado === true"
                            [class.promedio-fail]="alumno.promedioAprobado === false"
                          >
                            {{ alumno.notaPromedio }}
                          </span>
                        } @else {
                          <span class="text-muted text-xs">—</span>
                        }
                      </td>

                      <!-- Estado final -->
                      <td class="text-center">
                        @if (alumno.aprobado) {
                          <span class="estado-badge estado-aprobado">
                            <app-icon name="check-circle" [size]="11" />
                            Aprobado
                          </span>
                        } @else {
                          <span class="estado-badge estado-reprobado">
                            <app-icon name="x-circle" [size]="11" />
                            Reprobado
                          </span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Footer: resumen de criterios -->
            <div
              class="px-4 py-3 flex flex-wrap items-center gap-4 text-xs text-muted"
              style="border-top: 1px solid var(--border-subtle); background: var(--bg-elevated);"
            >
              <app-icon name="info" [size]="13" />
              <span>Aprobación requiere: asistencia teórica ≥ 75% y promedio de módulos ≥ 75</span>
              <span class="ml-auto">Escala MTT: 10–100 · Mínimo aprobación: 75</span>
            </div>
          </div>
        }
      </section>
    }
  `,
  styles: `
    .archivo-table {
      border-collapse: collapse;
    }
    .archivo-table th {
      padding: 10px 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-elevated);
      white-space: nowrap;
    }
    .archivo-table td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border-subtle);
      vertical-align: middle;
    }
    .archivo-table tr:last-child td {
      border-bottom: none;
    }
    .archivo-table tr:hover td {
      background: var(--bg-subtle, rgba(0, 0, 0, 0.02));
    }

    .sticky-col {
      position: sticky;
      left: 0;
      background: var(--bg-surface, var(--bg-base));
      z-index: 1;
      min-width: 200px;
      box-shadow: 2px 0 6px -2px rgba(0, 0, 0, 0.06);
    }
    .archivo-table tr:hover .sticky-col {
      background: var(--bg-subtle, rgba(0, 0, 0, 0.02));
    }

    .initials-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      font-size: 10px;
      font-weight: 700;
      flex-shrink: 0;
      background: var(--color-primary-tint, color-mix(in srgb, var(--ds-brand) 12%, transparent));
      color: var(--ds-brand);
    }

    .pct-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
    }
    .pct-ok {
      background: color-mix(in srgb, var(--state-success) 12%, transparent);
      color: var(--state-success);
    }
    .pct-warn {
      background: color-mix(in srgb, var(--state-warning) 12%, transparent);
      color: var(--state-warning);
    }
    .pct-danger {
      background: color-mix(in srgb, var(--state-error) 12%, transparent);
      color: var(--state-error);
    }

    .grade-cell {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 50px;
      padding: 4px 6px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
    }
    .grade-pass {
      background: color-mix(in srgb, var(--state-success) 10%, transparent);
      color: var(--state-success);
      border: 1px solid color-mix(in srgb, var(--state-success) 25%, transparent);
    }
    .grade-fail {
      background: color-mix(in srgb, var(--state-error) 10%, transparent);
      color: var(--state-error);
      border: 1px solid color-mix(in srgb, var(--state-error) 25%, transparent);
    }
    .grade-empty {
      color: var(--text-muted);
      font-size: 14px;
    }

    .promedio-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
    }
    .promedio-pass {
      background: color-mix(in srgb, var(--state-success) 14%, transparent);
      color: var(--state-success);
    }
    .promedio-fail {
      background: color-mix(in srgb, var(--state-error) 14%, transparent);
      color: var(--state-error);
    }

    .estado-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
    .estado-aprobado {
      background: color-mix(in srgb, var(--state-success) 12%, transparent);
      color: var(--state-success);
    }
    .estado-reprobado {
      background: color-mix(in srgb, var(--state-error) 12%, transparent);
      color: var(--state-error);
    }

    .curso-pill {
      background: transparent;
      border-color: var(--border-default);
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 11px;
    }
    .curso-pill:hover {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
    }
    .curso-pill--active {
      background: color-mix(in srgb, var(--ds-brand) 10%, transparent);
      border-color: var(--ds-brand);
      color: var(--ds-brand);
    }
  `,
})
export class AdminProfesionalArchivoComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(ArchivoFacade);
  private readonly branchFacade = inject(BranchFacade);

  protected readonly skeletonRows = Array.from({ length: 5 });

  protected readonly selectedPromocion = computed(() => {
    const id = this.facade.selectedPromocionId();
    return this.facade.promociones().find((p) => p.id === id) ?? null;
  });

  protected readonly cursoLabel = computed(() => {
    const id = this.facade.selectedCursoId();
    return this.facade.cursos().find((c) => c.id === id)?.label ?? '';
  });

  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
    void this.facade.initialize();
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }

  protected onPromoChange(id: number | null): void {
    void this.facade.selectPromocion(id);
  }

  protected onCursoChange(id: number | null): void {
    void this.facade.selectCurso(id);
  }
}
