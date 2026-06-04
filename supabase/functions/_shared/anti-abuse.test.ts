// supabase/functions/_shared/anti-abuse.test.ts
//
// Tests del Núcleo Funcional anti-abuso (Spec 0010). Funciones puras, sin I/O
// ni globals de Deno → testables con `deno test` nativo (cero dependencias
// externas que el cliente deba administrar).
//
//   deno test supabase/functions/_shared/anti-abuse.test.ts

import { assertEquals } from 'jsr:@std/assert';
import { amountsMatch, isHoneypotTripped, isOriginAllowed, isRateLimited } from './anti-abuse.ts';

// ── isRateLimited(countInWindow, max) ────────────────────────────────────────
// count = nº de requests en la ventana INCLUYENDO el actual (post-insert).
// Bloquea cuando count > max.

Deno.test('isRateLimited: bajo el umbral no bloquea', () => {
  assertEquals(isRateLimited(1, 10), false);
  assertEquals(isRateLimited(10, 10), false); // el 10º justo en el límite pasa
});

Deno.test('isRateLimited: sobre el umbral bloquea', () => {
  assertEquals(isRateLimited(11, 10), true);
  assertEquals(isRateLimited(50, 10), true);
});

// ── isOriginAllowed(origin, allowlist) ───────────────────────────────────────

Deno.test('isOriginAllowed: origen en la allowlist', () => {
  const allow = ['https://autoescuela.cl', 'https://conductores.cl'];
  assertEquals(isOriginAllowed('https://autoescuela.cl', allow), true);
  assertEquals(isOriginAllowed('https://conductores.cl', allow), true);
});

Deno.test('isOriginAllowed: origen fuera de la allowlist', () => {
  const allow = ['https://autoescuela.cl'];
  assertEquals(isOriginAllowed('https://evil.example', allow), false);
});

Deno.test('isOriginAllowed: Origin ausente o vacío', () => {
  const allow = ['https://autoescuela.cl'];
  assertEquals(isOriginAllowed(null, allow), false);
  assertEquals(isOriginAllowed('', allow), false);
});

Deno.test('isOriginAllowed: tolera espacios y allowlist con entradas vacías', () => {
  const allow = [' https://autoescuela.cl ', '', '  '];
  assertEquals(isOriginAllowed('https://autoescuela.cl', allow), true);
});

// ── amountsMatch(a, b) ───────────────────────────────────────────────────────

Deno.test('amountsMatch: montos iguales', () => {
  assertEquals(amountsMatch(180000, 180000), true);
});

Deno.test('amountsMatch: montos distintos', () => {
  assertEquals(amountsMatch(180000, 90000), false);
});

Deno.test('amountsMatch: caso partial redondeado (Math.ceil(base/2))', () => {
  const base = 180001;
  const partial = Math.ceil(base / 2); // 90001
  assertEquals(amountsMatch(partial, 90001), true);
  assertEquals(amountsMatch(partial, 90000), false);
});

Deno.test('amountsMatch: rechaza NaN / no finitos', () => {
  assertEquals(amountsMatch(NaN, NaN), false);
  assertEquals(amountsMatch(180000, NaN), false);
});

// ── isHoneypotTripped(value) ─────────────────────────────────────────────────
// Vacío/undefined/null = humano (false). Con valor = bot (true).

Deno.test('isHoneypotTripped: campo vacío = humano', () => {
  assertEquals(isHoneypotTripped(''), false);
  assertEquals(isHoneypotTripped('   '), false);
  assertEquals(isHoneypotTripped(undefined), false);
  assertEquals(isHoneypotTripped(null), false);
});

Deno.test('isHoneypotTripped: campo lleno = bot', () => {
  assertEquals(isHoneypotTripped('http://spam.example'), true);
  assertEquals(isHoneypotTripped('a'), true);
});
