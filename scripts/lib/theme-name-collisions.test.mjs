/**
 * Micro-suite de theme-name-collisions.js. Sin framework:
 * `node scripts/lib/theme-name-collisions.test.mjs`. Exit 1 si algún caso falla.
 */
import {
  ACCEPTED_COLLISIONS,
  findCollidingClassUsages,
  findThemeCollisions,
  keysOfNamespace,
  parseThemeProperties,
  stripComments,
} from './theme-name-collisions.js';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}
const classesOf = (usages) => usages.map((u) => u.sample).join(',');

// ── parseThemeProperties / keysOfNamespace ───────────────────────────────────
const theme = `
@import 'tailwindcss';
@theme {
  /* --color-comentado: red; */
  --color-base: var(--bg-base);
  --color-text-primary: var(--text-primary);
  --text-compact: var(--text-compact);
  --text-sm--line-height: 1.2;
  --shadow-sm: var(--shadow-sm);
}
.fuera { --color-lg: red; }
`;
const props = parseThemeProperties(theme);
check('lee las custom properties del @theme', props.has('--color-base') && props.has('--text-compact'));
check('ignora las comentadas', !props.has('--color-comentado'));
check('ignora las que están fuera del @theme', !props.has('--color-lg'));
check(
  'keysOfNamespace omite sub-claves --x--line-height',
  [...keysOfNamespace(props, '--text-')].join(',') === 'compact',
);
check(
  'lee @theme default (tema de Tailwind)',
  parseThemeProperties('@theme default {\n  --text-9xl: 8rem;\n}\n').has('--text-9xl'),
);

// ── findThemeCollisions ──────────────────────────────────────────────────────
check(
  'color base choca con el tamaño base del tema por defecto',
  findThemeCollisions(theme).map((c) => c.cls).join(',') === 'text-base',
);
check(
  'un color nuevo con nombre de tamaño (lg) también choca',
  findThemeCollisions('@theme {\n  --color-lg: red;\n}\n').some((c) => c.cls === 'text-lg'),
);
check(
  'un color con nombre de tamaño propio del proyecto (compact) choca',
  findThemeCollisions('@theme {\n  --text-compact: 13px;\n  --color-compact: red;\n}\n').some(
    (c) => c.cls === 'text-compact',
  ),
);
check(
  'un color con nombre de sombra (md) choca con shadow-md',
  findThemeCollisions('@theme {\n  --color-md: red;\n}\n').some((c) => c.cls === 'shadow-md'),
);
check(
  'claves del tema por defecto leídas de theme.css se suman',
  findThemeCollisions('@theme {\n  --color-huge: red;\n}\n', '@theme default {\n  --text-huge: 9rem;\n}\n')
    .some((c) => c.cls === 'text-huge'),
);
check(
  'colores sin choque no se reportan (text-primary, surface, brand)',
  findThemeCollisions(
    '@theme {\n  --color-text-primary: x;\n  --color-surface: x;\n  --color-brand: x;\n}\n',
  ).length === 0,
);
check('text-base está aceptada con motivo', typeof ACCEPTED_COLLISIONS['text-base'] === 'string');

// ── findCollidingClassUsages ─────────────────────────────────────────────────
const ban = ['text-base'];
check('detecta la clase suelta', classesOf(findCollidingClassUsages('<h3 class="text-base font-bold">', ban)) === 'text-base');
check(
  'detecta variantes responsive y de estado',
  classesOf(findCollidingClassUsages('<p class="text-sm sm:text-base md:hover:text-base">', ban)) ===
    'sm:text-base,md:hover:text-base',
);
check('detecta !important y opacidad', classesOf(findCollidingClassUsages(`class="!text-base text-base/50"`, ban)) === '!text-base,text-base/50');
check('detecta binding [class.text-base]', findCollidingClassUsages('<p [class.text-base]="x">', ban).length === 1);
check('detecta en string TS con comillas simples', findCollidingClassUsages(`const c = 'text-base';`, ban).length === 1);
check('detecta en template literal', findCollidingClassUsages('template: `<p class="a text-base">`', ban).length === 1);
check('detecta en @apply de SCSS', findCollidingClassUsages('.x { @apply text-base; }', ban).length === 1);
check('no cuenta var(--text-base)', findCollidingClassUsages('font-size: var(--text-base);', ban).length === 0);
check('no cuenta la definición --text-base: 1rem', findCollidingClassUsages('  --text-base: 1rem;', ban).length === 0);
check('no cuenta $text-base', findCollidingClassUsages('$text-base: 1rem;', ban).length === 0);
check('no cuenta text-base-alt ni xtext-base', findCollidingClassUsages('class="text-base-alt xtext-base"', ban).length === 0);
check('no cuenta text-text-base', findCollidingClassUsages('class="text-text-base"', ban).length === 0);
check(
  'no cuenta un comentario HTML que la nombra',
  findCollidingClassUsages('<!-- Sin la clase text-base: pinta con el fondo -->\n<p class="x">', ban).length === 0,
);
check('no cuenta un comentario de bloque', findCollidingClassUsages('/* evitar text-base */', ban).length === 0);
check('no cuenta un comentario de línea', findCollidingClassUsages('  // text-base pinta con el fondo', ban).length === 0);
check(
  'una URL con // no se come el resto de la línea',
  findCollidingClassUsages(`const u = 'https://x.cl'; const c = 'text-base';`, ban).length === 1,
);
check(
  'informa la línea correcta tras un comentario multilínea',
  findCollidingClassUsages('<!--\nuno\ndos\n-->\n<p class="text-base">', ban)[0]?.line === 5,
);
check('sin clases prohibidas no busca nada', findCollidingClassUsages('class="text-base"', []).length === 0);
check(
  'stripComments conserva los saltos de línea',
  stripComments('a<!--\n\n-->b').split('\n').length === 3,
);

if (failures > 0) {
  console.error(`\n${failures} caso(s) fallaron.`);
  process.exit(1);
}
console.log('\n✅ theme-name-collisions: todos los casos pasan.');
