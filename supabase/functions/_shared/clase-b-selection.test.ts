// supabase/functions/_shared/clase-b-selection.test.ts
//
// fix-240-b: la matrícula online Clase B valida en el servidor los horarios elegidos.
//
//   deno test supabase/functions/_shared/clase-b-selection.test.ts

import { assertEquals } from 'jsr:@std/assert';
import { type AvailabilityRow, checkClaseBSelection } from './clase-b-selection.ts';

// 2026-11-06 23:30 en Chile (02:30 UTC del 7): "hoy" es el 6 aunque en UTC ya sea el 7.
const NOW = new Date('2026-11-07T02:30:00.000Z');
const SEDE = 1;
const OTRA = 2;

function fila(slotStart: string, extra: Partial<AvailabilityRow> = {}): AvailabilityRow {
  return {
    slot_start: slotStart,
    slot_status: 'available',
    vehicle_id: 7,
    branch_ids: [SEDE],
    ...extra,
  };
}

const LUNES_0830 = '2026-11-09T11:30:00+00:00';
const LUNES_0915 = '2026-11-09T12:15:00+00:00';
const MARTES_0830 = '2026-11-10T11:30:00+00:00';
const FILAS = [fila(LUNES_0830), fila(LUNES_0915), fila(MARTES_0830)];

function check(slotIds: string[], rows = FILAS, heldByOthers: string[] = []) {
  return checkClaseBSelection({ slotIds, rows, branchId: SEDE, heldByOthers, now: NOW });
}

Deno.test(
  'acepta horarios libres de la sede y devuelve el vehículo y el instante de la vista',
  () => {
    // El cliente manda el mismo instante en otro formato: se normaliza al de la vista.
    assertEquals(check(['2026-11-09T11:30:00.000Z', MARTES_0830]), {
      ok: true,
      vehicleId: 7,
      slotStarts: [LUNES_0830, MARTES_0830],
    });
  },
);

Deno.test('rechaza un horario que el instructor no tiene en la vista', () => {
  assertEquals(check([LUNES_0830, '2026-11-09T20:00:00+00:00']), {
    ok: false,
    reason: 'unavailable',
    slots: ['2026-11-09T20:00:00+00:00'],
  });
});

Deno.test('rechaza un horario ocupado', () => {
  const rows = [fila(LUNES_0830, { slot_status: 'occupied' }), fila(MARTES_0830)];
  assertEquals(check([LUNES_0830, MARTES_0830], rows), {
    ok: false,
    reason: 'unavailable',
    slots: [LUNES_0830],
  });
});

Deno.test('rechaza un horario que solo atiende otra sede (spec 0057-b)', () => {
  const rows = [
    fila(LUNES_0830, { branch_ids: [OTRA] }),
    fila(MARTES_0830, { branch_ids: [SEDE, OTRA] }),
  ];
  assertEquals(check([LUNES_0830, MARTES_0830], rows), {
    ok: false,
    reason: 'unavailable',
    slots: [LUNES_0830],
  });
});

Deno.test('rechaza un horario de hoy en Chile, aunque en UTC ya sea mañana', () => {
  const HOY_2330 = '2026-11-07T02:30:00+00:00'; // 23:30 del 6 en Chile
  const rows = [fila('2026-11-06T22:00:00+00:00'), fila(HOY_2330), fila(MARTES_0830)];
  assertEquals(check(['2026-11-06T22:00:00+00:00', MARTES_0830], rows), {
    ok: false,
    reason: 'unavailable',
    slots: ['2026-11-06T22:00:00+00:00'],
  });
});

Deno.test('rechaza un horario que retiene otra sesión', () => {
  assertEquals(check([LUNES_0830, MARTES_0830], FILAS, ['2026-11-10T11:30:00.000Z']), {
    ok: false,
    reason: 'held',
    slots: [MARTES_0830],
  });
});

Deno.test('rechaza horarios repetidos, aunque vengan en otro formato', () => {
  assertEquals(check([LUNES_0830, '2026-11-09T11:30:00.000Z']), {
    ok: false,
    reason: 'duplicate',
    slots: ['2026-11-09T11:30:00.000Z'],
  });
});

Deno.test('rechaza un id que no es una fecha', () => {
  assertEquals(check([LUNES_0830, 'no-es-fecha']), {
    ok: false,
    reason: 'unavailable',
    slots: ['no-es-fecha'],
  });
});

Deno.test('rechaza una selección vacía o con más de 20 horarios', () => {
  assertEquals(check([]), { ok: false, reason: 'empty', slots: [] });
  const muchos = Array.from({ length: 21 }, (_, i) =>
    new Date(Date.parse(LUNES_0830) + i * 86_400_000).toISOString(),
  );
  assertEquals(check(muchos).ok, false);
  assertEquals((check(muchos) as { reason: string }).reason, 'too_many');
});

Deno.test('rechaza una selección repartida en dos vehículos', () => {
  const rows = [fila(LUNES_0830), fila(MARTES_0830, { vehicle_id: 8 })];
  assertEquals(check([LUNES_0830, MARTES_0830], rows), {
    ok: false,
    reason: 'mixed_vehicle',
    slots: [MARTES_0830],
  });
});

Deno.test('con dos filas para el mismo horario, basta una que cumpla', () => {
  const rows = [fila(LUNES_0830, { branch_ids: [OTRA], vehicle_id: 8 }), fila(LUNES_0830)];
  assertEquals(check([LUNES_0830], rows), { ok: true, vehicleId: 7, slotStarts: [LUNES_0830] });
});
