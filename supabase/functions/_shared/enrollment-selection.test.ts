// supabase/functions/_shared/enrollment-selection.test.ts
//
// Tests del Núcleo Funcional de selección de matrícula (fix-058, H-039).
//
//   deno test supabase/functions/_shared/enrollment-selection.test.ts

import { assertEquals } from 'jsr:@std/assert';
import { pickEnrollmentToShow } from './enrollment-selection.ts';

Deno.test('pickEnrollmentToShow: array vacío → null', () => {
  assertEquals(pickEnrollmentToShow([]), null);
});

Deno.test('pickEnrollmentToShow: una sola matrícula, con o sin saldo → esa misma', () => {
  const sinSaldo = { id: 1, pending_balance: 0 };
  assertEquals(pickEnrollmentToShow([sinSaldo]), sinSaldo);

  const conSaldo = { id: 2, pending_balance: 90000 };
  assertEquals(pickEnrollmentToShow([conSaldo]), conSaldo);
});

Deno.test(
  'pickEnrollmentToShow: prioriza la matrícula con saldo aunque sea más antigua (H-039)',
  () => {
    // Orden = created_at desc: la primera es la más reciente (Profesional, ya pagada).
    const profesionalPagada = { id: 2, pending_balance: 0, licenseGroup: 'professional' };
    const classBConSaldo = { id: 1, pending_balance: 90000, licenseGroup: 'class_b' };

    const result = pickEnrollmentToShow([profesionalPagada, classBConSaldo]);
    assertEquals(result?.id, 1);
  },
);

Deno.test(
  'pickEnrollmentToShow: todas saldadas → cae a la más reciente (primera del array)',
  () => {
    const masReciente = { id: 3, pending_balance: 0 };
    const masAntigua = { id: 1, pending_balance: 0 };

    const result = pickEnrollmentToShow([masReciente, masAntigua]);
    assertEquals(result?.id, 3);
  },
);

Deno.test(
  'pickEnrollmentToShow: pending_balance como string numérico (Supabase numeric) se compara bien',
  () => {
    const conSaldoString = { id: 1, pending_balance: '50000' };
    const result = pickEnrollmentToShow([conSaldoString]);
    assertEquals(result?.id, 1);
  },
);

Deno.test('pickEnrollmentToShow: pending_balance null se trata como sin saldo', () => {
  const sinSaldo = { id: 1, pending_balance: null };
  const conSaldo = { id: 2, pending_balance: 40000 };
  const result = pickEnrollmentToShow([sinSaldo, conSaldo]);
  assertEquals(result?.id, 2);
});
