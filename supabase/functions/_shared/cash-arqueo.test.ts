// supabase/functions/_shared/cash-arqueo.test.ts
//
//   deno test supabase/functions/_shared/cash-arqueo.test.ts

import { assertEquals } from 'jsr:@std/assert';
import { resolveArqueo } from './cash-arqueo.ts';

Deno.test(
  'resolveArqueo: sin arqueo (arqueo_amount null) es "Sin arqueo", no un faltante (fix-074-i)',
  () => {
    assertEquals(resolveArqueo({ balance: 290_000, arqueo_amount: null, difference: null }), {
      saldoSistema: 290_000,
      saldoFisico: null,
      diferencia: null,
      estado: 'Sin arqueo',
    });
  },
);

Deno.test('resolveArqueo: con arqueo usa la diferencia guardada', () => {
  assertEquals(resolveArqueo({ balance: 290_000, arqueo_amount: 289_500, difference: -500 }), {
    saldoSistema: 290_000,
    saldoFisico: 289_500,
    diferencia: -500,
    estado: 'Faltante',
  });
});

Deno.test('resolveArqueo: sin diferencia guardada la deriva del conteo', () => {
  const r = resolveArqueo({ balance: 10_000, arqueo_amount: 12_000, difference: null });
  assertEquals([r.diferencia, r.estado], [2_000, 'Sobrante']);
  const c = resolveArqueo({ balance: 10_000, arqueo_amount: 10_000 });
  assertEquals([c.diferencia, c.estado], [0, 'Cuadrado']);
});
