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
import { TooltipModule } from 'primeng/tooltip';

import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { AgendaSlotComponent } from './agenda-slot.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { ScrollContainerDirective } from '@core/directives/scroll-container.directive';
import { todayIso } from '@core/utils/date.utils';

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
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';

/**
 * Suma `days` días a una fecha ISO ('YYYY-MM-DD') y devuelve el resultado en
 * el mismo formato. Mediodía fijo al parsear para evitar corrimientos por
 * DST/zona horaria. Función pura.
 */
export function addDaysToIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * True si `dateIso` supera la fecha límite de visualización configurada
 * (`maxVisibleDateIso`) — usado para deshabilitar celdas/días individuales
 * dentro de una semana "límite" (parte dentro del rango, parte fuera).
 * Comparación de strings ISO 'YYYY-MM-DD' (ordenan igual que fechas).
 */
export function isDateBeyondLimit(
  dateIso: string | null | undefined,
  maxVisibleDateIso: string | null,
): boolean {
  if (!maxVisibleDateIso || !dateIso) return false;
  return dateIso > maxVisibleDateIso;
}

/**
 * True si la PRÓXIMA semana (weekStart + 7 días) ya arrancaría más allá de
 * la fecha límite — es decir, sería una semana enteramente "fantasma" (cero
 * días válidos). Deshabilita "Semana siguiente" en ese caso exacto: permite
 * llegar a la última semana con al menos un día válido, nunca a una semana
 * completamente fuera de rango. Función pura, sin depender de servicios.
 */
