import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';

import { IconComponent } from '@shared/components/icon/icon.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { AgendaSlotComponent } from './agenda-slot.component';

import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

import type {
  AgendaWeekData,
  AgendaDayColumn,
  AgendaSlot,
  AgendaInstructorFilter,
} from '@core/models/ui/agenda.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

/** Opción para el dropdown de filtro de instructor. */
interface InstructorOption {
  label: string;
  value: number | null;
}

/** Resumen condensado de una celda (master view). */
interface CellSummary {
  available: number;
  scheduled: number;
  completed: number;
  inProgress: number;
  noShow: number;
  total: number;
  instructors: string[];
}

/**
 * AgendaSemanalComponent — Organismo Dumb de la Agenda Semanal.
 *
 * Recibe todos los datos vía `input()` y emite interacciones vía `output()`.
 * La lógica de negocio (carga, navegación, agendar) vive en el Smart padre
 * que inyecta AgendaFacade.
 */
@Component({
  selector: 'app-agenda-semanal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    IconComponent,
    KpiCardVariantComponent,
    SkeletonBlockComponent,
    EmptyStateComponent,
    SectionHeroComponent,
    AgendaSlotComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
    AnimateInDirective,
  ],
  host: { class: 'block' },
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid aria-label="Agenda semanal">
      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <app-section-hero
        contextLine="Gestión de horarios"
        title="Agenda Semanal"
        variant="compact"
        [subtitle]="weekSubtitle()"
        [actions]="heroActions"
        (actionClick)="onHeroAction($event)"
      />

      <!-- ── KPIs ──────────────────────────────────────────────────────────── -->
      @for (kpi of kpiCards(); track kpi.id) {
        <div class="bento-square">
          <app-kpi-card-variant
            [value]="kpi.value"
            [label]="kpi.label"
            [icon]="kpi.icon"
            [color]="kpi.color"
            [loading]="isLoading()"
          />
        </div>
      }

      <!-- ── Calendario ─────────────────────────────────────────────────────── -->
      <div
        #calendarCard
        class="bento-banner card p-0 overflow-hidden"
        appCardHover
        aria-label="Calendario semanal"
      >
        <!-- Mobile day tabs — solo visibles debajo de 640px -->
        @if (filteredDays().length > 0) {
          <div class="agenda-mobile-tabs" role="tablist" aria-label="Seleccionar día">
            @for (day of filteredDays(); track day.date; let i = $index) {
              <button
                class="agenda-mobile-tab"
                [class.agenda-mobile-tab--active]="mobileDayIndex() === i"
                [class.agenda-mobile-tab--today]="day.isToday"
                role="tab"
                [attr.aria-selected]="mobileDayIndex() === i"
                [attr.aria-label]="day.label"
                (click)="selectMobileDay(i)"
              >
                <span class="agenda-mobile-tab-day">{{ day.label.split(' ')[0] }}</span>
                @if (day.isToday) {
                  <span class="agenda-mobile-today-dot"></span>
                }
              </button>
            }
          </div>
        }

        <!-- Toolbar de navegación + filtro -->
        <div class="agenda-toolbar flex items-center justify-between gap-3 px-4 py-3 border-b">
          <!-- Navegación de semana -->
          <div class="flex items-center gap-1">
            <button
              class="agenda-nav-btn"
              (click)="weekPrev.emit()"
              aria-label="Semana anterior"
              data-llm-action="prev-week"
            >
              <app-icon name="chevron-left" [size]="16" />
            </button>

            <span class="agenda-week-label" aria-live="polite">
              @if (weekData()?.weekLabel) {
                {{ weekData()!.weekLabel }}
              } @else {
                &nbsp;
              }
            </span>

            <button
              class="agenda-nav-btn"
              (click)="weekNext.emit()"
              aria-label="Semana siguiente"
              data-llm-action="next-week"
            >
              <app-icon name="chevron-right" [size]="16" />
            </button>

            @if (!isCurrentWeek()) {
              <button
                class="agenda-today-btn"
                (click)="weekToday.emit()"
                data-llm-action="go-to-today"
              >
                Hoy
              </button>
            }
          </div>

          <!-- Filtro de instructor -->
          <div class="flex items-center gap-2 min-w-0">
            <app-icon name="users" [size]="14" />
            <p-select
              [options]="instructorOptions()"
              [ngModel]="selectedInstructorId()"
              (ngModelChange)="instructorFilterChange.emit($event)"
              optionLabel="label"
              optionValue="value"
              [style]="{ 'min-width': '180px' }"
              placeholder="Todos los instructores"
              styleClass="agenda-select"
              [attr.data-llm-description]="'Filtrar calendario por instructor'"
            />
          </div>
        </div>

        <!-- Grid del calendario -->
        @if (isLoading()) {
          <div class="p-4 flex flex-col gap-2">
            <!-- Skeleton header -->
            <div class="flex gap-2 mb-1">
              <app-skeleton-block variant="rect" width="64px" height="36px" />
              @for (col of skeletonCols; track $index) {
                <app-skeleton-block variant="rect" width="100%" height="36px" />
              }
            </div>
            <!-- Skeleton rows — alternas para realismo -->
            @for (row of skeletonRows; track $index) {
              <div class="flex gap-2">
                <app-skeleton-block variant="rect" width="64px" height="52px" />
                @for (col of skeletonCols; track $index) {
                  <app-skeleton-block
                    variant="rect"
                    width="100%"
                    [height]="$index % 3 === 0 ? '52px' : '52px'"
                  />
                }
              </div>
            }
          </div>
        } @else if (!weekData() || timeRows().length === 0) {
          <app-empty-state
            icon="calendar"
            message="No hay clases en esta semana"
            subtitle="Navega a otra semana o agrega instructores con disponibilidad."
          />
        } @else {
          <div
            #calendarGrid
            class="agenda-grid"
            [style]="gridTemplateStyle()"
            role="grid"
            [attr.aria-label]="'Grilla de horarios, semana ' + (weekData()?.weekLabel ?? '')"
          >
            <!-- Header: esquina vacía + cabeceras de días -->
            <div class="agenda-corner" role="columnheader" aria-label="Hora"></div>
            @for (day of filteredDays(); track day.date) {
              <div
                class="agenda-day-header"
                [class.agenda-day-header--today]="day.isToday"
                role="columnheader"
                [attr.aria-label]="day.label"
              >
                {{ day.label }}
              </div>
            }

            <!-- Filas de tiempo -->
            @for (time of timeRows(); track time) {
              <!-- Etiqueta de hora -->
              <div
                class="agenda-time-label"
                [class.agenda-time-label--now]="nowTimeRow() === time"
                role="rowheader"
              >
                {{ time }}
              </div>

              <!-- Celdas por día -->
              @for (day of filteredDays(); track day.date) {
                @if (isMasterView()) {
                  <!-- MASTER VIEW: Vista condensada con indicadores -->
                  <div
                    class="agenda-cell cell-condensed"
                    [class.agenda-cell--now]="nowTimeRow() === time"
                    [class.agenda-cell--today]="day.isToday"
                    role="gridcell"
                    [attr.aria-label]="
                      day.label + ' ' + time + ' — ' + getCellSummary(day, time).total + ' slots'
                    "
                    [class.cell-condensed--expanded]="expandedCellKey() === cellKey(day.date, time)"
                    (click)="toggleCell(day.date, time)"
                  >
                    @if (expandedCellKey() === cellKey(day.date, time)) {
                      <!-- Expandido: slots individuales -->
                      <div class="cell-expanded-content" appAnimateIn>
                        @for (slot of getCell(day, time); track slot.id) {
                          <app-agenda-slot
                            [slot]="slot"
                            [compact]="true"
                            (slotClicked)="slotClick.emit($event)"
                          />
                        }
                        <button
                          class="cell-collapse-btn"
                          (click)="toggleCell(day.date, time); $event.stopPropagation()"
                          aria-label="Colapsar celda"
                        >
                          <app-icon name="chevron-up" [size]="10" />
                        </button>
                      </div>
                    } @else {
                      <!-- Condensado: pills de disponibilidad -->
                      @if (getCellSummary(day, time).total > 0) {
                        <div class="cell-pills">
                          @if (getCellSummary(day, time).available > 0) {
                            <span class="cell-pill cell-pill--available">
                              {{ getCellSummary(day, time).available }}
                              libre{{ getCellSummary(day, time).available !== 1 ? 's' : '' }}
                            </span>
                          }
                          @if (occupiedCount(getCellSummary(day, time)) > 0) {
                            <span class="cell-pill cell-pill--occupied">
                              {{ occupiedCount(getCellSummary(day, time)) }} ocup.
                            </span>
                          }
                        </div>
                        <span class="cell-expand-hint">
                          <app-icon name="chevron-down" [size]="10" />
                        </span>
                      }
                    }
                  </div>
                } @else {
                  <!-- FILTERED VIEW: Vista detallada con slots compactos -->
                  <div
                    class="agenda-cell"
                    [class.agenda-cell--now]="nowTimeRow() === time"
                    [class.agenda-cell--today]="day.isToday"
                    role="gridcell"
                    [attr.aria-label]="day.label + ' ' + time"
                  >
                    @for (slot of getCell(day, time); track slot.id) {
                      <app-agenda-slot
                        [slot]="slot"
                        [compact]="true"
                        (slotClicked)="slotClick.emit($event)"
                      />
                    }
                  </div>
                }
              }
            }
          </div>

          <!-- Leyenda -->
          <div class="agenda-legend flex items-center gap-4 px-4 py-2 border-t">
            <div class="legend-item legend-item--available">Disponible</div>
            <div class="legend-item legend-item--scheduled">Agendada</div>
            <div class="legend-item legend-item--in-progress">En progreso</div>
            <div class="legend-item legend-item--completed">Completada</div>
            <div class="legend-item legend-item--no-show">No asistió</div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    /* ── Mobile day tabs ─────────────────────────────────────────── */

    .agenda-mobile-tabs {
      display: none;
      overflow-x: auto;
      scrollbar-width: none;
      border-bottom: 1px solid var(--color-border);
      background: var(--bg-surface);
      padding: 0 0.5rem;

      &::-webkit-scrollbar {
        display: none;
      }

      @media (max-width: 640px) {
        display: flex;
        gap: 2px;
      }
    }

    .agenda-mobile-tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
      padding: 0.5rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-muted);
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition:
        color 150ms ease,
        border-color 150ms ease;
      background: transparent;

      &--active {
        color: var(--ds-brand);
        border-bottom-color: var(--ds-brand);
        font-weight: 600;
      }

      &--today .agenda-mobile-tab-day {
        color: var(--ds-brand);
      }
    }

    .agenda-mobile-today-dot {
      display: block;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--ds-brand);
    }

    /* ── Toolbar ───────────────────────────────────────────────────── */

    .agenda-toolbar {
      background: var(--bg-surface);
      flex-wrap: wrap;
    }

    .agenda-nav-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: var(--bg-surface);
      color: var(--text-secondary);
      cursor: pointer;
      transition:
        background 120ms ease,
        border-color 120ms ease;

      &:hover {
        border-color: var(--ds-brand);
        color: var(--ds-brand);
        background: color-mix(in srgb, var(--ds-brand) 6%, var(--bg-surface));
      }
    }

    .agenda-week-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
      padding: 0 0.5rem;
      min-width: 160px;
      text-align: center;
    }

    .agenda-today-btn {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.625rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--ds-brand);
      color: var(--ds-brand);
      background: color-mix(in srgb, var(--ds-brand) 8%, var(--bg-surface));
      cursor: pointer;
      transition: background 120ms ease;
      margin-left: 0.25rem;

      &:hover {
        background: color-mix(in srgb, var(--ds-brand) 16%, var(--bg-surface));
      }
    }

    /* ── CSS Grid del calendario ─────────────────────────────── */

    .agenda-grid {
      display: grid;
      /* grid-template-columns set via [style] binding */
      border-top: 1px solid var(--color-border);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scroll-behavior: smooth;

      @media (max-width: 640px) {
        /* Columnas compactas en mobile para scroll horizontal fluido */
        font-size: 0.75rem;
      }
    }

    .agenda-corner {
      background: var(--bg-surface);
      border-right: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
      position: sticky;
      top: 0;
      left: 0;
      z-index: 3;
    }

    .agenda-day-header {
      padding: 0.625rem 0.5rem;
      background: var(--bg-surface);
      text-align: center;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      border-right: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
      position: sticky;
      top: 0;
      z-index: 2;

      &--today {
        color: var(--ds-brand);
        background: color-mix(in srgb, var(--ds-brand) 5%, var(--bg-surface));

        &::after {
          content: '';
          display: block;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--ds-brand);
          margin: 2px auto 0;
        }
      }
    }

    .agenda-time-label {
      padding: 6px 8px 0;
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      color: var(--text-muted);
      text-align: right;
      background: var(--bg-surface);
      border-right: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
      position: sticky;
      left: 0;
      z-index: 1;
      min-height: 56px;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
    }

    .agenda-cell {
      background: var(--bg-surface);
      border-right: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
      padding: 3px;
      min-height: 56px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    /* ── Columna "hoy" — tint sutil en celdas ─────────────── */

    .agenda-cell--today {
      background: color-mix(in srgb, var(--ds-brand) 4%, var(--bg-surface));
    }

    /* ── Indicador "ahora" ───────────────────────────────── */

    .agenda-time-label--now {
      color: var(--state-error);
      font-weight: var(--font-bold);

      /* Punto rojo antes de la hora */
      &::before {
        content: '';
        display: block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--state-error);
        margin: 0 4px 0 auto;
        flex-shrink: 0;
        align-self: center;
      }
    }

    .agenda-cell--now {
      border-top: 2px solid var(--state-error);
    }

    /* ── Celdas condensadas (Master View) ─────────────────── */

    .cell-condensed {
      cursor: pointer;
      transition: background var(--duration-instant) var(--ease-standard);
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 4px;

      &:hover {
        background: color-mix(in srgb, var(--ds-brand) 5%, var(--bg-base));

        .cell-expand-hint {
          opacity: 1;
        }
      }

      &--expanded {
        cursor: default;
        align-items: stretch;
        justify-content: flex-start;
        text-align: left;
        background: color-mix(in srgb, var(--ds-brand) 6%, var(--bg-surface));
      }
    }

    .cell-expanded-content {
      display: flex;
      flex-direction: column;
      gap: 3px;
      width: 100%;
    }

    /* ── Pills de disponibilidad ───────────────────────────── */

    .cell-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
      justify-content: center;
    }

    .cell-pill {
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      padding: 2px 7px;
      border-radius: var(--radius-full);
      line-height: 1.4;
      white-space: nowrap;
    }

    .cell-pill--available {
      background: color-mix(in srgb, var(--ds-brand) 12%, var(--bg-surface));
      color: var(--ds-brand);
      border: 1px solid color-mix(in srgb, var(--ds-brand) 35%, transparent);
    }

    .cell-pill--occupied {
      background: var(--bg-elevated);
      color: var(--text-muted);
      border: 1px solid var(--border-subtle);
    }

    .cell-expand-hint {
      display: flex;
      justify-content: center;
      color: var(--text-disabled);
      opacity: 0;
      transition: opacity var(--duration-instant) var(--ease-standard);
    }

    .cell-collapse-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px;
      margin-top: 2px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      border-radius: var(--radius-sm);

      &:hover {
        color: var(--ds-brand);
        background: color-mix(in srgb, var(--ds-brand) 8%, transparent);
      }
    }

    /* ── Leyenda ─────────────────────────────────────────────── */

    .agenda-legend {
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      background: var(--bg-surface);
    }

    .legend-item {
      font-size: var(--text-xs);
      display: flex;
      align-items: center;
      gap: 5px;
      color: var(--text-muted);

      &::before {
        content: '';
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: var(--radius-sm);
        flex-shrink: 0;
      }

      &--available::before {
        border: 1.5px dashed var(--border-strong);
        background: transparent;
      }

      &--scheduled::before {
        background: color-mix(in srgb, var(--ds-brand) 14%, var(--bg-surface));
        border: 1.5px solid color-mix(in srgb, var(--ds-brand) 55%, transparent);
      }

      &--in-progress::before {
        background: var(--ds-brand);
        border: 1.5px solid var(--color-primary-hover);
      }

      &--completed::before {
        background: color-mix(in srgb, var(--state-success) 14%, var(--bg-surface));
        border: 1.5px solid color-mix(in srgb, var(--state-success) 50%, transparent);
      }

      &--no-show::before {
        background: var(--bg-elevated);
        border: 1px solid var(--border-subtle);
      }
    }
  `,
})
export class AgendaSemanalComponent implements AfterViewInit {
  private readonly gsap = inject(GsapAnimationsService);

  // ── Inputs ──────────────────────────────────────────────────────────────────

  weekData = input<AgendaWeekData | null>(null);
  filteredDays = input<AgendaDayColumn[]>([]);
  timeRows = input<string[]>([]);
  isLoading = input(false);
  isCurrentWeek = input(false);
  instructors = input<AgendaInstructorFilter[]>([]);
  selectedInstructorId = input<number | null>(null);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  weekNext = output<void>();
  weekPrev = output<void>();
  weekToday = output<void>();
  instructorFilterChange = output<number | null>();
  slotClick = output<AgendaSlot>();

  // ── ViewChildren ─────────────────────────────────────────────────────────────

  private readonly kpiGridRef = viewChild<ElementRef>('kpiGrid');
  private readonly calendarCardRef = viewChild<ElementRef>('calendarCard');
  private readonly calendarGridRef = viewChild<ElementRef>('calendarGrid');

  // ── Estado local ─────────────────────────────────────────────────────────────

  /** Índice del día seleccionado en mobile (0 = Lun, 4 = Vie). */
  readonly mobileDayIndex = signal(0);

  /** Clave de la celda expandida en master view (null = todas condensadas). */
  readonly expandedCellKey = signal<string | null>(null);

  /** True cuando no hay filtro de instructor → vista de todos. */
  readonly isMasterView = computed(() => this.selectedInstructorId() === null);

  /**
   * Fila de hora más cercana a la hora actual (HH:MM) — para el indicador "ahora".
   * Null si la hora actual está fuera del rango de timeRows.
   */
  readonly nowTimeRow = computed<string | null>(() => {
    if (!this.isCurrentWeek()) return null;
    const rows = this.timeRows();
    if (!rows.length) return null;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    // Encuentra la fila cuyo inicio ≤ ahora < inicio + 45min
    for (const row of rows) {
      const [h, m] = row.split(':').map(Number);
      const rowStart = h * 60 + m;
      if (nowMinutes >= rowStart && nowMinutes < rowStart + 45) return row;
    }
    return null;
  });

  /** Evita re-animar la grilla si ya fue animada en el ciclo de carga actual. */
  private _gridAnimated = false;

  // ── Datos del hero ───────────────────────────────────────────────────────────

  readonly heroActions: SectionHeroAction[] = [];

  readonly weekSubtitle = computed(() => {
    const data = this.weekData();
    if (!data) return 'Cargando semana...';
    return `Semana del ${data.weekLabel}`;
  });

  // ── KPI Cards ────────────────────────────────────────────────────────────────

  readonly kpiCards = computed(() => {
    const kpis = this.weekData()?.kpis;
    return [
      {
        id: 'agendadas',
        label: 'Clases Agendadas',
        value: kpis?.clasesAgendadas ?? 0,
        icon: 'calendar-clock' as const,
        color: 'default' as const,
        accent: false,
      },
      {
        id: 'instructores',
        label: 'Instructores Disponibles',
        value: kpis?.instructoresDisponibles ?? 0,
        icon: 'users' as const,
        color: 'success' as const,
        accent: false,
      },
      {
        id: 'vehiculos',
        label: 'Vehículos Disponibles',
        value: kpis?.vehiculosDisponibles ?? 0,
        icon: 'car' as const,
        color: 'default' as const,
        accent: false,
      },
      {
        id: 'completadas',
        label: 'Clases Completadas',
        value: kpis?.clasesCompletadas ?? 0,
        icon: 'check-circle' as const,
        color: 'success' as const,
        accent: true,
      },
    ];
  });

  // ── Opciones del dropdown de instructor ──────────────────────────────────────

  readonly instructorOptions = computed<InstructorOption[]>(() => [
    { label: 'Todos los instructores', value: null },
    ...this.instructors().map((i) => ({ label: i.name, value: i.id })),
  ]);

  // ── CSS Grid template ────────────────────────────────────────────────────────

  readonly gridTemplateStyle = computed(
    () =>
      `grid-template-columns: 64px repeat(${this.filteredDays().length || 5}, minmax(100px, 1fr))`,
  );

  // ── Filas de skeleton ────────────────────────────────────────────────────────

  readonly skeletonRows = Array(6).fill(0);
  readonly skeletonCols = Array(5).fill(0);

  // ── GSAP: animar grilla al cargar ─────────────────────────────────────────────

  constructor() {
    effect(() => {
      if (this.isLoading()) {
        this._gridAnimated = false;
        return;
      }
      if (this.weekData() && !this._gridAnimated) {
        this._gridAnimated = true;
        // Doble rAF para garantizar que @if haya re-renderizado el grid
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const gridEl = this.calendarGridRef()?.nativeElement as HTMLElement | undefined;
            if (gridEl) this.gsap.animateSkeletonToContent(gridEl);
          });
        });
      }
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    const kpiEl = this.kpiGridRef()?.nativeElement as HTMLElement | undefined;
    if (kpiEl) this.gsap.animateBentoGrid(kpiEl);

    const cardEl = this.calendarCardRef()?.nativeElement as HTMLElement | undefined;
    if (cardEl) this.gsap.animateHero(cardEl);
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  onHeroAction(actionId: string): void {
    if (actionId === 'schedule') {
      this.slotClick.emit(null as unknown as AgendaSlot);
    }
  }

  /** Selecciona el día en mobile y hace scroll suave hasta su columna en la grilla. */
  selectMobileDay(index: number): void {
    this.mobileDayIndex.set(index);
    const gridEl = this.calendarGridRef()?.nativeElement as HTMLElement | undefined;
    if (!gridEl) return;
    // Columna 0 = time-label (64px), columnas 1-N = días
    const colWidth = (gridEl.scrollWidth - 64) / (this.filteredDays().length || 1);
    gridEl.scrollTo({ left: 64 + colWidth * index, behavior: 'smooth' });
  }

  /**
   * Retorna los slots de una celda (día × hora).
   * Puro: sin estado externo, igual entrada = igual salida.
   */
  getCell(day: AgendaDayColumn, time: string): AgendaSlot[] {
    return day.slots.filter((s) => s.startTime === time);
  }

  // ── Master View: condensed cells ──────────────────────────────────────────

  /** Genera clave única para expandir/colapsar celdas. */
  cellKey(date: string, time: string): string {
    return `${date}__${time}`;
  }

  /** Toggle expandir/colapsar una celda en master view. */
  toggleCell(date: string, time: string): void {
    const key = this.cellKey(date, time);
    this.expandedCellKey.set(this.expandedCellKey() === key ? null : key);
  }

  /** Resumen de estados de los slots en una celda (para la vista condensada). */
  getCellSummary(day: AgendaDayColumn, time: string): CellSummary {
    const slots = this.getCell(day, time);
    const summary: CellSummary = {
      available: 0,
      scheduled: 0,
      completed: 0,
      inProgress: 0,
      noShow: 0,
      total: slots.length,
      instructors: [],
    };
    const instructorSet = new Set<string>();
    for (const s of slots) {
      switch (s.status) {
        case 'available':
          summary.available++;
          break;
        case 'scheduled':
          summary.scheduled++;
          break;
        case 'completed':
          summary.completed++;
          break;
        case 'in_progress':
          summary.inProgress++;
          break;
        case 'no_show':
        case 'cancelled':
          summary.noShow++;
          break;
      }
      if (s.instructorName) instructorSet.add(s.instructorName);
    }
    summary.instructors = [...instructorSet];
    return summary;
  }

  /** Retorna el total de slots ocupados (scheduled + in_progress + completed). */
  occupiedCount(summary: CellSummary): number {
    return summary.scheduled + summary.inProgress + summary.completed;
  }
}
