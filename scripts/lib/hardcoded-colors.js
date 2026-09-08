/**
 * hardcoded-colors.js — ARCH-08: colores hardcodeados en vez de tokens semánticos.
 *
 * Caso real que motivó ampliar esta regla (fix-160-b): en `flota-list-content` la patente
 * del vehículo se pintaba con `bg-white` hardcodeado. En modo oscuro el fondo quedaba en
 * `rgb(255,255,255)` y el texto heredaba `rgb(244,244,245)` del tema → contraste 1.05:1,
 * la patente literalmente invisible. `npm run lint:arch` daba exit 0 igual.
 *
 * ¿Por qué pasaba? La regla vivía como una regex que sólo matcheaba colores de PALETA con
 * número (`text-red-500`, `bg-blue-200`):
 *
 *     /(?:text|bg|border|...)-(?:red|blue|green|...)-\d{2,3}/
 *
 * `bg-white` no tiene sufijo numérico y `bg-[#ff0000]` no tiene nombre de paleta, así que
 * ninguno de los dos matcheaba — aun cuando `visual-system.md` nombra explícitamente
 * `bg-[#ff0000]` como prohibido. La regla estaba escrita en la prosa y sólo a medias en el
 * guard; el pedazo no enforceado se erosionó. Mismo mecanismo que produjo las 221 instancias
 * ad-hoc de overline (ver `.claude/rules/visual-system.md`).
 *
 * Criterio de aplicabilidad: esto NO es "una regex más larga". Es un caso de **regla que
 * vive en dos lugares y se contradice en silencio**. La implementación estaba duplicada
 * literalmente dos veces en `architect.js` (una para `.ts`, otra para `.html`), así que
 * ampliarla a mano significaba acertarle a las dos copias. Vive acá una sola vez.
 *
 * Micro-suite: `node scripts/lib/hardcoded-colors.test.mjs`
 * Standalone (sin esperar el wiring en architect.js — protegido):
 *   `node scripts/lib/hardcoded-colors.js`
 */

// ── Prefijos de utilidad que aceptan color ──────────────────────────────────
const COLOR_PREFIXES = 'text|bg|border|ring|from|to|via|fill|stroke|decoration|outline|shadow|accent|caret|divide|placeholder';

// Familias de paleta de Tailwind (las que traen sufijo numérico).
const PALETTE_FAMILIES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';

/**
 * Colores de paleta con número: `text-red-500`, `bg-blue-200`, `border-zinc-700`.
 * (Lo que la regla ya cubría antes de fix-160-b.)
 */
const PALETTE_RE = new RegExp(`(?:${COLOR_PREFIXES})-(?:${PALETTE_FAMILIES})-\\d{2,3}`, 'g');

/**
 * Colores absolutos OPACOS sin sufijo numérico: `bg-white`, `text-black`.
 *
 * El `(?!/)` es la parte importante, no un detalle: **con modificador de alpha
 * (`bg-black/50`, `bg-black/40`) NO es una violación.** Un velo negro translúcido es un
 * scrim de overlay — oscurece lo que tiene detrás y se comporta igual en claro y en oscuro,
 * que es exactamente para lo que se usa en `layout-drawer` y en los drawers modales. El que
 * rompe el tema es el OPACO: tapa el fondo con un color fijo y deja el texto heredado del
 * tema encima (el bug de la patente en Flota: `bg-white` + texto `rgb(244,244,245)`).
 *
 * `transparent` y `current` tampoco se listan: son neutros respecto del tema por definición.
 */
const ABSOLUTE_RE = new RegExp(`(?:${COLOR_PREFIXES})-(?:white|black)\\b(?!/)`, 'g');

/**
 * Valor arbitrario de color: `bg-[#ff0000]`, `text-[rgb(0,0,0)]`, `border-[hsl(...)]`.
 * Sólo matchea cuando el contenido del corchete ES un color — `w-[42px]` o
 * `grid-cols-[1fr_auto]` no son colores y no deben caer acá.
 */
const ARBITRARY_RE = new RegExp(
  `(?:${COLOR_PREFIXES})-\\[(?:#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\\([^\\]]*\\))\\]`,
  'g',
);

const ALL_RULES = [PALETTE_RE, ABSOLUTE_RE, ARBITRARY_RE];

