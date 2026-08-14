import type { DaySchedule, ScheduleBlock } from '@core/models/ui/instructor-portal.model';

/**
 * Bloques del rail diario sin el que ya se muestra en el Hero Card de "próxima clase"
 * (`daySchedule.nextBlock`) — evitar que la misma clase se pinte dos veces.
 */
export function filterRemainingBlocks(daySchedule: DaySchedule | null): ScheduleBlock[] {
  if (!daySchedule) return [];
  const nextId = daySchedule.nextBlock?.sessionId;
  return nextId == null
    ? daySchedule.blocks
    : daySchedule.blocks.filter((b) => b.sessionId !== nextId);
}

/**
 * El estado "Agenda Libre" solo debe mostrarse cuando el día no tiene NINGÚN bloque —
 * no cuando simplemente no hay una clase "próxima" (ej. un día pasado con clases ya
 * completadas sí tiene agenda, aunque `nextBlock` sea null).
 */
export function shouldShowEmptyDayState(daySchedule: DaySchedule | null): boolean {
  return (daySchedule?.blocks.length ?? 0) === 0;
}
