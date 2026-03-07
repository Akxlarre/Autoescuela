import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EnrollmentAssignmentData, WeekDay } from '@core/models/ui/enrollment-assignment.model';

@Component({
  selector: 'app-assignment-step',
  imports: [FormsModule, IconComponent],
  templateUrl: './assignment.component.html',
  styleUrl: './assignment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentComponent {
  data = input.required<EnrollmentAssignmentData>();
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

  /** Selecciona o deselecciona un slot de horario de forma inmutable. */
  selectSlot(slotId: string): void {
    const current = this.data();
    const oldIds = current.slotSelection.selectedSlotIds;
    const index = oldIds.indexOf(slotId);
    const newIds =
      index > -1
        ? oldIds.filter((_, i) => i !== index)
        : oldIds.length < current.slotSelection.requiredCount
          ? [...oldIds, slotId]
          : oldIds;
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
  }

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
    const sel = this.data().slotSelection;
    return sel.selectedSlotIds.includes(slotId) || sel.currentCount < sel.requiredCount;
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

  onNext(): void {
    this.next.emit();
  }

  onBack(): void {
    this.back.emit();
  }
}
