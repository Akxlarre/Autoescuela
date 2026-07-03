/**
 * Micro-suite de theme-tokens.js (spec 0019). Sin framework: `node scripts/lib/theme-tokens.test.mjs`
 * Exit 1 si algún caso falla.
 */
import { parseThemeTokens, findDeadTokenClasses } from './theme-tokens.js';

const theme = parseThemeTokens('src/tailwind.css');
console.log(`tokens: ${theme.tokens.size} | vocab: ${theme.vocab.size}`);

// AC4: los 4 patrones de la lista negra vieja + AC2: formas cortas muertas
const DEAD = [
  'bg-bg-base', 'text-state-error', 'bg-surface-hover', 'border-divider',
  'text-primary', 'text-secondary', 'text-muted', 'text-brand-contrast', 'divide-divider',
];
// AC1/AC3/AC-E1/AC-E2: válidas o fuera del vocabulario del DS
const VALID = [
  'text-text-primary', 'bg-surface/50', 'dark:text-text-muted', 'text-sm', 'text-center',
  'bg-gradient-primary', 'from-brand', 'text-warning', 'border-border-subtle',
  'bg-success-subtle', 'text-[9px]', 'text-editor', 'border-collapse', 'text-balance',
  'bg-brand-dark/20', 'hover:bg-elevated', 'via-white', 'text-transparent',
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

if (failures > 0) { console.error(`\n${failures} caso(s) fallidos`); process.exit(1); }
console.log('\n✅ theme-tokens: todos los casos pasan');
