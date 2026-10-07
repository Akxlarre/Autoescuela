// supabase/functions/_shared/holidays.test.ts
//
// Espejo exacto de `src/app/core/utils/promotion-end-date.utils.spec.ts` — mismos casos,
// mismas fechas, mismo resultado esperado. Si uno cambia, el otro debe cambiar igual.
//
//   deno test supabase/functions/_shared/holidays.test.ts

import { assertEquals } from 'jsr:@std/assert';
import { computePromotionEndDate, holidaysOfYear, promotionHolidayYears } from './holidays.ts';

Deno.test('holidaysOfYear: una fuente que responde con otro año queda vacía', () => {
  assertEquals(holidaysOfYear(['2026-01-01', '2026-12-25'], 2027), []);
  assertEquals(holidaysOfYear(['2026-12-25', '2027-01-01'], 2027), ['2027-01-01']);
});

const START = '2026-08-03'; // lunes

Deno.test('computePromotionEndDate: sin feriados → start + 33 (sábado de la 5ª semana)', () => {
  assertEquals(computePromotionEndDate(START, new Set()), '2026-09-05');
});

Deno.test('computePromotionEndDate: 1 feriado a mitad del rango → start + 35', () => {
  const holidays = new Set(['2026-08-13']); // jueves, semana 2
  assertEquals(computePromotionEndDate(START, holidays), '2026-09-07');
});

Deno.test('computePromotionEndDate: 2 feriados no consecutivos → start + 36', () => {
  const holidays = new Set(['2026-08-13', '2026-08-25']); // jueves sem2, martes sem4
  assertEquals(computePromotionEndDate(START, holidays), '2026-09-08');
});

Deno.test(
  'computePromotionEndDate: 2 feriados consecutivos (lunes y martes) → start + 36, sin loop infinito',
  () => {
    const holidays = new Set(['2026-08-17', '2026-08-18']); // lunes y martes semana 3
    assertEquals(computePromotionEndDate(START, holidays), '2026-09-08');
  },
);

Deno.test(
  'computePromotionEndDate: feriado justo en el último día (start+33) → coincide con 1 feriado',
  () => {
    const holidays = new Set(['2026-09-05']); // sábado, day33
    assertEquals(computePromotionEndDate(START, holidays), '2026-09-07');
  },
);

Deno.test('computePromotionEndDate: feriado en domingo → no afecta el conteo', () => {
  const holidays = new Set(['2026-08-09']); // domingo, semana 1
  assertEquals(computePromotionEndDate(START, holidays), '2026-09-05');
});

// fix-343-m — espejo de `promotionHolidayYears` en promotion-end-date.utils.spec.ts
Deno.test('promotionHolidayYears: inicio en octubre → solo el año de inicio', () => {
  assertEquals(promotionHolidayYears('2026-10-12'), [2026]);
});

Deno.test('promotionHolidayYears: inicio el 30 de noviembre → año de inicio y el siguiente', () => {
  assertEquals(promotionHolidayYears('2026-11-30'), [2026, 2027]);
});

Deno.test('promotionHolidayYears: inicio en diciembre → año de inicio y el siguiente', () => {
  assertEquals(promotionHolidayYears('2026-12-14'), [2026, 2027]);
});

Deno.test('promotionHolidayYears: inicio en enero → solo ese año', () => {
  assertEquals(promotionHolidayYears('2027-01-11'), [2027]);
});
