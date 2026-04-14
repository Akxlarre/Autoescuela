import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import type {
  AlertaFaltaConsecutiva,
  AsistenciaClaseBKpis,
  ClasePracticaRow,
  ClasePracticaStatus,
  ClaseTeoricoRow,
  InstructorOption,
} from '@core/models/ui/asistencia-clase-b.model';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  imports: [SectionHeroComponent, KpiCardVariantComponent, SkeletonBlockComponent, IconComponent],
  template: `
    <!-- ── Section Hero ────────────────────────────────────────────────────── -->
    <app-section-hero
      title="Control de Asistencia"
      icon="clipboard-check"
      [subtitle]="todayLabel"
      [actions]="heroActions"
      variant="compact"
      (actionClick)="onHeroAction($event)"
    />

    <div class="flex flex-col gap-6 p-4 md:p-6">
      <!-- ── KPIs ────────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <app-kpi-card-variant
          label="Tasa de Asistencia"
          [value]="kpis()?.tasaAsistencia ?? 0"
          suffix="%"
          [trend]="kpis()?.tasaAsistenciaTrend"
          trendLabel="vs mes anterior"
          icon="trending-up"
          [color]="(kpis()?.tasaAsistencia ?? 100) >= 90 ? 'success' : 'warning'"
          [loading]="isLoading()"
        />
        <app-kpi-card-variant
          label="Inasistencias Hoy"
          [value]="kpis()?.inasistenciasHoy ?? 0"
          [suffix]="' de ' + (kpis()?.totalClasesHoy ?? 0) + ' clases'"
          icon="calendar-x"
          color="error"
          [loading]="isLoading()"
        />
        <app-kpi-card-variant
          label="Alumnos en Riesgo"
          [value]="kpis()?.alumnosEnRiesgo ?? 0"
          suffix=" alumnos"
          icon="alert-triangle"
          color="warning"
          [loading]="isLoading()"
        />
        <app-kpi-card-variant
          label="Horarios Eliminados"
          [value]="kpis()?.horariosEliminados ?? 0"
          suffix=" esta semana"
          icon="calendar-x"
          [loading]="isLoading()"
        />
      </div>

      <!-- ── Alertas críticas ────────────────────────────────────────────── -->
      @if (!isLoading() && alertas().length > 0) {
        <section class="card p-5 flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <app-icon name="alert-triangle" [size]="18" [style.color]="'var(--state-warning)'" />
            <h2 class="text-sm font-semibold text-primary">Alertas y Acciones Urgentes</h2>
          </div>

          @for (alerta of alertas(); track alerta.enrollmentId) {
            <div
              class="flex items-start justify-between gap-4 rounded-lg px-4 py-3 border"
              [style.border-color]="
                alerta.nivel === 'danger' ? 'var(--state-error)' : 'var(--state-warning)'
              "
              [style.background]="
                alerta.nivel === 'danger'
                  ? 'color-mix(in srgb, var(--state-error) 6%, transparent)'
                  : 'color-mix(in srgb, var(--state-warning) 6%, transparent)'
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
                      alerta.faltasConsecutivas === 1 ? 'falta consecutiva' : 'faltas consecutivas'
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
      }

      <!-- ── Clases Teóricas (Zoom) ──────────────────────────────────────── -->
      <section class="card p-5 flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <app-icon name="video" [size]="18" [style.color]="'var(--color-primary)'" />
            <h2 class="text-sm font-semibold text-primary">Clases Teóricas (Zoom Automático)</h2>
            @if (clasesTeorias().length > 0) {
              <span
                class="text-xs font-semibold px-2 py-0.5 rounded-full"
                [style.background]="'color-mix(in srgb, var(--color-primary) 12%, transparent)'"
                [style.color]="'var(--color-primary)'"
              >
                {{ clasesTeorias().length }}
              </span>
            }
          </div>
          <div class="flex items-center gap-2">
            <!-- Selector de fecha -->
            <div class="flex items-center gap-1.5">
              <app-icon name="calendar" [size]="14" [style.color]="'var(--text-muted)'" />
              <input
                type="date"
                class="text-xs rounded-md border px-2 py-1.5 focus:outline-none"
                [style.border-color]="'var(--border-subtle)'"
                [style.background]="'var(--bg-surface)'"
                [style.color]="'var(--text-secondary)'"
                [value]="selectedDate()"
                data-llm-description="Selector de fecha para clases teóricas"
                (change)="onDateChange($event)"
              />
              @if (isFutureDate()) {
                <span
                  class="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style="background: color-mix(in srgb, var(--state-warning) 12%, transparent); color: var(--state-warning)"
                >
                  Solo lectura
                </span>
              }
            </div>
            <button
              class="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
              data-llm-action="schedule-new-theory-class"
              (click)="scheduleNewClass.emit()"
            >
              <app-icon name="calendar-plus" [size]="14" />
              Agendar nueva clase
            </button>
          </div>
        </div>

        @if (isLoading()) {
          <div class="flex flex-col gap-2">
            @for (i of [1, 2]; track i) {
              <app-skeleton-block variant="rect" width="100%" height="48px" />
            }
          </div>
        } @else if (clasesTeorias().length === 0) {
          <p class="text-sm text-secondary text-center py-4">
            No hay clases teóricas programadas para hoy.
          </p>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b" [style.border-color]="'var(--border-subtle)'">
                  <th class="text-left text-xs font-semibold text-secondary pb-2 pr-4">Hora</th>
                  <th class="text-left text-xs font-semibold text-secondary pb-2 pr-4">Sede</th>
                  <th class="text-left text-xs font-semibold text-secondary pb-2 pr-4">Tema</th>
                  <th class="text-left text-xs font-semibold text-secondary pb-2 pr-4">
                    Instructor
                  </th>
                  <th class="text-left text-xs font-semibold text-secondary pb-2 pr-4">
                    Inscritos
                  </th>
                  <th class="text-left text-xs font-semibold text-secondary pb-2 pr-4">
                    Estado Enlace
                  </th>
                  <th class="text-right text-xs font-semibold text-secondary pb-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (clase of clasesTeorias(); track clase.id) {
                  <tr
                    class="border-b transition-colors hover:bg-surface-elevated"
                    [style.border-color]="'var(--border-subtle)'"
                  >
                    <td class="py-3 pr-4 font-medium text-primary whitespace-nowrap">
                      {{ clase.horaInicio }} – {{ clase.horaFin }}
                    </td>
                    <td class="py-3 pr-4 text-secondary text-xs">{{ clase.branchName }}</td>
                    <td class="py-3 pr-4 text-secondary">{{ clase.tema }}</td>
                    <td class="py-3 pr-4 text-secondary">{{ clase.instructorName }}</td>
                    <td class="py-3 pr-4 text-secondary">{{ clase.inscritosCount }} alumnos</td>
                    <td class="py-3 pr-4">
                      <span
                        class="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full"
                        [style.background]="zoomBadgeBg(clase.zoomLinkStatus)"
                        [style.color]="zoomBadgeColor(clase.zoomLinkStatus)"
                      >
                        <app-icon [name]="zoomBadgeIcon(clase.zoomLinkStatus)" [size]="12" />
                        {{ zoomBadgeLabel(clase.zoomLinkStatus) }}
                      </span>
                    </td>
                    <td class="py-3 text-right">
                      <button
                        class="text-xs font-medium hover:underline cursor-pointer"
                        [style.color]="'var(--color-primary)'"
                        data-llm-action="view-attendance-list"
                        (click)="viewAtendanceList.emit(clase)"
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- ── Asistencia del Día (Prácticas) ─────────────────────────────── -->
      <section class="card p-5 flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <app-icon name="calendar-check" [size]="18" [style.color]="'var(--color-primary)'" />
            <h2 class="text-sm font-semibold text-primary">Asistencia del Día — Prácticas</h2>
          </div>
          <div class="flex items-center gap-2">
            <!-- Selector de fecha -->
            <div class="flex items-center gap-1.5">
              <app-icon name="calendar" [size]="14" [style.color]="'var(--text-muted)'" />
              <input
                type="date"
                class="text-xs rounded-md border px-2 py-1.5 focus:outline-none"
                [style.border-color]="'var(--border-subtle)'"
                [style.background]="'var(--bg-surface)'"
                [style.color]="'var(--text-secondary)'"
                [value]="selectedDate()"
                data-llm-description="Selector de fecha para clases prácticas"
                (change)="onDateChange($event)"
              />
              @if (isFutureDate()) {
                <span
                  class="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style="background: color-mix(in srgb, var(--state-warning) 12%, transparent); color: var(--state-warning)"
                >
                  Solo lectura
                </span>
              }
            </div>
            <button
              class="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              data-llm-action="export-excel"
              (click)="exportExcel.emit()"
            >
              <app-icon name="download" [size]="14" />
              Exportar
            </button>
            <button
              class="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
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
              [style.color]="activeStatusFilter() === f.value ? '#fff' : 'var(--text-secondary)'"
              [style.border-color]="
                activeStatusFilter() === f.value ? 'var(--color-primary)' : 'var(--border-subtle)'
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
            <select
              class="text-xs rounded-md border px-2.5 py-1.5 bg-surface text-secondary focus:outline-none"
              [style.border-color]="'var(--border-subtle)'"
              [value]="selectedInstructorId() ?? ''"
              (change)="onInstructorFilterChange($event)"
            >
              <option value="">Todos los instructores</option>
              @for (inst of instructores(); track inst.id) {
                <option [value]="inst.id">{{ inst.name }}</option>
              }
            </select>
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
          <p class="text-sm text-secondary text-center py-6">
            No hay registros que coincidan con los filtros seleccionados.
          </p>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b" [style.border-color]="'var(--border-subtle)'">
                  <th class="text-left text-xs font-semibold text-secondary pb-2 pr-4 w-20">
                    Hora
                  </th>
                  <th class="text-left text-xs font-semibold text-secondary pb-2 pr-4">Sede</th>
                  <th class="text-left text-xs font-semibold text-secondary pb-2 pr-4">
                    Instructor
                  </th>
                  <th class="text-left text-xs font-semibold text-secondary pb-2 pr-4">Alumno</th>
                  <th class="text-left text-xs font-semibold text-secondary pb-2 pr-4">Estado</th>
                  <th class="text-right text-xs font-semibold text-secondary pb-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredPracticas(); track row.id) {
                  <tr
                    class="border-b transition-colors hover:bg-surface-elevated"
                    [style.border-color]="'var(--border-subtle)'"
                  >
                    <td class="py-3 pr-4 font-medium text-primary whitespace-nowrap">
                      {{ row.horaInicio }}
                    </td>
                    <td class="py-3 pr-4 text-secondary text-xs">{{ row.branchName }}</td>
                    <td class="py-3 pr-4 text-secondary">{{ row.instructorName }}</td>
                    <td class="py-3 pr-4">
                      @if (row.alumnoName) {
                        <span
                          class="text-secondary"
                          [style.color]="
                            row.status === 'ausente' ? 'var(--color-primary)' : undefined
                          "
                        >
                          {{ row.alumnoName }}
                        </span>
                      } @else {
                        <span class="text-muted italic">Sin agendar</span>
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
                        @if (
                          row.status === 'pendiente' &&
                          row.alumnoName &&
                          isPastStartTime(row.scheduledAt)
                        ) {
                          <button
                            class="p-1.5 rounded-md transition-colors"
                            title="Marcar inasistencia"
                            [style.color]="'var(--state-error)'"
                            [disabled]="isSaving()"
                            data-llm-action="mark-ausente"
                            (click)="markAttendance.emit({ sessionId: row.id, status: 'ausente' })"
                          >
                            <app-icon name="x-circle" [size]="16" />
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
                        @if (row.status === 'en_curso') {
                          <span class="indicator-live text-xs text-secondary">En clase</span>
                        }
                        @if (row.status === 'presente') {
                          <span class="text-xs font-medium" [style.color]="'var(--state-success)'">
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

    <!-- ── Modal de justificación ─────────────────────────────────────────── -->
    @if (justifyModalOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        style="background: rgba(0,0,0,0.4)"
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
            <h3 class="text-base font-semibold text-primary">Justificar Inasistencia</h3>
            <button
              class="p-1 rounded-md text-muted hover:text-primary"
              aria-label="Cerrar"
              (click)="closeJustifyModal()"
            >
              <app-icon name="x" [size]="18" />
            </button>
          </div>
          <p class="text-sm text-secondary">
            Ingresa el motivo de la justificación para registrar en el historial del alumno.
          </p>
          <textarea
            class="w-full rounded-lg border p-3 text-sm text-primary bg-surface resize-none focus:outline-none"
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
  `,
})
export class AsistenciaClaseBContentComponent {
  // ── Inputs ──────────────────────────────────────────────────────────────────
  readonly kpis = input<AsistenciaClaseBKpis | null>(null);
  readonly clasesTeorias = input<ClaseTeoricoRow[]>([]);
  readonly clasesPracticas = input<ClasePracticaRow[]>([]);
  readonly alertas = input<AlertaFaltaConsecutiva[]>([]);
  readonly instructores = input<InstructorOption[]>([]);
  readonly isLoading = input(false);
  readonly isSaving = input(false);

