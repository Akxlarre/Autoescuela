// supabase/functions/_shared/announcement-send.test.ts
//
// Ejecutar:
//   npx --yes deno test --allow-env --no-lock --node-modules-dir=none supabase/functions/_shared/announcement-send.test.ts
// (--allow-env: nodemailer lee una variable de entorno al importarse)

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { brandInitials, buildEmailHtml } from './announcement-send.ts';

const AUTOESCUELA = { sede: 'Autoescuela Chillán', correoSede: 'otecchillan@gmail.com' };

Deno.test('S6: la marca del correo es la de la sede del alumno, no una fija', () => {
  const html = buildEmailHtml('Asunto', 'Cuerpo', { ...AUTOESCUELA, promocional: false });
  assertStringIncludes(html, '<span>AC</span>');
  assertStringIncludes(html, 'Autoescuela Chillán');
  assert(!html.includes('Conductores Chillán'), 'no debe aparecer la otra escuela');
});

Deno.test('S6: iniciales de la sede', () => {
  assertEquals(brandInitials('Conductores Chillán'), 'CC');
  assertEquals(brandInitials('Autoescuela Chillán'), 'AC');
  assertEquals(brandInitials(''), 'AE');
});

Deno.test('S5: el promocional dice cómo darse de baja, con el correo de la sede', () => {
  const html = buildEmailHtml('Promo', 'Cuerpo', { ...AUTOESCUELA, promocional: true });
  assertStringIncludes(html, 'Si no quieres recibir más promociones');
  assertStringIncludes(html, 'otecchillan@gmail.com');
});

Deno.test('S5: el operativo no lleva el pie de baja', () => {
  const html = buildEmailHtml('Aviso', 'Cuerpo', { ...AUTOESCUELA, promocional: false });
  assert(!html.includes('Si no quieres recibir más promociones'));
});

Deno.test('la sede y su correo se escapan', () => {
  const html = buildEmailHtml('A', 'B', {
    sede: '<b>X</b>',
    correoSede: '"><script>',
    promocional: true,
  });
  assert(!html.includes('<b>X</b>'));
  assert(!html.includes('"><script>'));
});

Deno.test('sin sede conocida usa una marca genérica y la baja se pide en la escuela', () => {
  const html = buildEmailHtml('A', 'B', { sede: '', correoSede: '', promocional: true });
  assertStringIncludes(html, 'Escuela de conductores');
  assertStringIncludes(html, 'avísanos en la escuela');
});
