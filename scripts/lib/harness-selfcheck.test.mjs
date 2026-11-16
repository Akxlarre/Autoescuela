/**
 * Micro-suite de harness-selfcheck.js. Sin framework: `node scripts/lib/harness-selfcheck.test.mjs`
 * Exit 1 si algún caso falla.
 */
import {
  INDEX_ROW_LIMIT,
  checkPayloadBudget,
  compareIndexRows,
  extractRepoPaths,
  findMissingReferences,
  findStaleNotWired,
  findUnbackedDocumentedHooks,
  findUnwiredHooks,
  measureLongRows,
  parseDocumentedHooks,
  findScopeGaps,
  parseScopeTable,
  SCOPES,
} from './harness-selfcheck.js';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}

const SETTINGS = JSON.stringify({
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node .claude/hooks/bash-guard.js' }] }],
    Stop: [{ hooks: [{ type: 'prompt', prompt: 'You are a sync-check auditor. Review...' }] }],
  },
});

// ── ARCH-31: hooks sin conectar ─────────────────────────────────────────────────────────────
check(
  'hook del directorio que settings.json no nombra → se marca',
  findUnwiredHooks(['.claude/hooks/bash-guard.js', '.claude/hooks/huerfano.js'], SETTINGS)[0] ===
    '.claude/hooks/huerfano.js',
);
check(
  'hook conectado → no se marca',
  findUnwiredHooks(['.claude/hooks/bash-guard.js'], SETTINGS).length === 0,
);
check(
  'hook sin conectar pero declarado en la lista de excepciones → no se marca',
  findUnwiredHooks(['.claude/hooks/huerfano.js'], SETTINGS, {
    '.claude/hooks/huerfano.js': 'guard de día 0',
  }).length === 0,
);
check(
  'ruta con separador de Windows → se normaliza',
  findUnwiredHooks(['.claude\\hooks\\bash-guard.js'], SETTINGS).length === 0,
);

// ── ARCH-31: excepciones que dejaron de ser verdad ──────────────────────────────────────────
check(
  'excepción de un hook que ahora sí está conectado → se marca',
  findStaleNotWired(['.claude/hooks/bash-guard.js'], SETTINGS, {
    '.claude/hooks/bash-guard.js': 'motivo viejo',
  })[0]?.reason === 'ya está conectado',
);
check(
  'excepción de un hook que ya no existe → se marca',
  findStaleNotWired([], SETTINGS, { '.claude/hooks/borrado.js': 'motivo' })[0]?.reason ===
    'ya no existe',
);
check(
  'excepción vigente → no se marca',
  findStaleNotWired(['.claude/hooks/huerfano.js'], SETTINGS, {
    '.claude/hooks/huerfano.js': 'motivo',
  }).length === 0,
);

// ── ARCH-31: hooks documentados ─────────────────────────────────────────────────────────────
const CLAUDE_MD = [
  '# Proyecto',
  '',
  '## Sistema de Hooks Activo',
  '',
  'Este proyecto tiene guardrails automáticos:',
  '',
  '- **Bash Guard** — No puedes crear archivos fuente via Bash.',
  '- **Sync Check** — Al terminar se verifican los índices.',
  '- **Guard Fantasma** — Dice que bloquea algo.',
  '',
  '## Comandos del proyecto',
  '',
  '- **Esto no es un hook** — viñeta de otra sección.',
].join('\n');

const names = parseDocumentedHooks(CLAUDE_MD);
check('lee las viñetas de la sección de hooks', names.length === 3 && names[0] === 'Bash Guard');
check('no cruza al siguiente encabezado', !names.includes('Esto no es un hook'));
check('sin la sección → lista vacía', parseDocumentedHooks('# Otro\n\n- **X** — y').length === 0);

const evidence = { 'Bash Guard': 'bash-guard.js', 'Sync Check': 'sync-check auditor' };
const unbacked = findUnbackedDocumentedHooks(names, evidence, SETTINGS);
check(
  'hook documentado sin entrada en el mapa → sin-mapa',
  unbacked.length === 1 && unbacked[0].name === 'Guard Fantasma' && unbacked[0].problem === 'sin-mapa',
);
check(
  'hook de tipo prompt se respalda con una frase de su texto',
  !unbacked.some((f) => f.name === 'Sync Check'),
);
check(
  'hook en el mapa cuya evidencia no está en settings.json → sin-respaldo',
  findUnbackedDocumentedHooks(['Bash Guard'], { 'Bash Guard': 'otro-archivo.js' }, SETTINGS)[0]
    ?.problem === 'sin-respaldo',
);

// ── ARCH-32: presupuesto ────────────────────────────────────────────────────────────────────
check('carga bajo el techo → dentro', checkPayloadBudget(50_000, 60_000).over === false);
check('carga igual al techo → dentro', checkPayloadBudget(60_000, 60_000).over === false);
check(
  'carga sobre el techo → fuera, con el exceso',
  checkPayloadBudget(740_000, 60_000).over === true && checkPayloadBudget(740_000, 60_000).excess === 680_000,
);

