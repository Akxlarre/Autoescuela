// supabase/functions/_shared/payroll-totals.test.ts
//
//   deno test supabase/functions/_shared/payroll-totals.test.ts

import { assertEquals } from 'jsr:@std/assert';
import { calcPayrollBaseAmount, roundPayrollHours, sumPayrollHours } from './payroll-totals.ts';

Deno.test('sumPayrollHours: evita deriva IEEE-754 al sumar horas NUMERIC(6,1)', () => {
  // En JS crudo: 2.3 + 2.3 + 2.3 + 3 === 9.899999999999999
  const total = sumPayrollHours([
    { totalHours: 2.3 },
    { totalHours: 2.3 },
    { totalHours: 2.3 },
    { totalHours: 3 },
  ]);
  assertEquals(total, 9.9);
  assertEquals(String(total), '9.9');
});

Deno.test('sumPayrollHours: lista vacía y múltiplos exactos', () => {
  assertEquals(sumPayrollHours([]), 0);
  assertEquals(sumPayrollHours([{ totalHours: 3 }, { totalHours: 6 }]), 9);
});

Deno.test('roundPayrollHours: normaliza un valor acumulado con error de punto flotante', () => {
  assertEquals(roundPayrollHours(8.3 + 9.8), 18.1);
  assertEquals(roundPayrollHours(0), 0);
});

Deno.test('calcPayrollBaseAmount: entrega entero CLP sin deriva de punto flotante', () => {
  // En JS crudo: 2.3 * 7000 === 16099.999999999998
  assertEquals(calcPayrollBaseAmount(2.3, 7000), 16100);
  assertEquals(calcPayrollBaseAmount(2.3, 5000), 11500);
  assertEquals(calcPayrollBaseAmount(3, 5000), 15000);
});
