import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  inject,
  AfterViewInit,
  ElementRef,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { todayIso } from '@core/utils/date.utils';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { CiclosTeoricosContentComponent } from '@shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component';
import type {
  AlertaFaltaConsecutiva,
  AsistenciaClaseBKpis,
  ClasePracticaRow,
  ClasePracticaStatus,
  InstructorOption,
} from '@core/models/ui/asistencia-clase-b.model';
import type {
  CicloAlumno,
  CicloAlumnoMovible,
  CicloClaseRow,
  CicloOption,
} from '@core/models/ui/ciclos-teoricos.model';

type StatusFilter = ClasePracticaStatus | 'todos';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'presente', label: 'Presente' },
  { value: 'ausente', label: 'Ausente' },
  { value: 'en_curso', label: 'En Curso' },
  { value: 'pendiente', label: 'Pendiente' },
];

/**
 * AsistenciaClaseBContentComponent — Dumb component.
 * Consolida la vista de Control de Asistencia Clase B:
 *  - KPIs (tasa, inasistencias, riesgo, horarios eliminados)
 *  - Alertas de faltas consecutivas con acciones manuales
 *  - Clases teóricas grupales (Zoom)
 *  - Asistencia del día (prácticas individuales) con filtros
 */
@Component({
  selector: 'app-asistencia-clase-b-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
    DateInputComponent,
    CiclosTeoricosContentComponent,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- ── Section Hero ────────────────────────────────────────────────────── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="isLoading()"
        title="Control de Asistencia"
        icon="clipboard-check"
        [subtitle]="todayLabel"
        [kpis]="heroKpis()"
        [actions]="heroActions"
        (actionClick)="onHeroAction($event)"
      />

      <!-- ── Pestañas: Prácticas | Ciclos Teóricos ──────────────────────────── -->
      <div class="bento-banner flex items-center">
        <div
          class="flex gap-1.5 p-1.5 rounded-xl bg-subtle w-full"
          role="tablist"
          aria-label="Ver asistencia"
        >
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeTab() === 'practicas'"
            class="flex-1 px-5 py-3 rounded-lg text-base font-semibold transition-colors cursor-pointer border-0 flex items-center justify-center gap-2"
            [style.background]="activeTab() === 'practicas' ? 'var(--bg-surface)' : 'transparent'"
            [style.color]="activeTab() === 'practicas' ? 'var(--ds-brand)' : 'var(--text-muted)'"
            [style.boxShadow]="
              activeTab() === 'practicas'
                ? 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,.12)), inset 0 0 0 1.5px var(--ds-brand)'
                : 'none'
            "
            data-llm-action="tab-practicas"
            (click)="activeTab.set('practicas')"
          >
            <app-icon name="calendar-check" [size]="18" />
            Prácticas
          </button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeTab() === 'ciclos'"
            class="flex-1 px-5 py-3 rounded-lg text-base font-semibold transition-colors cursor-pointer border-0 flex items-center justify-center gap-2"
            [style.background]="activeTab() === 'ciclos' ? 'var(--bg-surface)' : 'transparent'"
            [style.color]="activeTab() === 'ciclos' ? 'var(--ds-brand)' : 'var(--text-muted)'"
            [style.boxShadow]="
              activeTab() === 'ciclos'
                ? 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,.12)), inset 0 0 0 1.5px var(--ds-brand)'
                : 'none'
            "
            data-llm-action="tab-ciclos"
            (click)="activeTab.set('ciclos')"
          >
            <app-icon name="video" [size]="18" />
            Ciclos Teóricos
          </button>
        </div>
      </div>

      <!-- ── Alertas ────────────────────────────────────────────────────────── -->
      @if (activeTab() === 'practicas' && !isLoading() && alertas().length > 0) {
        <div class="bento-banner flex flex-col gap-4">
          <section class="bento-banner card p-5 flex flex-col gap-4">
            <div class="flex items-center gap-2">
              <app-icon name="alert-triangle" [size]="18" [style.color]="'var(--state-warning)'" />
              <h2 class="text-sm font-semibold text-text-primary">Alertas y Acciones Urgentes</h2>
            </div>

            @for (alerta of alertas(); track alerta.enrollmentId) {
              <div
                class="flex items-start justify-between gap-4 rounded-lg px-4 py-3 border"
                [style.border-color]="
                  alerta.nivel === 'danger' ? 'var(--state-error)' : 'var(--state-warning)'
                "
                [style.background]="
                  alerta.nivel === 'danger' ? 'var(--state-error-bg)' : 'var(--state-warning-bg)'
                "
              >
                <!-- Info del alumno -->
                <div class="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
                    [style.background]="
                      alerta.nivel === 'danger' ? 'var(--state-error)' : 'var(--state-warning)'
                    "
                  >
                    {{ initials(alerta.alumnoName) }}
                  </div>
                  <div class="min-w-0">
                    <p
                      class="text-sm font-semibold truncate"
                      [style.color]="
                        alerta.nivel === 'danger' ? 'var(--state-error)' : 'var(--state-warning)'
                      "
                    >
                      {{ alerta.alumnoName }} — {{ alerta.faltasConsecutivas }}
                      {{
                        alerta.faltasConsecutivas === 1
                          ? 'falta consecutiva'
                          : 'faltas consecutivas'
                      }}
                    </p>
                    @if (alerta.nivel === 'danger') {
                      <p class="text-xs mt-0.5" [style.color]="'var(--state-error)'">
                        Última falta: {{ formatIsoDate(alerta.ultimaFechaFalta) }}
                      </p>
                      <p class="text-xs mt-0.5" [style.color]="'var(--state-error)'">
                        Política: 2 inasistencias consecutivas — acción manual requerida
                      </p>
                    } @else {
                      <p class="text-xs mt-0.5" [style.color]="'var(--state-warning)'">
                        Próxima inasistencia podría requerir eliminación del horario
                      </p>
                    }
                  </div>
                </div>

                <!-- Acciones -->
                <div class="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  @if (alerta.nivel === 'danger') {
                    @if (alerta.horarioActivo) {
                      <button
                        class="btn-primary text-xs px-3 py-1.5"
                        [disabled]="isSaving()"
                        data-llm-action="remove-schedule"
                        (click)="removeSchedule.emit(alerta.enrollmentId)"
                      >
                        Eliminar Horario
                      </button>
                    } @else {
                      <button
                        class="btn-secondary text-xs px-3 py-1.5"
                        [disabled]="isSaving()"
                        data-llm-action="reactivate-schedule"
                        (click)="reactivateSchedule.emit(alerta.enrollmentId)"
                      >
                        Reactivar Horario
                      </button>
                    }
                  } @else {
                    <button
                      class="btn-secondary text-xs px-3 py-1.5"
                      [disabled]="isSaving()"
                      data-llm-action="send-reminder"
                      (click)="sendReminder.emit(alerta.enrollmentId)"
                    >
                      Enviar Recordatorio
                    </button>
                  }
                </div>
              </div>
            }
          </section>
        </div>
      }

      <!-- ── Asistencia del Día (Prácticas) ─────────────────────────────── -->
      @if (activeTab() === 'practicas') {
        <div class="bento-banner flex flex-col gap-6">
          <section class="bento-banner card p-5 flex flex-col gap-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <app-icon
                  name="calendar-check"
                  [size]="18"
                  [style.color]="'var(--color-primary)'"
                />
                <h2 class="text-sm font-semibold text-primary">Asistencia del Día — Prácticas</h2>
              </div>
              <div class="flex items-center gap-2">
                <!-- Selector de fecha -->
                <div class="flex items-center gap-1.5">
                  <app-date-input
                    [value]="selectedDate()"
                    data-llm-description="Selector de fecha para clases prácticas"
                    (valueChange)="onDateChange($event)"
                  />
                  @if (isFutureDate()) {
                    <span
                      class="text-sm font-semibold px-2 py-2 rounded-full text-warning bg-warning/12"
                    >
                      Solo lectura
                    </span>
                  }
                </div>
                <button
                  class="btn-primary text-sm px-3 py-2 flex items-center gap-1.5"
                  data-llm-action="refresh-attendance"
                  (click)="refreshRequested.emit()"
                >
                  <app-icon name="refresh-cw" [size]="14" />
                  Actualizar
                </button>
              </div>
            </div>

            <!-- Filtros -->
            <div class="flex flex-wrap items-center gap-2">
              @for (f of statusFilters; track f.value) {
                <button
                  class="text-xs font-medium px-3 py-1.5 rounded-full border transition-colors"
                  [style.background]="
                    activeStatusFilter() === f.value ? 'var(--color-primary)' : 'transparent'
                  "
                  [style.color]="
                    activeStatusFilter() === f.value ? '#fff' : 'var(--text-secondary)'
                  "
                  [style.border-color]="
                    activeStatusFilter() === f.value
                      ? 'var(--color-primary)'
                      : 'var(--border-subtle)'
                  "
                  (click)="activeStatusFilter.set(f.value)"
                >
                  {{ f.label }}
                  @if (countByStatus(f.value) > 0) {
                    <span class="ml-1 opacity-80">({{ countByStatus(f.value) }})</span>
                  }
                </button>
              }

              <!-- Filtro instructor -->
              <div class="ml-auto">
                <p-select
                  [options]="instructorSelectOptions()"
                  optionLabel="label"
                  optionValue="value"
                  [ngModel]="selectedInstructorId()"
                  (ngModelChange)="selectedInstructorId.set($event)"
                  styleClass="w-auto"
                  data-llm-description="filter attendance by instructor"
                />
              </div>
            </div>

            <!-- Tabla -->
            @if (isLoading()) {
              <div class="flex flex-col gap-2">
                @for (i of [1, 2, 3, 4, 5]; track i) {
                  <app-skeleton-block variant="rect" width="100%" height="44px" />
                }
              </div>
            } @else if (filteredPracticas().length === 0) {
              <p class="text-sm text-text-secondary text-center py-6">
                No hay registros que coincidan con los filtros seleccionados.
              </p>
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b" [style.border-color]="'var(--border-subtle)'">
                      <th class="text-left text-xs font-semibold text-text-secondary pb-2 pr-4 w-20">
                        Agendada
                      </th>
                      <th class="text-left text-xs font-semibold text-text-secondary pb-2 pr-4 w-16">
                        Inicio
                      </th>
                      <th class="text-left text-xs font-semibold text-text-secondary pb-2 pr-4 w-16">
                        Fin
                      </th>
                      <th class="text-left text-xs font-semibold text-text-secondary pb-2 pr-4">Sede</th>
                      <th class="text-left text-xs font-semibold text-text-secondary pb-2 pr-4">
                        Instructor
                      </th>
                      <th class="text-left text-xs font-semibold text-text-secondary pb-2 pr-4">
                        Alumno
                      </th>
                      <th class="text-left text-xs font-semibold text-text-secondary pb-2 pr-4">
                        Vehículo
                      </th>
                      <th class="text-left text-xs font-semibold text-text-secondary pb-2 pr-4">
                        Estado
                      </th>
                      <th class="text-right text-xs font-semibold text-text-secondary pb-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of filteredPracticas(); track row.id) {
                      <tr
                        class="border-b transition-colors hover:bg-elevated"
                        [style.border-color]="'var(--border-subtle)'"
                      >
                        <td class="py-3 pr-4 font-medium text-primary whitespace-nowrap">
                          {{ row.horaInicio }}
                        </td>
                        <td class="py-3 pr-4 whitespace-nowrap">
                          @if (row.horaInicioReal) {
                            <span class="font-medium text-primary">{{ row.horaInicioReal }}</span>
                          } @else {
                            <span class="text-text-muted">—</span>
                          }
                        </td>
                        <td class="py-3 pr-4 whitespace-nowrap">
                          @if (row.horaFinReal) {
                            <span class="font-medium text-primary">{{ row.horaFinReal }}</span>
                          } @else {
                            <span class="text-text-muted">—</span>
                          }
                        </td>
                        <td class="py-3 pr-4 text-text-secondary text-xs">{{ row.branchName }}</td>
                        <td class="py-3 pr-4 text-text-secondary">{{ row.instructorName }}</td>
                        <td class="py-3 pr-4">
                          @if (row.alumnoName) {
                            <span
                              class="text-text-secondary"
                              [style.color]="
                                row.status === 'ausente' ? 'var(--color-primary)' : undefined
                              "
                            >
                              {{ row.alumnoName }}
                            </span>
                          } @else {
                            <span class="text-text-muted italic">Sin agendar</span>
                          }
                        </td>
                        <td class="py-3 pr-4">
                          @if (row.vehiclePlate) {
                            <div class="flex flex-col">
                              <span class="text-xs font-medium text-primary">{{
                                row.vehiclePlate
                              }}</span>
                              @if (row.vehicleBrand || row.vehicleModel) {
                                <span class="text-xs text-text-muted">
                                  {{ row.vehicleBrand ?? '' }} {{ row.vehicleModel ?? '' }}
                                </span>
                              }
                            </div>
                          } @else {
                            <span class="text-text-muted">—</span>
                          }
                        </td>
                        <td class="py-3 pr-4">
                          <span
                            class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
                            [style.background]="statusBadgeBg(row.status)"
                            [style.color]="statusBadgeColor(row.status)"
                          >
                            <app-icon [name]="statusBadgeIcon(row.status)" [size]="11" />
                            {{ statusBadgeLabel(row.status) }}
                          </span>
                        </td>
                        <td class="py-3 text-right">
                          <div class="flex items-center justify-end gap-2">
                            @if (row.status === 'pendiente' && row.alumnoName && !isFutureDate()) {
                              <!-- Iniciar clase -->
                              <button
                                class="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer"
                                [style.color]="'var(--color-primary)'"
                                [style.border-color]="'var(--color-primary)'"
                                [style.background]="'color-mix(in srgb, var(--color-primary) 8%, transparent)'"
                                [disabled]="isSaving()"
                                title="Iniciar clase"
                                data-llm-action="iniciar-clase-practica"
                                (click)="iniciarClase.emit(row)"
                              >
                                <app-icon name="play" [size]="12" />
                                Iniciar
                              </button>
                              <!-- Marcar inasistencia (solo si ya pasó la hora) -->
                              @if (isPastStartTime(row.scheduledAt)) {
                                <button
                                  class="p-1.5 rounded-md transition-colors cursor-pointer"
                                  title="Marcar inasistencia"
                                  [style.color]="'var(--state-error)'"
                                  [disabled]="isSaving()"
                                  data-llm-action="mark-ausente"
                                  (click)="
                                    markAttendance.emit({ sessionId: row.id, status: 'ausente' })
                                  "
                                >
                                  <app-icon name="x-circle" [size]="16" />
                                </button>
                              }
                            }
                            @if (row.status === 'en_curso') {
                              <span class="indicator-live text-xs text-text-secondary">En clase</span>
                              <!-- Finalizar clase -->
                              <button
                                class="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer"
                                [style.color]="'var(--state-success)'"
                                [style.border-color]="'var(--state-success)'"
                                [style.background]="'var(--state-success-bg)'"
                                [disabled]="isSaving()"
                                title="Finalizar clase"
                                data-llm-action="finalizar-clase-practica"
                                (click)="finalizarClase.emit(row)"
                              >
                                <app-icon name="flag" [size]="12" />
                                Finalizar
                              </button>
                            }
                            @if (row.status === 'ausente' && !row.justificacion) {
                              <button
                                class="text-xs font-medium hover:underline"
                                [style.color]="'var(--color-primary)'"
                                [disabled]="isSaving()"
                                data-llm-action="justify-absence"
                                (click)="openJustifyModal(row.id)"
                              >
                                Justificar
                              </button>
                            }
                            @if (row.justificacion) {
                              <span
                                class="text-xs italic truncate max-w-40"
                                [title]="row.justificacion"
                                [style.color]="'var(--text-muted)'"
                              >
                                {{ row.justificacion }}
                              </span>
                            }
                            @if (row.status === 'presente') {
                              <span
                                class="text-xs font-medium"
                                [style.color]="'var(--state-success)'"
                              >
                                Finalizada
                              </span>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>
        </div>
      }

      <!-- ── Pestaña Ciclos Teóricos (Spec 0001) ────────────────────────────── -->
      @if (activeTab() === 'ciclos') {
        <app-ciclos-teoricos-content
          class="bento-banner"
          [cycles]="cycles()"
          [selectedCycleId]="selectedCycleId()"
          [clases]="clasesCiclo()"
          [roster]="rosterCiclo()"
          [addableStudents]="addableStudents()"
          [isLoading]="isLoadingCiclos()"
          [isLoadingCycle]="isLoadingCycle()"
          [isSaving]="isSaving()"
          [sendingClassId]="sendingClassId()"
          (selectCycle)="selectCycle.emit($event)"
          (saveZoomLink)="saveCicloZoomLink.emit($event)"
          (updateTopic)="updateCicloTopic.emit($event)"
          (sendZoom)="sendCicloZoom.emit($event)"
          (moveStudent)="moveCicloStudent.emit($event)"
          (requestAddable)="requestAddable.emit()"
          (addStudent)="addCicloStudent.emit($event)"
        />
      }

      <!-- ── Modal de justificación ─────────────────────────────────────────── -->
      @if (justifyModalOpen()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          class="bg-black/40"
          (click)="closeJustifyModal()"
        >
          <div
            class="surface-glass rounded-2xl p-6 w-full max-w-md flex flex-col gap-4"
            (click)="$event.stopPropagation()"
            role="dialog"
            aria-modal="true"
            aria-label="Justificar inasistencia"
          >
            <div class="flex items-center justify-between">
              <h3 class="text-base font-semibold text-text-primary">Justificar Inasistencia</h3>
              <button
                class="p-1 rounded-md text-text-muted hover:text-text-primary"
                aria-label="Cerrar"
                (click)="closeJustifyModal()"
              >
                <app-icon name="x" [size]="18" />
              </button>
            </div>
            <p class="text-sm text-text-secondary">
              Ingresa el motivo de la justificación para registrar en el historial del alumno.
            </p>
            <textarea
              class="w-full rounded-lg border p-3 text-sm text-text-primary bg-surface resize-none focus:outline-none"
              [style.border-color]="'var(--border-subtle)'"
              rows="3"
              placeholder="Ej: Certificado médico presentado..."
              data-llm-description="textarea for absence justification reason"
              [value]="justifyReason()"
              (input)="justifyReason.set($any($event.target).value)"
            ></textarea>
            <div class="flex justify-end gap-2">
              <button class="btn-secondary text-sm px-4 py-2" (click)="closeJustifyModal()">
                Cancelar
              </button>
              <button
                class="btn-primary text-sm px-4 py-2"
                [disabled]="!justifyReason().trim() || isSaving()"
                data-llm-action="submit-justification"
                (click)="submitJustification()"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AsistenciaClaseBContentComponent implements AfterViewInit {
  // ── Internal ────────────────────────────────────────────────────────────────
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');
  // ── Inputs ──────────────────────────────────────────────────────────────────
  readonly kpis = input<AsistenciaClaseBKpis | null>(null);
  readonly clasesPracticas = input<ClasePracticaRow[]>([]);
  readonly alertas = input<AlertaFaltaConsecutiva[]>([]);
  readonly instructores = input<InstructorOption[]>([]);
  readonly isLoading = input(false);
  readonly isSaving = input(false);

  // ── Inputs Ciclos Teóricos (Spec 0001) ──────────────────────────────────────
  readonly cycles = input<CicloOption[]>([]);
  readonly selectedCycleId = input<number | null>(null);
  readonly clasesCiclo = input<CicloClaseRow[]>([]);
  readonly rosterCiclo = input<CicloAlumno[]>([]);
  readonly addableStudents = input<CicloAlumnoMovible[]>([]);
  readonly isLoadingCiclos = input(false);
  readonly isLoadingCycle = input(false);
  readonly sendingClassId = input<number | null>(null);

  // ── Outputs ─────────────────────────────────────────────────────────────────
  readonly selectedDate = input<string>(todayIso());

  readonly markAttendance = output<{ sessionId: number; status: ClasePracticaStatus }>();
  readonly justifyAbsence = output<{ sessionId: number; reason: string }>();
  readonly removeSchedule = output<number>();
  readonly reactivateSchedule = output<number>();
  readonly sendReminder = output<number>();
  readonly dateChange = output<string>();
  readonly refreshRequested = output<void>();
  /** Emite la fila para abrir el drawer de iniciar clase. */
  readonly iniciarClase = output<ClasePracticaRow>();
  /** Emite la fila para abrir el drawer de finalizar clase. */
  readonly finalizarClase = output<ClasePracticaRow>();

  // ── Outputs Ciclos Teóricos (Spec 0001) ─────────────────────────────────────
  readonly selectCycle = output<number>();
  readonly saveCicloZoomLink = output<{ classId: number; link: string }>();
  readonly updateCicloTopic = output<{ classId: number; tema: string }>();
  readonly sendCicloZoom = output<{ classId: number; recipientEnrollmentIds: number[] }>();
  readonly moveCicloStudent = output<{ enrollmentId: number; targetCycleId: number }>();
  readonly requestAddable = output<void>();
  readonly addCicloStudent = output<number>();

  // ── Tab state ────────────────────────────────────────────────────────────────
  protected readonly activeTab = signal<'practicas' | 'ciclos'>('practicas');

  // ── Local state ─────────────────────────────────────────────────────────────
  protected readonly today = new Date();
  protected readonly todayIsoVal = todayIso();
  protected readonly todayLabel = (() => {
    const d = new Date();
    return d.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  })();
  protected readonly statusFilters = STATUS_FILTERS;
  protected readonly activeStatusFilter = signal<StatusFilter>('todos');
  protected readonly selectedInstructorId = signal<number | null>(null);

  readonly instructorSelectOptions = computed(() => [
    { label: 'Todos los instructores', value: null },
    ...this.instructores().map((i) => ({ label: i.name, value: i.id })),
  ]);

  // Justify modal
  protected readonly justifyModalOpen = signal(false);
  protected readonly justifySessionId = signal<number | null>(null);
  protected readonly justifyReason = signal('');

  // ── Hero actions ─────────────────────────────────────────────────────────────
  protected readonly heroActions: SectionHeroAction[] = [
    { id: 'refresh', label: 'Actualizar', icon: 'refresh-cw', primary: false },
  ];

  protected readonly heroKpis = computed((): SectionHeroKpi[] => {
    const k = this.kpis();
    return [
      {
        id: 'tasa',
        label: 'Tasa Asistencia',
        value: k?.tasaAsistencia ?? 0,
        suffix: '%',
        icon: 'trending-up',
        color: (k?.tasaAsistencia ?? 100) >= 90 ? 'success' : 'warning',
        trend: k?.tasaAsistenciaTrend,
        trendLabel: 'vs mes anterior',
      },
      {
        id: 'inasistencias',
        label: 'Inasistencias Hoy',
        value: k?.inasistenciasHoy ?? 0,
        icon: 'calendar-x',
        color: 'error',
      },
      {
        id: 'en-curso',
        label: 'En Curso',
        value: k?.clasesEnCurso ?? 0,
        icon: 'play-circle',
        color: 'success',
      },
      {
        id: 'pendientes',
        label: 'Pendientes',
        value: k?.pendientesPorIniciar ?? 0,
        icon: 'clock-alert',
        color: (k?.pendientesPorIniciar ?? 0) > 0 ? 'warning' : 'default',
      },
    ];
  });

  // ── Computed ─────────────────────────────────────────────────────────────────

  /** true cuando la fecha seleccionada es posterior a hoy → modo solo lectura */
  protected readonly isFutureDate = computed(() => this.selectedDate() > this.todayIsoVal);

  protected readonly filteredPracticas = computed(() => {
    let rows = this.clasesPracticas();
    const statusFilter = this.activeStatusFilter();
    const instructorId = this.selectedInstructorId();

    if (statusFilter !== 'todos') {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (instructorId !== null) {
      rows = rows.filter((r) => r.instructorId === instructorId);
    }
    return rows;
  });

  // ── Template helpers ─────────────────────────────────────────────────────────

  protected onDateChange(val: string): void {
    if (val) this.dateChange.emit(val);
  }

  protected onHeroAction(id: string): void {
    if (id === 'refresh') this.refreshRequested.emit();
  }

  protected countByStatus(filter: StatusFilter): number {
    if (filter === 'todos') return this.clasesPracticas().length;
    return this.clasesPracticas().filter((r) => r.status === filter).length;
  }

  /** Returns true if the scheduled start time is in the past (can mark absent). */
  protected isPastStartTime(scheduledAt: string): boolean {
    if (!scheduledAt) return false;
    return new Date(scheduledAt) < new Date();
  }

  protected formatIsoDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}-${m}-${y}`;
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  // ── Status badge helpers ──────────────────────────────────────────────────────

  protected statusBadgeLabel(status: ClasePracticaStatus): string {
    switch (status) {
      case 'presente':
        return 'Presente';
      case 'ausente':
        return 'Ausente';
      case 'en_curso':
        return 'En curso';
      case 'pendiente':
        return 'Pendiente';
    }
  }

  protected statusBadgeIcon(status: ClasePracticaStatus): string {
    switch (status) {
      case 'presente':
        return 'check-circle';
      case 'ausente':
        return 'x-circle';
      case 'en_curso':
        return 'circle-play';
      case 'pendiente':
        return 'clock';
    }
  }

  protected statusBadgeBg(status: ClasePracticaStatus): string {
    switch (status) {
      case 'presente':
        return 'var(--state-success-bg)';
      case 'ausente':
        return 'var(--state-error-bg)';
      case 'en_curso':
        return 'color-mix(in srgb, var(--color-primary) 12%, transparent)';
      case 'pendiente':
        return 'var(--bg-elevated)';
    }
  }

  protected statusBadgeColor(status: ClasePracticaStatus): string {
    switch (status) {
      case 'presente':
        return 'var(--state-success)';
      case 'ausente':
        return 'var(--state-error)';
      case 'en_curso':
        return 'var(--color-primary)';
      case 'pendiente':
        return 'var(--text-muted)';
    }
  }

  // ── Justify modal ─────────────────────────────────────────────────────────────

  protected openJustifyModal(sessionId: number): void {
    this.justifySessionId.set(sessionId);
    this.justifyReason.set('');
    this.justifyModalOpen.set(true);
  }

  protected closeJustifyModal(): void {
    this.justifyModalOpen.set(false);
    this.justifySessionId.set(null);
    this.justifyReason.set('');
  }

  protected submitJustification(): void {
    const id = this.justifySessionId();
    if (id) {
      this.justifyAbsence.emit({ sessionId: id, reason: this.justifyReason() });
      this.closeJustifyModal();
    }
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }
}
