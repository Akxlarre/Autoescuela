// supabase/functions/_shared/promotion-certificate.test.ts
//
// Ejecutar:
//   npx --yes deno test --no-lock --node-modules-dir=none supabase/functions/_shared/promotion-certificate.test.ts

import { assertEquals } from 'jsr:@std/assert@1';
import {
  checkPromotionFinished,
  DEFAULT_CONVALIDACION,
  professionalCourseLabel,
} from './promotion-certificate.ts';

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

// fix-483-m: el certificado menciona la licencia convalidada con el texto de la plantilla.
Deno.test('curso sin convalidación: el texto de la plantilla no se usa', () => {
  assertEquals(
    professionalCourseLabel('A5', null, DEFAULT_CONVALIDACION),
    'Licencia Profesional Clase A5',
  );
});

Deno.test('curso con convalidación y texto por defecto', () => {
  assertEquals(
    professionalCourseLabel('a5', 'A3', DEFAULT_CONVALIDACION),
    'Licencia Profesional Clase A5 con convalidación de Clase A3',
  );
});

Deno.test('curso con convalidación y texto editado en Plantillas', () => {
  assertEquals(
    professionalCourseLabel('A5', 'A3', 'y convalidación Clase {{claseConvalidada}}'),
    'Licencia Profesional Clase A5 y convalidación Clase A3',
  );
});

Deno.test('texto de convalidación vacío en la plantilla: no se menciona', () => {
  assertEquals(professionalCourseLabel('A5', 'A3', '   '), 'Licencia Profesional Clase A5');
});

Deno.test('clase desconocida', () => {
  assertEquals(professionalCourseLabel('', null, DEFAULT_CONVALIDACION), 'Licencia Profesional');
});
