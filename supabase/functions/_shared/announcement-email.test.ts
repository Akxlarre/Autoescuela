// supabase/functions/_shared/announcement-email.test.ts
//
// Parte pura del envío de comunicados: plantilla, destinatarios por (alumno, escuela) y
// consentimiento promocional por escuela (specs 0041-b, 0042-b, fix-232-b, 0061-b).
//
//   deno test supabase/functions/_shared/announcement-email.test.ts

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { resolveSender } from './school-email.ts';
import { CONTRACT_EMAIL_THEMES } from './contract-email.ts';
import {
  brandInitials,
  buildEmailHtml,
  consentedPairKeys,
  pairKey,
  recipientPairs,
  renderTemplate,
} from './announcement-email.ts';

const PLATFORM = 'cuentas@gestordeautoescuelas.cl';
const AUTOESCUELA = resolveSender(
  {
    id: 1,
    name: 'Autoescuela Chillán',
    email_sender_name: 'Autoescuela Chillán',
    email_sender_address: 'autoescuela-chillan@gestordeautoescuelas.cl',
    email: 'otecchillan@gmail.com',
    phone: '+56 42 232 7800',
  },
  PLATFORM,
);

// ── Plantilla ───────────────────────────────────────────────────────────────────────────────

Deno.test('AC4: la marca del correo es la de la escuela que envía', () => {
  const html = buildEmailHtml('Asunto', 'Cuerpo', AUTOESCUELA, false);
  assertStringIncludes(html, '<span>AC</span>');
  assertStringIncludes(html, 'Autoescuela Chillán');
  assert(!html.includes('Conductores Chillán'));
  assertStringIncludes(html, 'Enviado por Autoescuela Chillán mediante Gestor de Autoescuelas');
  assert(!/no responder/i.test(html));
});

Deno.test('AC5: el comunicado lleva los colores de la escuela que envía', () => {
  const roja = buildEmailHtml('Asunto', 'Cuerpo', AUTOESCUELA, false, CONTRACT_EMAIL_THEMES.roja);
  assertStringIncludes(roja, CONTRACT_EMAIL_THEMES.roja.gradientHero);
  assert(!roja.includes(CONTRACT_EMAIL_THEMES.azul.gradientHero));
  // Sin tema configurado, el azul de siempre.
  const azul = buildEmailHtml('Asunto', 'Cuerpo', AUTOESCUELA, false);
  assertStringIncludes(azul, CONTRACT_EMAIL_THEMES.azul.gradientHero);
});

Deno.test('el logo se centra sin flexbox (Gmail lo ignora)', () => {
  const html = buildEmailHtml('Asunto', 'Cuerpo', AUTOESCUELA, false);
  assert(!html.includes('inline-flex'));
  assertStringIncludes(html, 'line-height: 56px');
});

Deno.test('iniciales de la escuela', () => {
  assertEquals(brandInitials('Autoescuela Chillán'), 'AC');
  assertEquals(brandInitials(''), 'AE');
});

Deno.test('AC4: el promocional lleva el pie de baja con el correo de la escuela que envía', () => {
  const html = buildEmailHtml('Asunto', 'Cuerpo', AUTOESCUELA, true);
  assertStringIncludes(html, 'no quieres recibir más promociones');
  assertStringIncludes(html, 'otecchillan@gmail.com');
});

Deno.test('el operativo no lleva el pie de baja', () => {
  const html = buildEmailHtml('Asunto', 'Cuerpo', AUTOESCUELA, false);
  assert(!html.includes('no quieres recibir más promociones'));
});

Deno.test('asunto y cuerpo se escapan; los saltos de línea se respetan', () => {
  const html = buildEmailHtml('<b>A</b>', 'línea 1\n<script>x</script>', AUTOESCUELA, false);
  assert(!html.includes('<script>'));
  assert(!html.includes('<b>A</b>'));
  assertStringIncludes(html, 'línea 1<br>');
});

Deno.test('renderTemplate resuelve marcadores y vacía los desconocidos', () => {
  assertEquals(
    renderTemplate('Hola {{ nombre }} de {{sede}}{{x}}', { nombre: 'Ana', sede: 'AC' }),
    'Hola Ana de AC',
  );
});

// ── Destinatarios por (alumno, escuela) ─────────────────────────────────────────────────────

const ENROLLMENTS = [
  { branch_id: 1, students: { user_id: 10 } },
  { branch_id: 2, students: { user_id: 10 } }, // alumno de las dos escuelas
  { branch_id: 1, students: { user_id: 10 } }, // segunda matrícula en la misma escuela
  { branch_id: 2, students: { user_id: 20 } },
  { branch_id: 1, students: { user_id: 30 } },
];

Deno.test('AC-E5: un par por (alumno, escuela), sin duplicar por matrícula', () => {
  assertEquals(recipientPairs(ENROLLMENTS, []), [
    { userId: 10, branchId: 1 },
    { userId: 10, branchId: 2 },
    { userId: 20, branchId: 2 },
    { userId: 30, branchId: 1 },
  ]);
});

Deno.test('los excluidos a mano no reciben en ninguna escuela', () => {
  assertEquals(recipientPairs(ENROLLMENTS, [10]), [
    { userId: 20, branchId: 2 },
    { userId: 30, branchId: 1 },
  ]);
});

// ── Consentimiento promocional por escuela (AC10) ──────────────────────────────────────────

Deno.test('AC10: aceptó ante A y revocó ante B → solo A', () => {
  const keys = consentedPairKeys([
    {
      user_id: 10,
      branch_id: 1,
      granted: true,
      revoked_at: null,
      granted_at: '2026-10-01T12:00:00Z',
    },
    {
      user_id: 10,
      branch_id: 2,
      granted: true,
      revoked_at: '2026-11-01T12:00:00Z',
      granted_at: '2026-10-02T12:00:00Z',
    },
  ]);
  assert(keys.has(pairKey(10, 1)));
  assert(!keys.has(pairKey(10, 2)));
});

Deno.test('AC10: vale el último ante ESA escuela, no el último en general', () => {
  const keys = consentedPairKeys([
    // Ante la escuela 1: aceptó y después se negó.
    {
      user_id: 10,
      branch_id: 1,
      granted: true,
      revoked_at: null,
      granted_at: '2026-09-01T12:00:00Z',
    },
    {
      user_id: 10,
      branch_id: 1,
      granted: false,
      revoked_at: null,
      granted_at: '2026-10-01T12:00:00Z',
    },
    // Ante la escuela 2, lo más reciente de todo: aceptó.
    {
      user_id: 10,
      branch_id: 2,
      granted: true,
      revoked_at: null,
      granted_at: '2026-11-01T12:00:00Z',
    },
  ]);
  assert(!keys.has(pairKey(10, 1)));
  assert(keys.has(pairKey(10, 2)));
});

Deno.test('AC10: no depende del orden en que llegan las filas', () => {
  const keys = consentedPairKeys([
    {
      user_id: 10,
      branch_id: 1,
      granted: false,
      revoked_at: null,
      granted_at: '2026-10-01T12:00:00Z',
    },
    {
      user_id: 10,
      branch_id: 1,
      granted: true,
      revoked_at: null,
      granted_at: '2026-09-01T12:00:00Z',
    },
  ]);
  assert(!keys.has(pairKey(10, 1)));
});

Deno.test('sin ningún consentimiento ante la escuela → no recibe promocionales', () => {
  assertEquals(consentedPairKeys([]).size, 0);
});
