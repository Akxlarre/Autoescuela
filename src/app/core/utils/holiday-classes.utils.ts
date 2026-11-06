import { formatChileDate, formatChileTime } from '@core/utils/chile-time.utils';
import type { AlertDetail } from '@core/models/ui/dashboard.model';

/** Fila de `v_class_b_sessions_on_holiday` que usa la alerta (spec 0056-b). */
export interface HolidayClassRow {
  session_id: number;
  student_id: number;
  student_name: string | null;
  class_number: number;
  scheduled_at: string;
  status: string;
  holiday_name: string;
}

/**
 * Casos de la alerta "clases en día feriado" (spec 0056-b, AC6): una fila por clase, por fecha,
 * que lleva a la ficha del alumno, donde se reagenda.
 */
export function buildHolidayClassDetails(
  rows: HolidayClassRow[],
  role: 'admin' | 'secretaria',
): AlertDetail[] {
  return [...rows]
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .map((r) => {
      const fecha = formatChileDate(r.scheduled_at, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
      const partes = [
        `Clase ${r.class_number}`,
        `${fecha} ${formatChileTime(r.scheduled_at)}`,
        r.holiday_name,
      ];
      if (r.status === 'cancelled') partes.push('cancelada, por reagendar');
      return {
        id: String(r.session_id),
        title: r.student_name ?? 'Alumno',
        subtitle: partes.join(' · '),
        route: `/app/${role}/alumnos/${r.student_id}`,
      };
    });
}