// ── ARCH-33: filas largas ───────────────────────────────────────────────────────────────────
const corta = '| `tabla` | descripción breve |';
const larga = `| \`funcion()\` | ${'historial '.repeat(200)}|`;
check('fila larga del ejemplo supera el límite', larga.length > INDEX_ROW_LIMIT);
check(
  'cuenta solo las filas que pasan el límite',
  measureLongRows([corta, larga, corta].join('\n')).count === 1,
);
check('suma el largo de las filas largas', measureLongRows(larga).chars === larga.length);
check('índice sin filas largas → cero', measureLongRows(corta).count === 0);

check(
  'fila larga nueva → regresión',
  compareIndexRows({ 'indices/A.md': { count: 2, chars: 5000 } }, { 'indices/A.md': { count: 1, chars: 3000 } })
    .regressions[0]?.kind === 'fila-nueva',
);
check(
  'fila larga existente que creció → regresión',
  compareIndexRows({ 'indices/A.md': { count: 1, chars: 3100 } }, { 'indices/A.md': { count: 1, chars: 3000 } })
    .regressions[0]?.kind === 'fila-crecio',
);
check(
  'índice nuevo con una fila larga y sin línea base → regresión',
  compareIndexRows({ 'indices/NUEVO.md': { count: 1, chars: 2000 } }, {}).regressions.length === 1,
);
check(
  'sin cambios → ni regresión ni mejora',
  compareIndexRows({ 'indices/A.md': { count: 1, chars: 3000 } }, { 'indices/A.md': { count: 1, chars: 3000 } })
    .regressions.length === 0,
);
const mejora = compareIndexRows(
  { 'indices/A.md': { count: 1, chars: 1500 } },
  { 'indices/A.md': { count: 1, chars: 3000 } },
);
check('fila acortada → mejora, no regresión', mejora.regressions.length === 0 && mejora.improvements.length === 1);

{
  const fila = `| ${'x'.repeat(1300)} |`;
  const lf = measureLongRows(`${fila}\ncorta\n${fila}\n`);
  const crlf = measureLongRows(`${fila}\r\ncorta\r\n${fila}\r\n`);
  check('saltos de Windows y de Linux miden lo mismo', lf.count === 2 && lf.count === crlf.count && lf.chars === crlf.chars);
}

// ── ARCH-38: referencias del catálogo de patrones ───────────────────────────────────────────
const CATALOGO = [
  '| Lista | `src/app/features/a/a.component.ts` | `visual-system.md` | Ninguno |',
  '| Test | `supabase/tests/caja/x.sql` y `scripts/lib/y.js` | `database.md` | ARCH-37 |',
  '| Repetida | `src/app/features/a/a.component.ts` | — | — |',
].join('\n');
const rutas = extractRepoPaths(CATALOGO);
check('extrae las rutas del repo entre backticks', rutas.length === 3);
check('no toma nombres de reglas ni de guards', !rutas.some((r) => r.endsWith('.md')));
check('no repite una ruta citada dos veces', rutas.filter((r) => r.includes('a.component')).length === 1);
check(
  'ruta que no existe → se marca',
  findMissingReferences(CATALOGO, (p) => !p.includes('y.js'))[0] === 'scripts/lib/y.js',
);
check('todas existen → nada', findMissingReferences(CATALOGO, () => true).length === 0);

// ── ARCH-42: tabla de alcance ───────────────────────────────────────────────────────────────
const ALCANCE = [
  '| Pieza | Alcance | Nota |',
  '|---|---|---|',
  '| `rules/a.md` | boilerplate | vale en cualquier proyecto |',
  '| `AP-001` | proyecto | |',
  '| `skills/vieja` | mixto | ya no existe |',
  '| `rules/b.md` | generico | valor inventado |',
].join('\n');
const tabla = parseScopeTable(ALCANCE);
check('lee id y alcance de cada fila', tabla['rules/a.md'] === 'boilerplate' && tabla['AP-001'] === 'proyecto');
check('la cabecera y el separador no son filas', Object.keys(tabla).length === 4);
{
  const gaps = findScopeGaps(['rules/a.md', 'rules/b.md', 'AP-001', 'AP-002'], tabla);
  check('pieza sin clasificar → missing', gaps.missing.length === 1 && gaps.missing[0] === 'AP-002');
  check('fila de una pieza que ya no existe → stale', gaps.stale.length === 1 && gaps.stale[0] === 'skills/vieja');
  check('alcance fuera de la lista → invalid', gaps.invalid.length === 1 && gaps.invalid[0].id === 'rules/b.md');
}
{
  const gaps = findScopeGaps(['rules/a.md', 'AP-001'], parseScopeTable(ALCANCE.split('\n').slice(0, 4).join('\n')));
  check('tabla completa → sin huecos', gaps.missing.length + gaps.stale.length + gaps.invalid.length === 0);
}
check('los tres alcances válidos', SCOPES.join() === 'boilerplate,proyecto,mixto');

if (failures > 0) {
  console.error(`\n${failures} caso(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodos los casos pasaron.');
