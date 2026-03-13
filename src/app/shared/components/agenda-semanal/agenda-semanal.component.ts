import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
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
  ],
  host: { class: 'block' },
  template: `
    <div class="page-content">
      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <app-section-hero
        contextLine="Gestión de horarios"
        title="Agenda Semanal"
        [subtitle]="weekSubtitle()"
        [actions]="heroActions"
        (actionClick)="onHeroAction($event)"
      />

      <!-- ── KPIs ──────────────────────────────────────────────────────────── -->
      <section #kpiGrid class="bento-grid" appBentoGridLayout aria-label="Métricas de la semana">
        @for (kpi of kpiCards(); track kpi.id) {
          <app-kpi-card-variant
            class="bento-square"
            [value]="kpi.value"
            [label]="kpi.label"
            [icon]="kpi.icon"
            [color]="kpi.color"
            [loading]="isLoading()"
          />
        }
      </section>

      <!-- ── Calendario ─────────────────────────────────────────────────────── -->
      <div class="card p-0 overflow-hidden mt-2" aria-label="Calendario semanal">
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
          <div class="p-6 flex flex-col gap-3">
            @for (row of skeletonRows; track $index) {
              <div class="flex gap-2">
                <app-skeleton-block variant="rect" width="60px" height="48px" />
                @for (col of skeletonCols; track $index) {
                  <app-skeleton-block variant="rect" width="100%" height="48px" />
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
            class="agenda-grid overflow-auto"
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
              <div class="agenda-time-label" role="rowheader">{{ time }}</div>

              <!-- Celdas por día -->
              @for (day of filteredDays(); track day.date) {
                <div class="agenda-cell" role="gridcell" [attr.aria-label]="day.label + ' ' + time">
                  @for (slot of getCell(day, time); track slot.id) {
                    <app-agenda-slot [slot]="slot" (slotClicked)="slotClick.emit($event)" />
                  }
                </div>
              }
            }
          </div>

          <!-- Leyenda -->
          <div class="agenda-legend flex items-center gap-4 px-4 py-2 border-t">
            <div class="legend-item legend-item--available">Disponible</div>
            <div class="legend-item legend-item--scheduled">Agendada</div>
            <div class="legend-item legend-item--completed">Completada</div>
            <div class="legend-item legend-item--no_show">No asistió</div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    /* ── Toolbar ───────────────────────────────────────────────── */

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
      min-width: 600px;
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
      padding: 0.375rem 0.5rem;
      font-size: 0.65rem;
      font-weight: 600;
      color: var(--text-muted);
      text-align: right;
      background: var(--bg-surface);
      border-right: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
      position: sticky;
      left: 0;
      z-index: 1;
      min-height: 52px;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      padding-top: 6px;
    }

    .agenda-cell {
      background: var(--bg-base);
      border-right: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
      padding: 2px;
      min-height: 52px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    /* ── Leyenda ─────────────────────────────────────────────── */

    .agenda-legend {
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      background: var(--bg-surface);
    }

    .legend-item {
      font-size: 0.68rem;
      display: flex;
      align-items: center;
      gap: 5px;
      color: var(--text-muted);

      &::before {
        content: '';
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 2px;
        flex-shrink: 0;
      }

      &--available::before {
        border: 1px dashed var(--color-border);
        background: transparent;
      }

      &--scheduled::before {
        background: color-mix(in srgb, var(--ds-brand) 15%, var(--bg-surface));
        border: 1px solid color-mix(in srgb, var(--ds-brand) 40%, transparent);
      }

      &--completed::before {
        background: color-mix(in srgb, var(--state-success) 15%, var(--bg-surface));
        border: 1px solid color-mix(in srgb, var(--state-success) 40%, transparent);
      }

      &--no_show::before {
        background: var(--bg-surface);
        border: 1px solid var(--color-border);
        opacity: 0.5;
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
  private readonly calendarGridRef = viewChild<ElementRef>('calendarGrid');

  // ── Datos del hero ───────────────────────────────────────────────────────────

  readonly heroActions: SectionHeroAction[] = [
    { id: 'schedule', label: 'Agendar clase', icon: 'plus', primary: true },
  ];

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

  readonly skeletonRows = Array(5).fill(0);
  readonly skeletonCols = Array(5).fill(0);

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    const kpiEl = this.kpiGridRef()?.nativeElement as HTMLElement | undefined;
    if (kpiEl) {
      this.gsap.animateBentoGrid(kpiEl);
    }
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  onHeroAction(actionId: string): void {
    if (actionId === 'schedule') {
      // Emitir un output especial para que el Smart abra el drawer de búsqueda de alumno
      this.slotClick.emit(null as unknown as AgendaSlot);
    }
  }

  /**
   * Retorna los slots de una celda (día × hora).
   * Puro: sin estado externo, igual entrada = igual salida.
   */
  getCell(day: AgendaDayColumn, time: string): AgendaSlot[] {
    return day.slots.filter((s) => s.startTime === time);
  }
}
