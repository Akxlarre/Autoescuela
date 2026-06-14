import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { IconComponent } from '@shared/components/icon/icon.component';
import type {
  EnrollmentAssignmentData,
  TimeSlot,
  WeekDay,
} from '@core/models/ui/enrollment-assignment.model';

@Component({
  selector: 'app-public-schedule',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, FormsModule, SelectModule],
  styles: [
    `
      /* Estilos para el p-select para igualar los inputs premium de la UI */
      :host ::ng-deep .instructor-select.p-select {
        height: 48px;
        border-radius: 0.75rem;
        background: var(--bg-surface);
        border: 1.5px solid var(--border-default);
        align-items: center;
        transition: all 0.2s ease;
      }
      :host ::ng-deep .instructor-select.p-select:hover {
        border-color: var(--border-strong);
      }
      :host ::ng-deep .instructor-select.p-select.p-focus {
        border-color: var(--ds-brand);
        box-shadow: 0 0 0 2px rgba(var(--ds-brand-rgb, 59, 130, 246), 0.2);
      }

      /* --- Diseño Flotante Premium (Tailwind UI / macOS) --- */
      /* El input se mantiene con su radio completo, y al estar abierto o en focus brilla suavemente */
      :host ::ng-deep .instructor-select.p-select.p-select-open {
        border-color: var(--ds-brand);
        box-shadow: 0 0 0 3px rgba(var(--ds-brand-rgb, 59, 130, 246), 0.15);
      }

      /* El panel flotante será una tarjeta separada, elegante y simétrica */
      :host ::ng-deep .instructor-select-panel {
        background: var(--bg-surface) !important;
        border: 1px solid var(--border-subtle) !important;
        border-radius: 0.75rem !important; /* Curvo en los 4 lados */
        box-shadow:
          0 12px 32px -4px rgba(0, 0, 0, 0.08),
          0 4px 12px -4px rgba(0, 0, 0, 0.04) !important; /* Sombra difusa y elegante */
        margin-top: 6px !important; /* Gap intencional */
        padding: 4px !important; /* Espacio interno de respiración */
        transform: none !important;
      }
      /* ----------------------------------------------- */

      :host ::ng-deep .instructor-select .p-select-label {
        font-family: var(--font-body);
        font-size: 0.875rem;
        color: var(--text-primary);
        padding: 0.75rem 1rem;
        display: flex;
        align-items: center;
      }
      :host ::ng-deep .instructor-select .p-select-dropdown {
        color: var(--text-muted);
        width: 2.5rem;
      }
      :host ::ng-deep .p-select-list-container {
        font-family: var(--font-body);
        font-size: 0.875rem;
      }

      /* Opciones del selector (Estilo Islas / Tailwind UI) */
      :host ::ng-deep .instructor-select-panel .p-select-option {
        border-radius: 0.5rem !important; /* Redondeo interior para cada opción */
        margin-bottom: 2px;
        padding: 0.6rem 0.75rem !important;
        font-family: var(--font-body);
        font-size: 0.875rem;
        color: var(--text-secondary);
        transition: all 0.2s ease;
      }
      :host ::ng-deep .instructor-select-panel .p-select-option:last-child {
        margin-bottom: 0;
      }
      :host
        ::ng-deep
        .instructor-select-panel
        .p-select-option:not(.p-select-option-selected):not(.p-disabled):hover {
        background: var(--bg-subtle) !important;
        color: var(--text-primary);
      }
      :host ::ng-deep .instructor-select-panel .p-select-option-selected {
        background: var(--color-primary-muted) !important;
        color: var(--ds-brand) !important;
        font-weight: 600;
      }
    `,
  ],
  template: `
    <div class="space-y-5">
      <div>
        <h2
          class="font-bold mb-1"
          style="font-family: var(--font-display); font-size: 1.3rem; color: var(--text-primary);"
        >
          Elige tu horario
        </h2>
        <p class="text-sm" style="color: var(--text-secondary);">
          Selecciona
          <strong style="color: var(--text-primary);">{{
            data().slotSelection.requiredCount
          }}</strong>
          clases prácticas para comenzar. Máximo {{ data().slotSelection.maxClassesPerDay }} por
          día.
        </p>
      </div>

      <!-- Instructor selector -->
      <div class="flex flex-col gap-1.5">
        <label
          class="text-xs font-semibold"
          style="color: var(--text-secondary);"
          for="pub-instructor"
        >
          Instructor
        </label>
        <p-select
          inputId="pub-instructor"
          [options]="data().instructors"
          optionLabel="name"
          optionValue="id"
          [placeholder]="
            loading() && data().instructors.length === 0
              ? 'Cargando instructores disponibles...'
              : '— Selecciona un instructor —'
          "
          [disabled]="loading() && data().instructors.length === 0"
          [ngModel]="data().instructorId"
          (ngModelChange)="onInstructorChangeNgModel($event)"
          styleClass="w-full instructor-select"
          panelStyleClass="instructor-select-panel"
        />
      </div>

      <!-- Aviso: el instructor no tiene cupo suficiente para el total requerido -->
      @if (insufficientAvailability()) {
        <div
          class="flex items-start gap-2.5 rounded-xl p-3 text-sm"
          style="background: var(--state-warning-bg); border: 1px solid var(--state-warning-border); color: var(--state-warning);"
          role="alert"
        >
          <app-icon
            name="alert-triangle"
            [size]="16"
            color="var(--state-warning)"
            class="mt-0.5 shrink-0"
          />
          <span>
            Este instructor tiene cupo en solo {{ maxSelectableSlots() }}
            {{ maxSelectableSlots() === 1 ? 'día' : 'días' }} y necesitas
            {{ data().slotSelection.requiredCount }} clases (máximo
            {{ data().slotSelection.maxClassesPerDay }} por día). Elige otro instructor para
            completar tu horario.
          </span>
        </div>
      }

      <!-- Schedule grid -->
      @if (!data().instructorId) {
        <div
          class="flex flex-col items-center gap-3 rounded-xl p-6 text-center"
          style="background: var(--bg-surface); border: 1.5px dashed var(--border-muted);"
        >
          <div
            class="flex h-11 w-11 items-center justify-center rounded-full"
            style="background: var(--color-primary-muted);"
            aria-hidden="true"
          >
            <app-icon name="calendar" [size]="20" color="var(--color-primary)" />
          </div>
          <div>
            <p class="font-semibold text-sm" style="color: var(--text-primary);">
              Selecciona un instructor para ver los horarios
            </p>
            <p class="text-xs mt-1" style="color: var(--text-secondary);">
              Los horarios disponibles aparecerán aquí una vez que elijas tu instructor.
            </p>
          </div>
        </div>
      } @else if (data().scheduleLoading && !data().scheduleGrid) {
        <div
          class="flex flex-col items-center justify-center p-12 text-center rounded-xl"
          style="background: var(--bg-surface); border: 1px dashed var(--border-default);"
        >
          <app-icon
            name="loader"
            class="animate-spin mb-3"
            [size]="32"
            color="var(--text-secondary)"
          />
          <p class="text-sm font-semibold" style="color: var(--text-primary);">
            Cargando horario...
          </p>
          <p class="text-xs mt-1" style="color: var(--text-secondary);">
            Buscando disponibilidad del instructor
          </p>
        </div>
      } @else if (data().scheduleGrid) {
        <!-- Grilla real con Retención de Estado (Overlay) si recarga -->
        <div
          class="relative transition-opacity duration-300"
          [class.opacity-50]="data().scheduleLoading"
          [class.pointer-events-none]="data().scheduleLoading"
        >
          @if (data().scheduleLoading) {
            <!-- Spinner superpuesto -->
            <div
              class="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl"
              style="background: rgba(255,255,255,0.4); backdrop-filter: blur(1px);"
            >
              <app-icon name="loader" class="animate-spin" [size]="32" color="var(--ds-brand)" />
            </div>
          }
          <!-- Week navigation (solo si hay más de una semana) -->
          @if (weeks().length > 1) {
            <div class="flex items-center justify-between">
              <button
                type="button"
                class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer"
                style="background: var(--bg-surface); border: 1px solid var(--border-default); color: var(--text-secondary);"
                [style.opacity]="hasPrevWeek() ? '1' : '0.35'"
                [style.cursor]="hasPrevWeek() ? 'pointer' : 'not-allowed'"
                [disabled]="!hasPrevWeek()"
                data-llm-action="schedule-prev-week"
                (click)="prevWeek()"
              >
                <app-icon name="chevron-left" [size]="14" />
                Anterior
              </button>
              <span class="text-xs font-semibold" style="color: var(--text-secondary);">
                {{ weekIndicator() }}
              </span>
              <button
                type="button"
                class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer"
                style="background: var(--bg-surface); border: 1px solid var(--border-default); color: var(--text-secondary);"
                [style.opacity]="hasNextWeek() ? '1' : '0.35'"
                [style.cursor]="hasNextWeek() ? 'pointer' : 'not-allowed'"
                [disabled]="!hasNextWeek()"
                data-llm-action="schedule-next-week"
                (click)="nextWeek()"
              >
                Siguiente
                <app-icon name="chevron-right" [size]="14" />
              </button>
            </div>
          }

          <!-- Grid semanal -->
          <div class="rounded-xl overflow-hidden" style="border: 1px solid var(--border-default);">
            <!-- Day headers -->
            <div
              class="grid text-xs font-semibold text-center"
              style="background: var(--bg-surface); border-bottom: 1px solid var(--border-default); padding: 8px 4px;"
              [style.grid-template-columns]="gridColumns()"
            >
              <span style="color: var(--text-muted);">Hora</span>
              @for (day of currentWeekDays(); track day.date) {
                <span style="color: var(--text-secondary);">{{ day.label }}</span>
              }
            </div>

            <!-- Slot rows filtrados a la semana actual -->
            @for (timeRow of currentWeekTimeRows(); track timeRow) {
              <div
                class="grid text-xs"
                style="border-bottom: 1px solid var(--border-subtle);"
                [style.grid-template-columns]="gridColumns()"
              >
                <span
                  class="flex items-center justify-center text-xs"
                  style="color: var(--text-muted); padding: 8px 4px;"
                >
                  {{ timeRow }}
                </span>
                @for (day of currentWeekDays(); track day.date) {
                  @let slot = slotAt(day.date, timeRow);
                  @if (slot) {
                    <button
                      type="button"
                      class="m-1 rounded-lg py-2 text-xs font-semibold transition-all"
                      [style.background]="slotBg(slot)"
                      [style.color]="slotColor(slot)"
                      [style.cursor]="slot.status === 'occupied' ? 'not-allowed' : 'pointer'"
                      [disabled]="slot.status === 'occupied'"
                      [attr.aria-label]="slot.startTime + ' – ' + slot.endTime + ': ' + slot.status"
                      [attr.data-llm-action]="
                        slot.status !== 'occupied' ? 'toggle-schedule-slot' : null
                      "
                      (click)="onSlotToggle(slot)"
                    >
                      {{ slot.startTime }}
                    </button>
                  } @else {
                    <div></div>
                  }
                }
              </div>
            }
          </div>

          <!-- Selection progress -->
          <div
            class="flex items-center justify-between rounded-xl p-4 text-sm"
            style="background: var(--bg-surface); border: 1px solid var(--border-subtle);"
          >
            <span style="color: var(--text-secondary);">Clases seleccionadas</span>
            <span
              class="font-bold"
              [style.color]="selectionComplete() ? 'var(--state-success)' : 'var(--text-primary)'"
            >
              {{ data().slotSelection.currentCount }} / {{ data().slotSelection.requiredCount }}
            </span>
          </div>
        </div>
      } @else if (!data().scheduleLoading) {
        <div
          class="flex items-center gap-3 rounded-xl p-4 text-sm"
          style="background: var(--bg-surface); border: 1px solid var(--border-subtle);"
        >
          <app-icon name="calendar-x" [size]="18" color="var(--text-muted)" />
          <span style="color: var(--text-secondary);">
            No hay disponibilidad para este instructor en este período.
          </span>
        </div>
      }

      <!-- Nav -->
      <div class="flex justify-between pt-2 border-t" style="border-color: var(--border-subtle);">
        <button
          type="button"
          class="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
          style="color: var(--text-secondary);"
          (click)="back.emit()"
        >
          <app-icon name="arrow-left" [size]="16" />
          Volver
        </button>
        <button
          type="button"
          class="btn-primary px-7 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2"
          [disabled]="!selectionComplete() || loading()"
          data-llm-action="confirm-schedule-selection"
          (click)="onNext()"
        >
          @if (loading()) {
            <app-icon name="loader" [size]="16" class="animate-spin" />
            Confirmando...
          } @else {
            Confirmar horario
          }
        </button>
      </div>
    </div>
  `,
})
export class PublicScheduleComponent {
  readonly data = input.required<EnrollmentAssignmentData>();
  readonly loading = input<boolean>(false);
  readonly dataChange = output<EnrollmentAssignmentData>();
  readonly next = output<void>();
  readonly back = output<void>();

