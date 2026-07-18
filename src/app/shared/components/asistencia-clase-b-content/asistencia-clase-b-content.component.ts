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
import { TooltipModule } from 'primeng/tooltip';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { ModalOverlayDirective } from '@core/directives/modal-overlay.directive';
import { todayIso } from '@core/utils/date.utils';
import { visibleWithLoadMore } from '@core/utils/layout-tier.utils';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { CiclosTeoricosContentComponent } from '@shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
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
    TooltipModule,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
    BadgeComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
    AnimateInDirective,
    ModalOverlayDirective,
    DateInputComponent,
    CiclosTeoricosContentComponent,
    EmptyStateComponent,
  ],
  template: `
    <!-- Modo dual (spec 0030/0031): fill-screen en AMBOS tabs (3 filas fijas:
         hero / tabs / celda fill). El modificador es incondicional para que la
         página no scrollee en ningún tab → no aparece/desaparece el scrollbar al
         alternar tabs (fix del shift de la fila de tabs, spec 0031). La celda
         fill es el contenido del tab activo (Prácticas: tabla+rail alertas;
         Ciclos: selector + columnas con scroll interno). -->
    <div class="bento-grid bento-grid--fill-screen-kpi" appBentoGridLayout #bentoGrid>
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
            (click)="selectTab('practicas')"
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
            (click)="selectTab('ciclos')"
          >
            <app-icon name="video" [size]="18" />
            Ciclos Teóricos
          </button>
        </div>
      </div>

      <!-- ── Celda protagonista (spec 0030): tabla + rail de alertas ────────── -->
      <!-- Hijo directo del grid con .bento-fill: en desktop llena el resto del
           viewport (fila minmax(0,1fr) + contain:size vía _bento-grid.scss);
           bajo lg mide su contenido natural y la página scrollea.
           2 columnas en desktop (feedback owner 2026-07-13): la TABLA es la
           protagonista y ocupa el ancho principal; las alertas van a un rail
           lateral angosto (contexto, no bloqueo) — antes apiladas verticalmente
           invertían la jerarquía (secundario arriba comía 45% del alto).
           Las utilidades order-1/order-2 dejan la tabla primera en AMBOS ejes:
           arriba en móvil (flex-col → trabajo principal inmediato), izquierda
           en desktop (flex-row). El DOM mantiene [alertas, tabla] para no
           mover el bloque grande de la tabla. El switch col/row usa
           isDesktopLayout() (= maxVisible()===null = tier desktop por
           contenedor), NO el breakpoint de viewport lg: de Tailwind. -->
      @if (activeTab() === 'practicas') {
        <!-- Sin overflow-hidden a propósito (fix-045): el alto ya lo fija
             contain:size de .bento-fill y el scroll lo dueñan los contenedores
             hijos (lista de alertas + tabla). El overflow-hidden recortaba el
             hover glow (y:-2 + sombra) de las cards appCardHover anidadas. -->
        <div
          class="bento-banner bento-fill flex gap-4 min-h-0"
          [class.flex-col]="!isDesktopLayout()"
          [class.flex-row]="isDesktopLayout()"
        >
          <!-- Rail lateral de alertas (contexto, no bloqueo). Filas compactas
               de 1 línea; el detalle completo (última falta, política) va en el
               atributo title (tooltip nativo). order-2 = a la derecha en
               desktop / debajo de la tabla en móvil. En desktop el rail llena
               el alto de la fila (min-h-0) y el listado scrollea internamente;
               en móvil altura natural y la página scrollea (dual). -->
          <!-- Skeleton del rail (fix-046): mismas clases/dimensiones que el rail
               real para que la tabla NO cambie de ancho entre carga y datos
               (antes el aside solo existía tras cargar → la tabla saltaba de
               904→568px). Sin appCardHover: es un placeholder, no interactivo. -->
          @if (isLoading()) {
            <aside
              class="card p-3 flex flex-col gap-1.5 order-2 min-h-0 overflow-hidden"
              [class.w-80]="isDesktopLayout()"
              [class.shrink-0]="isDesktopLayout()"
            >
              <div class="flex items-center gap-1.5 px-1 pb-0.5 shrink-0">
                <app-skeleton-block variant="circle" width="14px" height="14px" />
                <app-skeleton-block variant="text" width="80px" height="12px" />
              </div>
              <div class="flex flex-col gap-1.5 flex-1 min-h-0 overflow-hidden">
                @for (i of alertSkeletonIndexes; track i) {
                  <app-skeleton-block variant="rect" width="100%" height="48px" />
                }
              </div>
            </aside>
          } @else if (alertas().length > 0) {
            <aside
              class="card p-3 flex flex-col gap-1.5 order-2 min-h-0 overflow-hidden"
              [class.w-80]="isDesktopLayout()"
              [class.shrink-0]="isDesktopLayout()"
              appCardHover
            >
              <div class="flex items-center gap-1.5 px-1 pb-0.5 shrink-0">
                <app-icon
                  name="alert-triangle"
                  [size]="14"
                  [style.color]="'var(--state-warning)'"
                />
                <h2 class="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Alertas ({{ alertas().length }})
                </h2>
              </div>

              <div class="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto">
                @for (alerta of alertas(); track alerta.enrollmentId) {
                  <!-- Fila de 2 líneas (fix-047): descomprime yendo a lo vertical
                       (el rail scrollea). Línea 1 = avatar + nombre completo (sin
                       truncar); línea 2 = conteo + última falta + acción. El title
                       conserva la política como enriquecimiento en hover. -->
                  <div
                    class="flex flex-col gap-1 rounded-md pl-3 pr-2 py-2 border-l-[3px] transition-colors hover:bg-elevated"
                    [style.border-left-color]="
                      alerta.nivel === 'danger' ? 'var(--state-error)' : 'var(--state-warning)'
                    "
                    [pTooltip]="alertaTooltip(alerta)"
                    tooltipPosition="left"
                  >
                    <!-- Línea 1: avatar + nombre completo -->
                    <div class="flex items-center gap-2">
                      <div
                        class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-2xs font-bold text-white"
                        [class.bg-error]="alerta.nivel === 'danger'"
                        [class.bg-warning]="alerta.nivel !== 'danger'"
                      >
                        {{ initials(alerta.alumnoName) }}
                      </div>
                      <p
                        class="text-xs font-semibold leading-tight min-w-0 flex-1"
                        [class.text-error]="alerta.nivel === 'danger'"
                        [class.text-warning]="alerta.nivel !== 'danger'"
                      >
                        {{ alerta.alumnoName }}
                      </p>
                    </div>

                    <!-- Línea 2: detalle (conteo + última falta) + acción -->
                    <div class="flex items-center justify-between gap-2 pl-7">
                      <span class="text-2xs text-text-muted leading-tight">
                        {{ alerta.faltasConsecutivas }}
                        {{ alerta.faltasConsecutivas === 1 ? 'falta' : 'faltas' }} · últ.
                        {{ formatIsoDateShort(alerta.ultimaFechaFalta) }}
                      </span>
                      <div class="shrink-0">
                        @if (alerta.nivel === 'danger') {
                          @if (alerta.horarioActivo) {
                            <button
                              class="btn-primary text-xs px-2.5 py-1"
                              [disabled]="isSaving()"
                              data-llm-action="remove-schedule"
                              (click)="removeSchedule.emit(alerta.enrollmentId)"
                            >
                              Eliminar
                            </button>
                          } @else {
                            <button
                              class="btn-secondary text-xs px-2.5 py-1"
                              [disabled]="isSaving()"
                              data-llm-action="reactivate-schedule"
                              (click)="reactivateSchedule.emit(alerta.enrollmentId)"
                            >
                              Reactivar
                            </button>
                          }
                        } @else {
                          <button
                            class="btn-secondary text-xs px-2.5 py-1"
                            [disabled]="isSaving()"
                            data-llm-action="send-reminder"
                            (click)="sendReminder.emit(alerta.enrollmentId)"
                          >
                            Recordar
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                }
              </div>
            </aside>
          }

          <!-- ── Asistencia del Día (Prácticas) — PROTAGONISTA ────────────── -->
          <section class="card p-5 flex flex-col gap-4 flex-1 min-w-0 min-h-0 order-1" appCardHover>
            <div class="flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div class="flex items-center gap-2">
                <app-icon
                  name="calendar-check"
                  [size]="18"
                  [style.color]="'var(--color-primary)'"
                />
                <h2 class="text-sm font-semibold text-text-primary">
                  Asistencia del Día — Prácticas
                </h2>
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
            <div class="flex flex-wrap items-center gap-2 shrink-0">
              @for (f of statusFilters; track f.value) {
                <button
                  class="text-xs font-medium px-3 py-1.5 rounded-full border transition-colors"
                  [class.bg-brand]="activeStatusFilter() === f.value"
                  [class.text-white]="activeStatusFilter() === f.value"
                  [class.border-brand]="activeStatusFilter() === f.value"
                  [class.bg-transparent]="activeStatusFilter() !== f.value"
                  [class.text-text-secondary]="activeStatusFilter() !== f.value"
                  [class.border-border-subtle]="activeStatusFilter() !== f.value"
                  (click)="setStatusFilter(f.value)"
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
                  placeholder="Todos los instructores"
                  [ngModel]="selectedInstructorId()"
                  (ngModelChange)="setInstructorFilter($event)"
                  styleClass="w-auto"
                  data-llm-description="filter attendance by instructor"
                />
              </div>
            </div>

            <!-- Tabla -->
            @if (isLoading()) {
              <!-- Skeleton parecido a tabla (fix-046): header + filas con celdas
                   tipo columna, en vez de barras genéricas. -->
              <div class="flex-1 min-h-0 overflow-hidden">
                <div
                  class="flex items-center gap-4 pb-2 mb-1 border-b"
                  [style.border-color]="'var(--border-subtle)'"
                >
                  @for (w of skeletonColWidths; track $index) {
                    <app-skeleton-block variant="text" [width]="w" height="10px" />
                  }
                </div>
                @for (i of skeletonIndexes(); track i) {
                  <div
                    class="flex items-center gap-4 py-3 border-b overflow-hidden"
                    [style.border-color]="'var(--border-subtle)'"
                  >
                    <app-skeleton-block variant="text" width="40px" height="12px" />
                    <app-skeleton-block variant="text" width="28px" height="12px" />
                    <app-skeleton-block variant="text" width="28px" height="12px" />
                    <app-skeleton-block variant="text" width="40px" height="12px" />
                    <app-skeleton-block variant="text" width="52px" height="12px" />
                    <app-skeleton-block variant="text" width="60px" height="12px" />
                    <app-skeleton-block variant="text" width="44px" height="12px" />
                    <app-skeleton-block variant="rect" width="40px" height="22px" />
                    <app-skeleton-block variant="rect" width="32px" height="26px" />
                  </div>
                }
              </div>
            } @else if (filteredPracticas().length === 0) {
              <app-empty-state
                icon="calendar-x"
                message="Sin resultados"
                subtitle="No hay registros que coincidan con los filtros seleccionados."
              />
            } @else {
              <!-- Único contenedor de scroll (X siempre; Y solo surte efecto en
                   desktop fill, donde la celda tiene alto fijo). thead sticky
                   se ancla a este scrollport. -->
              <div class="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
                <table class="w-full text-sm">
                  <thead class="sticky top-0 z-10 bg-surface">
                    <tr class="border-b" [style.border-color]="'var(--border-subtle)'">
                      <th
                        class="text-left text-xs font-semibold text-text-secondary pb-2 pr-4 w-20"
                      >
                        Agendada
                      </th>
                      <th
                        class="text-left text-xs font-semibold text-text-secondary pb-2 pr-4 w-16"
                      >
                        Inicio
                      </th>
                      <th
                        class="text-left text-xs font-semibold text-text-secondary pb-2 pr-4 w-16"
                      >
                        Fin
                      </th>
                      <th class="text-left text-xs font-semibold text-text-secondary pb-2 pr-4">
                        Sede
                      </th>
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
                      <th class="text-left text-xs font-semibold text-text-secondary pb-2 pl-4">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of visiblePracticas(); track row.id) {
                      <tr
                        class="border-b transition-colors hover:bg-elevated"
                        [style.border-color]="'var(--border-subtle)'"
                      >
                        <td class="py-3 pr-4 font-medium text-text-primary whitespace-nowrap">
                          {{ row.horaInicio }}
                        </td>
                        <td class="py-3 pr-4 whitespace-nowrap">
                          @if (row.horaInicioReal) {
                            <span class="font-medium text-text-primary">{{
                              row.horaInicioReal
                            }}</span>
                          } @else {
                            <span class="text-text-muted">—</span>
                          }
                        </td>
                        <td class="py-3 pr-4 whitespace-nowrap">
                          @if (row.horaFinReal) {
                            <span class="font-medium text-text-primary">{{ row.horaFinReal }}</span>
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
                              [class.text-brand]="row.status === 'ausente'"
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
                              <span class="text-xs font-medium text-text-primary">{{
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
                          <app-badge [variant]="statusBadgeVariant(row)">
                            <app-icon [name]="statusBadgeIcon(row)" [size]="11" />
                            {{ statusBadgeLabel(row) }}
                          </app-badge>
                        </td>
                        <td class="py-3 pl-4">
                          <div class="flex items-center justify-start gap-2">
                            @if (row.status === 'pendiente' && row.alumnoName && !isFutureDate()) {
                              <!-- Iniciar clase -->
                              <button
                                class="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer text-brand border-brand bg-brand/10"
                                [disabled]="isSaving()"
                                pTooltip="Iniciar clase"
                                tooltipPosition="top"
                                data-llm-action="iniciar-clase-practica"
                                (click)="iniciarClase.emit(row)"
                              >
                                <app-icon name="play" [size]="12" />
                                Iniciar
                              </button>
                              <!-- Marcar inasistencia (solo si ya pasó la hora) -->
                              @if (isPastStartTime(row.scheduledAt)) {
                                <button
                                  class="p-1.5 rounded-md transition-colors cursor-pointer text-error"
                                  pTooltip="Marcar inasistencia"
                                  tooltipPosition="top"
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
                              <span class="indicator-live text-xs text-text-secondary"
                                >En clase</span
                              >
                              <!-- Finalizar clase -->
                              <button
                                class="btn-success-soft text-xs font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1 cursor-pointer"
                                [disabled]="isSaving()"
                                pTooltip="Finalizar clase"
                                tooltipPosition="top"
                                data-llm-action="finalizar-clase-practica"
                                (click)="finalizarClase.emit(row)"
                              >
                                <app-icon name="flag" [size]="12" />
                                Finalizar
                              </button>
                            }
                            @if (row.status === 'ausente' && !row.justificacion) {
                              <button
                                class="btn-ghost text-xs px-2 py-1"
                                [disabled]="isSaving()"
                                data-llm-action="justify-absence"
                                (click)="openJustifyModal(row.id)"
                              >
                                Justificar
                              </button>
                            }
                            @if (row.justificacion) {
                              <button
                                class="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
                                [pTooltip]="row.justificacion"
                                tooltipPosition="top"
                                data-llm-action="view-justification"
                                (click)="openViewMotivo(row.justificacion)"
                              >
                                <app-icon name="info" [size]="14" />
                                Ver motivo
                              </button>
                            }
                            @if (row.status === 'presente') {
                              <span class="text-xs font-medium text-success">
                                Finalizada
                              </span>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
                @if (hasMorePracticas()) {
                  <button
                    type="button"
                    class="btn-ghost w-full flex items-center justify-center gap-1.5 font-medium transition-colors cursor-pointer mt-2"
                    data-llm-action="load-more-practicas"
                    (click)="loadMorePracticas()"
                  >
                    <app-icon name="chevron-down" [size]="14" />
                    Cargar más ({{ remainingPracticas() }} restantes)
                  </button>
                }
              </div>
            }
          </section>
        </div>
      }

      <!-- ── Pestaña Ciclos Teóricos (Spec 0001) ────────────────────────────── -->
      @if (activeTab() === 'ciclos') {
        <app-ciclos-teoricos-content
          class="bento-banner bento-fill flex flex-col min-h-0"
          [isDesktop]="isDesktopLayout()"
          [cycles]="cycles()"
          [selectedCycleId]="selectedCycleId()"
          [clases]="clasesCiclo()"
          [roster]="rosterCiclo()"
          [addableStudents]="addableStudents()"
          [isLoading]="isLoadingCiclos()"
          [isLoadingCycle]="isLoadingCycle()"
          [isLoadingAddable]="isLoadingAddable()"
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
    </div>

    <!-- ── Modal de justificación (canon: backdrop + card, hotfix-021) ───────
         Fuera del .bento-grid (hotfix-022): como sibling, igual que el modal
         de admin-alumnos.component.ts. Dentro del grid, el wrapper vacío del
         [appModalOverlay] contaba como ítem sin clase bento-* y CSS Grid le
         reservaba una fila fantasma (grid-auto-rows), comprimiendo la fila
         fill real. -->
    <div [appModalOverlay]="justifyModalOpen()">
      @if (justifyModalOpen()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-(--overlay-backdrop) backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Justificar inasistencia"
          (click)="closeJustifyModal()"
          (document:keydown.escape)="closeJustifyModal()"
        >
          <div
            class="surface-glass rounded-2xl p-6 w-full max-w-md flex flex-col gap-4"
            (click)="$event.stopPropagation()"
            appAnimateIn
          >
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-text-primary">Justificar Inasistencia</h3>
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
              class="w-full rounded-lg border border-border-subtle p-3 text-sm text-text-primary bg-surface resize-none focus:outline-none"
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
    
    <!-- Modal para ver el motivo de justificación -->
    <div [appModalOverlay]="viewMotivoModalOpen()">
      @if (viewMotivoModalOpen()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-(--overlay-backdrop) backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          (click)="closeViewMotivo()"
          (document:keydown.escape)="closeViewMotivo()"
        >
          <div
            class="surface-glass rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4"
            (click)="$event.stopPropagation()"
            appAnimateIn
          >
            <div class="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 class="font-semibold text-text-primary flex items-center gap-2">
                <app-icon name="info" [size]="18" class="text-brand" />
                Motivo de Justificación
              </h3>
              <button
                class="p-1 rounded-md text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                aria-label="Cerrar"
                (click)="closeViewMotivo()"
              >
                <app-icon name="x" [size]="18" />
              </button>
            </div>
            <div class="bg-surface border border-border-subtle rounded-lg p-4 max-h-60 overflow-y-auto text-sm text-text-secondary whitespace-pre-wrap">
              {{ viewMotivoText() }}
            </div>
            <div class="flex justify-end pt-2">
              <button class="btn-secondary text-sm px-4 py-2 cursor-pointer" (click)="closeViewMotivo()">
                Cerrar
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
  /** Presupuesto de densidad (spec 0028/0030): null = sin límite (desktop). Llega resuelto por input — este Dumb NO inyecta LayoutService. */
  readonly maxVisible = input<number | null>(null);

  // ── Inputs Ciclos Teóricos (Spec 0001) ──────────────────────────────────────
  readonly cycles = input<CicloOption[]>([]);
  readonly selectedCycleId = input<number | null>(null);
  readonly clasesCiclo = input<CicloClaseRow[]>([]);
  readonly rosterCiclo = input<CicloAlumno[]>([]);
  readonly addableStudents = input<CicloAlumnoMovible[]>([]);
  readonly isLoadingCiclos = input(false);
  readonly isLoadingCycle = input(false);
  readonly isLoadingAddable = input(false);
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

  // Skeletons (fix-046): anchos de columnas del header de tabla + nº de filas del rail.
  // Suma acotada para caber en la card angosta (568px) del layout 2-col sin recorte.
  protected readonly skeletonColWidths = [
    '40px',
    '28px',
    '28px',
    '40px',
    '52px',
    '60px',
    '44px',
    '40px',
    '32px',
  ];
  protected readonly alertSkeletonIndexes = [0, 1, 2, 3, 4, 5, 6, 7];
  protected readonly activeStatusFilter = signal<StatusFilter>('todos');
  protected readonly selectedInstructorId = signal<number | null>(null);

  readonly instructorSelectOptions = computed(() =>
    this.instructores().map((i) => ({ label: i.name, value: i.id })),
  );

  // Justify modal
  protected readonly justifyModalOpen = signal(false);
  protected readonly justifySessionId = signal<number | null>(null);
  protected readonly justifyReason = signal('');

  protected readonly viewMotivoModalOpen = signal(false);
  protected readonly viewMotivoText = signal('');

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

  /**
   * true = layout desktop de 2 columnas (tabla + rail de alertas).
   * Se deriva de `maxVisible() === null`, que el Smart resuelve como
   * `LayoutService.tier() === 'desktop'` (main ≥ 1024px) — MISMA señal que
   * activa el fill-screen (`@container layoutmain min-width:1024px`). Se usa
   * en vez del breakpoint de viewport `lg:` de Tailwind a propósito: con el
   * drawer lateral abierto el viewport sigue ancho pero `<main>` se angosta →
   * queremos apilar (1 columna) igual que se compacta la densidad, no mantener
   * 2 columnas apretadas.
   */
  protected readonly isDesktopLayout = computed(() => this.maxVisible() === null);

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

  // ── Densidad adaptativa (spec 0030) ──────────────────────────────────────────
  // "Cargar más" tab-scoped (canon 0029) + reset explícito al cambiar filtro,
  // instructor, fecha o tab (los setters wrapper de abajo). Los filtros operan
  // sobre el total (filteredPracticas); el presupuesto solo recorta el render.
  private readonly loadMoreTab = signal<string | null>(null);
  private readonly loadMoreClicks = signal(0);

  protected readonly visiblePracticas = computed(() =>
    visibleWithLoadMore(this.filteredPracticas(), this.maxVisible(), this.activeTab(), {
      forTab: this.loadMoreTab(),
      clicks: this.loadMoreClicks(),
    }),
  );

  protected readonly hasMorePracticas = computed(
    () => this.visiblePracticas().length < this.filteredPracticas().length,
  );

  protected readonly remainingPracticas = computed(
    () => this.filteredPracticas().length - this.visiblePracticas().length,
  );

  protected readonly skeletonIndexes = computed(() => {
    const count = this.maxVisible() ?? 5;
    return Array.from({ length: count }, (_, i) => i);
  });

  protected loadMorePracticas(): void {
    const tab = this.activeTab();
    if (this.loadMoreTab() !== tab) {
      this.loadMoreTab.set(tab);
      this.loadMoreClicks.set(1);
    } else {
      this.loadMoreClicks.update((n) => n + 1);
    }
  }

  private resetLoadMore(): void {
    this.loadMoreTab.set(null);
    this.loadMoreClicks.set(0);
  }

  protected setStatusFilter(filter: StatusFilter): void {
    this.activeStatusFilter.set(filter);
    this.resetLoadMore();
  }

  protected setInstructorFilter(id: number | null): void {
    this.selectedInstructorId.set(id);
    this.resetLoadMore();
  }

  protected selectTab(tab: 'practicas' | 'ciclos'): void {
    this.activeTab.set(tab);
    this.resetLoadMore();
  }

  // ── Template helpers ─────────────────────────────────────────────────────────

  protected onDateChange(val: string): void {
    if (!val) return;
    this.resetLoadMore();
    this.dateChange.emit(val);
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

  /** Fecha compacta DD-MM para la línea 2 de la fila de alerta (fix-047). */
  protected formatIsoDateShort(iso: string): string {
    const [, m, d] = iso.slice(0, 10).split('-');
    return `${d}-${m}`;
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  /** Política/motivo de la alerta para el pTooltip canon (fix-048). Nombre, conteo y
   *  última fecha ya van inline en la fila (fix-047); el tooltip solo aporta el "por qué". */
  protected alertaTooltip(alerta: AlertaFaltaConsecutiva): string {
    return alerta.nivel === 'danger'
      ? 'Política: 2 inasistencias consecutivas — acción manual requerida'
      : 'Próxima inasistencia podría requerir eliminar el horario';
  }

  // ── Status badge helpers ──────────────────────────────────────────────────────

  /** true cuando la inasistencia ya fue justificada por la secretaria. */
  protected isJustificada(row: ClasePracticaRow): boolean {
    return row.status === 'ausente' && !!row.justificacion;
  }

  protected statusBadgeLabel(row: ClasePracticaRow): string {
    if (this.isJustificada(row)) return 'Justificada';
    switch (row.status) {
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

  protected statusBadgeIcon(row: ClasePracticaRow): string {
    if (this.isJustificada(row)) return 'shield-check';
    switch (row.status) {
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

  protected statusBadgeVariant(row: ClasePracticaRow): 'success' | 'error' | 'brand' | 'neutral' {
    if (this.isJustificada(row)) return 'neutral';
    switch (row.status) {
      case 'presente':
        return 'success';
      case 'ausente':
        return 'error';
      case 'en_curso':
        return 'brand';
      case 'pendiente':
        return 'neutral';
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
  
  protected openViewMotivo(motivo: string): void {
    this.viewMotivoText.set(motivo);
    this.viewMotivoModalOpen.set(true);
  }
  
  protected closeViewMotivo(): void {
    this.viewMotivoModalOpen.set(false);
    this.viewMotivoText.set('');
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
