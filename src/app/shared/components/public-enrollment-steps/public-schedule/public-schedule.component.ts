import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import type {
  EnrollmentAssignmentData,
  TimeSlot,
  WeekDay,
} from '@core/models/ui/enrollment-assignment.model';

@Component({
  selector: 'app-public-schedule',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent],
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
          clases prácticas para comenzar. Máximo una por día.
        </p>
      </div>

      <!-- Instructor selector -->
      @if (data().instructors.length > 0) {
        <div class="flex flex-col gap-1.5">
          <label
            class="text-xs font-semibold"
            style="color: var(--text-secondary);"
            for="pub-instructor"
          >
            Instructor
          </label>
          <select
            id="pub-instructor"
            class="w-full rounded-xl px-4 py-3 text-sm cursor-pointer"
            style="background: var(--bg-surface); border: 1.5px solid var(--border-default); color: var(--text-primary); font-family: var(--font-body);"
            [value]="data().instructorId ?? ''"
            (change)="onInstructorChange($event)"
            data-llm-description="Instructor selector for practical driving classes"
          >
            <option value="">— Selecciona un instructor —</option>
            @for (inst of data().instructors; track inst.id) {
              <option [value]="inst.id">{{ inst.name }}</option>
            }
          </select>
        </div>
      }

      <!-- Schedule grid -->
      @if (data().scheduleLoading) {
        <div class="space-y-2">
          <app-skeleton-block variant="rect" width="100%" height="48px" />
          <app-skeleton-block variant="rect" width="100%" height="160px" />
        </div>
      } @else if (data().scheduleGrid && data().instructorId) {
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
      } @else if (data().instructorId && !data().scheduleLoading) {
        <div
          class="flex items-center gap-3 rounded-xl p-4 text-sm"
          style="background: var(--bg-surface); border: 1px solid var(--border-subtle);"
        >
          <app-icon name="calendar-x" [size]="18" color="var(--text-muted)" />
          <span style="color: var(--text-secondary);">
            No hay disponibilidad para este instructor en este período.
          </span>
        </div>
      } @else if (!data().instructorId && !data().scheduleLoading) {
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
          class="btn-primary px-7 py-2.5 rounded-xl font-semibold text-sm"
          [disabled]="!selectionComplete()"
          data-llm-action="confirm-schedule-selection"
          (click)="onNext()"
        >
          Confirmar horario
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

  /** `grid-template-columns`: columna hora fija + una columna por día de la semana actual. */
  protected readonly gridColumns = computed(() => {
    const dayCount = this.currentWeekDays().length;
    return `60px repeat(${dayCount}, 1fr)`;
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
    const selectedSlotIds = current.includes(slot.id)
      ? current.filter((id) => id !== slot.id)
      : [...current, slot.id];
    this.dataChange.emit({
      ...this.data(),
      slotSelection: { ...this.data().slotSelection, selectedSlotIds },
    });
  }

  protected onInstructorChange(event: Event): void {
    const id = +(event.target as HTMLSelectElement).value;
    if (id) {
      this.currentWeekIndex.set(0);
      this.dataChange.emit({ ...this.data(), instructorId: id });
    }
  }

  protected onNext(): void {
    if (this.selectionComplete()) this.next.emit();
  }
}
