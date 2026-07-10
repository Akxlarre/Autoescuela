/**
 * class-discipline.js — Detección de indisciplina de clases del Design System.
 *
 * Tres detectores puros (Data In → Data Out, sin fs) + helpers de baseline (ratchet):
 *
 *   ARCH-15  findAdhocPills          — pill/badge ad-hoc (rounded-full + micro-texto + px-)
 *                                      en vez de <app-badge> o utilidades badge-*.
 *   ARCH-16  findButtonSizeOverrides — utilities de tamaño (px-/py-/p-, text-{size}, rounded-*)
 *                                      montadas sobre una utilidad btn-* (mutila su contrato).
 *   ARCH-17  findArbitraryTextSizes  — tamaños de fuente arbitrarios text-[NNpx] fuera de la
 *                                      escala tipográfica (--text-*).
 *
 * Ratchet: el backlog pre-existente vive en class-discipline.baseline.json.
 * El linter solo reporta REGRESIONES (archivo supera su cuota del baseline).
 * Mejoras → se re-baselinea con `npm run lint:arch -- --update-ds-baseline`.
 *
 * Micro-suite: `node scripts/lib/class-discipline.test.mjs`
 */

// ── Extracción de atributos class estáticos ──────────────────────────────────
// Cubre class="..." en templates .html y en templates inline de .ts.
// Los bindings dinámicos ([class]="expr") no se analizan (v1, igual que ARCH-14).
const CLASS_ATTR_RE = /\bclass\s*=\s*"([^"]*)"/g;

export function extractClassAttributes(content) {
  const out = [];
  let m;
  CLASS_ATTR_RE.lastIndex = 0;
  while ((m = CLASS_ATTR_RE.exec(content)) !== null) {
    if (m[1].trim().length > 0) out.push(m[1]);
  }
  return out;
}

// ── ARCH-15: pills/badges ad-hoc ─────────────────────────────────────────────
// Heurística: rounded-full + tamaño micro de texto + padding horizontal.
// Exige px- para NO marcar avatares/dots (círculos w-N h-N con iniciales).
const MICRO_TEXT_RE = /(?:^|\s)(?:[\w-]+:)?text-(?:xs|2xs|\[1[0-3](?:\.\d+)?px\])(?=\s|$|\/)/;
const ROUNDED_FULL_RE = /(?:^|\s)(?:[\w-]+:)?rounded-full(?=\s|$)/;
const PX_PAD_RE = /(?:^|\s)(?:[\w-]+:)?px-(?:\d|\[)/;
const FIXED_CIRCLE_RE = /(?:^|\s)w-(?:\d|\[)[^\s]*/;

/** Archivos que SON el componente badge canónico — exentos de ARCH-15. */
export const PILL_WHITELIST_SEGMENTS = [
  'components/badge/',
  'components/task-status-badge/',
];

export function isPillWhitelisted(relPath) {
  const p = relPath.replace(/\\/g, '/');
  return PILL_WHITELIST_SEGMENTS.some((seg) => p.includes(seg));
}

export function findAdhocPills(content) {
  const hits = [];
  for (const attr of extractClassAttributes(content)) {
    if (!ROUNDED_FULL_RE.test(attr)) continue;
    if (!MICRO_TEXT_RE.test(attr)) continue;
    if (!PX_PAD_RE.test(attr)) continue;
    // Círculo de tamaño fijo con padding raro: igual lo dejamos pasar solo si
    // tiene w- Y h- (avatar/dot), que no es un pill de contenido.
    if (FIXED_CIRCLE_RE.test(attr) && /(?:^|\s)h-(?:\d|\[)/.test(attr)) continue;
    hits.push(attr.trim().slice(0, 90));
  }
  return hits;
}

// ── ARCH-16: utilities de tamaño sobre btn-* ─────────────────────────────────
const BTN_UTILITY_RE =
  /(?:^|\s)btn-(?:primary|secondary|ghost|outline|neutral|danger-ghost|danger-solid|warning-soft|success-soft)(?=\s|$)/;
// Solo lo que mutila el contrato interno del botón: padding, tamaño de fuente y radio.
// Layout (w-, h-, flex, gap-, shrink-0, justify-*) está permitido por architecture.md.
const BTN_OVERRIDE_RE =
  /(?:^|\s)((?:[\w-]+:)?(?:p[xy]?-(?:\d|\[)[^\s]*|text-(?:xs|sm|base|lg|xl|\dxl|\[\d[^\s\]]*\])|rounded(?:-[\w[\]]+)?))(?=\s|$)/g;

export function findButtonSizeOverrides(content) {
  const hits = [];
  for (const attr of extractClassAttributes(content)) {
    if (!BTN_UTILITY_RE.test(attr)) continue;
    const offenders = [];
    let m;
    BTN_OVERRIDE_RE.lastIndex = 0;
    while ((m = BTN_OVERRIDE_RE.exec(attr)) !== null) offenders.push(m[1]);
    if (offenders.length > 0) {
      hits.push({ attr: attr.trim().slice(0, 90), offenders });
    }
  }
  return hits;
}

// ── ARCH-17: tamaños de fuente arbitrarios ───────────────────────────────────
const ARBITRARY_TEXT_RE = /(?:^|\s)(?:[\w-]+:)?(text-\[\d+(?:\.\d+)?px\])(?=\s|$|\/)/g;

export function findArbitraryTextSizes(content) {
  const hits = [];
  for (const attr of extractClassAttributes(content)) {
    let m;
    ARBITRARY_TEXT_RE.lastIndex = 0;
    while ((m = ARBITRARY_TEXT_RE.exec(attr)) !== null) hits.push(m[1]);
  }
  return hits;
}

// ── Ratchet / baseline ───────────────────────────────────────────────────────
// Shape: { generatedAt, rules: { 'ARCH-15': { total, files: { relPath: n } }, ... } }

export const DS_RULES = ['ARCH-15', 'ARCH-16', 'ARCH-17'];

export function buildBaseline(countsByRule) {
  const rules = {};
  for (const rule of DS_RULES) {
    const files = {};
    let total = 0;
    const map = countsByRule[rule] || new Map();
    for (const [file, info] of [...map.entries()].sort()) {
      files[file] = info.count;
      total += info.count;
    }
    rules[rule] = { total, files };
  }
  return { generatedAt: new Date().toISOString(), rules };
}

/**
 * Compara conteos actuales contra el baseline.
 * Regresión = un archivo supera su cuota (o aparece nuevo con violaciones).
 */
export function compareWithBaseline(countsByRule, baseline) {
  const regressions = [];
  let currentTotal = 0;
  let baselineTotal = 0;
  for (const rule of DS_RULES) {
    const base = baseline?.rules?.[rule] || { total: 0, files: {} };
    baselineTotal += base.total;
    const map = countsByRule[rule] || new Map();
    for (const [file, info] of map.entries()) {
      currentTotal += info.count;
      const allowed = base.files[file] || 0;
      if (info.count > allowed) {
        regressions.push({
          rule,
          file,
          was: allowed,
          now: info.count,
          sample: info.sample,
        });
      }
    }
  }
  return { regressions, currentTotal, baselineTotal, improved: currentTotal < baselineTotal };
}
