import { addDaysIso, weekdayOfIso } from './chile-time.utils';

/**
 * Calcula la `end_date` de una promoción profesional: camina día a día desde `startDate`
 * (L-S, saltando domingos) contando días hábiles que no sean feriado, hasta acumular 30.
 *
 * Sin feriados en el rango da `startDate + 33` (sábado de la 5ª semana). Cada feriado dentro
 * del rango extiende el resultado un día hábil más — si ese día de recupero también cae en
 * feriado, el loop simplemente sigue contando (recursivo por construcción, sin recursión
 * explícita, así que 2 feriados consecutivos no producen loop infinito).
 */
export function computePromotionEndDate(startDate: string, holidayDates: Set<string>): string {
  let validDays = 0;
  let iso = startDate;

  while (true) {
    const isSunday = weekdayOfIso(iso) === 0;
    const isHoliday = holidayDates.has(iso);

    if (!isSunday && !isHoliday) {
      validDays++;
    }

    if (validDays >= 30) return iso;
    iso = addDaysIso(iso, 1);
  }
}

/** Días corridos que puede llegar a cubrir una promoción: 33 mínimos + margen por feriados. */
const PROMOTION_MAX_SPAN_DAYS = 60;

/**
 * Años calendario cuyos feriados hay que consultar para una promoción que parte en `startDate`:
 * el de inicio y, si es otro, el año en que cae "inicio + 60 días". No se puede acotar por la
 * fecha de término porque esa fecha depende justamente de los feriados (fix-343-m: antes solo se
 * pedía el año siguiente si partía en diciembre, y una del 30 de noviembre perdía el 1 de enero).
 */
export function promotionHolidayYears(startDate: string): number[] {
  const startYear = Number(startDate.slice(0, 4));
  const limitYear = Number(addDaysIso(startDate, PROMOTION_MAX_SPAN_DAYS).slice(0, 4));
  return limitYear === startYear ? [startYear] : [startYear, limitYear];
}

/**
 * Se queda con las fechas (YYYY-MM-DD) que pertenecen a `year`. Una fuente de feriados que
 * responde con otro año (o vacía) no sirve para ese año: quien llama debe probar otra fuente.
 */
export function holidaysOfYear(dates: readonly string[], year: number): string[] {
  return dates.filter((d) => d.startsWith(`${year}-`));
}
