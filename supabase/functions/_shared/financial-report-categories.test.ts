// supabase/functions/_shared/financial-report-categories.test.ts
//
//   deno test supabase/functions/_shared/financial-report-categories.test.ts
//
// Los nombres tienen que ser los mismos que muestra la pantalla de Reportes Contables
// (src/app/core/utils/reportes-contables.utils.ts). fix-077-i.

import { assertEquals } from 'jsr:@std/assert';
import {
  expenseCategory,
  incomeCategory,
  paymentCountsAsIncome,
  sumFinancialTotals,
} from './financial-report-categories.ts';

Deno.test('expenseCategory: combustible es Bencina, igual que fuel (fix-077-i)', () => {
  assertEquals(expenseCategory('combustible'), { key: 'fuel', label: 'Bencina' });
  assertEquals(expenseCategory('fuel'), { key: 'fuel', label: 'Bencina' });
});

Deno.test('expenseCategory: sin categoría es Gastos Varios; una desconocida es Otros', () => {
  assertEquals(expenseCategory(null), { key: 'general', label: 'Gastos Varios' });
  assertEquals(expenseCategory('general'), { key: 'general', label: 'Gastos Varios' });
  assertEquals(expenseCategory('cualquier-cosa'), { key: 'other', label: 'Otros' });
});

Deno.test('expenseCategory: las categorías de gastos fijos tienen nombre', () => {
  assertEquals(expenseCategory('rent').label, 'Arriendo');
  assertEquals(expenseCategory('salary').label, 'Sueldos');
  assertEquals(expenseCategory('utility').label, 'Servicios Básicos');
  assertEquals(expenseCategory('insurance').label, 'Seguros');
  assertEquals(expenseCategory('repair').label, 'Reparaciones');
});

Deno.test('incomeCategory: mismos nombres que la pantalla, con una sede', () => {
  const one = (type: string | null, lg: string | null) =>
    incomeCategory({ type, licenseGroup: lg, branchId: 1 }, false).label;
  assertEquals(one('enrollment', 'class_b'), 'Clase B');
  assertEquals(one('monthly_fee', 'professional'), 'Profesional');
  assertEquals(one('standalone', 'standalone'), 'Cursos Singulares');
  assertEquals(one('complement', 'class_b'), 'Clases Extra');
  assertEquals(one('special_service', null), 'Psicotécnico / Servicios');
  assertEquals(one('enrollment', null), 'Otros');
});

Deno.test('incomeCategory: con todas las sedes separa por sede, como la pantalla', () => {
  const s1 = incomeCategory({ type: 'enrollment', licenseGroup: 'class_b', branchId: 1 }, true);
  const s2 = incomeCategory({ type: 'enrollment', licenseGroup: 'class_b', branchId: 2 }, true);
  assertEquals(s1.label, 'Clase B (A. Chillán)');
  assertEquals(s2.label, 'Clase B (C. Chillán)');
  // Clases extra y servicios no se separan por sede.
  assertEquals(
    incomeCategory({ type: 'complement', licenseGroup: 'class_b', branchId: 2 }, true).label,
    'Clases Extra',
  );
});

Deno.test('paymentCountsAsIncome: paid y completado suman; el resto no', () => {
  assertEquals(paymentCountsAsIncome('paid'), true);
  assertEquals(paymentCountsAsIncome('completado'), true);
  assertEquals(paymentCountsAsIncome('anulado'), false);
  assertEquals(paymentCountsAsIncome(null), false);
});

Deno.test(
  'sumFinancialTotals: los gastos fijos entran en Total Gastos y Neto (fix-077-i, caso H19)',
  () => {
    // Sede 1, nov-2026 en fix-073-i: ingresos 1.190.000, gastos operacionales 55.000 y un
    // Arriendo fijo de 100.000. La pantalla: gastos 155.000, neto 1.035.000.
    const totals = sumFinancialTotals(
      [{ amount: 1_190_000 }],
      [{ amount: 55_000 }],
      [{ amount: 100_000 }],
    );
    assertEquals(totals, { totalIngresos: 1_190_000, totalGastos: 155_000, totalNeto: 1_035_000 });
  },
);