  // ── Outputs ─────────────────────────────────────────────────────────────────
  readonly selectedDate = input<string>(todayIso());

  readonly markAttendance = output<{ sessionId: number; status: ClasePracticaStatus }>();
  readonly justifyAbsence = output<{ sessionId: number; reason: string }>();
  readonly removeSchedule = output<number>();
  readonly reactivateSchedule = output<number>();
  readonly sendReminder = output<number>();
  /** Emits the full ClaseTeoricoRow so the smart parent can open the drawer with context. */
  readonly viewAtendanceList = output<ClaseTeoricoRow>();
  readonly dateChange = output<string>();
  readonly exportExcel = output<void>();
  readonly refreshRequested = output<void>();
  readonly scheduleNewClass = output<void>();

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

  // Justify modal
  protected readonly justifyModalOpen = signal(false);
  protected readonly justifySessionId = signal<number | null>(null);
  protected readonly justifyReason = signal('');

  // ── Hero actions ─────────────────────────────────────────────────────────────
  protected readonly heroActions: SectionHeroAction[] = [
    { id: 'refresh', label: 'Actualizar', icon: 'refresh-cw', primary: false },
  ];

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

  protected onDateChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val) this.dateChange.emit(val);
  }

  protected onHeroAction(id: string): void {
    if (id === 'refresh') this.refreshRequested.emit();
  }

  protected onInstructorFilterChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedInstructorId.set(val ? Number(val) : null);
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

  // ── Zoom badge helpers ────────────────────────────────────────────────────────

  protected zoomBadgeLabel(status: ClaseTeoricoRow['zoomLinkStatus']): string {
    switch (status) {
      case 'sent':
        return 'Enviado Automáticamente';
      case 'pending':
        return 'Pendiente de envío';
      case 'not_configured':
        return 'Sin configurar';
    }
  }

  protected zoomBadgeIcon(status: ClaseTeoricoRow['zoomLinkStatus']): string {
    switch (status) {
      case 'sent':
        return 'check-circle';
      case 'pending':
        return 'clock';
      case 'not_configured':
        return 'alert-circle';
    }
  }

  protected zoomBadgeBg(status: ClaseTeoricoRow['zoomLinkStatus']): string {
    switch (status) {
      case 'sent':
        return 'color-mix(in srgb, var(--state-success) 12%, transparent)';
      case 'pending':
        return 'color-mix(in srgb, var(--state-warning) 12%, transparent)';
      case 'not_configured':
        return 'color-mix(in srgb, var(--state-error) 12%, transparent)';
    }
  }

  protected zoomBadgeColor(status: ClaseTeoricoRow['zoomLinkStatus']): string {
    switch (status) {
      case 'sent':
        return 'var(--state-success)';
      case 'pending':
        return 'var(--state-warning)';
      case 'not_configured':
        return 'var(--state-error)';
    }
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
        return 'color-mix(in srgb, var(--state-success) 12%, transparent)';
      case 'ausente':
        return 'color-mix(in srgb, var(--state-error) 12%, transparent)';
      case 'en_curso':
        return 'color-mix(in srgb, var(--color-primary) 12%, transparent)';
      case 'pendiente':
        return 'color-mix(in srgb, var(--text-muted) 12%, transparent)';
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
    const sessionId = this.justifySessionId();
    const reason = this.justifyReason().trim();
    if (!sessionId || !reason) return;
    this.justifyAbsence.emit({ sessionId, reason });
    this.closeJustifyModal();
  }
}
