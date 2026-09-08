/**
 * Micro-suite de card-composition.js (ARCH-25, fix-160-b).
 *
 * Uso: node scripts/lib/card-composition.test.mjs
 */

import assert from 'node:assert/strict';
import { findAdHocCardCompositions } from './card-composition.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('\ncard-composition — detecta la composición ad-hoc (las 3 capas juntas):');

test('detecta el caso real de fix-158-b (alumnos-list-content)', () => {
  const markup =
    '<div class="flex flex-col bg-base border border-border-subtle rounded-xl overflow-hidden shadow-sm bento-wide">';
  assert.equal(findAdHocCardCompositions(markup).length, 1);
});

test('detecta el caso de certificacion-clase-b-content (otro orden de clases)', () => {
  const markup = '<div class="rounded-xl border border-border-subtle bg-base p-3 flex flex-col gap-2.5">';
  assert.equal(findAdHocCardCompositions(markup).length, 1);
});

test('detecta un class que abarca varias líneas', () => {
  const markup = `<div
      class="flex flex-col bg-surface border border-border-default
             rounded-lg shadow-sm"
    >`;
  assert.equal(findAdHocCardCompositions(markup).length, 1);
});

test('cuenta cada ocurrencia por separado (skeleton + real en el mismo archivo)', () => {
  const markup =
    '<div class="bg-base border border-border-subtle rounded-xl p-4"></div>' +
    '<div class="bg-base border border-border-subtle rounded-xl overflow-hidden"></div>';
  assert.equal(findAdHocCardCompositions(markup).length, 2);
});

test('soporta comillas simples', () => {
  assert.equal(findAdHocCardCompositions("<div class='bg-base border rounded-xl'>").length, 1);
});

console.log('\ncard-composition — NO reporta lo que ya usa el DS:');

test('NO reporta si ya usa .card (aunque traiga utilities al lado)', () => {
  const markup = '<div class="card p-0 overflow-hidden flex flex-col">';
  assert.deepEqual(findAdHocCardCompositions(markup), []);
});

test('NO reporta bento-card', () => {
  assert.deepEqual(findAdHocCardCompositions('<div class="bento-card flex flex-col gap-2 h-full">'), []);
});

console.log('\ncard-composition — falsos positivos que NO debe reportar:');

test('NO reporta un avatar (radio sin fondo de superficie ni borde)', () => {
  const markup = '<div class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center">';
  assert.deepEqual(findAdHocCardCompositions(markup), []);
});

test('NO reporta un divisor (borde sin radio ni fondo)', () => {
  const markup = '<div class="p-4 border-b border-border-subtle flex flex-col gap-2">';
  assert.deepEqual(findAdHocCardCompositions(markup), []);
});

test('NO reporta un <input> aunque tenga fondo+borde+radio (era el falso positivo #1)', () => {
  // Sin anclar al tag, esta línea sola generaba ~200 falsos positivos en el repo.
  const markup =
    '<input class="w-full h-11 px-3 text-sm rounded-xl border border-border-default bg-surface text-text-primary focus:ring-2" />';
  assert.deepEqual(findAdHocCardCompositions(markup), []);
});

test('NO reporta un <textarea> con fondo+borde+radio', () => {
  const markup =
    '<textarea class="flex-1 resize-none rounded-lg border border-border-default px-3 py-2 bg-surface text-text-primary"></textarea>';
  assert.deepEqual(findAdHocCardCompositions(markup), []);
});

test('NO reporta un <button> con fondo+borde+radio', () => {
  const markup = '<button class="rounded-lg border border-border-default bg-surface px-3 py-2">Guardar</button>';
  assert.deepEqual(findAdHocCardCompositions(markup), []);
});

test('NO reporta un chip de ícono de tamaño fijo chico (w-10 h-10)', () => {
  // Falso positivo real de la primera pasada: un ícono 40×40 con marco, no una card.
  const markup =
    '<div class="w-10 h-10 rounded-xl bg-surface border border-warning-border flex items-center justify-center shadow-sm shrink-0">';
  assert.deepEqual(findAdHocCardCompositions(markup), []);
});

test('SÍ reporta una superficie grande aunque declare tamaño (w-64 h-40)', () => {
  const markup = '<div class="w-64 h-40 rounded-xl bg-base border border-border-subtle">';
  assert.equal(findAdHocCardCompositions(markup).length, 1);
});

test('NO reporta layout puro', () => {
  assert.deepEqual(findAdHocCardCompositions('<div class="flex flex-wrap gap-1.5 w-full">'), []);
});

test('contenido sin atributos class devuelve array vacío', () => {
  assert.deepEqual(findAdHocCardCompositions('const x = 1; // bg-base border rounded-xl'), []);
});

if (process.exitCode) {
  console.error(`\n❌ card-composition: hay tests en rojo.`);
} else {
  console.log(`\n✅ card-composition: ${passed} tests en verde.`);
}
