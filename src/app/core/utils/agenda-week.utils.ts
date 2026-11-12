import { addDaysIso, formatChileDate } from './chile-time.utils';

/**
 * Etiqueta de la semana de la Agenda ("9 nov – 13 nov", lunes a viernes) a partir de su lunes.
 * fix-241-b (P08): se calcula de la semana pedida, no de los datos ya cargados, para que el
 * encabezado cambie apenas se navega y no siga mostrando la semana anterior mientras carga.
 */
export function formatWeekLabel(weekStart: string): string {
  const start = formatChileDate(weekStart, { day: 'numeric', month: 'short' });
  const end = formatChileDate(addDaysIso(weekStart, 4), { day: 'numeric', month: 'short' });
  return `${start} – ${end}`;
}

/**
 * La leyenda de la Agenda acompaña al skeleton y a la grilla con datos, no al error ni al estado
 * vacío (fix-241-b, P08): si faltara durante la carga, la grilla crecería y se volvería a achicar.
 */
export function agendaShowsLegend(state: {
  isLoading: boolean;
  error: string | null;
  hasWeekData: boolean;
  timeRowCount: number;
}): boolean {
  if (state.isLoading) return true;
  return !state.error && state.hasWeekData && state.timeRowCount > 0;
}
/**
 * Suma `days` días a una fecha ISO ('YYYY-MM-DD') y devuelve el resultado en
 * el mismo formato. Aritmética de calendario, sin zona horaria. Función pura.
 */
export function addDaysToIso(iso: string, days: number): string {
  return addDaysIso(iso, days);
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

/**
 * Día que muestra la Agenda al abrir una semana en el celular (hotfix-094-b): el de hoy si está en
 * la semana; si no (otra semana, fin de semana), el lunes.
 */
export function initialMobileDayIndex(days: readonly { isToday: boolean }[]): number {
  const i = days.findIndex((d) => d.isToday);
  return i >= 0 ? i : 0;
}

/**
 * Portal (admin o secretaria) desde el que se abrió la Agenda. Sale de la URL actual: la Agenda
 * también se abre como drawer desde el dashboard de la secretaria.
 */
function agendaPortal(currentUrl: string): 'admin' | 'secretaria' {
  return currentUrl.startsWith('/app/secretaria') ? 'secretaria' : 'admin';
}

/**
 * Texto accesible de un slot de la grilla. fix-251-b: incluye el aviso del vehículo, que antes
 * existía solo en el tooltip.
 */
export function agendaSlotAriaLabel(
  slot: { status: string; startTime: string; instructorName: string; studentName?: string },
  disabled: boolean,
  vehicleWarning: string,
): string {
  if (disabled) return `${slot.startTime} — fuera del rango de visualización configurado.`;
  const aviso = vehicleWarning ? ` ${vehicleWarning}.` : '';
  // hotfix-060-b: la Agenda es de solo lectura (fix-017); el clic abre el detalle, no agenda.
  const head =
    slot.status === 'available'
      ? `Slot disponible ${slot.startTime}`
      : `${slot.studentName ? `${slot.studentName}, ` : ''}${slot.startTime}`;
  return `${head} — ${slot.instructorName}.${aviso} Clic para ver detalle.`;
}

/** "Juan · RTRE29": identifica un horario libre en la vista "Todos los instructores" (fix-251-b). */
export function agendaSlotIdentity(instructorName: string, vehiclePlate: string): string {
  const firstName = instructorName.trim().split(/\s+/)[0] ?? '';
  return [firstName, vehiclePlate].filter(Boolean).join(' · ');
}

/** Flota del portal actual, desde el aviso de documentos del vehículo (fix-251-b). */
export function fleetUrl(currentUrl: string): string {
  return `/app/${agendaPortal(currentUrl)}/flota`;
}

/** Ficha del alumno desde el detalle de una clase de la Agenda (hotfix-095-b). */
export function studentFichaUrl(
  currentUrl: string,
  studentId: number,
  enrollmentId: number | undefined,
): string {
  const base = `/app/${agendaPortal(currentUrl)}/alumnos/${studentId}`;
  return enrollmentId ? `${base}?enrollment=${enrollmentId}` : base;
}
