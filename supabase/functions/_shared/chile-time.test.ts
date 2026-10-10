// supabase/functions/_shared/chile-time.test.ts
//
// Corre los mismos casos que `src/app/core/utils/chile-time.utils.spec.ts`, desde el mismo
// archivo de vectores: si la copia de edge functions se desvía de la de la app, falla acá.
//
//   deno test --allow-read supabase/functions/_shared/chile-time.test.ts

import { assertEquals } from 'jsr:@std/assert';
import {
  addDaysIso,
  addMonthsIso,
  chileDayRange,
  chileMonth,
  chileMonthRange,
  chileParts,
  chileRange,
  chileToday,
  chileWallTimeToInstant,
  chileYear,
  diffDaysIso,
  endOfMonthIso,
  formatChileDate,
  formatChilePattern,
  formatChileTime,
  mondayOfIso,
  monthDays,
  startOfMonthIso,
  toChileDate,
  weekdayOfIso,
} from './chile-time.ts';

const vectors = JSON.parse(
  Deno.readTextFileSync(
    new URL('../../../src/app/core/utils/chile-time.vectors.json', import.meta.url),
  ),
);

const HOUR_MS = 3_600_000;

Deno.test('toChileDate: día de Chile de cada instante de los vectores', () => {
  for (const { instant, date } of vectors.instantToDate) {
    assertEquals(toChileDate(instant), date, instant);
    assertEquals(toChileDate(new Date(instant)), date, instant);
  }
});

Deno.test('toChileDate: fecha pura, instante sin zona y valores vacíos', () => {
  assertEquals(toChileDate('2026-10-06'), '2026-10-06');
  assertEquals(toChileDate('2026-10-06T23:30:00'), '2026-10-06');
  assertEquals(toChileDate('2026-10-06 00:10:00'), '2026-10-06');
  for (const value of [null, undefined, '', 'no-es-fecha']) assertEquals(toChileDate(value), '');
});

Deno.test('chileToday / chileMonth / chileYear: a las 23:30 hora Chile sigue siendo hoy', () => {
  const now = new Date('2026-10-07T02:30:00.000Z');
  assertEquals(chileToday(now), '2026-10-06');
  assertEquals(chileMonth(now), '2026-10');
  assertEquals(chileYear(now), 2026);

  const lastNightOfJune = new Date('2026-07-01T03:30:00.000Z');
  assertEquals(chileToday(lastNightOfJune), '2026-06-30');
  assertEquals(chileMonth(lastNightOfJune), '2026-06');

  const newYearsEve = new Date('2027-01-01T02:30:00.000Z');
  assertEquals(chileToday(newYearsEve), '2026-12-31');
  assertEquals(chileYear(newYearsEve), 2026);
});

Deno.test('chileParts: hora de pared de Chile; la medianoche es la hora 0', () => {
  assertEquals(chileParts('2026-10-07T02:30:15.000Z'), {
    year: 2026,
    month: 10,
    day: 6,
    hour: 23,
    minute: 30,
    second: 15,
    weekday: 2,
  });
  assertEquals(chileParts('2026-10-07T03:00:00.000Z').hour, 0);
});

Deno.test('chileDayRange: rango semiabierto de cada día de los vectores', () => {
  for (const { date, start, endExclusive, hours } of vectors.dayRange) {
    const range = chileDayRange(date);
    assertEquals(range.start, start, date);
    assertEquals(range.endExclusive, endExclusive, date);
    assertEquals((Date.parse(range.endExclusive) - Date.parse(range.start)) / HOUR_MS, hours, date);
    assertEquals(toChileDate(new Date(Date.parse(range.endExclusive) - 1)), date);
    assertEquals(toChileDate(new Date(Date.parse(range.start) - 1)), addDaysIso(date, -1));
  }
});

