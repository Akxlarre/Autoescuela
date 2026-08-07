// supabase/functions/_shared/holidays.ts
//
// Puerto Deno de `src/app/core/utils/promotion-end-date.utils.ts` + del fetch de feriados
// chilenos de `promociones.facade.ts` (`fetchHolidaysForYears`). Deno no puede importar
// directo código de `src/app/`, así que la regla se replica aquí — MANTENER AMBAS EN SYNC.
//
//   deno test supabase/functions/_shared/holidays.test.ts

/**
 * Calcula la `end_date` de una promoción profesional: camina día a día desde `startDate`
 * (L-S, saltando domingos) contando días hábiles que no sean feriado, hasta acumular 30.
 *
 * Sin feriados en el rango da `startDate + 33` (sábado de la 5ª semana). Cada feriado dentro
 * del rango extiende el resultado un día hábil más — si ese día de recupero también cae en
 * feriado, el loop simplemente sigue contando (recursivo por construcción, sin recursión
 * explícita).
 *
 * Casos de test (espejo exacto de `promotion-end-date.utils.spec.ts`, ver `holidays.test.ts`):
 *  - Sin feriados → `start + 33`.
 *  - 1 feriado a mitad del rango → `start + 35` (el `+34` siempre cae domingo porque las
 *    promociones arrancan lunes).
 *  - 2 feriados no consecutivos → `start + 36`.
 *  - 2 feriados consecutivos (L y M de la misma semana) → `start + 36`, sin loop infinito.
 *  - Feriado justo en `start+33` → coincide con el caso de 1 feriado (`start + 35`).
 *  - Feriado en domingo → no afecta el conteo (ya excluido).
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

/**
 * Devuelve las fechas (YYYY-MM-DD) de feriados desde `startDate` en adelante, para el/los
 * año(s) calendario que la promoción podría llegar a cubrir (~35-40 días) — no se puede
 * acotar por `endDate` porque ese valor todavía no existe, depende de este resultado (AC6).
 * Intenta `apis.digital.gob.cl` primero; si falla (DNS/red/CORS/5xx), reintenta con
 * `api.boostr.cl` como respaldo (fix-139 — `apis.digital.gob.cl` quedó inalcanzable en
 * producción sin previo aviso). Si AMBAS fuentes fallan para algún año, retorna [] para ese
 * año sin bloquear la creación/actualización de la promoción (0 feriados asumidos).
 */
export async function fetchHolidaysForYears(startDate: string): Promise<string[]> {
  const anchor = new Date(`${startDate}T12:00:00`);
  const startYear = anchor.getFullYear();
  // Solo cruza a un 2º año calendario si arranca en diciembre (rango ~35-40 días).
  const years = anchor.getMonth() === 11 ? [startYear, startYear + 1] : [startYear];

  const perYear = await Promise.all(years.map((year) => fetchHolidaysForYear(year)));

  return perYear.flatMap((r) => r ?? []).filter((d) => d >= startDate);
}

async function fetchHolidaysForYear(year: number): Promise<string[] | null> {
  try {
    const resp = await fetch(`https://apis.digital.gob.cl/fl/feriados/${year}`);
    if (resp.ok) {
      const data = (await resp.json()) as { fecha: string }[];
      return data.map((f) => f.fecha);
    }
  } catch {
    // sigue al respaldo
  }

  try {
    const resp = await fetch(`https://api.boostr.cl/holidays.json?year=${year}&country=CL`);
    if (resp.ok) {
      const json = (await resp.json()) as { data: { date: string }[] };
      return json.data.map((f) => f.date);
    }
  } catch {
    // ambas fuentes fallaron
  }

  return null;
}
