import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type {
  ScheduleGrid,
  SlotSelection,
  TimeSlot,
  WeekDay,
} from '@core/models/ui/enrollment-assignment.model';
import {
  formatDayShort,
  isInsufficientAvailability,
  isSlotSelectable,
  maxSelectableSlots,
  selectedSlotsLabels,
  toggleSlotIds,
} from './schedule-grid.logic';

/**
 * Grilla semanal de selección de horarios (dumb component compartido).
 *
 * Reutilizada por el flujo público (`PublicScheduleComponent`) y por el flujo
 * admin/secretaria (`AssignmentComponent`). La única diferencia de negocio entre
 * ambos —cuántas clases se permiten por día— es puro dato: se lee de
 * `slotSelection.maxClassesPerDay` (público = 1, admin = 3).
 *
 * Renderiza columnas = días, filas = horas; permite seleccionar slots de varios
 * días a la vez. Incluye navegación semanal, aviso de cupo insuficiente, barra de
 * progreso y resumen de clases seleccionadas.
 */
@Component({
  selector: 'app-schedule-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="space-y-4">
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
            {{ maxSelectableSlots() === 1 ? 'día' : 'días' }} y se necesitan
            {{ slotSelection().requiredCount }} clases (máximo
            {{ slotSelection().maxClassesPerDay }} por día). Elige otro instructor para completar el
            horario.
          </span>
        </div>
      }

      <!-- Grilla real con retención de estado (overlay) si recarga -->
      <div
        class="relative transition-opacity duration-300"
        [class.opacity-50]="scheduleLoading()"
        [class.pointer-events-none]="scheduleLoading()"
      >
        @if (scheduleLoading()) {
          <div
            class="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl"
            style="background: color-mix(in srgb, var(--bg-surface) 55%, transparent); backdrop-filter: blur(1px);"
          >
            <app-icon name="loader" class="animate-spin" [size]="32" color="var(--ds-brand)" />
          </div>
        }

        <!-- Navegación de semanas (solo si hay más de una) -->
        @if (weeks().length > 1) {
          <div class="flex items-center justify-between mb-3">
            <button
              type="button"
              class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
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
              class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
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
        <div class="overflow-x-auto scrollbar-thin">
          <div
            class="rounded-xl overflow-hidden"
            style="border: 1px solid var(--border-default); min-width: max-content;"
          >
            <!-- Day headers -->
            <div
              class="grid text-xs font-semibold text-center"
              style="background: var(--bg-surface); border-bottom: 1px solid var(--border-default); padding: 8px 4px;"
              [style.grid-template-columns]="gridColumns()"
            >
              <span style="color: var(--text-muted);">Hora</span>
              @for (day of currentWeekDays(); track day.date) {
                <span style="color: var(--text-secondary);">{{ dayHeader(day.date) }}</span>
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
                      [style.cursor]="isSelectable(slot) ? 'pointer' : 'not-allowed'"
                      [style.opacity]="isSelectable(slot) ? '1' : '0.45'"
                      [disabled]="!isSelectable(slot)"
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
        </div>

        <!-- Barra de progreso -->
        <div
          class="mt-3 flex items-center justify-between rounded-xl p-4 text-sm"
          style="background: var(--bg-surface); border: 1px solid var(--border-subtle);"
        >
          <span style="color: var(--text-secondary);">Clases seleccionadas</span>
          <span
            class="font-bold"
            [style.color]="selectionComplete() ? 'var(--state-success)' : 'var(--text-primary)'"
          >
            {{ slotSelection().currentCount }} / {{ slotSelection().requiredCount }}
          </span>
        </div>

        <!-- Resumen de clases seleccionadas -->
        @if (selectedSlotsDisplay().length > 0) {
          <div
            class="mt-3 rounded-xl overflow-hidden"
            style="background: var(--bg-surface); border: 1px solid var(--border-subtle);"
          >
            <div
              class="flex items-center gap-2 px-4 py-2.5"
              style="border-bottom: 1px solid var(--border-subtle);"
            >
              <app-icon name="calendar-check" [size]="14" color="var(--color-primary)" />
              <span
                class="text-xs font-semibold tracking-wide"
                style="color: var(--text-secondary);"
              >
                Tu horario ({{ selectedSlotsDisplay().length }})
              </span>
            </div>
            <ul class="flex flex-wrap gap-2 p-3" role="list">
              @for (slot of selectedSlotsDisplay(); track slot.id) {
                <li
                  class="group flex items-center gap-2 rounded-lg py-1.5 pl-3 pr-1.5 text-xs font-semibold"
                  style="background: var(--color-primary-muted); color: var(--color-primary);"
                >
                  <span>{{ slot.label }}</span>
                  <button
                    type="button"
                    class="flex h-5 w-5 items-center justify-center rounded-md transition-colors"
                    style="cursor: pointer;"
                    [attr.aria-label]="'Quitar clase ' + slot.label"
                    data-llm-action="remove-schedule-slot"
                    (click)="onSlotRemove(slot.id)"
                  >
                    <app-icon name="x" [size]="12" color="var(--color-primary)" />
                  </button>
                </li>
              }
            </ul>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host ::ng-deep .group:hover button {
        background: color-mix(in srgb, var(--color-primary) 16%, transparent);
      }
    `,
  ],
})
export class ScheduleGridComponent {
  readonly scheduleGrid = input.required<ScheduleGrid | null>();
  readonly slotSelection = input.required<SlotSelection>();
  readonly scheduleLoading = input<boolean>(false);

  /** Emite la nueva lista de slots seleccionados (selección inmutable). */
  readonly slotsChange = output<string[]>();

  // ── Navegación semanal ──────────────────────────────────────────────────────
  protected readonly currentWeekIndex = signal(0);

  protected readonly weeks = computed<WeekDay[][]>(() => {
    const days = this.scheduleGrid()?.week.days ?? [];
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
   * Solo las filas de hora con al menos un slot en la semana visible.
   * timeRows tienen formato "HH:MM-HH:MM"; slot.startTime es solo "HH:MM".
   */
  protected readonly currentWeekTimeRows = computed(() => {
    const grid = this.scheduleGrid();
    if (!grid) return [];
    const weekDates = new Set(this.currentWeekDays().map((d) => d.date));
    return grid.timeRows.filter((time) => {
      const start = time.split('-')[0];
      return grid.slots.some((s) => weekDates.has(s.date) && s.startTime === start);
    });
  });

  /** `grid-template-columns`: columna hora fija + una columna por día visible. */
  protected readonly gridColumns = computed(() => {
    const dayCount = this.currentWeekDays().length;
    return `60px repeat(${dayCount}, minmax(110px, 200px))`;
  });

  // ── Estado derivado ─────────────────────────────────────────────────────────
  protected readonly selectionComplete = computed(
    () => this.slotSelection().currentCount >= this.slotSelection().requiredCount,
  );

  protected readonly maxSelectableSlots = computed<number>(() =>
    maxSelectableSlots(this.scheduleGrid(), this.slotSelection()),
  );

  /** true si, aun tomando toda la disponibilidad, no se alcanza el total requerido. */
  protected readonly insufficientAvailability = computed<boolean>(() =>
    isInsufficientAvailability(this.scheduleGrid(), this.slotSelection()),
  );

  /** Slots seleccionados con etiqueta de fecha y hora, ordenados cronológicamente. */
  protected readonly selectedSlotsDisplay = computed<{ id: string; label: string }[]>(() =>
    selectedSlotsLabels(this.scheduleGrid(), this.slotSelection().selectedSlotIds),
  );

  // ── Helpers de render ─────────────────────────────────────────────────────────
  /** Etiqueta de encabezado de día "lun 22/6" derivada de la fecha. */
  protected dayHeader(date: string): string {
    return formatDayShort(date);
  }

  protected slotAt(date: string, time: string): TimeSlot | null {
    const start = time.split('-')[0];
    return this.scheduleGrid()?.slots.find((s) => s.date === date && s.startTime === start) ?? null;
  }

  protected isSelectable(slot: TimeSlot): boolean {
    return isSlotSelectable(slot, this.scheduleGrid(), this.slotSelection());
  }

  protected slotBg(slot: TimeSlot): string {
    if (this.slotSelection().selectedSlotIds.includes(slot.id)) return 'var(--ds-brand)';
    if (slot.status === 'occupied') return 'var(--bg-subtle)';
    return 'var(--color-primary-muted)';
  }

  protected slotColor(slot: TimeSlot): string {
    if (this.slotSelection().selectedSlotIds.includes(slot.id)) return 'white';
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
    // null = acción bloqueada (slot ocupado o cupo lleno: total o por día 1/3).
    const next = toggleSlotIds(slot, this.scheduleGrid(), this.slotSelection());
    if (next) this.slotsChange.emit(next);
  }

  protected onSlotRemove(slotId: string): void {
    this.slotsChange.emit(this.slotSelection().selectedSlotIds.filter((id) => id !== slotId));
  }
}
