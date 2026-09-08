/**
 * card-composition.js — ARCH-25: card compuesta a mano en vez de la clase `.card` del DS.
 *
 * Caso real que motivó esta regla (fix-158-b → fix-160-b): la card de alumno en la vista
 * comprimida se armaba con
 *
 *     class="flex flex-col bg-base border border-border-subtle rounded-xl overflow-hidden shadow-sm"
 *
 * en vez de `.card`, que ya define exactamente eso vía tokens (`--card-bg`, `--card-border`,
 * `--card-radius`, `--card-shadow`, `--card-padding`). Ese mismo bloque estaba copiado en 4
 * archivos, cada uno derivando por su lado. Al auditarlo aparecieron 20 ocurrencias en 14
 * archivos, y adentro de una de ellas un bug real de contraste en modo oscuro.
 *
 * `visual-system.md` y `architecture.md` (§Clases Semánticas vs Tailwind Genérico) ya decían
 * "usá `.card`", pero **ningún guard lo verificaba** — la regla vivía sólo en la prosa. Este
 * módulo es la mitad que faltaba.
 *
 * ── Qué cuenta como violación ────────────────────────────────────────────────
 * La firma de una card es la coincidencia de las TRES capas de superficie en el mismo
 * atributo `class`: **fondo + borde + radio**. Buscar sólo una de ellas daría falsos
 * positivos por todos lados (`rounded-full` en un avatar, `border` en un divisor); exigir
 * las tres es lo que distingue "estoy dibujando una superficie de card" de "estoy usando
 * utilities de layout".
 *
 * ── Por qué ratchet y no error duro ──────────────────────────────────────────
 * Hay ocurrencias pre-existentes. Un error duro dejaría `lint:arch` en rojo desde el minuto
 * cero y el equipo aprendería a ignorarlo — el modo exacto en que un guardrail se vuelve
 * ruido. Con ratchet (mismo patrón que ARCH-16/ARCH-19) la cuota arranca en el conteo actual
 * y sólo puede bajar: lo que ya está no bloquea, lo nuevo sí.
 *
 * Micro-suite: `node scripts/lib/card-composition.test.mjs`
 * Standalone (sin esperar el wiring en architect.js — protegido):
 *   `node scripts/lib/card-composition.js`
 */

/**
 * Tag contenedor + su atributo `class`.
 *
 * Anclar al TAG (y no sólo al `class=`) no es cosmético: sin esto la regla reportaba 227
 * ocurrencias y la enorme mayoría eran `<input>` y `<textarea>` — un control de formulario
 * también tiene fondo + borde + radio, así que las tres capas por sí solas no distinguen
 * "superficie de card" de "campo de texto". Un guard con 227 hits mayormente falsos es peor
 * que no tener guard: enseña al equipo a ignorarlo.
 *
 * Una card es un contenedor. `input`/`textarea`/`select`/`button` quedan fuera por
 * construcción, no por olfatear clases.
 */
const CONTAINER_TAGS = 'div|section|article|li|aside|header|footer|main|nav';
const CLASS_ATTR_RE = new RegExp(
  `<(?:${CONTAINER_TAGS})\\b[^>]*?class\\s*=\\s*(["'])([\\s\\S]*?)\\1`,
  'g',
);

// Las tres capas que juntas dibujan una superficie de card.
const BG_RE = /(?:^|\s)bg-(?:base|surface|surface-elevated|elevated|subtle|white)(?:\s|$)/;
const BORDER_RE = /(?:^|\s)border(?:-[a-z]+)?(?:\s|$)/;
const RADIUS_RE = /(?:^|\s)rounded-(?:md|lg|xl|2xl|3xl)(?:\s|$)/;

/** Ya usa la clase del DS — no es una composición ad-hoc aunque traiga utilities al lado. */
const HAS_CARD_CLASS_RE = /(?:^|\s)(?:card|bento-card)(?:\s|$)/;

/**
 * Caja chica de tamaño FIJO: chip de ícono, avatar cuadrado, contador.
 *
 * `w-10 h-10 rounded-xl bg-surface border border-warning-border` es un ícono de 40×40 con
 * marco, no una card — apareció como falso positivo en la primera pasada. Una card nunca
 * declara alto y ancho fijos chicos: crece con su contenido o llena su celda del grid.
 * El corte en 16 es la escala de Tailwind (w-16 = 64px); por encima de eso ya puede ser
 * una superficie real y se evalúa normal.
 */
const FIXED_SMALL_BOX_RE = /(?:^|\s)w-(\d{1,2})(?:\s|$)/;
const FIXED_SMALL_H_RE = /(?:^|\s)h-(\d{1,2})(?:\s|$)/;

function isFixedSmallBox(classes) {
  const w = classes.match(FIXED_SMALL_BOX_RE);
  const h = classes.match(FIXED_SMALL_H_RE);
  if (!w || !h) return false;
  return Number(w[1]) <= 16 && Number(h[1]) <= 16;
}

/**
 * Encuentra composiciones ad-hoc de card en el contenido de un componente/template.
 *
 * @param {string} content — contenido del `.ts` (template inline) o `.html`.
 * @returns {string[]} el valor de cada atributo `class` infractor, normalizado a una línea.
 */
export function findAdHocCardCompositions(content) {
  const out = [];
  CLASS_ATTR_RE.lastIndex = 0;
  let m;
  while ((m = CLASS_ATTR_RE.exec(content)) !== null) {
    const raw = m[2];
    const classes = ` ${raw.replace(/\s+/g, ' ').trim()} `;

    if (HAS_CARD_CLASS_RE.test(classes)) continue;
    if (isFixedSmallBox(classes)) continue;
    if (!BG_RE.test(classes) || !BORDER_RE.test(classes) || !RADIUS_RE.test(classes)) continue;

    out.push(classes.trim());
  }
  return out;
}

export const CARD_COMPOSITION_FIX =
  'Usá la clase `.card` del DS en vez de recomponer fondo+borde+radio a mano ' +
  '(`bg-base border border-border-subtle rounded-xl`). `.card` ya resuelve eso con tokens ' +
  '(--card-bg/--card-border/--card-radius/--card-shadow). Si necesitás secciones internas ' +
  'con su propio padding, `card p-0 overflow-hidden` es el precedente (alumno-card, fix-158-b).';

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
    const hits = findAdHocCardCompositions(readFileSync(file, 'utf8'));
    if (hits.length > 0) {
      offenders.push({ file: relative(repoRoot, file), hits });
      total += hits.length;
    }
  }

  console.log(`ARCH-25 — ${total} composición(es) ad-hoc de card en ${offenders.length} archivo(s):\n`);
  for (const { file, hits } of offenders) {
    console.log(`   ${file}  (${hits.length})`);
    hits.forEach((h) => console.log(`      ${h.length > 110 ? h.slice(0, 110) + '…' : h}`));
  }
  console.log(`\nCuota sugerida para el ratchet inicial: ${total}`);
  console.log(`\n${CARD_COMPOSITION_FIX}`);
}
