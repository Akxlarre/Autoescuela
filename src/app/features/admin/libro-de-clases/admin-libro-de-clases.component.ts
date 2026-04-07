import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { BranchFacade } from '@core/facades/branch.facade';
import { LibroDeClasesFacade } from '@core/facades/libro-de-clases.facade';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { getModuleNames, MODULE_COUNT } from '@core/utils/professional-modules';

@Component({
  selector: 'app-admin-libro-de-clases',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, SectionHeroComponent, SkeletonBlockComponent, IconComponent],
  template: `
    <!-- ═══ Hero ═══ -->
    <app-section-hero
      title="Libro de Clases"
      subtitle="Libro de control de clases — Clase Profesional"
      [actions]="[]"
    />

    <!-- ═══ Acción Exportar PDF ═══ -->
    @if (facade.hasDatos() && !facade.isLoadingSections()) {
      <div class="mt-4 flex justify-end">
        <button
          class="flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
          style="background: var(--color-primary)"
          [disabled]="facade.isExporting()"
          (click)="onExportPdf()"
          data-llm-action="export-class-book-pdf"
        >
          @if (facade.isExporting()) {
            <span
              class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
            ></span>
            Generando PDF...
          } @else {
            <app-icon name="download" [size]="16" />
            Exportar PDF
          }
        </button>
      </div>
    }

    <!-- ═══ Filtros ═══ -->
    <section class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label class="mb-1 block text-xs font-medium text-secondary">Promoción</label>
        <p-select
          [options]="promoOptions()"
          optionLabel="name"
          optionValue="id"
          placeholder="Seleccionar promoción"
          [ngModel]="facade.selectedPromocionId()"
          (ngModelChange)="onPromoChange($event)"
          styleClass="w-full"
          [style]="{ height: '40px' }"
          data-llm-description="select promotion for class book"
        />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-secondary">Curso</label>
        <p-select
          [options]="cursoOptions()"
          optionLabel="courseCode"
          optionValue="id"
          placeholder="Seleccionar curso"
          [ngModel]="facade.selectedCursoId()"
          (ngModelChange)="onCursoChange($event)"
          styleClass="w-full"
          [style]="{ height: '40px' }"
          [disabled]="facade.cursos().length === 0"
          data-llm-description="select course for class book"
        />
      </div>
    </section>

    <!-- ═══ Loading ═══ -->
    @if (facade.isLoading() || facade.isLoadingSections()) {
      <div class="mt-8 space-y-4">
        <app-skeleton-block variant="text" width="100%" height="200px" />
        <app-skeleton-block variant="text" width="100%" height="300px" />
      </div>
    }

    <!-- ═══ Error ═══ -->
    @if (facade.error(); as err) {
      <div class="card mt-6 p-4 text-center" style="color: var(--state-error)">
        <p>{{ err }}</p>
      </div>
    }

    <!-- ═══ Contenido del Libro ═══ -->
    @if (facade.hasDatos() && !facade.isLoadingSections()) {
      <!-- ── 1. Cabecera ── -->
      <section class="card mt-6 p-6">
        <button
          class="flex w-full items-center justify-between text-left"
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
                  <span class="font-medium text-secondary">Autoescuela:</span> {{ cab.branchName }}
                </p>
                <p><span class="font-medium text-secondary">Curso:</span> {{ cab.courseName }}</p>
                <p><span class="font-medium text-secondary">Código:</span> {{ cab.courseCode }}</p>
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
                <button
                  class="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style="background: var(--color-primary)"
                  [disabled]="facade.isSaving() || !hasEditableChanges()"
                  (click)="onSaveClassBook()"
                  data-llm-action="save-class-book-fields"
                >
                  @if (facade.isSaving()) {
                    Guardando...
                  } @else {
                    Guardar
                  }
                </button>
                @if (!hasEditableChanges()) {
                  <span class="text-xs text-muted">Sin cambios</span>
                }
              </div>
            </div>
          }
        }
      </section>

      <!-- ── 2. Profesores por módulo ── -->
      <section class="card mt-4 p-6">
        <button
          class="flex w-full items-center justify-between text-left"
          (click)="toggleSection('profesores')"
          data-llm-action="toggle-profesores-section"
        >
          <h2 class="text-lg font-semibold text-primary">
            <app-icon name="users" [size]="18" class="mr-2 inline-block align-text-bottom" />
            Profesores por Módulo
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
      <section class="card mt-4 p-6">
        <button
          class="flex w-full items-center justify-between text-left"
          (click)="toggleSection('alumnos')"
          data-llm-action="toggle-alumnos-section"
        >
          <h2 class="text-lg font-semibold text-primary">
            <app-icon name="list-checks" [size]="18" class="mr-2 inline-block align-text-bottom" />
            Lista de Clase
            <span class="ml-2 text-sm font-normal text-muted"
              >({{ facade.totalAlumnos() }} alumnos)</span
            >
          </h2>
          <app-icon [name]="isSectionOpen('alumnos') ? 'chevron-up' : 'chevron-down'" [size]="18" />
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

      <!-- ── 4. Asistencia Diaria ── -->
      <section class="card mt-4 p-6">
        <button
          class="flex w-full items-center justify-between text-left"
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
          </h2>
          <app-icon
            [name]="isSectionOpen('asistencia') ? 'chevron-up' : 'chevron-down'"
            [size]="18"
          />
        </button>

        @if (isSectionOpen('asistencia')) {
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
                          <div class="text-[10px] text-muted">{{ formatShortDate(dia.date) }}</div>
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
      <section class="card mt-4 p-6">
        <button
          class="flex w-full items-center justify-between text-left"
          (click)="toggleSection('calendario')"
          data-llm-action="toggle-calendario-section"
        >
          <h2 class="text-lg font-semibold text-primary">
            <app-icon name="calendar" [size]="18" class="mr-2 inline-block align-text-bottom" />
            Calendario de Clases
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
                    <td colspan="5" class="py-6 text-center text-muted">Sin clases programadas</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- ── 6. Evaluaciones ── -->
      <section class="card mt-4 p-6">
        <button
          class="flex w-full items-center justify-between text-left"
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
      <section class="card mt-4 p-6 mb-6">
        <button
          class="flex w-full items-center justify-between text-left"
          (click)="toggleSection('resumen')"
          data-llm-action="toggle-resumen-section"
        >
          <h2 class="text-lg font-semibold text-primary">
            <app-icon name="bar-chart-2" [size]="18" class="mr-2 inline-block align-text-bottom" />
            Asistencia Clase Profesional
          </h2>
          <app-icon [name]="isSectionOpen('resumen') ? 'chevron-up' : 'chevron-down'" [size]="18" />
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
                    <td colspan="4" class="py-6 text-center text-muted">Sin datos de asistencia</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    }
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
  `,
})
export class AdminLibroDeClasesComponent implements OnInit, OnDestroy {
  readonly facade = inject(LibroDeClasesFacade);
  private readonly branchFacade = inject(BranchFacade);

  readonly MODULE_COUNT = MODULE_COUNT;

  // ── Secciones colapsables ──────────────────────────────────────────────────
  private readonly openSections = signal<Set<string>>(
    new Set([
      'cabecera',
      'profesores',
      'alumnos',
      'asistencia',
      'calendario',
      'evaluaciones',
      'resumen',
    ]),
  );

  // ── Computed ───────────────────────────────────────────────────────────────
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

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

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
