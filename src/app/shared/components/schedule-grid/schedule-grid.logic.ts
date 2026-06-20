// Núcleo funcional de la grilla de horarios (funciones puras, Data In → Data Out).
// Testeable sin levantar Angular. Lo consume ScheduleGridComponent.

import type {
  ScheduleGrid,
  SlotSelection,
  TimeSlot,
} from '@core/models/ui/enrollment-assignment.model';

/**
 * Formatea una fecha `YYYY-MM-DD` como "lun 22/6" (día abreviado + día/mes).
 * Se deriva siempre desde la fecha — no del `label` que provee cada facade — para
 * garantizar el mismo formato en flujo público y admin/secretaria.
 */
export function formatDayShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const weekday = d.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '');
  return `${weekday} ${d.getDate()}/${d.getMonth() + 1}`;
}

/** Cuántos slots seleccionados pertenecen a una fecha dada. */
export function sameDaySelectedCount(
  grid: ScheduleGrid | null,
  selectedSlotIds: string[],
  date: string,
): number {
  const slots = grid?.slots ?? [];
  return selectedSlotIds.filter((id) => slots.find((s) => s.id === id)?.date === date).length;
}

/**
 * ¿Se puede seleccionar este slot? Considera: ocupado, ya seleccionado, tope total
 * (requiredCount) y tope por día (maxClassesPerDay).
 */
export function isSlotSelectable(
  slot: TimeSlot,
  grid: ScheduleGrid | null,
  sel: SlotSelection,
): boolean {
  if (slot.status === 'occupied') return false;
  if (sel.selectedSlotIds.includes(slot.id)) return true;
  if (sel.currentCount >= sel.requiredCount) return false;
  return sameDaySelectedCount(grid, sel.selectedSlotIds, slot.date) < sel.maxClassesPerDay;
}

/**
 * Devuelve la nueva lista de slots seleccionados tras togglear `slot`, o `null` si
 * la acción está bloqueada (slot ocupado o cupo lleno).
 * - Deseleccionar siempre se permite.
 * - Seleccionar respeta el tope total y el tope por día.
 */
export function toggleSlotIds(
  slot: TimeSlot,
  grid: ScheduleGrid | null,
  sel: SlotSelection,
): string[] | null {
  if (slot.status === 'occupied') return null;
  const current = sel.selectedSlotIds;

  if (current.includes(slot.id)) {
    return current.filter((id) => id !== slot.id);
  }
  if (current.length >= sel.requiredCount) return null;
  if (sameDaySelectedCount(grid, current, slot.date) >= sel.maxClassesPerDay) return null;
  return [...current, slot.id];
}

/**
 * Máximo de slots seleccionables considerando el cupo por día: por cada fecha con
 * disponibilidad se pueden tomar hasta maxClassesPerDay.
 */
export function maxSelectableSlots(grid: ScheduleGrid | null, sel: SlotSelection): number {
  if (!grid) return 0;
  const perDate = new Map<string, number>();
  for (const s of grid.slots) {
    if (s.status === 'available') perDate.set(s.date, (perDate.get(s.date) ?? 0) + 1);
  }
  // Sumar ya seleccionados que pudieran no figurar como 'available' tras una recarga.
  for (const id of sel.selectedSlotIds) {
    const s = grid.slots.find((x) => x.id === id);
    if (s && s.status !== 'available') perDate.set(s.date, (perDate.get(s.date) ?? 0) + 1);
  }
  let total = 0;
  for (const count of perDate.values()) total += Math.min(count, sel.maxClassesPerDay);
  return total;
}

/** true si, aun tomando toda la disponibilidad, no se alcanza el total requerido. */
export function isInsufficientAvailability(grid: ScheduleGrid | null, sel: SlotSelection): boolean {
  return !!grid && maxSelectableSlots(grid, sel) < sel.requiredCount;
}

/** Etiquetas "lun 22/6 · 08:30" de los slots seleccionados, orden cronológico. */
export function selectedSlotsLabels(
  grid: ScheduleGrid | null,
  selectedSlotIds: string[],
): { id: string; label: string }[] {
  if (!grid || selectedSlotIds.length === 0) return [];
  return selectedSlotIds
    .map((id) => {
      const slot = grid.slots.find((s) => s.id === id);
      if (!slot) return { id, sortKey: id, label: id };
      return {
        id,
        sortKey: `${slot.date}T${slot.startTime}`,
        label: `${formatDayShort(slot.date)} · ${slot.startTime}`,
      };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ id, label }) => ({ id, label }));
}
