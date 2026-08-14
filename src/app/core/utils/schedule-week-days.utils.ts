import type { ScheduleDay } from '@core/models/ui/instructor-portal.model';

/**
 * El domingo nunca tiene clases (regla de negocio) — se omite de las vistas de horario
 * del instructor (day tab strip mobile y grid semanal desktop).
 */
export function filterVisibleWeekDays(weekDays: ScheduleDay[] | undefined): ScheduleDay[] {
  return (weekDays ?? []).filter((d) => d.name !== 'Domingo');
}
