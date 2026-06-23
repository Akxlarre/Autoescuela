import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  AfterViewInit,
  ElementRef,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { BranchFacade } from '@core/facades/branch.facade';
import { ArchivoFacade } from '@core/facades/archivo-profesional.facade';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SectionHeroKpi } from '@core/models/ui/section-hero.model';

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
    SkeletonBlockComponent,
    IconComponent,
    BentoGridLayoutDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- ═══ Hero ═══ -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoadingAlumnos()"
        title="Archivo · Clase Profesional"
        subtitle="Historial completo de promociones finalizadas — asistencia y evaluaciones"
        [actions]="[]"
      />

      <!-- ═══ Buscador / Selector Principal & Cursos ═══ -->
      <section class="bento-banner bento-card p-5">
        <div class="flex flex-col md:flex-row gap-6">
          <!-- Selector -->
          <div class="flex-1 max-w-xl">
            <label class="mb-2 block text-sm font-semibold text-text-primary">
              Promoción archivada
            </label>
            <p class="mb-4 text-xs text-muted">
              Busca y selecciona una promoción archivada para revisar notas y asistencia.
            </p>

            @if (facade.isLoading()) {
              <app-skeleton-block variant="rect" width="100%" height="44px" />
            } @else {
              <p-select
                [options]="facade.promociones()"
                optionLabel="label"
                optionValue="id"
                placeholder="Buscar promoción (ej. Clase 123...)"
                [ngModel]="facade.selectedPromocionId()"
                (ngModelChange)="onPromoChange($event)"
                styleClass="w-full"
                [style]="{ height: '44px' }"
                appendTo="body"
                [filter]="true"
                filterPlaceholder="Buscar por nombre..."
                data-llm-description="select archived professional promotion"
              />
            }
          </div>

          <!-- Pills de cursos (solo visible si hay promo seleccionada) -->
          @if (facade.selectedPromocionId()) {
            <div class="flex-1 border-t md:border-t-0 md:border-l border-border-subtle pt-4 md:pt-0 md:pl-6">
              <label class="mb-2 block text-sm font-semibold text-text-primary">
                Cursos impartidos en esta promoción
              </label>
              <p class="mb-4 text-xs text-muted">
                Selecciona el curso para ver los resultados de los alumnos.
              </p>
              <div class="flex flex-wrap items-center gap-2">
                @for (curso of facade.cursos(); track curso.id) {
                  <button
                    class="curso-pill flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
                    [class.curso-pill--active]="facade.selectedCursoId() === curso.id"
                    (click)="onCursoChange(curso.id)"
                    [title]="curso.courseName"
                    data-llm-action="select-archived-course"
                  >
                    <app-icon name="book" [size]="13" />
                    {{ curso.licenseClass }}
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </section>

      <!-- ═══ Estado vacío (nada seleccionado) ═══ -->
      @if (!facade.isLoading() && !facade.selectedPromocionId()) {
        <div class="bento-banner bento-card flex flex-col items-center gap-4 text-center py-16">
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
                Elige una promoción del desplegable para consultar su historial de asistencia y
                notas.
              </p>
            </div>
          }
        </div>
      }

      <!-- ═══ Seleccionada promoción pero sin curso ═══ -->
      @if (
        facade.selectedPromocionId() && !facade.selectedCursoId() && !facade.isLoadingAlumnos()
      ) {
        <div class="bento-banner bento-card flex flex-col items-center gap-3 text-center py-12">
          <app-icon name="book-open" [size]="44" color="var(--text-muted)" />
          <p class="text-sm text-muted">Selecciona un curso para ver el historial de alumnos.</p>
        </div>
      }

      <!-- ═══ Tabla de alumnos ═══ -->
      @if (facade.selectedCursoId()) {
        <section class="bento-banner bento-card p-5">
          <div class="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <div class="flex items-center gap-2">
                <app-icon name="list-checks" [size]="16" color="var(--ds-brand)" />
                <h2 class="text-sm font-semibold text-text-primary m-0">Resultados por alumno</h2>
              </div>
              <span class="hidden sm:inline text-border-default">|</span>
              <span class="text-xs font-medium text-secondary">
                {{ cursoLabel() }}
              </span>
            </div>
            <div class="flex items-center gap-4 text-xs text-secondary bg-surface px-3 py-1.5 rounded-md border border-border-subtle w-fit">
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-success"></span>
                Aprobado (≥75)
              </span>
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-error"></span>
                Reprobado (&lt;75)
              </span>
            </div>
          </div>

          <!-- KPIs del Curso -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            @for (kpi of cursoKpis(); track kpi.id) {
              <div class="flex flex-col gap-1.5 p-4 rounded-xl border border-border-subtle bg-surface-elevated">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] uppercase font-bold text-muted tracking-wider">{{ kpi.label }}</span>
                  @if (kpi.icon) {
                    <app-icon [name]="kpi.icon" [size]="14" class="text-muted opacity-50" />
                  }
                </div>
                <span class="text-2xl font-bold" [class]="kpi.color ? 'text-' + kpi.color : 'text-text-primary'">
                  {{ kpi.value }}{{ kpi.suffix || '' }}
                </span>
              </div>
            }
          </div>

          <!-- Skeleton de carga -->
          @if (facade.isLoadingAlumnos()) {
            <div class="flex flex-col gap-3 pt-2">
              @for (i of skeletonRows; track $index) {
                <app-skeleton-block variant="text" width="100%" height="44px" />
              }
            </div>
          } @else if (facade.alumnos().length === 0) {
            <div class="p-10 text-center">
              <app-icon name="users" [size]="40" color="var(--text-muted)" class="mb-3" />
              <p class="text-sm font-medium text-primary">Sin alumnos en este curso</p>
              <p class="mt-1 text-xs text-muted">
                No hay matrículas registradas para este curso archivado.
              </p>
            </div>
          } @else {
            <!-- Desktop: Tabla con scroll horizontal -->
            <div class="hidden md:block overflow-hidden border border-border-subtle rounded-lg">
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
                                [class.pct-warn]="
                                  alumno.pctPractica >= 50 && alumno.pctPractica < 75
                                "
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
            </div>

            <!-- Mobile: Tarjetas responsivas -->
            <div class="flex flex-col gap-4 md:hidden">
              @for (alumno of facade.alumnos(); track alumno.enrollmentId) {
                <div class="p-4 rounded-xl border border-border-subtle bg-surface flex flex-col gap-4 shadow-sm">
                  <!-- Cabecera Alumno -->
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="initials-avatar shrink-0">{{ alumno.initials }}</div>
                      <div class="min-w-0 flex flex-col">
                        <p class="text-sm font-semibold text-text-primary truncate">{{ alumno.nombre }}</p>
                        <p class="text-[11px] text-muted">{{ alumno.rut }}</p>
                      </div>
                    </div>
                    <div class="shrink-0">
                      @if (alumno.aprobado) {
                        <span class="estado-badge estado-aprobado whitespace-nowrap">
                          <app-icon name="check-circle" [size]="11" /> Aprobado
                        </span>
                      } @else {
                        <span class="estado-badge estado-reprobado whitespace-nowrap">
                          <app-icon name="x-circle" [size]="11" /> Reprobado
                        </span>
                      }
                    </div>
                  </div>

                  <!-- Asistencia (Teoría y Práctica) -->
                  <div class="grid grid-cols-2 gap-px bg-border-subtle rounded-lg overflow-hidden border border-border-subtle">
                    <div class="bg-surface flex flex-col items-center p-2.5">
                      <span class="text-[10px] uppercase font-bold text-muted mb-1 tracking-wide">Teoría</span>
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-semibold text-text-primary">{{ alumno.teoriaAsistida }}/{{ alumno.teoriaTotal }}</span>
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
                    </div>
                    <div class="bg-surface flex flex-col items-center p-2.5">
                      <span class="text-[10px] uppercase font-bold text-muted mb-1 tracking-wide">Práctica</span>
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-semibold text-text-primary">{{ alumno.practicaAsistida }}/{{ alumno.practicaTotal }}</span>
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
                    </div>
                  </div>

                  <!-- Notas Módulos -->
                  <div>
                    <span class="text-[10px] uppercase font-bold text-muted block mb-2 tracking-wide">Evaluaciones</span>
                    <div class="flex flex-wrap gap-1.5">
                      @for (nota of alumno.notas; track nota.moduleNumber) {
                        <div class="flex flex-col items-center justify-center border border-border-subtle rounded-md p-1.5 flex-1 min-w-[36px]">
                          <span class="text-[9px] text-muted mb-1 font-medium">M{{ nota.moduleNumber }}</span>
                          @if (nota.grade !== null) {
                            <span
                              class="text-xs font-bold"
                              [class.text-success]="nota.passed === true"
                              [class.text-error]="nota.passed === false"
                            >
                              {{ nota.grade }}
                            </span>
                          } @else {
                            <span class="text-xs text-muted">—</span>
                          }
                        </div>
                      }
                      
                      <!-- Promedio Final -->
                      <div class="flex flex-col items-center justify-center border border-brand/20 bg-brand/5 rounded-md p-1.5 flex-1 min-w-[48px]">
                        <span class="text-[9px] text-brand font-bold mb-1 uppercase">Prom</span>
                        @if (alumno.notaPromedio !== null) {
                          <span class="text-sm font-bold text-brand">{{ alumno.notaPromedio }}</span>
                        } @else {
                          <span class="text-xs text-muted">—</span>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>

              <!-- Footer: resumen de criterios -->
              <div
                class="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 text-xs text-muted bg-surface border border-border-subtle rounded-lg mt-4"
              >
                <div class="flex items-center gap-2">
                  <app-icon name="info" [size]="13" />
                  <span>Aprobación requiere: asistencia teórica ≥ 75% y promedio de módulos ≥ 75</span>
                </div>
                <span class="sm:ml-auto">Escala MTT: 10–100 · Mínimo aprobación: 75</span>
              </div>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .bento-grid {
      /* Permitimos que el Hero dicte su propia altura sin dejar espacio vacío */
      --bento-row-min: auto;
    }

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
export class AdminProfesionalArchivoComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly facade = inject(ArchivoFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');

  protected readonly skeletonRows = Array.from({ length: 5 });

  protected readonly selectedPromocion = computed(() => {
    const id = this.facade.selectedPromocionId();
    return this.facade.promociones().find((p) => p.id === id) ?? null;
  });

  protected readonly cursoLabel = computed(() => {
    const id = this.facade.selectedCursoId();
    return this.facade.cursos().find((c) => c.id === id)?.label ?? '';
  });

  protected readonly cursoKpis = computed((): SectionHeroKpi[] => {
    if (!this.facade.selectedCursoId()) return [];
    return [
      {
        id: 'total',
        label: 'Total alumnos',
        value: this.facade.kpis().totalAlumnos,
        icon: 'users',
      },
      {
        id: 'aprobados',
        label: 'Aprobados',
        value: this.facade.kpis().aprobados,
        icon: 'check-circle',
        color: 'success',
      },
      {
        id: 'reprobados',
        label: 'Reprobados',
        value: this.facade.kpis().reprobados,
        icon: 'x-circle',
        color: 'error',
      },
      {
        id: 'pct',
        label: '% Aprobación',
        value: this.facade.kpis().pctAprobacion,
        icon: 'trending-up',
        suffix: '%',
      },
    ];
  });

  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
    void this.facade.initialize();
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
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
