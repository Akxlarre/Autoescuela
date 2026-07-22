import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { BranchFacade } from '@core/facades/branch.facade';
import { LibroDeClasesFacade } from '@core/facades/libro-de-clases.facade';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import type { LibroClasesSubnavSection } from '@core/models/ui/libro-clases-subnav.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { LibroDeClasesSubnavComponent } from '@shared/components/libro-de-clases-subnav/libro-de-clases-subnav.component';
import { getModuleNames, MODULE_COUNT } from '@core/utils/professional-modules';

@Component({
  selector: 'app-libro-de-clases',
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
    LibroDeClasesSubnavComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- ═══ Hero ═══ -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        title="Libro de Clases"
        subtitle="Libro de control de clases — Clase Profesional"
        [actions]="heroActions()"
        (actionClick)="onHeroAction($event)"
      />

      <!-- ═══ Filtros ═══ -->
      <div class="bento-banner card p-4" appCardHover>
        @if (facade.isLoading()) {
          <div class="flex flex-col gap-4 sm:flex-row">
            <div class="flex-1 space-y-1">
              <app-skeleton-block variant="text" width="70px" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="40px" />
            </div>
            <div class="flex-1 space-y-1">
              <app-skeleton-block variant="text" width="48px" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="40px" />
            </div>
          </div>
        } @else {
          <div class="flex flex-col gap-4 sm:flex-row">
            <div class="flex-1">
              <label class="mb-1 block text-xs font-medium text-text-secondary">Promoción</label>
              <p-select
                [options]="promoOptions()"
                optionLabel="name"
                optionValue="id"
                placeholder="Seleccionar promoción"
                [ngModel]="facade.selectedPromocionId()"
                (ngModelChange)="onPromoChange($event)"
                styleClass="w-full"
                appendTo="body"
                data-llm-description="select promotion for class book"
              />
            </div>
            <div class="flex-1">
              <label class="mb-1 block text-xs font-medium text-text-secondary">Curso</label>
              <p-select
                [options]="cursoOptions()"
                optionLabel="courseCode"
                optionValue="id"
                placeholder="Seleccionar curso"
                [ngModel]="facade.selectedCursoId()"
                (ngModelChange)="onCursoChange($event)"
                styleClass="w-full"
                appendTo="body"
                [disabled]="facade.cursos().length === 0"
                data-llm-description="select course for class book"
              />
            </div>
          </div>
        }
      </div>

      <!-- ═══ Skeleton secciones — imita el subnav + la card "Cabecera" (sección activa por defecto al entrar) ═══ -->
      @if (facade.isLoadingSections()) {
        <div class="bento-banner flex items-center">
          <div class="flex gap-1 p-1 rounded-xl bg-subtle w-full">
            @for (i of skeletonRows; track i) {
              <div class="flex-1 flex items-center justify-center py-3 px-2">
                <app-skeleton-block variant="text" width="70%" height="13px" />
              </div>
            }
          </div>
        </div>
        <section class="bento-banner card p-6">
          <app-skeleton-block variant="text" width="220px" height="20px" />
          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <!-- 4 líneas: Autoescuela, Curso, ID, Promoción -->
            <div class="space-y-2">
              <app-skeleton-block variant="text" width="85%" height="14px" />
              <app-skeleton-block variant="text" width="70%" height="14px" />
              <app-skeleton-block variant="text" width="60%" height="14px" />
              <app-skeleton-block variant="text" width="80%" height="14px" />
            </div>
            <!-- 3 líneas: Fecha inicio, Fecha término, Dirección -->
            <div class="space-y-2">
              <app-skeleton-block variant="text" width="65%" height="14px" />
              <app-skeleton-block variant="text" width="65%" height="14px" />
              <app-skeleton-block variant="text" width="75%" height="14px" />
            </div>
          </div>
          <div class="mt-4 border-t pt-4 border-border-default">
            <app-skeleton-block variant="text" width="180px" height="15px" />
            <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div class="mb-1">
                  <app-skeleton-block variant="text" width="60%" height="12px" />
                </div>
                <app-skeleton-block variant="rect" width="100%" height="40px" />
              </div>
              <div>
                <div class="mb-1">
                  <app-skeleton-block variant="text" width="40%" height="12px" />
                </div>
                <app-skeleton-block variant="rect" width="100%" height="40px" />
              </div>
            </div>
            <div class="mt-3 flex items-center gap-3">
              <app-skeleton-block variant="rect" width="100px" height="36px" />
              <app-skeleton-block variant="text" width="70px" height="12px" />
            </div>
          </div>
        </section>
      }

      <!-- ═══ Error ═══ -->
      @if (facade.error(); as err) {
        <div class="bento-banner card p-4 text-center text-error" appCardHover>
          <p>{{ err }}</p>
        </div>
      }

      <!-- ═══ Empty state ═══ -->
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
        <!-- ═══ Subnav: reemplaza el acordeón — una sola sección visible a la vez ═══ -->
        <div class="bento-banner flex items-center">
          <app-libro-de-clases-subnav
            [sections]="subnavSections()"
            [activeId]="activeSection()"
            (sectionChange)="onSectionChange($event)"
          />
        </div>

        @if (activeSection() === 'cabecera') {
          <section class="bento-banner card p-6" appCardHover>
            <h2 class="text-lg font-semibold text-text-primary">
              <app-icon name="file-text" [size]="18" class="mr-2 inline-block align-text-bottom" />
              Libro de Control de Clases
            </h2>
            @if (facade.cabecera(); as cab) {
              <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="space-y-2 text-sm">
                  <p>
                    <span class="font-medium text-text-secondary">Autoescuela:</span>
                    {{ cab.branchName }}
                  </p>
                  <p>
                    <span class="font-medium text-text-secondary">Curso:</span> {{ cab.courseName }}
                  </p>
                  <p>
                    <span class="font-medium text-text-secondary">ID:</span>
                    {{ cab.bookId || '—' }}
                  </p>
                  <p>
                    <span class="font-medium text-text-secondary">Promoción:</span>
                    {{ cab.promotionName }} ({{ cab.promotionCode }})
                  </p>
                </div>
                <div class="space-y-2 text-sm">
                  <p>
                    <span class="font-medium text-text-secondary">Fecha inicio:</span>
                    {{ formatDate(cab.startDate) }}
                  </p>
                  <p>
                    <span class="font-medium text-text-secondary">Fecha término:</span>
                    {{ formatDate(cab.endDate) }}
                  </p>
                  <p>
                    <span class="font-medium text-text-secondary">Dirección:</span>
                    {{ cab.branchAddress || '—' }}
                  </p>
                </div>
              </div>
              <div class="mt-4 border-t pt-4 border-border-default">
                <h3 class="mb-3 text-sm font-semibold text-text-secondary">
                  <app-icon name="edit-3" [size]="14" class="mr-1 inline-block align-text-bottom" />
                  Datos del Libro de Clases
                </h3>
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label class="mb-1 block text-xs font-medium text-text-secondary"
                      >Código Autorizado por SENCE</label
                    >
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
                    <label class="mb-1 block text-xs font-medium text-text-secondary"
                      >Horario</label
                    >
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
                    <span class="text-xs text-text-muted">Sin cambios</span>
                  }
                </div>
              </div>
            }
          </section>
        }

        @if (activeSection() === 'profesores') {
          <section class="bento-banner card p-6" appCardHover>
            <h2 class="text-lg font-semibold text-text-primary">
              <app-icon name="users" [size]="18" class="mr-2 inline-block align-text-bottom" />
              Profesores por Módulo
              <span class="section-meta">{{ facade.profesores().length }} módulos</span>
            </h2>
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
          </section>
        }

        @if (activeSection() === 'alumnos') {
          <section class="bento-banner card p-6" appCardHover>
            <h2 class="text-lg font-semibold text-text-primary">
              <app-icon
                name="list-checks"
                [size]="18"
                class="mr-2 inline-block align-text-bottom"
              />
              Lista de Clase
              <span class="ml-2 text-sm font-normal text-text-muted"
                >({{ facade.totalAlumnos() }} alumnos)</span
              >
            </h2>
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
                      <td colspan="5" class="py-6 text-center text-text-muted">
                        Sin alumnos inscritos
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        @if (activeSection() === 'asistencia') {
          <section class="bento-banner card p-6" appCardHover>
            <h2 class="text-lg font-semibold text-text-primary">
              <app-icon
                name="calendar-check"
                [size]="18"
                class="mr-2 inline-block align-text-bottom"
              />
              Control de Asistencia (Firma Diaria)
              <span class="section-meta">{{ facade.asistenciaSemanal().length }} semanas</span>
            </h2>
            <div class="mt-3 flex flex-wrap gap-3">
              <span class="flex items-center gap-1.5 text-xs text-text-secondary"
                ><span class="attendance-present">P</span> Presente</span
              >
              <span class="flex items-center gap-1.5 text-xs text-text-secondary"
                ><span class="attendance-absent">A</span> Ausente</span
              >
              <span class="flex items-center gap-1.5 text-xs text-text-secondary"
                ><span class="attendance-excused">J</span> Justificado</span
              >
            </div>
            @if (facade.asistenciaSemanal().length === 0) {
              <p class="mt-4 text-sm text-text-muted">Sin sesiones registradas</p>
            }
            @for (semana of facade.asistenciaSemanal(); track semana.weekStartDate) {
              <div class="mt-4">
                <h3 class="mb-2 text-sm font-semibold text-text-secondary">
                  {{ semana.weekLabel }}
                </h3>
                <div class="overflow-x-auto">
                  <table class="ldc-table ldc-table-compact">
                    <thead>
                      <tr>
                        <th class="w-12">N°</th>
                        <th class="min-w-45">Apellido, Nombre</th>
                        @for (dia of semana.dias; track dia.date) {
                          <th class="w-20 text-center">
                            <div class="text-xs">{{ dia.dayLabel }}</div>
                            <div class="text-2xs text-text-muted">
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
                                <span class="text-text-muted">—</span>
                              }
                            </td>
                          }
                          <td class="text-center">
                            @if (alumno.firmaSemanal) {
                              <app-icon name="check" [size]="14" color="var(--state-success)" />
                            } @else {
                              <span class="text-text-muted">—</span>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </section>
        }

        @if (activeSection() === 'calendario') {
          <section class="bento-banner card p-6" appCardHover>
            <h2 class="text-lg font-semibold text-text-primary">
              <app-icon name="calendar" [size]="18" class="mr-2 inline-block align-text-bottom" />
              Calendario de Clases
              <span class="section-meta">{{ facade.calendario().length }} clases</span>
            </h2>
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
                      <td colspan="5" class="py-6 text-center text-text-muted">
                        Sin clases programadas
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        @if (activeSection() === 'evaluaciones') {
          <section class="bento-banner card p-6" appCardHover>
            <h2 class="text-lg font-semibold text-text-primary">
              <app-icon
                name="clipboard-list"
                [size]="18"
                class="mr-2 inline-block align-text-bottom"
              />
              Evaluaciones Clase Profesional
              <span class="section-meta">Escala MTT · Mín. 75</span>
            </h2>
            <div class="mt-4 overflow-x-auto">
              <table class="ldc-table ldc-table-compact">
                <thead>
                  <tr>
                    <th class="w-12">N°</th>
                    <th class="min-w-45">Apellido, Nombre</th>
                    @for (modName of moduleHeaders(); track $index) {
                      <th class="w-20 text-center text-2xs">{{ modName }}</th>
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
                            <span [class.text-error]="nota < 75">{{ nota }}</span>
                          } @else {
                            <span class="text-text-muted">—</span>
                          }
                        </td>
                      }
                      <td class="text-center font-semibold">
                        @if (fila.notaFinal !== null) {
                          <span
                            [class.text-success]="fila.aprobado"
                            [class.text-error]="!fila.aprobado"
                            >{{ fila.notaFinal }}</span
                          >
                        } @else {
                          <span class="text-text-muted">—</span>
                        }
                      </td>
                    </tr>
                  }
                  @if (facade.evaluaciones().length === 0) {
                    <tr>
                      <td
                        [attr.colspan]="MODULE_COUNT + 3"
                        class="py-6 text-center text-text-muted"
                      >
                        Sin evaluaciones registradas
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        @if (activeSection() === 'resumen') {
          <section class="bento-banner card p-6" appCardHover>
            <h2 class="text-lg font-semibold text-text-primary">
              <app-icon
                name="bar-chart-2"
                [size]="18"
                class="mr-2 inline-block align-text-bottom"
              />
              Asistencia Clase Profesional
              <span class="section-meta">{{ facade.resumenAsistencia().length }} alumnos</span>
            </h2>
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
                          [class.text-success]="r.pctPractica >= 75"
                          [class.text-warning]="r.pctPractica >= 50 && r.pctPractica < 75"
                          [class.text-error]="r.pctPractica < 50"
                          >{{ r.pctPractica }}%</span
                        >
                      </td>
                      <td class="text-center font-mono">
                        <span
                          [class.text-success]="r.pctTeorica >= 75"
                          [class.text-warning]="r.pctTeorica >= 50 && r.pctTeorica < 75"
                          [class.text-error]="r.pctTeorica < 50"
                          >{{ r.pctTeorica }}%</span
                        >
                      </td>
                    </tr>
                  }
                  @if (facade.resumenAsistencia().length === 0) {
                    <tr>
                      <td colspan="4" class="py-6 text-center text-text-muted">
                        Sin datos de asistencia
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
      }
    </div>
  `,
  styles: `
    .bento-grid {
      /* Permite que cada fila mida según su contenido real (hero slim, secciones
         variables) en vez de imponer un piso de 120px por fila. */
      --bento-row-min: auto;
    }

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
      background: var(--bg-subtle, var(--bg-surface));
    }
    .ldc-table-compact th,
    .ldc-table-compact td {
      padding: 0.25rem 0.5rem;
    }
    .text-success {
      color: var(--state-success);
    }
    .text-warning {
      color: var(--state-warning);
    }
    .text-error {
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
    .section-meta {
      margin-left: 0.5rem;
      font-size: 0.75rem;
      font-weight: 400;
      color: var(--text-muted);
    }
  `,
})
export class LibroDeClasesComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly facade = inject(LibroDeClasesFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly gsap = inject(GsapAnimationsService);

  @ViewChild('bentoGrid') private readonly bentoGrid!: ElementRef<HTMLElement>;

  readonly MODULE_COUNT = MODULE_COUNT;
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6];

  /** Sección visible del subnav — reemplaza el `openSections: Set<string>` del acordeón. */
  readonly activeSection = signal<string>('cabecera');

  readonly heroActions = computed<SectionHeroAction[]>(() => {
    if (!this.facade.hasDatos() || this.facade.isLoadingSections()) return [];
    return [
      {
        id: 'export-pdf',
        label: this.facade.isExporting() ? 'Generando PDF...' : 'Exportar PDF',
        icon: 'download',
        primary: true,
      },
    ];
  });

  readonly subnavSections = computed<LibroClasesSubnavSection[]>(() => [
    { id: 'cabecera', label: 'Cabecera', shortLabel: 'Cab.', icon: 'file-text' },
    {
      id: 'profesores',
      label: 'Profesores por Módulo',
      shortLabel: 'Prof.',
      icon: 'users',
      meta: `${this.facade.profesores().length}`,
    },
    {
      id: 'alumnos',
      label: 'Lista de Clase',
      shortLabel: 'Alum.',
      icon: 'list-checks',
      meta: `${this.facade.totalAlumnos()}`,
    },
    {
      id: 'asistencia',
      label: 'Firma Diaria',
      shortLabel: 'Firma',
      icon: 'calendar-check',
      meta: `${this.facade.asistenciaSemanal().length}`,
    },
    {
      id: 'calendario',
      label: 'Calendario de Clases',
      shortLabel: 'Cal.',
      icon: 'calendar',
      meta: `${this.facade.calendario().length}`,
    },
    { id: 'evaluaciones', label: 'Evaluaciones', shortLabel: 'Eval.', icon: 'clipboard-list' },
    {
      id: 'resumen',
      label: 'Resumen Asistencia',
      shortLabel: 'Res.',
      icon: 'bar-chart-2',
      meta: `${this.facade.resumenAsistencia().length}`,
    },
  ]);

  readonly promoOptions = computed(() =>
    this.facade.promociones().map((p) => ({ ...p, name: `${p.name} (${p.code})` })),
  );

  readonly cursoOptions = computed(() =>
    this.facade.cursos().map((c) => ({ ...c, courseCode: `${c.courseCode} — ${c.courseName}` })),
  );

  readonly moduleHeaders = computed(() => {
    const cab = this.facade.cabecera();
    if (!cab) return [];
    return getModuleNames(cab.licenseClass).map((_, i) => `Mód. ${i + 1}`);
  });

  readonly editSenceCode = signal('');
  readonly editHorario = signal('');

  readonly hasEditableChanges = computed(() => {
    const cab = this.facade.cabecera();
    if (!cab) return false;
    return this.editSenceCode() !== cab.senceCode || this.editHorario() !== cab.horario;
  });

  constructor() {
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
    this.facade.reset();
    void this.facade.initialize();
  }

  ngAfterViewInit(): void {
    this.gsap.animateBentoGrid(this.bentoGrid.nativeElement);
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }

  onHeroAction(id: string): void {
    if (id === 'export-pdf') void this.facade.exportPdf();
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

  onSectionChange(id: string): void {
    this.activeSection.set(id);
  }

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
