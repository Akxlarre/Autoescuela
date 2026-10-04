// supabase/functions/_shared/enrollment-sheet-format.test.ts
//
//   deno test supabase/functions/_shared/enrollment-sheet-format.test.ts

import { assertEquals } from 'jsr:@std/assert';
import { conceptoPago, fechaHoraGeneracion, fechaPago } from './enrollment-sheet-format.ts';
import { escapePdfWinAnsi } from './pdf-utils.ts';

Deno.test('conceptoPago: el pago de matrícula se muestra en español', () => {
  assertEquals(conceptoPago('enrollment'), 'Matrícula');
  assertEquals(conceptoPago(' Enrollment '), 'Matrícula');
});

Deno.test('conceptoPago: el pago en línea y los demás tipos', () => {
  assertEquals(conceptoPago('online'), 'Online');
  assertEquals(conceptoPago('Cuota 2'), 'Cuota 2');
});

Deno.test('conceptoPago: sin tipo dice "Pago"', () => {
  assertEquals(conceptoPago(null), 'Pago');
  assertEquals(conceptoPago('   '), 'Pago');
});

Deno.test('fechaPago: una fecha sin hora no retrocede un día', () => {
  assertEquals(fechaPago('2026-09-22'), '22-09-2026');
  assertEquals(fechaPago('2026-01-01'), '01-01-2026');
});

Deno.test('fechaPago: sin fecha muestra un guion', () => {
  assertEquals(fechaPago(null), '-');
  assertEquals(fechaPago(''), '-');
});

Deno.test('fechaHoraGeneracion: dd-mm-aaaa y hora de 24 h, en hora de Chile', () => {
  // 00:10 del 4 de octubre en Santiago (UTC-3 en verano).
  assertEquals(fechaHoraGeneracion('2026-10-04T03:10:00Z'), '04-10-2026, 00:10');
  // 23:24 del 2 de octubre en Santiago: en UTC ya es el día 3.
  assertEquals(fechaHoraGeneracion('2026-10-03T02:24:00Z'), '02-10-2026, 23:24');
});

Deno.test('fechaHoraGeneracion: solo usa caracteres que la fuente del PDF tiene', () => {
  const texto = fechaHoraGeneracion('2026-10-04T03:10:00Z');
  assertEquals(escapePdfWinAnsi(texto).includes('?'), false);
});

Deno.test('escapePdfWinAnsi conserva tildes y ñ (antes la ficha las quitaba)', () => {
  // WinAnsi: ñ = 0xF1 (361 octal), é = 0xE9 (351), Í = 0xCD (315).
  assertEquals(escapePdfWinAnsi('Muñoz'), 'Mu\\361oz');
  assertEquals(escapePdfWinAnsi('Teléfono'), 'Tel\\351fono');
  assertEquals(escapePdfWinAnsi('MATRÍCULA'), 'MATR\\315CULA');
});
