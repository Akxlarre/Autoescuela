/**
 * pattern-guards.js — Detección de ARCH-39, ARCH-40 y ARCH-41: tres patrones de src/app que
 * vivían solo en la prosa de .claude/rules.
 *
 *   ARCH-39  Facade que filtra por sede sin guard de orden de respuestas  (facades.md §7)
 *   ARCH-40  Facade con initialize() sin las dos piezas de SWR            (swr-pattern.md)
 *   ARCH-41  Página con .bento-grid sin modificador app-like             (visual-system.md)
 *
 * Funciones puras: reciben texto y devuelven datos. El disco lo lee check-qa-guardrails.mjs.
 *
 * Las tres detectan por PRESENCIA de un identificador, no por uso correcto: es la mitad barata
 * del chequeo. Un Facade que crea el guard y nunca llama a isCurrent() pasa.
 */

/** Quita comentarios de bloque y de línea: un identificador nombrado en un comentario no cuenta. */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

// ── ARCH-39 ─────────────────────────────────────────────────────────────────────────────────

/** El Facade lee la sede activa (es branch-scoped) y no crea ningún guard de orden. */
export function isBranchScopedWithoutGuard(source) {
  const code = stripComments(source);
  return /\bselectedBranchId\(\)/.test(code) && !/\bcreateRequestGuard\(/.test(code);
}

// ── ARCH-40 ─────────────────────────────────────────────────────────────────────────────────

const INITIALIZE_RE = /^[ \t]*(?:public[ \t]+)?(?:async[ \t]+)?initialize\(/m;
export const SWR_PIECES = ['_initialized', 'refreshSilently'];

/**
 * Piezas de SWR que le faltan a un Facade con initialize(). [] si no tiene initialize() o si
 * tiene las dos.
 */
export function swrGaps(source) {
  const code = stripComments(source);
  if (!INITIALIZE_RE.test(code)) return [];
  return SWR_PIECES.filter((piece) => !new RegExp(`\\b${piece}\\b`).test(code));
}

// ── ARCH-41 ─────────────────────────────────────────────────────────────────────────────────

const GRID_CLASS_RE = /class="[^"]*\bbento-grid(?![-\w])[^"]*"/g;

/** El archivo declara una grilla bento y ninguna lleva un modificador de pantalla completa. */
export function hasGridWithoutFillScreen(source) {
  const grids = stripComments(source).match(GRID_CLASS_RE) ?? [];
  return grids.length > 0 && !grids.some((cls) => /\bbento-grid--fill-screen/.test(cls));
}

/**
 * Nombres con que el registro de app-like puede citar un componente: su archivo sin sufijo y su
 * clase. 'features/x/mi-pagina.component.html' → ['mi-pagina', 'MiPaginaComponent'].
 */
export function componentNames(file) {
  const base = file
    .split('/')
    .pop()
    .replace(/\.component\.(?:ts|html)$/, '');
  const pascal = base.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
  return [base, `${pascal}Component`];
}

/** El registro (indices/APP-LIKE-ROLLOUT.md) nombra al componente. */
export function isInRegistry(file, registryText) {
  return componentNames(file).some((name) =>
    new RegExp(`(^|[^\\w-])${name}(?![\\w-])`).test(registryText),
  );
}

// ── Deuda conocida ──────────────────────────────────────────────────────────────────────────

/**
 * Separa los casos de hoy contra la lista de deuda conocida.
 *  - fresh:    casos que no están en la lista → error.
 *  - resolved: entradas de la lista que ya cumplen → se quitan al consolidar.
 */
export function classifyDebt(offenders, known) {
  const knownSet = new Set(known);
  const nowSet = new Set(offenders);
  return {
    fresh: offenders.filter((file) => !knownSet.has(file)).sort(),
    resolved: known.filter((file) => !nowSet.has(file)).sort(),
  };
}

/**
 * La lista de deuda que se escribe al consolidar. Solo puede achicarse: un caso nuevo no entra
 * por consolidar, hay que arreglarlo o agregarlo a mano (y se ve en el diff). La primera vez
 * (sin lista previa) se registra el estado actual.
 */
export function nextDebt(offenders, known) {
  if (!Array.isArray(known)) return [...offenders].sort();
  const nowSet = new Set(offenders);
  return known.filter((file) => nowSet.has(file)).sort();
}
