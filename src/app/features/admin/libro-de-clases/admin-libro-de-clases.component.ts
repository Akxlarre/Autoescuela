import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { BranchFacade } from '@core/facades/branch.facade';
import { LibroDeClasesFacade } from '@core/facades/libro-de-clases.facade';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { getModuleNames, MODULE_COUNT } from '@core/utils/professional-modules';

@Component({
  selector: 'app-admin-libro-de-clases',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
    AsyncBtnComponent,
    EmptyStateComponent,
    BentoGridLayoutDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- ═══ Hero ═══ -->
      <div class="bento-banner" #heroRef>
        <app-section-hero
          title="Libro de Clases"
          subtitle="Libro de control de clases — Clase Profesional"
          [actions]="heroActions()"
          (actionClick)="onHeroAction($event)"
        />
      </div>

      <!-- ═══ Filtros ═══ -->
      <div class="bento-banner card p-4">
        @if (facade.isLoading()) {
          <!-- Skeleton de selectores mientras cargan las promociones -->
          <div class="flex flex-col gap-4 sm:flex-row">
            <div class="flex-1 space-y-2">
              <app-skeleton-block variant="text" width="70px" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="40px" />
            </div>
            <div class="flex-1 space-y-2">
              <app-skeleton-block variant="text" width="48px" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="40px" />
            </div>
          </div>
        } @else {
          <div class="flex flex-col gap-4 sm:flex-row">
            <div class="flex-1">
              <label class="mb-1 block text-xs font-medium text-secondary">Promoción</label>
              <p-select
                [options]="promoOptions()"
                optionLabel="name"
                optionValue="id"
                placeholder="Seleccionar promoción"
                [ngModel]="facade.selectedPromocionId()"
                (ngModelChange)="onPromoChange($event)"
                styleClass="w-full"
                data-llm-description="select promotion for class book"
              />
            </div>
            <div class="flex-1">
              <label class="mb-1 block text-xs font-medium text-secondary">Curso</label>
              <p-select
                [options]="cursoOptions()"
                optionLabel="courseCode"
                optionValue="id"
                placeholder="Seleccionar curso"
                [ngModel]="facade.selectedCursoId()"
                (ngModelChange)="onCursoChange($event)"
                styleClass="w-full"
                [disabled]="facade.cursos().length === 0"
                data-llm-description="select course for class book"
              />
            </div>
          </div>
        }
      </div>

      <!-- ═══ Skeleton secciones — 7 filas slim que imitan secciones colapsadas ═══ -->
      @if (facade.isLoadingSections()) {
        @for (i of skeletonRows; track i) {
          <div class="bento-banner card flex items-center justify-between p-5">
            <div class="flex items-center gap-3">
              <app-skeleton-block variant="rect" width="18px" height="18px" />
              <app-skeleton-block variant="text" [width]="skeletonWidths[i % 4]" height="15px" />
            </div>
            <app-skeleton-block variant="rect" width="18px" height="18px" />
          </div>
        }
      }

      <!-- ═══ Error ═══ -->
      @if (facade.error(); as err) {
        <div class="bento-banner card p-4 text-center" style="color: var(--state-error)">
          <p>{{ err }}</p>
        </div>
      }

      <!-- ═══ Empty state — sin datos cargados ═══ -->
      @if (
        !facade.hasDatos() && !facade.isLoading() && !facade.isLoadingSections() && !facade.error()
      ) {
        <div class="bento-banner">
          <app-empty-state
            icon="book-open"
            message="Selecciona una promoción y un curso"
            subtitle="El libro de clases se cargará automáticamente al elegir un curso"
          />
        </div>
      }

      <!-- ═══ Contenido del Libro ═══ -->
      @if (facade.hasDatos() && !facade.isLoadingSections()) {
        <!-- ── 1. Cabecera — card-accent: acento de marca único de la página ── -->
        <section class="bento-banner card card-accent p-6">
          <button
            class="section-toggle"
            (click)="toggleSection('cabecera')"
            data-llm-action="toggle-cabecera-section"
          >
            <h2 class="text-lg font-semibold text-primary">
              <app-icon name="file-text" [size]="18" class="mr-2 inline-block align-text-bottom" />
              Libro de Control de Clases
            </h2>
            <app-icon
              [name]="isSectionOpen('cabecera') ? 'chevron-up' : 'chevron-down'"
              [size]="18"
            />
          </button>

          @if (isSectionOpen('cabecera')) {
            @if (facade.cabecera(); as cab) {
              <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="space-y-2 text-sm">
                  <p>
                    <span class="font-medium text-secondary">Autoescuela:</span>
                    {{ cab.branchName }}
                  </p>
                  <p><span class="font-medium text-secondary">Curso:</span> {{ cab.courseName }}</p>
                  <p>
                    <span class="font-medium text-secondary">Código:</span> {{ cab.courseCode }}
                  </p>
                  <p>
                    <span class="font-medium text-secondary">Licencia:</span> {{ cab.licenseClass }}
                  </p>
                </div>
                <div class="space-y-2 text-sm">
                  <p>
                    <span class="font-medium text-secondary">Promoción:</span>
                    {{ cab.promotionName }} ({{ cab.promotionCode }})
                  </p>
                  <p>
                    <span class="font-medium text-secondary">Fecha inicio:</span>
                    {{ formatDate(cab.startDate) }}
                  </p>
                  <p>
                    <span class="font-medium text-secondary">Fecha término:</span>
                    {{ formatDate(cab.endDate) }}
                  </p>
                  <p>
                    <span class="font-medium text-secondary">Dirección:</span>
                    {{ cab.branchAddress || '—' }}
                  </p>
                </div>
              </div>

              <!-- Campos editables del Libro -->
              <div class="mt-4 border-t pt-4" style="border-color: var(--border-default)">
                <h3 class="mb-3 text-sm font-semibold text-secondary">
                  <app-icon name="edit-3" [size]="14" class="mr-1 inline-block align-text-bottom" />
                  Datos del Libro de Clases
                </h3>
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label class="mb-1 block text-xs font-medium text-secondary">
                      Código Autorizado por SENCE
                    </label>
                    <input
                      type="text"
                      class="ldc-input"
                      placeholder="Ej: 1237920905"
                      [ngModel]="editSenceCode()"
                      (ngModelChange)="editSenceCode.set($event)"
                      data-llm-description="input for SENCE authorized code"
                    />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-medium text-secondary">Horario</label>
                    <input
                      type="text"
                      class="ldc-input"
                      placeholder="Ej: L-V 17:30-22:30, S 9:00-14:00"
                      [ngModel]="editHorario()"
                      (ngModelChange)="editHorario.set($event)"
                      data-llm-description="input for class schedule"
                    />
                  </div>
                </div>
                <div class="mt-3 flex items-center gap-3">
                  <app-async-btn
                    label="Guardar"
                    [loading]="facade.isSaving()"
                    loadingLabel="Guardando..."
                    [disabled]="!hasEditableChanges()"
                    (click)="onSaveClassBook()"
                    data-llm-action="save-class-book-fields"
                  />
                  @if (!hasEditableChanges()) {
                    <span class="text-xs text-muted">Sin cambios</span>
                  }
                </div>
              </div>
            }
          }
        </section>

        <!-- ── 2. Profesores por módulo ── -->
        <section class="bento-banner card p-6">
          <button
            class="section-toggle"
            (click)="toggleSection('profesores')"
            data-llm-action="toggle-profesores-section"
          >
            <h2 class="text-lg font-semibold text-primary">
              <app-icon name="users" [size]="18" class="mr-2 inline-block align-text-bottom" />
              Profesores por Módulo
              <span class="section-meta">{{ facade.profesores().length }} módulos</span>
            </h2>
            <app-icon
              [name]="isSectionOpen('profesores') ? 'chevron-up' : 'chevron-down'"
              [size]="18"
            />
          </button>

          @if (isSectionOpen('profesores')) {
            <div class="mt-4 overflow-x-auto">
              <table class="ldc-table">
                <thead>
                  <tr>
                    <th class="w-12">N°</th>
                    <th>Módulo</th>
                    <th>Nombre Profesor</th>
                  </tr>
                </thead>
                <tbody>
                  @for (prof of facade.profesores(); track prof.moduleNumber) {
                    <tr>
                      <td class="text-center">{{ prof.moduleNumber }}</td>
                      <td>{{ prof.moduleName }}</td>
                      <td>{{ prof.lecturerName }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <!-- ── 3. Lista de Clase ── -->
        <section class="bento-banner card p-6">
          <button
            class="section-toggle"
            (click)="toggleSection('alumnos')"
            data-llm-action="toggle-alumnos-section"
          >
            <h2 class="text-lg font-semibold text-primary">
              <app-icon
                name="list-checks"
                [size]="18"
                class="mr-2 inline-block align-text-bottom"
              />
              Lista de Clase
              <span class="ml-2 text-sm font-normal text-muted"
                >({{ facade.totalAlumnos() }} alumnos)</span
              >
            </h2>
            <app-icon
              [name]="isSectionOpen('alumnos') ? 'chevron-up' : 'chevron-down'"
              [size]="18"
            />
          </button>

          @if (isSectionOpen('alumnos')) {
            <div class="mt-4 overflow-x-auto">
              <table class="ldc-table">
                <thead>
                  <tr>
                    <th class="w-12">N°</th>
                    <th>Apellido, Nombre</th>
                    <th>RUN</th>
                    <th>Teléfono</th>
                    <th>Licencia</th>
                  </tr>
                </thead>
                <tbody>
                  @for (alumno of facade.alumnos(); track alumno.enrollmentId) {
                    <tr>
                      <td class="text-center">{{ alumno.numero }}</td>
                      <td>{{ alumno.nombre }}</td>
                      <td class="font-mono text-xs">{{ alumno.rut }}</td>
                      <td>{{ alumno.telefono || '—' }}</td>
                      <td class="text-center">{{ alumno.licenciaPostulada }}</td>
                    </tr>
                  }
                  @if (facade.alumnos().length === 0) {
                    <tr>
                      <td colspan="5" class="py-6 text-center text-muted">Sin alumnos inscritos</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <!-- ── 4. Control de Asistencia ── -->
        <section class="bento-banner card p-6">
          <button
            class="section-toggle"
            (click)="toggleSection('asistencia')"
            data-llm-action="toggle-asistencia-section"
          >
            <h2 class="text-lg font-semibold text-primary">
              <app-icon
                name="calendar-check"
                [size]="18"
                class="mr-2 inline-block align-text-bottom"
              />
              Control de Asistencia (Firma Diaria)
              <span class="section-meta">{{ facade.asistenciaSemanal().length }} semanas</span>
            </h2>
            <app-icon
              [name]="isSectionOpen('asistencia') ? 'chevron-up' : 'chevron-down'"
              [size]="18"
            />
          </button>

          @if (isSectionOpen('asistencia')) {
            <!-- Leyenda de estados -->
            <div class="mt-3 flex flex-wrap gap-3">
              <span class="flex items-center gap-1.5 text-xs text-secondary">
                <span class="attendance-present">P</span> Presente
              </span>
              <span class="flex items-center gap-1.5 text-xs text-secondary">
                <span class="attendance-absent">A</span> Ausente
              </span>
              <span class="flex items-center gap-1.5 text-xs text-secondary">
                <span class="attendance-excused">J</span> Justificado
              </span>
            </div>
            @if (facade.asistenciaSemanal().length === 0) {
              <p class="mt-4 text-sm text-muted">Sin sesiones registradas</p>
            }
            @for (semana of facade.asistenciaSemanal(); track semana.weekStartDate) {
              <div class="mt-4">
                <h3 class="mb-2 text-sm font-semibold text-secondary">{{ semana.weekLabel }}</h3>
                <div class="overflow-x-auto">
                  <table class="ldc-table ldc-table-compact">
                    <thead>
                      <tr>
                        <th class="w-12">N°</th>
                        <th class="min-w-45">Apellido, Nombre</th>
                        @for (dia of semana.dias; track dia.date) {
                          <th class="w-20 text-center">
                            <div class="text-xs">{{ dia.dayLabel }}</div>
                            <div class="text-[10px] text-muted">
                              {{ formatShortDate(dia.date) }}
                            </div>
                          </th>
                        }
                        <th class="w-20 text-center">Firma<br />Semanal</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (alumno of semana.alumnos; track alumno.enrollmentId; let idx = $index) {
                        <tr>
                          <td class="text-center">{{ idx + 1 }}</td>
                          <td class="text-xs">{{ alumno.nombre }}</td>
                          @for (status of alumno.asistenciaDias; track $index) {
                            <td class="text-center">
                              @if (status === 'present') {
                                <span class="attendance-present">P</span>
                              } @else if (status === 'absent') {
                                <span class="attendance-absent">A</span>
                              } @else if (status === 'excused') {
                                <span class="attendance-excused">J</span>
                              } @else {
                                <span class="text-muted">—</span>
                              }
                            </td>
                          }
                          <td class="text-center">
                            @if (alumno.firmaSemanal) {
                              <app-icon name="check" [size]="14" color="var(--state-success)" />
                            } @else {
                              <span class="text-muted">—</span>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          }
        </section>

        <!-- ── 5. Calendario de Clases ── -->
        <section class="bento-banner card p-6">
          <button
            class="section-toggle"
            (click)="toggleSection('calendario')"
            data-llm-action="toggle-calendario-section"
          >
            <h2 class="text-lg font-semibold text-primary">
              <app-icon name="calendar" [size]="18" class="mr-2 inline-block align-text-bottom" />
              Calendario de Clases
              <span class="section-meta">{{ facade.calendario().length }} clases</span>
            </h2>
            <app-icon
              [name]="isSectionOpen('calendario') ? 'chevron-up' : 'chevron-down'"
              [size]="18"
            />
          </button>

          @if (isSectionOpen('calendario')) {
            <div class="mt-4 overflow-x-auto">
              <table class="ldc-table">
                <thead>
                  <tr>
                    <th class="w-12">N°</th>
                    <th>Fecha</th>
                    <th>Asignatura</th>
                    <th class="w-20 text-center">Horas</th>
                    <th>Profesor</th>
                  </tr>
                </thead>
                <tbody>
                  @for (clase of facade.calendario(); track clase.numero) {
                    <tr>
                      <td class="text-center">{{ clase.numero }}</td>
                      <td>{{ formatDate(clase.fecha) }}</td>
                      <td>{{ clase.asignatura }}</td>
                      <td class="text-center">{{ clase.horas }}</td>
                      <td>{{ clase.profesor }}</td>
                    </tr>
                  }
                  @if (facade.calendario().length === 0) {
                    <tr>
                      <td colspan="5" class="py-6 text-center text-muted">
                        Sin clases programadas
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <!-- ── 6. Evaluaciones ── -->
        <section class="bento-banner card p-6">
          <button
            class="section-toggle"
            (click)="toggleSection('evaluaciones')"
            data-llm-action="toggle-evaluaciones-section"
          >
            <h2 class="text-lg font-semibold text-primary">
              <app-icon
                name="clipboard-list"
                [size]="18"
                class="mr-2 inline-block align-text-bottom"
              />
              Evaluaciones Clase Profesional
              <span class="section-meta">Escala MTT · Mín. 75</span>
            </h2>
            <app-icon
              [name]="isSectionOpen('evaluaciones') ? 'chevron-up' : 'chevron-down'"
              [size]="18"
            />
          </button>

          @if (isSectionOpen('evaluaciones')) {
            <div class="mt-4 overflow-x-auto">
              <table class="ldc-table ldc-table-compact">
                <thead>
                  <tr>
                    <th class="w-12">N°</th>
                    <th class="min-w-45">Apellido, Nombre</th>
                    @for (modName of moduleHeaders(); track $index) {
                      <th class="w-20 text-center text-[10px]">{{ modName }}</th>
                    }
                    <th class="w-20 text-center font-bold">Nota Final</th>
                  </tr>
                </thead>
                <tbody>
                  @for (fila of facade.evaluaciones(); track fila.rut; let idx = $index) {
                    <tr>
                      <td class="text-center">{{ idx + 1 }}</td>
                      <td class="text-xs">{{ fila.nombre }}</td>
                      @for (nota of fila.notas; track $index) {
                        <td class="text-center">
                          @if (nota !== null) {
                            <span [class.text-state-error]="nota < 75">{{ nota }}</span>
                          } @else {
                            <span class="text-muted">—</span>
                          }
                        </td>
                      }
                      <td class="text-center font-semibold">
                        @if (fila.notaFinal !== null) {
                          <span
                            [class.text-state-success]="fila.aprobado"
                            [class.text-state-error]="!fila.aprobado"
                          >
                            {{ fila.notaFinal }}
                          </span>
                        } @else {
                          <span class="text-muted">—</span>
                        }
                      </td>
                    </tr>
                  }
                  @if (facade.evaluaciones().length === 0) {
                    <tr>
                      <td [attr.colspan]="MODULE_COUNT + 3" class="py-6 text-center text-muted">
                        Sin evaluaciones registradas
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <!-- ── 7. Resumen Asistencia ── -->
        <section class="bento-banner card p-6">
          <button
            class="section-toggle"
            (click)="toggleSection('resumen')"
            data-llm-action="toggle-resumen-section"
          >
            <h2 class="text-lg font-semibold text-primary">
              <app-icon
                name="bar-chart-2"
                [size]="18"
                class="mr-2 inline-block align-text-bottom"
              />
              Asistencia Clase Profesional
              <span class="section-meta">{{ facade.resumenAsistencia().length }} alumnos</span>
            </h2>
            <app-icon
              [name]="isSectionOpen('resumen') ? 'chevron-up' : 'chevron-down'"
              [size]="18"
            />
          </button>

          @if (isSectionOpen('resumen')) {
            <div class="mt-4 overflow-x-auto">
              <table class="ldc-table">
                <thead>
                  <tr>
                    <th class="w-12">N°</th>
                    <th>Apellido, Nombre</th>
                    <th class="w-32 text-center">% Asistencia<br />Clase Práctica</th>
                    <th class="w-32 text-center">% Asistencia<br />Clase Teórica</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of facade.resumenAsistencia(); track r.nombre; let idx = $index) {
                    <tr>
                      <td class="text-center">{{ idx + 1 }}</td>
                      <td>{{ r.nombre }}</td>
                      <td class="text-center font-mono">
                        <span
                          [class.text-state-success]="r.pctPractica >= 75"
                          [class.text-state-warning]="r.pctPractica >= 50 && r.pctPractica < 75"
                          [class.text-state-error]="r.pctPractica < 50"
                        >
                          {{ r.pctPractica }}%
                        </span>
                      </td>
                      <td class="text-center font-mono">
                        <span
                          [class.text-state-success]="r.pctTeorica >= 75"
                          [class.text-state-warning]="r.pctTeorica >= 50 && r.pctTeorica < 75"
                          [class.text-state-error]="r.pctTeorica < 50"
                        >
                          {{ r.pctTeorica }}%
                        </span>
                      </td>
                    </tr>
                  }
                  @if (facade.resumenAsistencia().length === 0) {
                    <tr>
                      <td colspan="4" class="py-6 text-center text-muted">
                        Sin datos de asistencia
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .ldc-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    .ldc-table th {
      padding: 0.5rem 0.75rem;
      text-align: left;
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      color: var(--text-secondary);
      border-bottom: 2px solid var(--border-default);
      background: var(--bg-surface);
    }

    .ldc-table td {
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--border-default);
      color: var(--text-primary);
    }

    .ldc-table tbody tr:hover {
      background: var(--bg-surface-hover, var(--bg-surface));
    }

    .ldc-table-compact th,
    .ldc-table-compact td {
      padding: 0.25rem 0.5rem;
    }

    .text-state-success {
      color: var(--state-success);
    }
    .text-state-warning {
      color: var(--state-warning);
    }
    .text-state-error {
      color: var(--state-error);
    }

    .attendance-present {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 50%;
      font-size: 0.625rem;
      font-weight: 700;
      background: color-mix(in srgb, var(--state-success) 15%, transparent);
      color: var(--state-success);
    }

    .attendance-absent {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 50%;
      font-size: 0.625rem;
      font-weight: 700;
      background: color-mix(in srgb, var(--state-error) 15%, transparent);
      color: var(--state-error);
    }

    .attendance-excused {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 50%;
      font-size: 0.625rem;
      font-weight: 700;
      background: color-mix(in srgb, var(--state-warning) 15%, transparent);
      color: var(--state-warning);
    }

    .ldc-input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      border: 1px solid var(--border-default);
      border-radius: 0.5rem;
      background: var(--bg-surface);
      color: var(--text-primary);
      outline: none;
      transition: border-color 0.15s;
    }

    .ldc-input:focus {
      border-color: var(--color-primary);
    }

    .ldc-input::placeholder {
      color: var(--text-muted);
    }

    /* Botón colapsable de sección — hover con affordance visual */
    .section-toggle {
      display: flex;
      width: calc(100% + 1.5rem);
      align-items: center;
      justify-content: space-between;
      text-align: left;
      border-radius: 0.5rem;
      padding: 0.5rem 0.75rem;
      margin: -0.5rem -0.75rem;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .section-toggle:hover {
      background: var(
        --bg-surface-hover,
        color-mix(in srgb, var(--bg-surface) 92%, var(--text-primary))
      );
    }

    /* Metadato de conteo junto al título colapsado */
    .section-meta {
      margin-left: 0.5rem;
      font-size: 0.75rem;
      font-weight: 400;
      color: var(--text-muted);
    }
  `,
})
export class AdminLibroDeClasesComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly facade = inject(LibroDeClasesFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly gsap = inject(GsapAnimationsService);

  @ViewChild('bentoGrid') private readonly bentoGrid!: ElementRef<HTMLElement>;
  @ViewChild('heroRef') private readonly heroRef!: ElementRef<HTMLElement>;

  readonly MODULE_COUNT = MODULE_COUNT;

  /** 7 índices para el @for del skeleton de secciones */
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6];
  /** Anchos variados para que los skeletons no parezcan clones exactos */
  readonly skeletonWidths = ['160px', '200px', '220px', '175px'];

  private static readonly ALL_SECTIONS = [
    'cabecera',
    'profesores',
    'alumnos',
    'asistencia',
    'calendario',
    'evaluaciones',
    'resumen',
  ] as const;

  // ── Secciones colapsables — solo cabecera abierta por defecto ──────────────
  private readonly openSections = signal<Set<string>>(new Set(['cabecera']));

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly heroActions = computed<SectionHeroAction[]>(() => {
    if (!this.facade.hasDatos() || this.facade.isLoadingSections()) return [];
    return [
      {
        id: 'toggle-sections',
        label: this.allSectionsOpen() ? 'Colapsar todo' : 'Expandir todo',
        icon: this.allSectionsOpen() ? 'chevrons-up' : 'chevrons-down',
        primary: false,
      },
      {
        id: 'export-pdf',
        label: this.facade.isExporting() ? 'Generando PDF...' : 'Exportar PDF',
        icon: 'download',
        primary: true,
      },
    ];
  });

  readonly allSectionsOpen = computed(() =>
    AdminLibroDeClasesComponent.ALL_SECTIONS.every((s) => this.openSections().has(s)),
  );

  readonly promoOptions = computed(() =>
    this.facade.promociones().map((p) => ({
      ...p,
      name: `${p.name} (${p.code})`,
    })),
  );

  readonly cursoOptions = computed(() =>
    this.facade.cursos().map((c) => ({
      ...c,
      courseCode: `${c.courseCode} — ${c.courseName}`,
    })),
  );

  readonly moduleHeaders = computed(() => {
    const cab = this.facade.cabecera();
    if (!cab) return [];
    return getModuleNames(cab.licenseClass).map((_, i) => `Mód. ${i + 1}`);
  });

  // ── Campos editables ──────────────────────────────────────────────────────
  readonly editSenceCode = signal('');
  readonly editHorario = signal('');

  readonly hasEditableChanges = computed(() => {
    const cab = this.facade.cabecera();
    if (!cab) return false;
    return this.editSenceCode() !== cab.senceCode || this.editHorario() !== cab.horario;
  });

  constructor() {
    effect(() => {
      const _ = this.branchFacade.selectedBranchId();
      this.facade.reset();
      void this.facade.initialize();
    });

    // Sincronizar campos editables cuando cambia la cabecera
    effect(() => {
      const cab = this.facade.cabecera();
      if (cab) {
        this.editSenceCode.set(cab.senceCode);
        this.editHorario.set(cab.horario);
      }
    });
  }

  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
  }

  ngAfterViewInit(): void {
    if (this.heroRef) this.gsap.animateHero(this.heroRef.nativeElement);
    this.gsap.animateBentoGrid(this.bentoGrid.nativeElement);
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  onHeroAction(id: string): void {
    if (id === 'export-pdf') void this.facade.exportPdf();
    if (id === 'toggle-sections') this.toggleAllSections();
  }

  onPromoChange(id: number): void {
    void this.facade.selectPromocion(id);
  }

  onCursoChange(id: number): void {
    void this.facade.selectCurso(id);
  }

  onSaveClassBook(): void {
    void this.facade.saveClassBookFields(this.editSenceCode(), this.editHorario());
  }

  onExportPdf(): void {
    void this.facade.exportPdf();
  }

  toggleAllSections(): void {
    if (this.allSectionsOpen()) {
      this.openSections.set(new Set());
    } else {
      this.openSections.set(new Set(AdminLibroDeClasesComponent.ALL_SECTIONS));
    }
  }

  toggleSection(section: string): void {
    this.openSections.update((set) => {
      const next = new Set(set);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }

  isSectionOpen(section: string): boolean {
    return this.openSections().has(section);
  }

  // ── Formateo ───────────────────────────────────────────────────────────────

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatShortDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