Deno.test('chileDayRange: los días consecutivos son contiguos', () => {
  let cursor = '2026-03-30';
  for (let i = 0; i < 200; i++) {
    const next = addDaysIso(cursor, 1);
    assertEquals(chileDayRange(cursor).endExclusive, chileDayRange(next).start, cursor);
    cursor = next;
  }
});

Deno.test('chileRange / chileMonthRange', () => {
  assertEquals(chileRange('2026-10-01', '2026-10-06'), {
    start: '2026-10-01T03:00:00.000Z',
    endExclusive: '2026-10-07T03:00:00.000Z',
  });
  assertEquals(chileMonthRange('2026-04'), {
    start: '2026-04-01T03:00:00.000Z',
    endExclusive: '2026-05-01T04:00:00.000Z',
  });
  assertEquals(chileMonthRange('2026-12'), {
    start: '2026-12-01T03:00:00.000Z',
    endExclusive: '2027-01-01T03:00:00.000Z',
  });
});

Deno.test('chileWallTimeToInstant: vectores, incluidas la hora inexistente y la repetida', () => {
  for (const { date, time, instant } of vectors.wallTimeToInstant) {
    assertEquals(chileWallTimeToInstant(date, time), instant, `${date} ${time}`);
  }
});

Deno.test('aritmética de fechas puras', () => {
  for (const { date, days, result } of vectors.addDays) {
    assertEquals(addDaysIso(date, days), result, date);
  }
  for (const v of vectors.weekday) {
    assertEquals(weekdayOfIso(v.date), v.weekday, v.date);
    assertEquals(mondayOfIso(v.date), v.monday, v.date);
  }
  assertEquals(diffDaysIso('2026-10-06', '2026-10-09'), 3);
  assertEquals(diffDaysIso('2026-10-09', '2026-10-06'), -3);
  assertEquals(diffDaysIso('2026-04-01', '2026-04-10'), 9);
  assertEquals(addMonthsIso('2026-03-31', -1), '2026-02-28');
  assertEquals(addMonthsIso('2026-11-30', 3), '2027-02-28');
  assertEquals(monthDays(2026, 2), 28);
  assertEquals(monthDays(2028, 2), 29);
  assertEquals(startOfMonthIso('2026-10-06'), '2026-10-01');
  assertEquals(endOfMonthIso('2026-02'), '2026-02-28');
  assertEquals(endOfMonthIso('2026-12-15'), '2026-12-31');
});

Deno.test('formato: zona de Chile fija; una fecha pura no se desplaza', () => {
  const numeric = { day: '2-digit', month: '2-digit', year: 'numeric' } as const;
  assertEquals(formatChileDate('2026-10-06', numeric), '06-10-2026');
  assertEquals(formatChileDate('2026-10-07T02:30:00.000Z', numeric), '06-10-2026');
  assertEquals(formatChileDate(null), '—');
  assertEquals(formatChileTime('2026-10-07T02:30:00.000Z'), '23:30');
  assertEquals(formatChileTime('2026-07-01T12:30:00.000Z'), '08:30');
  assertEquals(formatChileTime('no-es-fecha'), '—');
});

Deno.test('formatChilePattern: mismos patrones que la app', () => {
  const instant = '2026-10-07T02:30:15.000Z';
  const cases: [string, string][] = [
    ['dd/MM/yyyy', '06/10/2026'],
    ['dd/MM/yyyy HH:mm:ss', '06/10/2026 23:30:15'],
    ['yyyy-MM-dd HH:mm:ss', '2026-10-06 23:30:15'],
    ['dd MMM yyyy', '06 oct 2026'],
    ["EEEE d 'de' MMMM 'a las' HH:mm", 'martes 6 de octubre a las 23:30'],
  ];
  for (const [pattern, expected] of cases) {
    assertEquals(formatChilePattern(instant, pattern), expected, pattern);
  }
  assertEquals(formatChilePattern('2026-10-06', 'dd/MM/yyyy'), '06/10/2026');
  assertEquals(formatChilePattern('', 'dd/MM/yyyy'), null);
});
