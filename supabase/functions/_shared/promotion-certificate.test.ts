// supabase/functions/_shared/promotion-certificate.test.ts
//
// Ejecutar:
//   npx --yes deno test --no-lock --node-modules-dir=none supabase/functions/_shared/promotion-certificate.test.ts

import { assertEquals } from 'jsr:@std/assert@1';
import { checkPromotionFinished } from './promotion-certificate.ts';

Deno.test('promoción en curso (termina después de hoy): 400 PROMOCION_EN_CURSO', () => {
  assertEquals(checkPromotionFinished('2026-10-24', '2026-10-19'), {
    ok: false,
    status: 400,
    body: {
      error: 'La promoción termina el 24-10-2026: el certificado se puede generar desde ese día.',
      code: 'PROMOCION_EN_CURSO',
    },
  });
});

Deno.test('último día de la promoción: se emite', () => {
  assertEquals(checkPromotionFinished('2026-10-19', '2026-10-19'), { ok: true });
});

Deno.test('promoción ya terminada: se emite', () => {
  assertEquals(checkPromotionFinished('2026-08-24', '2026-10-19'), { ok: true });
});

Deno.test('sin fecha de término: no se emite', () => {
  const verdict = checkPromotionFinished(null, '2026-10-19');
  assertEquals(verdict.ok, false);
});
