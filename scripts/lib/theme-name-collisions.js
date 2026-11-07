/**
 * theme-name-collisions.js — ARCH-29: un color del @theme con el mismo nombre que un tamaño.
 *
 * Tailwind v4 arma `text-<nombre>` con dos namespaces del tema: `--color-*` (color del texto) y
 * `--text-*` (tamaño de letra). Si el mismo nombre existe en los dos, la clase es ambigua y
 * Tailwind se queda con UNO solo. En este proyecto `--color-base` (el fondo de la página) choca
 * con `--text-base` (16 px del tema por defecto): compilando src/tailwind.css, `text-base` genera
 * `color: var(--color-base)` y ningún `font-size`. Un texto con esa clase y sin otro color que
 * gane queda pintado con el color del fondo, casi invisible. Lo mismo pasa con `shadow-<nombre>`
 * (`--color-*` contra `--shadow-*`).
 *
 * Dos chequeos:
 *   1. findThemeCollisions(css): colores del @theme cuyo nombre ya es un tamaño de letra o de
 *      sombra. Uno nuevo es error: hay que elegir otro nombre de color.
 *   2. findCollidingClassUsages(source, collisions): usos de la clase ambigua (con cualquier
 *      variante: `md:text-base`, `!text-base`, `[class.text-base]`) en plantillas y estilos.
 *
 * Las colisiones que ya existen y no se renombran van en ACCEPTED_COLLISIONS con su motivo; para
 * ellas solo rige el chequeo 2.
 *
 * Micro-suite: `node scripts/lib/theme-name-collisions.test.mjs`
 */

// Claves del tema por defecto de Tailwind v4 (node_modules/tailwindcss/theme.css). Se usan si no
// se puede leer ese archivo; si se puede, se suman las que traiga.
export const DEFAULT_THEME_KEYS = {
  text: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'],
  shadow: ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'],
};

/** Prefijo de clase → namespace del tema que compite con `--color-*` por ese prefijo. */
export const COMPETING_NAMESPACES = {
  text: { namespace: '--text-', what: 'tamaño de letra' },
  shadow: { namespace: '--shadow-', what: 'sombra' },
};

/**
 * Colisiones que existen y se decidió no renombrar. Clave: `prefijo-nombre`.
 * Mantenerla chica: cada entrada es una clase que nadie puede usar.
 */
export const ACCEPTED_COLLISIONS = {
  'text-base':
    'bg-base tiene ~97 usos en ~50 archivos: renombrar el color cambiaba todos y además le devolvía ' +
    '16 px a los text-base que hoy no fijan tamaño. Se prohíbe la clase text-base en su lugar.',
};

/** Qué usar en vez de la clase ambigua. */
export const COLLISION_FIX = {
  'text-base':
    'Sacá la clase: acá no fija ningún tamaño, el texto ya hereda el suyo. Si necesita color, ' +
    'text-text-primary / text-text-secondary / text-text-muted. Si necesita otro tamaño, la escala ' +
    'text-xs / text-sm / text-lg o una clase tipográfica del DS (.item-title, .micro-label).',
};

const THEME_BLOCK_RE = /@theme(?:\s+[\w-]+)*\s*\{([\s\S]*?)\n\}/g;
const CUSTOM_PROP_RE = /(--[\w-]+)\s*:/g;

/** Nombres de las custom properties declaradas en los bloques @theme de un CSS. */
export function parseThemeProperties(css) {
  const props = new Set();
  let block;
  THEME_BLOCK_RE.lastIndex = 0;
  while ((block = THEME_BLOCK_RE.exec(css)) !== null) {
    const body = stripComments(block[1]);
    let m;
    CUSTOM_PROP_RE.lastIndex = 0;
    while ((m = CUSTOM_PROP_RE.exec(body)) !== null) props.add(m[1]);
  }
  return props;
}

/** Claves de un namespace (`--text-`), sin las sub-claves tipo `--text-sm--line-height`. */
export function keysOfNamespace(props, namespace) {
  const keys = new Set();
  for (const prop of props) {
    if (!prop.startsWith(namespace)) continue;
    const key = prop.slice(namespace.length);
    if (key && !key.includes('--')) keys.add(key);
  }
  return keys;
}

/**
 * @param {string} projectCss    — contenido de src/tailwind.css
 * @param {string} [defaultCss]  — contenido de tailwindcss/theme.css, si se pudo leer
 * @returns {{ cls: string, prefix: string, name: string, what: string }[]} ordenadas por clase.
 */
export function findThemeCollisions(projectCss, defaultCss = '') {
  const projectProps = parseThemeProperties(projectCss);
  const defaultProps = parseThemeProperties(defaultCss);
  const colors = keysOfNamespace(projectProps, '--color-');

  const out = [];
  for (const [prefix, { namespace, what }] of Object.entries(COMPETING_NAMESPACES)) {
    const sizes = new Set([
      ...DEFAULT_THEME_KEYS[prefix],
      ...keysOfNamespace(defaultProps, namespace),
      ...keysOfNamespace(projectProps, namespace),
    ]);
    for (const name of colors) {
      if (sizes.has(name)) out.push({ cls: `${prefix}-${name}`, prefix, name, what });
    }
  }
  return out.sort((a, b) => a.cls.localeCompare(b.cls));
}

/**
 * Reemplaza comentarios (HTML, bloque y línea completa) por espacios, conservando los saltos de
 * línea para que los números de línea no se corran. Un comentario que explica por qué NO se usa
 * la clase no es un uso.
 */
export function stripComments(source) {
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  return source
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/^([ \t]*)\/\/.*$/gm, (_, indent) => indent);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Usos de las clases ambiguas en un archivo.
 * Cuenta `text-base`, `md:text-base`, `hover:!text-base`, `text-base/50` y `[class.text-base]`.
 * No cuenta `var(--text-base)`, `$text-base` ni `font-text-base`: el carácter anterior tiene que
 * ser inicio, espacio, comilla, backtick o el punto de `[class.`.
 *
 * @param {string} source
 * @param {string[]} classes — p. ej. ['text-base']
 * @returns {{ cls: string, line: number, sample: string }[]}
 */
export function findCollidingClassUsages(source, classes) {
  if (classes.length === 0) return [];
  const clean = stripComments(source);
  const alternatives = classes.map(escapeRe).join('|');
  const re = new RegExp(
    `(?<=^|[\\s"'\`.])((?:[\\w-]+:)*!?(${alternatives})(?:\\/[\\w.]+)?!?)(?![\\w-])`,
    'g',
  );
  const out = [];
  let m;
  while ((m = re.exec(clean)) !== null) {
    const line = clean.slice(0, m.index).split('\n').length;
    out.push({ cls: m[2], line, sample: m[1] });
  }
  return out;
}
