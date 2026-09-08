/**
 * Micro-suite de hardcoded-colors.js (ARCH-08 ampliada, fix-160-b).
 *
 * Uso: node scripts/lib/hardcoded-colors.test.mjs
 */

import assert from 'node:assert/strict';
import {
  findHardcodedColors,
  findHardcodedPaletteColors,
  findHardcodedAbsoluteColors,
} from './hardcoded-colors.js';

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

console.log('\nhardcoded-colors — lo que la regla YA cubría (no debe regresionar):');

test('detecta color de paleta con número (text-red-500)', () => {
  assert.deepEqual(findHardcodedColors('<p class="text-red-500">hola</p>'), ['text-red-500']);
});

test('detecta varias familias y prefijos', () => {
  const hits = findHardcodedColors('class="bg-blue-200 border-zinc-700 from-emerald-50"');
  assert.deepEqual(hits, ['bg-blue-200', 'border-zinc-700', 'from-emerald-50']);
});

console.log('\nhardcoded-colors — el hueco que cerró fix-160-b:');

test('detecta bg-white (el bug real de flota-list-content)', () => {
  const markup = '<span class="font-mono font-bold bg-white px-2 py-1 rounded text-xs">RTRE29</span>';
  assert.deepEqual(findHardcodedColors(markup), ['bg-white']);
});

test('detecta text-black y text-white', () => {
  const hits = findHardcodedColors('class="text-black"; class="text-white"');
  assert.deepEqual(hits, ['text-black', 'text-white']);
});

test('detecta hex arbitrario (bg-[#ff0000], el que visual-system.md nombra)', () => {
  assert.deepEqual(findHardcodedColors('class="bg-[#ff0000]"'), ['bg-[#ff0000]']);
});

test('detecta hex de 3 y de 8 dígitos', () => {
  const hits = findHardcodedColors('class="text-[#fff] border-[#11223344]"');
  assert.deepEqual(hits, ['border-[#11223344]', 'text-[#fff]']);
});

test('detecta funciones de color arbitrarias (rgb/rgba/hsl)', () => {
  const hits = findHardcodedColors('class="bg-[rgb(0,0,0)] text-[hsl(210,50%,50%)]"');
  assert.deepEqual(hits, ['bg-[rgb(0,0,0)]', 'text-[hsl(210,50%,50%)]']);
});

console.log('\nhardcoded-colors — falsos positivos que NO debe reportar:');

test('NO reporta tokens semánticos del DS', () => {
  const markup = 'class="text-text-primary bg-surface border-border-subtle text-text-muted bg-base"';
  assert.deepEqual(findHardcodedColors(markup), []);
});

test('NO reporta valores arbitrarios que no son color', () => {
  const markup = 'class="w-[42px] grid-cols-[1fr_auto] min-h-[calc(100vh-4rem)]"';
  assert.deepEqual(findHardcodedColors(markup), []);
});

test('NO reporta transparent ni current (neutros respecto del tema)', () => {
  assert.deepEqual(findHardcodedColors('class="bg-transparent text-current border-transparent"'), []);
});

test('NO reporta scrims con alpha (bg-black/50) — velo translúcido, no rompe el tema', () => {
  // layout-drawer.component.ts y los drawers modales usan esto legítimamente.
  assert.deepEqual(findHardcodedColors('class="fixed inset-0 bg-black/50"'), []);
  assert.deepEqual(findHardcodedColors('class="bg-black/40 backdrop-blur-sm"'), []);
});

test('SÍ reporta el opaco aunque en el mismo archivo haya un scrim válido', () => {
  const markup = '<div class="bg-black/50"></div><span class="bg-white">RTRE29</span>';
  assert.deepEqual(findHardcodedColors(markup), ['bg-white']);
});

test('NO reporta una palabra que apenas CONTIENE white/black', () => {
  // `bg-whitesmoke` no es una utilidad de Tailwind, pero el \b evita el match parcial
  // de `bg-white` dentro de ella — si alguien define algo así, no es este error.
  assert.deepEqual(findHardcodedColors('class="bg-whitesmoke"'), []);
});

test('NO reporta bg-brand-muted ni clases compuestas del DS', () => {
  assert.deepEqual(findHardcodedColors('class="bg-brand-muted text-brand bg-elevated"'), []);
});

console.log('\nhardcoded-colors — deduplicación y orden:');

test('deduplica ocurrencias repetidas y ordena', () => {
  const markup = 'bg-white ... bg-white ... text-red-500 ... bg-white';
  assert.deepEqual(findHardcodedColors(markup), ['bg-white', 'text-red-500']);
});

test('contenido limpio devuelve array vacío', () => {
  assert.deepEqual(findHardcodedColors('<div class="card p-4"><span class="micro-label">RUT</span></div>'), []);
});

console.log('\nhardcoded-colors — separación error duro vs ratchet (fix-160-b, 2ª pasada):');

test('paleta va a error duro, absolutos NO', () => {
  const markup = 'class="text-red-500 bg-white"';
  assert.deepEqual(findHardcodedPaletteColors(markup), ['text-red-500']);
  assert.deepEqual(findHardcodedAbsoluteColors(markup), ['bg-white']);
});

test('velo con opacity-N no cuenta como superficie (orb decorativo real)', () => {
  // daily-schedule-timeline: <div class="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 bg-white">
  const markup = '<div class="absolute w-24 h-24 rounded-full opacity-10 bg-white"></div>';
  assert.deepEqual(findHardcodedAbsoluteColors(markup), []);
});

test('el velo se evalúa por atributo, no por archivo', () => {
  // Un bg-white opaco en OTRA línea del mismo archivo sigue siendo violación.
  const markup =
    '<div class="opacity-10 bg-white"></div>\n<span class="bg-white px-2">RTRE29</span>';
  assert.deepEqual(findHardcodedAbsoluteColors(markup), ['bg-white']);
});

test('findHardcodedColors sigue devolviendo la unión de ambos', () => {
  assert.deepEqual(findHardcodedColors('class="text-red-500 bg-white"'), ['bg-white', 'text-red-500']);
});

if (process.exitCode) {
  console.error(`\n❌ hardcoded-colors: hay tests en rojo.`);
} else {
  console.log(`\n✅ hardcoded-colors: ${passed} tests en verde.`);
}
