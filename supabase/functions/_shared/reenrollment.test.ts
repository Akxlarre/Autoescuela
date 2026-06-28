// supabase/functions/_shared/reenrollment.test.ts
//
// Tests del Núcleo Funcional de re-matrícula pública (fix-020). Funciones puras,
// sin I/O ni globals de Deno → testables con `deno test` nativo.
//
//   deno test supabase/functions/_shared/reenrollment.test.ts

import { assertEquals } from 'jsr:@std/assert';
import { evaluateReenrollment, reenrollmentBlockMessage } from './reenrollment.ts';

// ── evaluateReenrollment(statuses) ───────────────────────────────────────────

Deno.test('evaluateReenrollment: sin matrícula previa → allow', () => {
  assertEquals(evaluateReenrollment([]), 'allow');
  assertEquals(evaluateReenrollment([null, undefined]), 'allow');
});

Deno.test('evaluateReenrollment: matrícula viva → block', () => {
  assertEquals(evaluateReenrollment(['active']), 'block');
  assertEquals(evaluateReenrollment(['pending_payment']), 'block');
  assertEquals(evaluateReenrollment(['draft']), 'block');
});

Deno.test('evaluateReenrollment: solo histórico → confirm', () => {
  assertEquals(evaluateReenrollment(['completed']), 'confirm');
  assertEquals(evaluateReenrollment(['cancelled']), 'confirm');
  assertEquals(evaluateReenrollment(['completed', 'cancelled']), 'confirm');
});

Deno.test('evaluateReenrollment: block gana sobre confirm', () => {
  assertEquals(evaluateReenrollment(['completed', 'active']), 'block');
  assertEquals(evaluateReenrollment(['active', 'completed']), 'block');
});

Deno.test('evaluateReenrollment: estado desconocido → block (conservador)', () => {
  assertEquals(evaluateReenrollment(['frozen']), 'block');
  assertEquals(evaluateReenrollment(['completed', 'mistery']), 'block');
  assertEquals(evaluateReenrollment([null, 'completed', undefined]), 'confirm');
});

// ── reenrollmentBlockMessage(verdict, label) ─────────────────────────────────

Deno.test('reenrollmentBlockMessage: allow → null (puede continuar)', () => {
  assertEquals(reenrollmentBlockMessage('allow', 'Clase B'), null);
});

Deno.test('reenrollmentBlockMessage: block menciona "en curso"', () => {
  const msg = reenrollmentBlockMessage('block', 'Clase B') ?? '';
  assertEquals(msg.includes('en curso'), true);
  assertEquals(msg.includes('Clase B'), true);
});

Deno.test('reenrollmentBlockMessage: confirm indica ir presencialmente', () => {
  const msg = reenrollmentBlockMessage('confirm', 'Clase Profesional A2') ?? '';
  assertEquals(msg.includes('presencial'), true);
  assertEquals(msg.includes('Clase Profesional A2'), true);
});
