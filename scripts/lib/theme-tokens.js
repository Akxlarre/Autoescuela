/**
 * theme-tokens.js — Fuente de verdad derivada del @theme de Tailwind v4 (spec 0019)
 *
 * En vez de mantener una lista negra manual de clases muertas (ARCH-11 v1),
 * parsea el bloque @theme de src/tailwind.css y deriva:
 *   - tokens: los sufijos de color que SÍ generan utilities (text-X, bg-X, border-X, …)
 *   - vocab:  el vocabulario del design system (segmentos de los tokens + familias
 *             muertas conocidas de AP-011) — solo clases construidas con este
 *             vocabulario se validan; el resto (text-sm, text-center, text-editor)
 *             se ignora para acotar falsos positivos.
 *
 * Compartido por architect.js (linter) e indices-sync.js (índices).
 */

import fs from 'fs';

/** Valores de color que Tailwind acepta para cualquier prefijo, sin pasar por @theme. */
const UNIVERSAL_COLOR_VALUES = new Set([
  'transparent', 'current', 'inherit', 'white', 'black', 'none', 'auto',
]);

/** Prefijos de utility que consumen un color. */
const COLOR_PREFIXES = 'text|bg|border|ring|from|to|via|divide|outline|fill|stroke|accent|caret';

/**
 * Parsea el bloque @theme y devuelve { tokens, vocab }.
 * Falla honesto: si el archivo o el bloque no existen, lanza (el caller decide fail-open).
 */
export function parseThemeTokens(cssPath) {
  const src = fs.readFileSync(cssPath, 'utf-8');
  const themeMatch = src.match(/@theme\s*\{([\s\S]*?)\n\}/);
  if (!themeMatch) {
    throw new Error(`No se encontró bloque @theme en ${cssPath}`);
  }

  const tokens = new Set();
  const re = /--color-([\w-]+)\s*:/g;
  let m;
  while ((m = re.exec(themeMatch[1])) !== null) tokens.add(m[1]);

  if (tokens.size === 0) {
    throw new Error(`El bloque @theme de ${cssPath} no define tokens --color-*`);
  }

  // Vocabulario del DS: segmentos de los tokens + familias muertas conocidas (AP-011).
  const vocab = new Set(['state', 'bg', 'surface', 'divider']);
  for (const t of tokens) for (const seg of t.split('-')) vocab.add(seg);

  return { tokens, vocab };
}

/** Heurísticas para sugerir la forma canónica más cercana de una clase muerta. */
function suggestCanonical(prefix, suffix, tokens) {
  const candidates = [
    `${prefix}-${suffix}`,              // text-primary → text-text-primary (prepend del prefijo)
    suffix.replace(/^bg-/, ''),         // bg-bg-base → base
    suffix.replace(/^state-/, ''),      // text-state-error → error
    suffix.replace(/-(hover|base|elevated)$/, ''), // bg-surface-hover → surface
  ];
  for (const c of candidates) {
    if (tokens.has(c)) return `${prefix}-${c}`;
  }
  return null;
}

/**
 * Encuentra clases color-like muertas (no generan CSS) en un contenido.
 * Devuelve [{ cls, suggestion }] con clases únicas.
 * Los modificadores /N y variantes dark:/hover: quedan fuera del match por los boundaries.
 */
export function findDeadTokenClasses(content, theme) {
  const { tokens, vocab } = theme;
  const found = new Map();
  const re = new RegExp(`(?<![\\w-])(${COLOR_PREFIXES})-([a-z][a-z-]*[a-z])(?![\\w-])`, 'g');
  let m;
  while ((m = re.exec(content)) !== null) {
    const [cls, prefix, suffix] = m;
    if (tokens.has(suffix)) continue;
    if (UNIVERSAL_COLOR_VALUES.has(suffix)) continue;
    // Solo se valida vocabulario del DS — lo demás no es una clase de color token-like.
    if (!vocab.has(suffix.split('-')[0])) continue;
    if (!found.has(cls)) {
      found.set(cls, { cls, suggestion: suggestCanonical(prefix, suffix, tokens) });
    }
  }
  return [...found.values()];
}

/**
 * ARCH-18 (fix-033) — Alias "bare" prohibidos en @theme.
 *
 * ARCH-11 solo detecta clases que NO generan CSS. Ese guardrail queda ciego en
 * cuanto alguien agrega un alias como `--color-secondary: var(--text-secondary)`
 * al @theme: la clase "muerta" pasa a ser válida y ARCH-11 deja de marcarla —
 * exactamente el mecanismo que resucitó `text-secondary`/`text-muted` en a4675ee
 * (ver AP-015). Esta función audita la DEFINICIÓN del bridge, no el uso.
 *
 * Prohibidos: alias bare que colisionan con la forma corta ya establecida como
 * muerta por el canon `text-text-*` (fix-030). Los sufijos (--color-border-muted,
 * --color-brand-muted…) NO están prohibidos — son formas canónicas legítimas.
 */
const FORBIDDEN_THEME_ALIASES = ['--color-secondary', '--color-muted', '--color-disabled', '--color-primary'];

/**
 * Busca definiciones de alias prohibidos dentro del bloque @theme de un CSS.
 * Devuelve [{ key }] — vacío si no hay violaciones.
 */
export function findForbiddenThemeAliases(cssContent) {
  const themeMatch = cssContent.match(/@theme\s*\{([\s\S]*?)\n\}/);
  if (!themeMatch) return [];
  const body = themeMatch[1];
  const found = [];
  for (const key of FORBIDDEN_THEME_ALIASES) {
    // Match exacto de la propiedad (no --color-secondary-foo, no --color-brand-muted).
    const re = new RegExp(`(?:^|\\n)\\s*${key}\\s*:`);
    if (re.test(body)) found.push({ key });
  }
  return found;
}
