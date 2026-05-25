import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { EnrollmentAssignmentData, WeekDay } from '@core/models/ui/enrollment-assignment.model';

@Component({
  selector: 'app-assignment-step',
  imports: [FormsModule, IconComponent, AsyncBtnComponent, SkeletonBlockComponent],
  templateUrl: './assignment.component.html',
  styleUrl: './assignment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentComponent {
  data = input.required<EnrollmentAssignmentData>();
  loading = input<boolean>(false);
  /** Número de paso a mostrar en el encabezado (default: 2 para flujo admin). */
  stepNumber = input<number>(2);
  /** Oculta la sección de modalidad de pago (cuando ya fue elegida en un paso previo). */
  hidePaymentMode = input<boolean>(false);
  /**
   * Máximo de clases permitidas por día. Usar 2 para admin/secretaria, 1 (default) para alumnos.
   * Con maxPerDay=2 el auto-avance ocurre solo cuando el día está lleno, no tras cada selección.
   */
  maxPerDay = input<number>(1);
  dataChange = output<EnrollmentAssignmentData>();
  next = output<void>();
  back = output<void>();

  /** Emite copia con campo actualizado — SIN mutar el input. */
  emitField<K extends keyof EnrollmentAssignmentData>(
    field: K,
    value: EnrollmentAssignmentData[K],
  ): void {
    this.dataChange.emit({ ...this.data(), [field]: value });
  }

  /** Cuenta cuántos slots seleccionados hay por fecha (YYYY-MM-DD). */
  readonly slotsPerDay = computed<Map<string, number>>(() => {
    const ids = this.data().slotSelection.selectedSlotIds;
    const slots = this.data().scheduleGrid?.slots ?? [];
    const map = new Map<string, number>();
    for (const id of ids) {
      const date = slots.find((s) => s.id === id)?.date;
      if (date) map.set(date, (map.get(date) ?? 0) + 1);
    }
    return map;
  });

  /** Array de longitud maxPerDay para iterar dots en el template. */
  readonly maxPerDayDots = computed<number[]>(() =>
    Array.from({ length: this.maxPerDay() }, (_, i) => i),
  );

  /** Selecciona o deselecciona un slot de horario de forma inmutable. */
  selectSlot(slotId: string): void {
    const current = this.data();
    const oldIds = current.slotSelection.selectedSlotIds;
    const index = oldIds.indexOf(slotId);

    let newIds: string[];
    if (index > -1) {
      newIds = oldIds.filter((_, i) => i !== index);
    } else if (oldIds.length < current.slotSelection.requiredCount) {
      const slotDate = current.scheduleGrid?.slots.find((s) => s.id === slotId)?.date;
      if (slotDate) {
        const sameDayCount = oldIds.filter((id) => {
          const s = current.scheduleGrid?.slots.find((sl) => sl.id === id);
          return s?.date === slotDate;
        }).length;
        if (sameDayCount >= this.maxPerDay()) return;
      }
      newIds = [...oldIds, slotId];
    } else {
      newIds = oldIds;
    }

    const wasAdded = newIds.length > oldIds.length;
    const newCount = newIds.length;
    this.dataChange.emit({
      ...current,
      slotSelection: {
        ...current.slotSelection,
        selectedSlotIds: newIds,
        currentCount: newCount,
        isComplete: newCount === current.slotSelection.requiredCount,
      },
    });

    if (wasAdded) {
      // Auto-avanzar solo cuando el día está lleno (cupo de maxPerDay alcanzado)
      const slotDate = current.scheduleGrid?.slots.find((s) => s.id === slotId)?.date;
      const dayNowFull = slotDate
        ? newIds.filter((id) => {
            const s = current.scheduleGrid?.slots.find((sl) => sl.id === id);
            return s?.date === slotDate;
          }).length >= this.maxPerDay()
        : true;

      if (dayNowFull) setTimeout(() => this.advanceToNextAvailableDay(), 450);
    }
  }

  /** Mueve la selección al siguiente día con slots disponibles. Si no hay en la semana actual, avanza a la siguiente. */
  private advanceToNextAvailableDay(): void {
    const weekDays = this.currentWeekDays();
    const grid = this.data().scheduleGrid;
    for (let i = this.selectedDayIndex() + 1; i < weekDays.length; i++) {
      const hasAvailable = grid?.slots.some(
        (s) => s.date === weekDays[i].date && s.status !== 'occupied',
      );
      if (hasAvailable) {
        this.selectedDayIndex.set(i);
        return;
      }
    }
    if (this.hasNextWeek()) {
      this.currentWeekIndex.update((i) => i + 1);
      this.selectedDayIndex.set(0);
    }
  }

  /** Slots seleccionados con etiqueta de fecha y hora para mostrar resumen. */
  readonly selectedSlotsDisplay = computed(() => {
    const grid = this.data().scheduleGrid;
    const ids = this.data().slotSelection.selectedSlotIds;
    if (!grid || ids.length === 0) return [];
    return ids
      .map((id) => {
        const slot = grid.slots.find((s) => s.id === id);
        if (!slot) return { id, label: id };
        const date = new Date(id.includes('T') ? id : id + 'T12:00:00Z');
        const dayLabel = date.toLocaleDateString('es-CL', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          timeZone: 'America/Santiago',
        });
        return { id, label: `${dayLabel} · ${slot.startTime} – ${slot.endTime}` };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  });

  selectedDayIndex = signal(0);
  currentWeekIndex = signal(0);

  readonly daysFromGrid = computed(() => this.data().scheduleGrid?.week.days ?? []);

  /** Agrupa todos los días del grid por semana (lunes como inicio de semana). */
  readonly weeks = computed<WeekDay[][]>(() => {
    const days = this.daysFromGrid();
    if (days.length === 0) return [];
    const map = new Map<string, WeekDay[]>();
    for (const day of days) {
      const key = this.getMondayKey(day.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(day);
    }
    return [...map.values()];
  });

  readonly currentWeekDays = computed(() => this.weeks()[this.currentWeekIndex()] ?? []);
  readonly hasPrevWeek = computed(() => this.currentWeekIndex() > 0);
  readonly hasNextWeek = computed(() => this.currentWeekIndex() < this.weeks().length - 1);
  readonly weekIndicator = computed(
    () => `Semana ${this.currentWeekIndex() + 1} de ${this.weeks().length}`,
  );

  readonly slotsForDay = computed(() => {
    const grid = this.data().scheduleGrid;
    if (!grid) return [];
    const day = this.currentWeekDays()[this.selectedDayIndex()];
    if (!day) return [];
    return grid.slots.filter((s) => s.date === day.date);
  });

  isSlotSelectable(slotId: string): boolean {
    const current = this.data();
    const sel = current.slotSelection;
    if (sel.selectedSlotIds.includes(slotId)) return true;
    if (sel.currentCount >= sel.requiredCount) return false;
    const slotDate = current.scheduleGrid?.slots.find((s) => s.id === slotId)?.date;
    if (slotDate) {
      const sameDayCount = sel.selectedSlotIds.filter((id) => {
        const s = current.scheduleGrid?.slots.find((sl) => sl.id === id);
        return s?.date === slotDate;
      }).length;
      if (sameDayCount >= this.maxPerDay()) return false;
    }
    return true;
  }

  selectDay(index: number): void {
    this.selectedDayIndex.set(index);
  }

  prevWeek(): void {
    if (this.hasPrevWeek()) {
      this.currentWeekIndex.update((i) => i - 1);
      this.selectedDayIndex.set(0);
    }
  }

  nextWeek(): void {
    if (this.hasNextWeek()) {
      this.currentWeekIndex.update((i) => i + 1);
      this.selectedDayIndex.set(0);
    }
  }

  private getMondayKey(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  readonly ceilHalf = (n: number): number => Math.ceil(n / 2);

  onNext(): void {
    this.next.emit();
  }

  onBack(): void {
    this.back.emit();
  }
}
