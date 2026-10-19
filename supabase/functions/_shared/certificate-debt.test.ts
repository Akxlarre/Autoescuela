// supabase/functions/_shared/certificate-debt.test.ts
//
// Ejecutar:
//   npx --yes deno test --no-lock --node-modules-dir=none supabase/functions/_shared/certificate-debt.test.ts

import { assertEquals } from 'jsr:@std/assert@1';
import { checkCertificateDebt, type OverrideCounter } from './certificate-debt.ts';

function counter(count: number, error: string | null = null): OverrideCounter & { calls: number } {
  const c = {
    calls: 0,
    countCertificateOverrides() {
      c.calls++;
      return Promise.resolve({ count, error });
    },
  };
  return c;
}

Deno.test('sin saldo: se emite sin consultar habilitaciones', async () => {
  const db = counter(0);
  assertEquals(await checkCertificateDebt(db, 1, 0), { ok: true });
  assertEquals(await checkCertificateDebt(db, 1, null), { ok: true });
  assertEquals(await checkCertificateDebt(db, 1, -500), { ok: true });
  assertEquals(db.calls, 0);
});

Deno.test('con saldo y sin habilitación: 409 DEUDA_PENDIENTE con el monto', async () => {
  const verdict = await checkCertificateDebt(counter(0), 1, 180000);
  assertEquals(verdict, {
    ok: false,
    status: 409,
    body: { error: 'El alumno tiene un saldo pendiente de $180.000.', code: 'DEUDA_PENDIENTE' },
  });
});

Deno.test('con saldo y habilitación registrada: se emite', async () => {
  assertEquals(await checkCertificateDebt(counter(1), 1, 180000), { ok: true });
});

Deno.test('si falla la consulta de habilitaciones: 500, nunca se emite', async () => {
  const verdict = await checkCertificateDebt(counter(0, 'timeout'), 1, 180000);
  assertEquals(verdict.ok, false);
  if (!verdict.ok) assertEquals(verdict.status, 500);
});
