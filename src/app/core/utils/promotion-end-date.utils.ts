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
  const cursor = new Date(`${startDate}T12:00:00`);
  let validDays = 0;
  let iso = startDate;

  while (validDays < 30) {
    iso = cursor.toISOString().split('T')[0];
    const isSunday = cursor.getDay() === 0;
    const isHoliday = holidayDates.has(iso);

    if (!isSunday && !isHoliday) {
      validDays++;
    }

    if (validDays < 30) {
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return iso;
}
