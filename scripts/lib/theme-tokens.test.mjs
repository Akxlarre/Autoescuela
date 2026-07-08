/**
 * Micro-suite de theme-tokens.js (spec 0019). Sin framework: `node scripts/lib/theme-tokens.test.mjs`
 * Exit 1 si algún caso falla.
 */
import { parseThemeTokens, findDeadTokenClasses, findForbiddenThemeAliases } from './theme-tokens.js';

const theme = parseThemeTokens('src/tailwind.css');
console.log(`tokens: ${theme.tokens.size} | vocab: ${theme.vocab.size}`);

// AC4: los 4 patrones de la lista negra vieja + AC2: formas cortas muertas
// NOTA (fix-033): 'text-secondary'/'text-muted' vuelven a DEAD — a4675ee las había
// resucitado agregando alias --color-secondary/--color-muted al @theme; fix-033
// revirtió esos alias (AP-015) y migró los 31 usos reales a la forma canónica
// text-text-*. El guardrail ARCH-18 (findForbiddenThemeAliases, abajo) impide que
// alguien vuelva a agregarlos.
const DEAD = [
  'bg-bg-base', 'text-state-error', 'bg-surface-hover', 'border-divider',
  'text-primary', 'text-brand-contrast', 'divide-divider',
  'text-secondary', 'text-muted', 'text-disabled',
];
// AC1/AC3/AC-E1/AC-E2: válidas o fuera del vocabulario del DS
// 'text-2xs' es el token de 10px formalizado en fix-032.
const VALID = [
  'text-text-primary', 'bg-surface/50', 'dark:text-text-muted', 'text-sm', 'text-center',
  'bg-gradient-primary', 'from-brand', 'text-warning', 'border-border-subtle',
  'bg-success-subtle', 'text-[9px]', 'text-editor', 'border-collapse', 'text-balance',
  'bg-brand-dark/20', 'hover:bg-elevated', 'via-white', 'text-transparent',
  'text-2xs', 'border-border-muted', 'bg-brand-muted',
];

let failures = 0;

for (const cls of DEAD) {
  const r = findDeadTokenClasses(`class="p-4 ${cls} flex"`, theme);
  const hit = r.find(x => cls.endsWith(x.cls));
  if (!hit) { console.error(`FALLO: '${cls}' debía detectarse como muerta`); failures++; }
  else console.log(`DEAD ok   ${cls}${hit.suggestion ? '  → sugerencia: ' + hit.suggestion : ''}`);
}

for (const cls of VALID) {
  const r = findDeadTokenClasses(`class="p-4 ${cls} flex"`, theme);
  if (r.length > 0) { console.error(`FALLO: '${cls}' marcó falso positivo: ${r.map(x => x.cls).join(', ')}`); failures++; }
  else console.log(`PASS ok   ${cls}`);
}

// AC-E3: la clase dentro de un binding [class.x] también se valida
const binding = findDeadTokenClasses(`[class.text-primary]="cond()"`, theme);
if (binding.length === 1) console.log('DEAD ok   [class.text-primary] (AC-E3)');
else { console.error('FALLO: AC-E3 binding no detectado'); failures++; }

// ── ARCH-18 (fix-033): alias bare prohibidos en @theme ──────────────────────
const cleanTheme = `@theme {\n  --color-brand-muted: var(--x);\n  --color-border-muted: var(--y);\n}\n`;
const cleanResult = findForbiddenThemeAliases(cleanTheme);
if (cleanResult.length === 0) console.log('PASS ok   @theme limpio (solo sufijos legítimos) → 0 violaciones');
else { console.error(`FALLO: falso positivo en @theme limpio: ${JSON.stringify(cleanResult)}`); failures++; }

const dirtyTheme = `@theme {\n  --color-text-secondary: var(--a);\n  --color-secondary: var(--a);\n  --color-muted: var(--b);\n}\n`;
const dirtyResult = findForbiddenThemeAliases(dirtyTheme);
const dirtyKeys = dirtyResult.map((r) => r.key).sort();
if (JSON.stringify(dirtyKeys) === JSON.stringify(['--color-muted', '--color-secondary'])) {
  console.log('DEAD ok   --color-secondary + --color-muted detectados (no --color-text-secondary)');
} else {
  console.error(`FALLO: esperaba [--color-muted, --color-secondary], obtuvo ${JSON.stringify(dirtyKeys)}`);
  failures++;
}

const realTheme = findForbiddenThemeAliases(
  (await import('fs')).readFileSync('src/tailwind.css', 'utf-8'),
);
if (realTheme.length === 0) console.log('PASS ok   src/tailwind.css real → sin alias prohibidos (post fix-033)');
else { console.error(`FALLO: src/tailwind.css tiene alias prohibidos: ${JSON.stringify(realTheme)}`); failures++; }

if (failures > 0) { console.error(`\n${failures} caso(s) fallidos`); process.exit(1); }
console.log('\n✅ theme-tokens: todos los casos pasan');
