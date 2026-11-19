// supabase/functions/_shared/payroll-totals.test.ts
//
//   deno test supabase/functions/_shared/payroll-totals.test.ts

import { assertEquals } from 'jsr:@std/assert';
import {
  calcPayrollBaseAmount,
  formatPayrollHours,
  roundPayrollHours,
  sumPayrollHours,
} from './payroll-totals.ts';

Deno.test('sumPayrollHours: horas exactas, 2,25 × 3 + 3 = 9,75 (spec 0012-i AC17)', () => {
  // En JS crudo las sumas de decimales derivan; la función las deja en 2 decimales.
  const total = sumPayrollHours([
    { totalHours: 2.25 },
    { totalHours: 2.25 },
    { totalHours: 2.25 },
    { totalHours: 3 },
  ]);
  assertEquals(total, 9.75);
  assertEquals(String(total), '9.75');
});

Deno.test('sumPayrollHours: lista vacía y múltiplos exactos', () => {
  assertEquals(sumPayrollHours([]), 0);
  assertEquals(sumPayrollHours([{ totalHours: 3 }, { totalHours: 6 }]), 9);
});

Deno.test('roundPayrollHours: conserva 2,25 y normaliza la deriva de punto flotante', () => {
  assertEquals(roundPayrollHours(3 * 0.75), 2.25);
  assertEquals(roundPayrollHours(0.1 + 0.2), 0.3);
  assertEquals(roundPayrollHours(0), 0);
});

Deno.test('formatPayrollHours: dos decimales con coma', () => {
  assertEquals(formatPayrollHours(2.25), '2,25');
  assertEquals(formatPayrollHours(3), '3,00');
  assertEquals(formatPayrollHours(9.75), '9,75');
});

Deno.test('calcPayrollBaseAmount: entrega entero CLP sin deriva de punto flotante', () => {
  // spec 0012-i AC17: 3 clases = 2,25 h a $5.000/h = $11.250 (antes 2,3 h = $11.500).
  assertEquals(calcPayrollBaseAmount(2.25, 5000), 11250);
  // En JS crudo: 2.3 * 7000 === 16099.999999999998
  assertEquals(calcPayrollBaseAmount(2.3, 7000), 16100);
  assertEquals(calcPayrollBaseAmount(3, 5000), 15000);
});
