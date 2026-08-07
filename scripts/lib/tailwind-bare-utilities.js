/**
 * tailwind-bare-utilities.js — ARCH-22: colisión de nombre con utilidad "bare" de Tailwind.
 *
 * Caso real que motivó esta regla (fix-115-b): el DS definía `.overline` como micro-label
 * tipográfico. Tailwind CSS v4 escanea el contenido (`@source`) y, al ver el literal
 * `"overline"` como class en 141 lugares, generaba su PROPIA regla dentro de
 * `@layer utilities` — `overline` es también una utilidad nativa de Tailwind
 * (`text-decoration-line: overline`, familia `underline`/`overline`/`line-through`).
 * Como esa regla y la del DS no comparten ninguna propiedad CSS, ambas se aplicaban a la
 * vez: el texto quedaba con el estilo correcto de micro-label Y ADEMÁS con una línea física
 * dibujada encima. Renombrado a `.micro-label` (fix-115-b).
 *
 * Esta regla evita que el próximo nombre de clase del DS repita el mismo error: falla si
 * una clase definida en un archivo de `src/styles/` coincide EXACTAMENTE con una utilidad
 * "bare" (sin sufijo de valor) reservada de Tailwind. Nombres compuestos con guion
 * (`.item-title`, `.card-tinted`) no chocan por construcción — las utilidades bare de
 * Tailwind son casi siempre una sola palabra inglesa suelta.
 *
 * Micro-suite: `node scripts/lib/tailwind-bare-utilities.test.mjs`
 * Standalone (sin esperar el wiring en architect.js — protegido, ver architect-js-patch.md):
 *   `node scripts/lib/tailwind-bare-utilities.js`
 */

// ── Utilidades "bare" reservadas de Tailwind (sin sufijo de valor) ───────────
// Lista curada, no exhaustiva — cubre las utilidades de una sola palabra con más
// probabilidad de coincidir con un nombre de clase semántico del DS. Si aparece una
// colisión nueva con una utilidad no listada acá, sumala (mismo espíritu que el
// allowlist de bento-classes.js: se extiende cuando se descubre un caso real).
export const TAILWIND_BARE_UTILITIES = [
  // display
  'block',
  'inline-block',
  'inline',
  'flex',
  'inline-flex',
  'table',
  'inline-table',
  'flow-root',
  'grid',
  'inline-grid',
  'contents',
  'list-item',
  'hidden',
  // position
  'static',
  'fixed',
  'absolute',
  'relative',
  'sticky',
  // visibility / isolation
  'visible',
  'invisible',
  'collapse',
  'isolate',
  // flex sizing
  'grow',
  'shrink',
  // box sizing
  'border',
  'box-border',
  'box-content',
  // typography (decoración / transformación / estilo)
  'italic',
  'uppercase',
  'lowercase',
  'capitalize',
  'underline',
  'overline',
  'truncate',
  'antialiased',
  // efectos
  'rounded',
  'shadow',
  'ring',
  'outline',
  // motion / interacción
  'transition',
  'resize',
  // misc
  'container',
  'group',
  'peer',
  'sr-only',
];

// ── Extracción de nombres de clase DEFINIDOS (selectores, no usos) ───────────
// Solo selectores de nivel superior escritos como `.nombre {` o `.nombre,` al
// inicio de línea — el mismo nivel de heurística que extractBentoClasses (simple,
// suficiente para archivos del DS que no anidan selectores con `&`).
const CLASS_SELECTOR_RE = /^[ \t]*\.([a-zA-Z][\w-]*)[ \t]*[,{]/gm;

export function extractDefinedClassNames(scssContent) {
  const out = new Set();
  let m;
  CLASS_SELECTOR_RE.lastIndex = 0;
  while ((m = CLASS_SELECTOR_RE.exec(scssContent)) !== null) {
    out.add(m[1]);
  }
  return out;
}

/**
 * @param {string} scssContent
 * @param {string[]} [reserved] — override para tests; por defecto TAILWIND_BARE_UTILITIES.
 * @returns {string[]} nombres de clase definidos que colisionan, ordenados.
 */
export function findReservedTailwindClassCollisions(scssContent, reserved = TAILWIND_BARE_UTILITIES) {
  const defined = extractDefinedClassNames(scssContent);
  const reservedSet = new Set(reserved);
  return [...defined].filter((name) => reservedSet.has(name)).sort();
}

// ── CLI standalone (no depende del wiring en architect.js) ───────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const scssPath = join(__dirname, '..', '..', 'src', 'styles', 'tokens', '_variables.scss');
  const content = readFileSync(scssPath, 'utf8');
  const collisions = findReservedTailwindClassCollisions(content);

  if (collisions.length > 0) {
    console.error('🚨 Clases del DS que colisionan con una utilidad bare de Tailwind:');
    collisions.forEach((c) => console.error(`   .${c}`));
    console.error(
      '\nRenombrá la clase a un nombre compuesto (ej. .micro-label en vez de .overline, fix-115-b).',
    );
    process.exitCode = 1;
  } else {
    console.log('✅ tailwind-bare-utilities: sin colisiones en _variables.scss.');
  }
}