  // ── Navegación semanal ──────────────────────────────────────────────────────
  protected readonly currentWeekIndex = signal(0);

  protected readonly weeks = computed<WeekDay[][]>(() => {
    const days = this.data().scheduleGrid?.week.days ?? [];
    if (days.length === 0) return [];
    const map = new Map<string, WeekDay[]>();
    for (const day of days) {
      const key = this.getMondayKey(day.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(day);
    }
    return [...map.values()];
  });

  protected readonly currentWeekDays = computed(() => this.weeks()[this.currentWeekIndex()] ?? []);

  protected readonly hasPrevWeek = computed(() => this.currentWeekIndex() > 0);
  protected readonly hasNextWeek = computed(
    () => this.currentWeekIndex() < this.weeks().length - 1,
  );
  protected readonly weekIndicator = computed(
    () => `Semana ${this.currentWeekIndex() + 1} de ${this.weeks().length}`,
  );

  /**
   * Solo las filas de hora que tienen al menos un slot en la semana visible.
   * timeRows tienen formato "HH:MM-HH:MM"; slot.startTime es solo "HH:MM",
   * por lo que se extrae la parte inicial para comparar.
   */
  protected readonly currentWeekTimeRows = computed(() => {
    const grid = this.data().scheduleGrid;
    if (!grid) return [];
    const weekDates = new Set(this.currentWeekDays().map((d) => d.date));
    return grid.timeRows.filter((time) => {
      const start = time.split('-')[0];
      return grid.slots.some((s) => weekDates.has(s.date) && s.startTime === start);
    });
  });

  // ── Estado derivado ─────────────────────────────────────────────────────────
  protected readonly selectionComplete = computed(
    () => this.data().slotSelection.currentCount >= this.data().slotSelection.requiredCount,
  );

  /**
   * Máximo de slots seleccionables = días distintos con cupo (regla "máx 1 por día").
   * Cuenta días con algún slot disponible + los días ya seleccionados.
   */
  protected readonly maxSelectableSlots = computed<number>(() => {
    const grid = this.data().scheduleGrid;
    if (!grid) return 0;
    const dates = new Set<string>();
    for (const s of grid.slots) {
      if (s.status === 'available') dates.add(s.date);
    }
    for (const id of this.data().slotSelection.selectedSlotIds) {
      const s = grid.slots.find((x) => x.id === id);
      if (s) dates.add(s.date);
    }
    return dates.size;
  });

  /** true si, aun tomando toda la disponibilidad, no se alcanza el total requerido. */
  protected readonly insufficientAvailability = computed<boolean>(
    () =>
      !!this.data().scheduleGrid &&
      this.maxSelectableSlots() < this.data().slotSelection.requiredCount,
  );

  /** `grid-template-columns`: columna hora fija + una columna por día de la semana actual. */
  protected readonly gridColumns = computed(() => {
    const dayCount = this.currentWeekDays().length;
    // minmax(0, 200px): la columna llena el espacio pero con un máximo, para que con
    // pocos días (ej. uno solo) los slots no se estiren a todo el ancho del card.
    return `60px repeat(${dayCount}, minmax(0, 200px))`;
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────
  protected slotAt(date: string, time: string): TimeSlot | null {
    const start = time.split('-')[0];
    return (
      this.data().scheduleGrid?.slots.find((s) => s.date === date && s.startTime === start) ?? null
    );
  }

  protected slotBg(slot: TimeSlot): string {
    if (this.data().slotSelection.selectedSlotIds.includes(slot.id)) return 'var(--ds-brand)';
    if (slot.status === 'occupied') return 'var(--bg-subtle)';
    return 'var(--color-primary-muted)';
  }

  protected slotColor(slot: TimeSlot): string {
    if (this.data().slotSelection.selectedSlotIds.includes(slot.id)) return 'white';
    if (slot.status === 'occupied') return 'var(--text-muted)';
    return 'var(--color-primary)';
  }

  private getMondayKey(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  // ── Acciones ────────────────────────────────────────────────────────────────
  protected prevWeek(): void {
    if (this.hasPrevWeek()) this.currentWeekIndex.update((i) => i - 1);
  }

  protected nextWeek(): void {
    if (this.hasNextWeek()) this.currentWeekIndex.update((i) => i + 1);
  }

  protected onSlotToggle(slot: TimeSlot): void {
    if (slot.status === 'occupied') return;
    const current = this.data().slotSelection.selectedSlotIds;

    let selectedSlotIds: string[];
    if (current.includes(slot.id)) {
      // Deseleccionar siempre permitido.
      selectedSlotIds = current.filter((id) => id !== slot.id);
    } else {
      // Máximo total de clases: bloquear si ya agendó todas las necesarias.
      if (current.length >= this.data().slotSelection.requiredCount) return;

      // Máximo dinámico de clases por día: bloquear si ya se alcanzó el límite.
      const slots = this.data().scheduleGrid?.slots ?? [];
      const sameDaySelectedCount = current.filter(
        (id) => slots.find((s) => s.id === id)?.date === slot.date,
      ).length;
      if (sameDaySelectedCount >= this.data().slotSelection.maxClassesPerDay) return;
      selectedSlotIds = [...current, slot.id];
    }

    this.dataChange.emit({
      ...this.data(),
      slotSelection: { ...this.data().slotSelection, selectedSlotIds },
    });
  }

  protected onInstructorChangeNgModel(id: number | null): void {
    if (id) {
      this.currentWeekIndex.set(0);
      this.dataChange.emit({ ...this.data(), instructorId: id });
    }
  }

  protected onNext(): void {
    if (this.selectionComplete()) this.next.emit();
  }
}
