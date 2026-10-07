// supabase/functions/_shared/class-book-calendar.test.ts
//
//   deno test supabase/functions/_shared/class-book-calendar.test.ts

import { assertEquals } from 'jsr:@std/assert';
import { buildCalendarRows, type CurriculumRow } from './class-book-calendar.ts';

const row = (fecha: string, asignatura: string): CurriculumRow => ({
  fecha,
  asignatura,
  materias: `Materias de ${asignatura}`,
  horas: '5 horas',
  profesor: 'RELATOR',
});

const LIBRE: CurriculumRow = {
  fecha: '',
  asignatura: 'LIBRE',
  materias: 'LIBRE',
  horas: 'LIBRE',
  profesor: 'LIBRE',
};

const session = (date: string, status = 'scheduled') => ({ date, status });

Deno.test('un bloque por día del libro real: las filas del mismo día comparten fecha', () => {
  const result = buildCalendarRows(
    [row('1/17/2022', 'A'), row('1/18/2022', 'B'), row('1/18/2022', 'C')],
    [session('2026-10-05'), session('2026-10-06')],
  );

  assertEquals(
    result.rows.map((r) => [r.numero, r.fecha, r.asignatura]),
    [
      [1, '2026-10-05', 'A'],
      [2, '2026-10-06', 'B'],
      [3, '2026-10-06', 'C'],
    ],
  );
  assertEquals(result.blocks, 2);
  assertEquals(result.activeDates, 2);
});

Deno.test('las filas LIBRE no se muestran ni consumen fecha', () => {
  const result = buildCalendarRows(
    [row('1/17/2022', 'A'), LIBRE, row('1/19/2022', 'B')],
    [session('2026-10-05'), session('2026-10-06')],
  );

  assertEquals(
    result.rows.map((r) => [r.numero, r.fecha, r.asignatura]),
    [
      [1, '2026-10-05', 'A'],
      [2, '2026-10-06', 'B'],
    ],
  );
});

Deno.test('una sesión cancelada (feriado) se salta, venga en el orden que venga', () => {
  const result = buildCalendarRows(
    [row('1/17/2022', 'A'), row('1/18/2022', 'B')],
    [session('2026-10-13'), session('2026-10-12', 'cancelled'), session('2026-10-09')],
  );

  assertEquals(
    result.rows.map((r) => r.fecha),
    ['2026-10-09', '2026-10-13'],
  );
  assertEquals(result.activeDates, 2);
});

Deno.test('si faltan sesiones, los bloques que sobran quedan sin fecha', () => {
  const result = buildCalendarRows(
    [row('1/17/2022', 'A'), row('1/18/2022', 'B'), row('1/19/2022', 'C')],
    [session('2026-10-05')],
  );

  assertEquals(
    result.rows.map((r) => r.fecha),
    ['2026-10-05', null, null],
  );
  assertEquals(result.blocks, 3);
  assertEquals(result.activeDates, 1);
});

Deno.test('conserva el contenido de la malla tal cual', () => {
  const result = buildCalendarRows([row('1/17/2022', 'TRANSPORTE')], [session('2026-10-05')]);

  assertEquals(result.rows[0], {
    numero: 1,
    fecha: '2026-10-05',
    asignatura: 'TRANSPORTE',
    materias: 'Materias de TRANSPORTE',
    horas: '5 horas',
    profesor: 'RELATOR',
  });
});
