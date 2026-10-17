// supabase/functions/export-special-services/rows.test.ts
//
//   npx deno test --node-modules-dir=none export-special-services/rows.test.ts   (desde supabase/functions)

import { assertEquals } from 'jsr:@std/assert';
import { EXPORT_HEADERS, exportRows, parseSaleIds } from './rows.ts';

const venta = {
  sale_date: '2026-10-15',
  client_name: 'José Núñez',
  client_rut: '12.345.678-5',
  service_name: 'Psicotécnico',
  service_catalog: { name: 'Psicotécnico renombrado' },
  document_number: '4582',
  payment_method: 'transferencia',
  price: 20000,
  branches: { name: 'Autoescuela Chillán' },
};

Deno.test('columnas: sin Estado ni Pagado; con boleta, medio de pago y sede (fix-440-m)', () => {
  assertEquals(EXPORT_HEADERS, [
    'Fecha',
    'Cliente',
    'RUT',
    'Servicio',
    'N° boleta',
    'Medio de pago',
    'Monto',
    'Sede',
    'Anulación',
  ]);
});

Deno.test('una fila usa el nombre guardado en la venta, no el actual del catálogo', () => {
  const { rows } = exportRows([venta]);
  assertEquals(rows[0], [
    '15-10-2026',
    'José Núñez',
    '12.345.678-5',
    'Psicotécnico',
    '4582',
    'Transferencia',
    20000,
    'Autoescuela Chillán',
    '',
  ]);
});

Deno.test('anulada: sale marcada con su motivo y fuera del total (fix-443-m)', () => {
  const anulada = { ...venta, price: 5000, status: 'anulado', void_reason: ' Venta duplicada ' };
  const { rows, total, vigentes } = exportRows([venta, anulada]);
  assertEquals(rows[1][8], 'Anulada: Venta duplicada');
  assertEquals(rows[1][6], 5000);
  assertEquals(total, 20000);
  assertEquals(vigentes, 1);
  assertEquals(exportRows([{ ...anulada, void_reason: null }]).rows[0][8], 'Anulada');
});

Deno.test('sin nombre guardado cae al del catálogo; sin boleta queda vacío', () => {
  const { rows } = exportRows([
    { ...venta, service_name: null, document_number: null, payment_method: null },
  ]);
  assertEquals(rows[0][3], 'Psicotécnico renombrado');
  assertEquals(rows[0][4], '');
  assertEquals(rows[0][5], '');
});

Deno.test('el total suma los montos', () => {
  const { total } = exportRows([venta, { ...venta, price: 5000 }]);
  assertEquals(total, 25000);
});

Deno.test(
  'parseSaleIds: solo enteros positivos, sin repetidos; cualquier otra cosa es null',
  () => {
    assertEquals(parseSaleIds([3, 1, 3]), [3, 1]);
    assertEquals(parseSaleIds([]), []);
    assertEquals(parseSaleIds(undefined), null);
    assertEquals(parseSaleIds('1,2'), null);
    assertEquals(parseSaleIds([1, 'x']), null);
    assertEquals(parseSaleIds([0]), null);
  },
);