/**
 * Un atributo `class` que además trae `opacity-N` usa el blanco/negro como VELO, no como
 * superficie — mismo caso que `bg-black/50`, sólo que con la opacidad escrita aparte
 * (`opacity-10 bg-white` en daily-schedule-timeline es un orb decorativo). Se evalúa por
 * atributo, no por archivo: un `bg-white` opaco en otra línea del mismo archivo sigue siendo
 * violación.
 */
const CLASS_ATTR_RE = /class\s*=\s*(["'])([\s\S]*?)\1/g;
const HAS_OPACITY_RE = /(?:^|\s)opacity-\d{1,3}(?:\s|$)/;

function stripVeiledAttributes(content) {
  return content.replace(CLASS_ATTR_RE, (full, _q, classes) =>
    HAS_OPACITY_RE.test(` ${classes.replace(/\s+/g, ' ').trim()} `) ? '' : full,
  );
}

function matchAll(content, regexes) {
  const found = new Set();
  for (const re of regexes) {
    re.lastIndex = 0;
    const matches = content.match(re);
    if (matches) matches.forEach((m) => found.add(m));
  }
  return [...found].sort();
}

/**
 * Colores de PALETA (`text-red-500`). Nunca son correctos: hay un token para cada uno.
 * Error duro — el repo ya está en cero acá.
 */
export function findHardcodedPaletteColors(content) {
  return matchAll(content, [PALETTE_RE]);
}

/**
 * Colores ABSOLUTOS opacos (`bg-white`, `text-black`) y hex arbitrario (`bg-[#hex]`).
 *
 * Van al ratchet, NO a error duro. Al ampliar la regla aparecieron 27 casos y al revisarlos
 * uno por uno la mayoría era legítima: el blanco de un `<iframe>` de PDF es el papel, la
 * perilla de un toggle es blanca por convención, y un velo con `opacity-10` no es una
 * superficie. Sólo 1 de 5 `bg-white` era el bug real (la patente en Flota).
 *
 * Convertirlos a error duro dejaba `lint:arch` en rojo con hallazgos mayormente correctos —
 * que es cómo un guardrail se vuelve ruido y el equipo aprende a ignorarlo. Con ratchet la
 * cuota arranca en lo que hay y sólo puede bajar.
 */
export function findHardcodedAbsoluteColors(content) {
  return matchAll(stripVeiledAttributes(content), [ABSOLUTE_RE, ARBITRARY_RE]);
}

/** Todos juntos — para el modo CLI y para tests. */
export function findHardcodedColors(content) {
  return [
    ...new Set([...findHardcodedPaletteColors(content), ...findHardcodedAbsoluteColors(content)]),
  ].sort();
}

/** Mensaje de fix compartido por las dos rutas (ts/html) — antes estaba duplicado. */
export const HARDCODED_COLOR_FIX =
  'Usa tokens semánticos: text-text-primary, text-text-muted, bg-surface, bg-base, ' +
  'var(--ds-brand). Para blanco sobre marca usa var(--color-primary-text) (surface-hero), ' +
  'no bg-white/text-white — se rompen en modo oscuro.';

// ── CLI standalone (no depende del wiring en architect.js) ───────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative } from 'node:path';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      walk(full, out);
    } else if (/\.(ts|html)$/.test(entry) && !entry.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(__dirname, '..', '..');
  const srcApp = join(repoRoot, 'src', 'app');

  let total = 0;
  const offenders = [];
  for (const file of walk(srcApp)) {
    const hits = findHardcodedColors(readFileSync(file, 'utf8'));
    if (hits.length > 0) {
      offenders.push({ file: relative(repoRoot, file), hits });
      total += hits.length;
    }
  }

  if (total > 0) {
    console.error(`🚨 ARCH-08 — ${total} color(es) hardcodeado(s) en ${offenders.length} archivo(s):\n`);
    for (const { file, hits } of offenders) {
      console.error(`   ${file}`);
      console.error(`      ${hits.join(', ')}`);
    }
    console.error(`\n${HARDCODED_COLOR_FIX}`);
    process.exitCode = 1;
  } else {
    console.log('✅ hardcoded-colors: sin colores hardcodeados en src/app.');
  }
}