export function isNextWeekBeyondLimit(
  weekStart: string | null | undefined,
  maxVisibleDateIso: string | null,
): boolean {
  if (!maxVisibleDateIso || !weekStart) return false;
  return addDaysToIso(weekStart, 7) > maxVisibleDateIso;
}

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
    TooltipModule,
    IconComponent,
    SkeletonBlockComponent,
    EmptyStateComponent,
    SectionHeroComponent,
    AgendaSlotComponent,
    DateInputComponent,
    BentoGridLayoutDirective,
    ScrollContainerDirective,
    CardHoverDirective,
    AnimateInDirective,
  ],
  host: { class: 'block' },
  template: `
    <div
      class="bento-grid bento-grid--fill-screen"
      appBentoGridLayout
      #bentoGrid
      aria-label="Agenda semanal"
    >
      <!-- ── Hero + KPIs inline ───────────────────────────────────────────── -->
      @if (showHero()) {
        <app-section-hero
          density="slim"
          contextLine="Gestión de horarios"
          title="Agenda Semanal"
          [subtitle]="weekSubtitle()"
          [kpis]="heroKpis()"
          [loading]="isLoading()"
          [actions]="heroActions"
          (actionClick)="onHeroAction($event)"
        />
      }

      <!-- ── Calendario ─────────────────────────────────────────────────────── -->
      <div
        #calendarCard
        class="bento-banner card p-0 overflow-hidden flex flex-col"
        appCardHover
        aria-label="Calendario semanal"
      >
        <!-- Mobile day tabs — solo visibles debajo de 640px -->
        @if (filteredDays().length > 0) {
          <div class="agenda-mobile-tabs shrink-0" role="tablist" aria-label="Seleccionar día">
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
        <div
          class="agenda-toolbar flex items-center justify-between gap-3 px-4 py-3 border-b shrink-0"
        >
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
              [disabled]="isNextWeekDisabled()"
              [attr.aria-disabled]="isNextWeekDisabled()"
              [pTooltip]="isNextWeekDisabled() ? nextWeekDisabledHint() : undefined"
              tooltipPosition="bottom"
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

            <!-- Salto rápido: elegir cualquier fecha (respeta min=hoy, max=límite
                 configurado en Ajustes) → la agenda salta a la semana que contiene
                 ese día. Reutiliza app-date-input (Boilerplate Local). -->
            <div class="agenda-jump-date" data-llm-description="Saltar a una fecha específica">
              <app-date-input
                [value]="jumpMinDate"
                [min]="jumpMinDate"
                [max]="maxVisibleDateIso() ?? ''"
                [readonlyInput]="true"
                placeholder="Ir a fecha"
                inputStyleClass="agenda-jump-date-input"
                (valueChange)="onJumpToDate($event)"
              />
            </div>

            @if (maxVisibleDateLabel()) {
              <span class="agenda-visibility-hint">
                Mostrando horarios hasta el {{ maxVisibleDateLabel() }}
              </span>
            }
          </div>

          <!-- Filtro de instructor -->
          <div class="agenda-instructor-filter flex items-center gap-2 min-w-0">
            <span class="instructor-label">Mostrando horario de:</span>
            <div class="agenda-select-wrap">
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
        </div>

        <!-- Grid del calendario -->
        @if (isLoading()) {
          <div
            class="agenda-grid flex-1"
            appScrollContainer
            maxHeight="none"
            [scrollX]="true"
            style="grid-template-columns: 64px repeat(5, minmax(100px, 1fr))"
            aria-hidden="true"
          >
            <!-- Skeleton: corner + day headers -->
            <div class="agenda-corner"></div>
            @for (col of skeletonCols; track col) {
              <div class="agenda-day-header flex items-center justify-center">
                <app-skeleton-block variant="text" width="56px" />
              </div>
            }

            <!-- Skeleton: time rows -->
            @for (row of skeletonRows; track row) {
              <div class="agenda-time-label">
                <app-skeleton-block variant="text" width="32px" />
              </div>
              @for (col of skeletonCols; track col) {
                <div class="agenda-cell">
                  @if ((row + col) % 3 !== 0) {
                    <app-skeleton-block variant="rect" width="85%" height="20px" />
                  }
                </div>
              }
            }
          </div>
        } @else if (!weekData() || timeRows().length === 0) {
          <div
            class="flex flex-1 items-center justify-center border-t border-[var(--color-border)]"
          >
            <app-empty-state
              icon="calendar"
              message="No hay clases en esta semana"
              subtitle="Navega a otra semana o agrega instructores con disponibilidad."
            />
          </div>
        } @else {
          <div
            #calendarGrid
            class="agenda-grid flex-1"
            appScrollContainer
            maxHeight="none"
            [scrollX]="true"
            [style]="gridTemplateStyle()"
            role="grid"
            [attr.aria-label]="'Grilla de horarios, semana ' + (weekData()?.weekLabel ?? '')"
          >
            <!-- Header: esquina vacía + cabeceras de días -->
            <div class="agenda-corner" role="columnheader" aria-label="Hora"></div>
            @for (day of filteredDays(); track day.date; let dayIdx = $index) {
              <div
                class="agenda-day-header"
                [class.agenda-day-header--today]="day.isToday"
                [class.agenda-day-header--disabled]="isDayBeyondLimit(day)"
                [class.agenda-col--mobile-hidden]="dayIdx !== mobileDayIndex()"
                role="columnheader"
                [attr.aria-label]="day.label"
                [attr.aria-disabled]="isDayBeyondLimit(day) || null"
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
              @for (day of filteredDays(); track day.date; let dayIdx = $index) {
                @if (isMasterView()) {
                  <!-- MASTER VIEW: Vista condensada con indicadores -->
                  <div
                    class="agenda-cell cell-condensed"
                    [class.agenda-cell--now]="nowTimeRow() === time"
                    [class.agenda-cell--today]="day.isToday"
                    [class.agenda-col--mobile-hidden]="dayIdx !== mobileDayIndex()"
                    [class.cell-condensed--empty]="getCellSummary(day, time).total === 0"
                    [class.agenda-cell--beyond-limit]="isDayBeyondLimit(day)"
                    role="gridcell"
                    [attr.aria-label]="
                      day.label + ' ' + time + ' — ' + getCellSummary(day, time).total + ' slots'
                    "
                    [attr.aria-disabled]="isDayBeyondLimit(day) || null"
                    [class.cell-condensed--expanded]="expandedCellKey() === cellKey(day.date, time)"
                    (click)="
                      getCellSummary(day, time).total > 0 &&
                        !isDayBeyondLimit(day) &&
                        toggleCell(day.date, time)
                    "
                  >
                    @if (expandedCellKey() === cellKey(day.date, time)) {
                      <!-- Expandido: slots individuales -->
                      <div class="cell-expanded-content" appAnimateIn>
                        @for (slot of getCell(day, time); track slot.id) {
                          <app-agenda-slot
                            [slot]="slot"
                            [compact]="true"
                            [disabled]="isDayBeyondLimit(day)"
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
                      } @else {
                        <!-- Celda vacía: marcador sutil, mantiene la textura de la grilla -->
                        <span class="cell-empty-marker" aria-hidden="true"></span>
                      }
                    }
                  </div>
                } @else {
                  <!-- FILTERED VIEW: Vista detallada con slots compactos -->
                  <div
                    class="agenda-cell"
                    [class.agenda-cell--now]="nowTimeRow() === time"
                    [class.agenda-cell--today]="day.isToday"
                    [class.agenda-col--mobile-hidden]="dayIdx !== mobileDayIndex()"
                    [class.agenda-cell--empty]="getCell(day, time).length === 0"
                    [class.agenda-cell--beyond-limit]="isDayBeyondLimit(day)"
                    role="gridcell"
                    [attr.aria-label]="day.label + ' ' + time"
                    [attr.aria-disabled]="isDayBeyondLimit(day) || null"
                  >
                    @for (slot of getCell(day, time); track slot.id) {
                      <app-agenda-slot
                        [slot]="slot"
                        [compact]="true"
                        [disabled]="isDayBeyondLimit(day)"
                        (slotClicked)="slotClick.emit($event)"
                      />
                    }
                    @if (getCell(day, time).length === 0) {
                      <!-- Celda vacía: sin slot definido para este instructor/horario —
                           marcador sutil (NO clickeable: no hay slot real que agendar). -->
                      <span
                        class="cell-empty-marker cell-empty-marker--filtered"
                        aria-hidden="true"
                      ></span>
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

      &:disabled {
        cursor: not-allowed;
        opacity: 0.4;

        &:hover {
          border-color: var(--color-border);
          color: var(--text-secondary);
          background: var(--bg-surface);
        }
      }
    }

    /* Texto sutil: hasta qué fecha se están cargando datos (límite de meses
       configurable en Ajustes → AgendaSettingsService). */
    .agenda-visibility-hint {
      font-size: var(--text-xs);
      color: var(--text-muted);
      white-space: nowrap;
      margin-left: 0.25rem;
    }

    @media (max-width: 640px) {
      .agenda-visibility-hint {
        display: none;
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

    /* ── Salto rápido de fecha (compacto — solo el ícono de calendario es
       clickeable de forma práctica; el input queda readonly y angosto) ── */
    .agenda-jump-date {
      margin-left: 0.25rem;
      width: 34px;
      flex-shrink: 0;
    }

    .agenda-jump-date ::ng-deep .p-datepicker {
      width: 100%;
    }

    .agenda-jump-date ::ng-deep input.agenda-jump-date-input {
      width: 0;
      min-width: 0;
      padding: 0;
      border: none;
      opacity: 0;
      position: absolute;
      pointer-events: none;
    }

    .agenda-jump-date ::ng-deep .p-datepicker-dropdown {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: var(--bg-surface);
      color: var(--text-secondary);
      cursor: pointer;
      transition:
        background 120ms ease,
        border-color 120ms ease;
    }

    .agenda-jump-date ::ng-deep .p-datepicker-dropdown:hover {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
      background: color-mix(in srgb, var(--ds-brand) 6%, var(--bg-surface));
    }

    .instructor-label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .agenda-select-wrap {
      min-width: 0;
    }

    @media (max-width: 640px) {
      /* Libera el ancho del toolbar: el placeholder del select ya comunica
         el propósito ("Todos los instructores"), la etiqueta es redundante. */
      .instructor-label {
        display: none;
      }

      .agenda-instructor-filter {
        flex: 1 1 100%;
      }

      .agenda-select-wrap {
        flex: 1;
      }

      /* El inline [style]="{'min-width':'180px'}" de PrimeNG gana especificidad
         sobre reglas normales — !important necesario para que el select ocupe
         el ancho completo disponible en vez de quedar apretado junto al nav. */
      .agenda-select-wrap ::ng-deep .p-select {
        width: 100% !important;
        min-width: 0 !important;
      }
    }

    /* ── CSS Grid del calendario ─────────────────────────────── */

    .agenda-grid {
      display: grid;
      /* grid-template-columns set via [style] binding */
      /* Piso de altura por fila explícito a nivel de grid (no solo en las celdas):
         así una fila entera sin ninguna clase agendada (semana vacía, fin de
         semana) conserva la misma altura que una fila llena — la fuente de
         verdad del alto de fila es el propio grid, no el contenido de cada
         celda individual. */
      grid-auto-rows: minmax(56px, auto);
      border-top: 1px solid var(--color-border);
      /* overflow, max-height y scroll-behavior los maneja ScrollContainerDirective */
    }

    /* ── Mobile: un solo día visible por vez ──────────────────────────────
       Reglas SIN nesting (@media plano, no anidado dentro de un selector):
       el nesting nativo mezclado con .agenda-cell / .agenda-grid (definidas
       arriba sin @media) no ganaba la cascada de forma confiable en todos
       los motores — .agenda-col--mobile-hidden no ocultaba nada y el grid
       de 2 columnas terminaba envolviendo los 5 slots por fila en filas
       implícitas nuevas (el apilamiento reportado). Un @media plano al final
       de la hoja, con igual especificidad (una sola clase) mata cualquier
       ambigüedad: por orden de aparición, esta regla siempre gana. */
    @media (max-width: 640px) {
      .agenda-grid {
        font-size: 0.75rem;
        /* !important porque grid-template-columns llega inline vía [style]
           (gridTemplateStyle()), pensado solo para desktop. */
        grid-template-columns: 64px 1fr !important;
      }

      /* Columna de día no seleccionada (ver mobileDayIndex) — display:none
         saca el nodo por completo del grid, así el layout de 2 columnas
         solo recibe 2 items reales por fila (hora + día activo). */
      .agenda-col--mobile-hidden {
        display: none !important;
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

    /* ── Día fuera del límite de visualización (semana "límite" — parte
       dentro del rango, parte fuera). Bloquea toda la columna: sin click,
       sin foco de teclado (pointer-events:none también corta clics a
       app-agenda-slot hijos, que además reciben su propio [disabled]). ── */

    .agenda-day-header--disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .agenda-cell--beyond-limit {
      opacity: 0.45;
      cursor: not-allowed;
      pointer-events: none;
      background: repeating-linear-gradient(
        135deg,
        var(--bg-surface),
        var(--bg-surface) 5px,
        var(--bg-elevated) 5px,
        var(--bg-elevated) 6px
      );
    }

    /* ── Celda vacía (Filtered View) — sin slot definido para ese instructor/
       horario. NO es un slot "available" real (no hay nada que agendar ahí),
       así que solo se comunica con textura, sin affordance de clic. Mantiene
       min-height/bordes idénticos a una celda con contenido. ─────────────── */
    .agenda-cell--empty {
      background: repeating-linear-gradient(
        135deg,
        var(--bg-surface),
        var(--bg-surface) 6px,
        var(--bg-elevated) 6px,
        var(--bg-elevated) 7px
      );
    }

    .cell-empty-marker {
      display: block;
      margin: auto;
    }

    .cell-empty-marker--filtered {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: var(--border-subtle);
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

      /* Sin slots — nada que expandir, así que no se ve/comporta como clickeable. */
      &--empty {
        cursor: default;

        &:hover {
          background: transparent;
        }
      }
    }

    .cell-empty-marker:not(.cell-empty-marker--filtered) {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--border-subtle);
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
  /** Ocultar KPIs cuando la agenda se renderiza dentro de un drawer. */
  showKpis = input(true);
  /** Ocultar hero cuando la agenda se renderiza dentro de un drawer. */
  showHero = input(true);
  /**
   * Fecha límite (ISO YYYY-MM-DD) hasta la que se puede navegar/agendar —
   * viene de `AgendaSettingsService` a través del Smart padre (este Dumb
   * component no inyecta services, solo recibe el valor ya resuelto).
   */
  maxVisibleDateIso = input<string | null>(null);
  /** Etiqueta legible de esa misma fecha límite, ej. "18 de septiembre, 2026". */
  maxVisibleDateLabel = input<string | null>(null);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  weekNext = output<void>();
  weekPrev = output<void>();
  weekToday = output<void>();
  /** Fecha ISO elegida en el "salto rápido" — el Smart padre resuelve a qué semana pertenece. */
  weekJump = output<string>();
  instructorFilterChange = output<number | null>();
  slotClick = output<AgendaSlot>();

  // ── ViewChildren ─────────────────────────────────────────────────────────────

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
   * True cuando la PRÓXIMA semana ya sería enteramente fantasma (0 días
   * válidos) — deshabilita "Semana siguiente" exactamente en la última semana
   * que todavía tiene al menos un día dentro del rango permitido.
   */
  readonly isNextWeekDisabled = computed(() =>
    isNextWeekBeyondLimit(this.weekData()?.weekStart, this.maxVisibleDateIso()),
  );

  readonly nextWeekDisabledHint = computed(
    () => `No se puede agendar más allá del ${this.maxVisibleDateLabel() ?? 'límite configurado'}`,
  );

  /** True si `day.date` supera la fecha límite — bloquea toda la columna de ese día. */
  isDayBeyondLimit(day: AgendaDayColumn): boolean {
    return isDateBeyondLimit(day.date, this.maxVisibleDateIso());
  }

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
        id: 'alumnos',
        label: 'Alumnos esta semana',
        value: kpis?.alumnosDistintos ?? 0,
        icon: 'user-check' as const,
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

  readonly heroKpis = computed((): SectionHeroKpi[] =>
    this.kpiCards().map((k) => ({
      id: k.id,
      label: k.label,
      value: k.value,
      icon: k.icon,
      color: k.color,
    })),
  );

  // ── Opciones del dropdown de instructor ──────────────────────────────────────

  readonly instructorOptions = computed<InstructorOption[]>(() =>
    this.instructors().map((i) => ({ label: i.name, value: i.id })),
  );

  // ── CSS Grid template ────────────────────────────────────────────────────────

  readonly gridTemplateStyle = computed(
    () =>
      `grid-template-columns: 64px repeat(${this.filteredDays().length || 5}, minmax(100px, 1fr))`,
  );

  // ── Filas de skeleton ────────────────────────────────────────────────────────

  readonly skeletonRows = Array.from({ length: 14 }, (_, i) => i);
  readonly skeletonCols = Array.from({ length: 5 }, (_, i) => i);

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
    const cardEl = this.calendarCardRef()?.nativeElement as HTMLElement | undefined;
    if (cardEl) this.gsap.animateHero(cardEl);
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  onHeroAction(actionId: string): void {
    if (actionId === 'schedule') {
      this.slotClick.emit(null as unknown as AgendaSlot);
    }
  }

  /**
   * Selecciona el día visible en mobile. Las columnas de los demás días se
   * ocultan vía CSS (`.agenda-col--mobile-hidden`, comparando contra este
   * índice) — ya no depende de scroll horizontal manual.
   */
  selectMobileDay(index: number): void {
    this.mobileDayIndex.set(index);
  }

  /** Fecha mínima seleccionable en el "salto rápido" — nunca antes de hoy. */
  protected readonly jumpMinDate = todayIso();

  /** Emite la fecha elegida en el DatePicker de salto rápido hacia el Smart padre. */
  protected onJumpToDate(dateIso: string): void {
    if (!dateIso) return;
    this.weekJump.emit(dateIso);
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
