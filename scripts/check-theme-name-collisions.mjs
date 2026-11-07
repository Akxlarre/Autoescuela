#!/usr/bin/env node
/**
 * check-theme-name-collisions.mjs — Runner de ARCH-29 (color del @theme con nombre de tamaño).
 *
 * La detección vive en scripts/lib/theme-name-collisions.js; acá solo se lee el disco.
 *   1. Un color nuevo del @theme cuyo nombre ya es un tamaño de letra o de sombra → error.
 *   2. Un uso de la clase ambigua en src/ (incluidas las colisiones aceptadas) → error.
 *
 * Error duro, sin línea base: arranca en cero usos.
 *   node scripts/check-theme-name-collisions.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ACCEPTED_COLLISIONS,
  COLLISION_FIX,
  findCollidingClassUsages,
  findThemeCollisions,
} from './lib/theme-name-collisions.js';

const RULE = 'ARCH-29';
const ROOT = process.cwd();
const TAILWIND_CSS = path.join(ROOT, 'src', 'tailwind.css');
const DEFAULT_THEME_CSS = path.join(ROOT, 'node_modules', 'tailwindcss', 'theme.css');
const SCAN_DIR = path.join(ROOT, 'src');
const EXTENSIONS = ['.ts', '.html', '.scss', '.css'];

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.some((ext) => full.endsWith(ext))) out.push(full);
  }
  return out;
}

const projectCss = read(TAILWIND_CSS);
if (projectCss === null) {
  // fail-open: si no está el archivo, otro check ya lo habrá señalado
  console.log(`ℹ ${RULE}: no se encontró src/tailwind.css, se omite.`);
  process.exit(0);
}

let errors = 0;
const fail = (file, message, hint) => {
  errors++;
  console.error(red(`❌ [${RULE}] ${file}`));
  console.error(`   ${message}`);
  if (hint) console.error(`   → ${hint}`);
};

// ── 1. El @theme mismo ───────────────────────────────────────────────────────
const collisions = findThemeCollisions(projectCss, read(DEFAULT_THEME_CSS) ?? '');
for (const c of collisions) {
  if (ACCEPTED_COLLISIONS[c.cls]) continue;
  fail(
    'src/tailwind.css',
    `--color-${c.name} tiene el mismo nombre que un/a ${c.what}: Tailwind genera ${c.cls} como una sola cosa y descarta la otra.`,
    `Elegí otro nombre para el color (p. ej. --color-${c.name}-surface). No se puede tener ${c.cls} con color y ${c.what} a la vez.`,
  );
}

// ── 2. Usos de la clase ambigua ──────────────────────────────────────────────
const banned = collisions.map((c) => c.cls);
for (const full of walk(SCAN_DIR)) {
  const rel = path.relative(ROOT, full).replace(/\\/g, '/');
  for (const u of findCollidingClassUsages(fs.readFileSync(full, 'utf8'), banned)) {
    fail(
      `${rel}:${u.line}`,
      `'${u.sample}' es ambigua: acá ${u.cls} pinta el texto con un color del @theme (no fija tamaño).`,
      COLLISION_FIX[u.cls] ?? `Usá otra clase: ${u.cls} no hace lo que su nombre dice en este proyecto.`,
    );
  }
}

if (errors > 0) {
  console.error(red(`\n❌ ${RULE}: ${errors} error(es). Ver .claude/rules/visual-system.md (§Tokens de color).`));
  process.exit(1);
}
console.log(green(`✅ ${RULE}: sin clases ambiguas entre color y tamaño (prohibidas: ${banned.join(', ') || 'ninguna'}).`));
