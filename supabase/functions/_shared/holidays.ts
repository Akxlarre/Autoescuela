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

/** Días corridos que puede llegar a cubrir una promoción: 33 mínimos + margen por feriados. */
const PROMOTION_MAX_SPAN_DAYS = 60;

/**
 * Años calendario cuyos feriados hay que consultar para una promoción que parte en `startDate`:
 * el de inicio y, si es otro, el año en que cae "inicio + 60 días" (fix-343-m: antes solo se
 * pedía el año siguiente si partía en diciembre, y una del 30 de noviembre perdía el 1 de enero).
 * Espejo de `promotionHolidayYears` en `promotion-end-date.utils.ts`.
 */
export function promotionHolidayYears(startDate: string): number[] {
  const start = new Date(`${startDate}T12:00:00`);
  const limit = new Date(start);
  limit.setDate(limit.getDate() + PROMOTION_MAX_SPAN_DAYS);
  const startYear = start.getFullYear();
  const limitYear = limit.getFullYear();
  return limitYear === startYear ? [startYear] : [startYear, limitYear];
}

/**
 * Devuelve las fechas (YYYY-MM-DD) de feriados desde `startDate` en adelante, para el/los
 * año(s) calendario que la promoción podría llegar a cubrir (~35-40 días) — no se puede
 * acotar por `endDate` porque ese valor todavía no existe, depende de este resultado (AC6).
 * Intenta `apis.digital.gob.cl` primero; si no entrega ese año (DNS/red/CORS/5xx), sigue con
 * `api.boostr.cl` y `date.nager.at` (fix-139, fix-343-m). Si NINGUNA fuente entrega un año,
 * retorna [] para ese año sin bloquear la creación/actualización de la promoción (0 feriados
 * asumidos).
 */
export async function fetchHolidaysForYears(startDate: string): Promise<string[]> {
  const years = promotionHolidayYears(startDate);

  const perYear = await Promise.all(years.map((year) => fetchHolidaysForYear(year)));

  return perYear.flatMap((r) => r ?? []).filter((d) => d >= startDate);
}

/** Fechas (YYYY-MM-DD) que pertenecen a `year`. Espejo de `holidaysOfYear` del frontend. */
export function holidaysOfYear(dates: readonly string[], year: number): string[] {
  return dates.filter((d) => d.startsWith(`${year}-`));
}

// Consulta las fuentes en orden y se queda con la primera que entregue fechas DEL AÑO PEDIDO.
// El filtro no es defensivo: `api.boostr.cl` ignora el parámetro `year` y devuelve siempre el
// año en curso, así que para el año siguiente respondía 200 sin un solo feriado útil (fix-343-m).
async function fetchHolidaysForYear(year: number): Promise<string[] | null> {
  const sources: (() => Promise<string[]>)[] = [
    async () => {
      const resp = await fetch(`https://apis.digital.gob.cl/fl/feriados/${year}`);
      if (!resp.ok) return [];
      return ((await resp.json()) as { fecha: string }[]).map((f) => f.fecha);
    },
    async () => {
      const resp = await fetch(`https://api.boostr.cl/holidays.json?year=${year}&country=CL`);
      if (!resp.ok) return [];
      return ((await resp.json()) as { data: { date: string }[] }).data.map((f) => f.date);
    },
    async () => {
      const resp = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/CL`);
      if (!resp.ok) return [];
      // Los que no son globales son feriados regionales de otras zonas del país.
      return ((await resp.json()) as { date: string; global: boolean }[])
        .filter((f) => f.global)
        .map((f) => f.date);
    },
  ];

  for (const source of sources) {
    try {
      const ofYear = holidaysOfYear(await source(), year);
      if (ofYear.length > 0) return ofYear;
    } catch {
      // sigue a la siguiente fuente
    }
  }
  return null;
}
