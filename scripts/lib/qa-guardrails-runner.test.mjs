/**
 * Micro-suite de punta a punta de scripts/check-qa-guardrails.mjs.
 *
 * Las otras suites prueban las funciones puras. Esta prueba que el runner las llama: arma un
 * repositorio mínimo en una carpeta temporal, corre el runner ahí y comprueba que cada regla
 * dispara con su violación y que un repositorio limpio pasa. Sin esto, un chequeo podría quedar
 * escrito y desconectado, que es justo lo que ARCH-31 vigila en los hooks.
 *
 * Sin framework: `node scripts/lib/qa-guardrails-runner.test.mjs` — exit 1 si algún caso falla.
 * Los valores con forma de credencial son inventados para esta suite.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNNER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'check-qa-guardrails.mjs');

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}

function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-guardrails-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

function run(root, args = []) {
  const result = spawnSync(process.execPath, [RUNNER, ...args], { cwd: root, encoding: 'utf8' });
  return { code: result.status, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

const settings = JSON.stringify({
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node .claude/hooks/bash-guard.js' }] }],
    SessionStart: [{ matcher: 'compact', hooks: [{ type: 'command', command: 'node .claude/hooks/compact-recovery.js' }] }],
  },
});
const claudeMd = (extra = '') =>
  ['# Proyecto', '', '## Sistema de Hooks Activo', '', '- **Bash Guard** — bloquea.', extra, '', '## Comandos', ''].join('\n');
const recoveryHook = (bytes) => `process.stdout.write('x'.repeat(${bytes}));\n`;
const allowlist = JSON.stringify({
  hooks: { notWired: {}, documented: { 'Bash Guard': 'bash-guard.js' } },
  edgeFunctions: { withoutSharedGuard: {} },
  permissionMigrations: { after: '20260101000000', exempt: {} },
});
const baseline = JSON.stringify({
  compactRecovery: { maxBytes: 1000, targetBytes: 500 },
  indexRows: {},
  credentials: {},
  testHygiene: { unitSkips: 0, vitestExcludedSpecs: 0, e2eFixedWaits: 0, e2eSkips: 0 },
  patternDebt: { requestGuard: [], swr: [] },
});
const SCOPED_FACADE = 'const sede = this.branchFacade.selectedBranchId();\nthis._data.set(rows);\n';

const cleanRepo = {
  '.claude/settings.json': settings,
  '.claude/CLAUDE.md': claudeMd(),
  '.claude/hooks/bash-guard.js': '// hook\n',
  '.claude/hooks/compact-recovery.js': recoveryHook(100),
  'scripts/lib/qa-guardrails.allowlist.json': allowlist,
  'scripts/lib/qa-guardrails.baseline.json': baseline,
  'indices/COMPONENTS.md': '| `app-x` | una fila corta |\n',
  'docs/GUIA.md': 'La contraseña se lee de la variable `E2E_PASSWORD`.\n',
  'docs/HARNESS-SCOPE.md': '| Pieza | Alcance | Nota |\n|---|---|---|\n| `rules/a.md` | boilerplate | |\n',
  '.claude/rules/a.md': '# Regla\n',
  'indices/APP-LIKE-ROLLOUT.md': '| `/x` | `ExcepcionComponent` | no aplica: contenido corto |\n',
  'src/app/features/x/excepcion.component.ts': 'template: `<div class="bento-grid"></div>`\n',
  'src/app/features/y/lista.component.ts': 'template: `<div class="bento-grid bento-grid--fill-screen"></div>`\n',
  'src/app/core/facades/ok.facade.ts': `private g = createRequestGuard();\n  private _initialized = false;\n  async initialize() { void this.refreshSilently(); }\n${SCOPED_FACADE}`,
  'vitest.config.ts': "export default { test: { exclude: [] } };\n",
  'src/app/a.spec.ts': "describe('a', () => { it('b', () => {}); });\n",
  'e2e/a.spec.ts': "test('a', async ({ page }) => { await expect(page).toBeTruthy(); });\n",
  'supabase/functions/con-guard/index.ts': "import { requireStaff } from '../_shared/staff-auth.ts';\n",
  'supabase/migrations/20270101000000_politica.sql': 'CREATE POLICY p ON t USING (true);\n',
  'supabase/tests/rls/politica.sql': '-- Migración: 20270101000000_politica.sql\nBEGIN;\n',
};

// ── Repositorio limpio ──────────────────────────────────────────────────────────────────────
{
  const root = makeRepo(cleanRepo);
  const normal = run(root);
  check('repo limpio → exit 0', normal.code === 0);
  check('repo limpio → sin ninguna regla disparada', !/\[ARCH-[34]\d\]/.test(normal.out));
  check('repo limpio en modo estricto → exit 0', run(root, ['--strict']).code === 0);
  fs.rmSync(root, { recursive: true, force: true });
}

// ── Un error duro por regla ─────────────────────────────────────────────────────────────────
const hardCases = [
  ['ARCH-31', 'hook en el directorio sin conectar', { '.claude/hooks/huerfano.js': '// nadie me llama\n' }],
  ['ARCH-31', 'hook documentado sin respaldo', { '.claude/CLAUDE.md': claudeMd('- **Guard Fantasma** — dice que bloquea.') }],
  ['ARCH-34', 'credencial en una guía', { 'docs/GUIA.md': 'Contraseña de la cuenta de prueba: `Ejemplo12345`\n' }],
  ['ARCH-36', 'edge function sin guard', { 'supabase/functions/sin-guard/index.ts': 'Deno.serve(() => new Response("ok"));\n' }],
  ['ARCH-37', 'migración de permisos sin test', { 'supabase/migrations/20270202000000_otra.sql': 'ALTER POLICY p ON t USING (false);\n' }],
  ['ARCH-39', 'facade nuevo con sede y sin guard de orden', { 'src/app/core/facades/nuevo.facade.ts': SCOPED_FACADE }],
  ['ARCH-40', 'facade nuevo con initialize() sin SWR', { 'src/app/core/facades/nuevo.facade.ts': '  async initialize(): Promise<void> {}\n' }],
  ['ARCH-41', 'página nueva con grilla sin app-like ni registro', { 'src/app/features/z/nueva.component.ts': 'template: `<div class="bento-grid" appBentoGridLayout></div>`\n' }],
  ['ARCH-42', 'regla nueva sin alcance declarado', { '.claude/rules/nueva.md': '# Otra regla\n' }],
  ['ARCH-42', 'fila de una pieza que ya no existe', { 'docs/HARNESS-SCOPE.md': '| `rules/a.md` | boilerplate | |\n| `rules/borrada.md` | proyecto | |\n' }],
];
for (const [rule, name, extra] of hardCases) {
  const root = makeRepo({ ...cleanRepo, ...extra });
  const result = run(root);
  check(`${rule}: ${name} → dispara`, result.out.includes(`[${rule}]`));
  check(`${rule}: ${name} → exit 1 también sin --strict`, result.code === 1);
  fs.rmSync(root, { recursive: true, force: true });
}

// ── Una regresión de trinquete por regla ────────────────────────────────────────────────────
const ratchetCases = [
  ['ARCH-32', 'recuperación sobre su techo', { '.claude/hooks/compact-recovery.js': recoveryHook(5000) }],
  ['ARCH-33', 'fila de índice larga', { 'indices/COMPONENTS.md': `| \`app-x\` | ${'historial '.repeat(200)}|\n` }],
  ['ARCH-35', 'espera fija nueva en e2e', { 'e2e/a.spec.ts': 'await page.waitForTimeout(500);\n' }],
  ['ARCH-35', 'test unitario desactivado', { 'src/app/a.spec.ts': "describe.skip('a', () => {});\n" }],
];
for (const [rule, name, extra] of ratchetCases) {
  const root = makeRepo({ ...cleanRepo, ...extra });
  const normal = run(root);
  check(`${rule}: ${name} → avisa`, normal.out.includes(`[${rule}]`));
  check(`${rule}: ${name} → en modo normal no falla`, normal.code === 0);
  check(`${rule}: ${name} → con --strict falla`, run(root, ['--strict']).code === 1);
  fs.rmSync(root, { recursive: true, force: true });
}

// ── La línea base se registra y después sostiene ────────────────────────────────────────────
{
  const root = makeRepo({ ...cleanRepo, 'e2e/a.spec.ts': 'await page.waitForTimeout(500);\n' });
  check('--update-qa-baseline → exit 0', run(root, ['--update-qa-baseline']).code === 0);
  const written = JSON.parse(fs.readFileSync(path.join(root, 'scripts/lib/qa-guardrails.baseline.json'), 'utf8'));
  check('registra el conteo medido', written.testHygiene.e2eFixedWaits === 1);
  check('conserva el techo de la recuperación', written.compactRecovery.maxBytes === 1000);
  check('con la base registrada, el modo estricto pasa', run(root, ['--strict']).code === 0);
  fs.rmSync(root, { recursive: true, force: true });
}

// ── La lista de deuda solo se achica ────────────────────────────────────────────────────────
{
  const debtFile = 'src/app/core/facades/deuda.facade.ts';
  const withDebt = JSON.stringify({ ...JSON.parse(baseline), patternDebt: { requestGuard: [debtFile], swr: [] } });
  const root = makeRepo({
    ...cleanRepo,
    'scripts/lib/qa-guardrails.baseline.json': withDebt,
    [debtFile]: SCOPED_FACADE,
    'src/app/core/facades/nuevo.facade.ts': SCOPED_FACADE,
  });
  const result = run(root);
  check('un facade de la lista de deuda no dispara', !result.out.includes('deuda.facade'));
  check('uno fuera de la lista sí dispara', result.out.includes('nuevo.facade') && result.code === 1);
  run(root, ['--update-qa-baseline']);
  const written = JSON.parse(fs.readFileSync(path.join(root, 'scripts/lib/qa-guardrails.baseline.json'), 'utf8'));
  check('consolidar no agrega el caso nuevo a la lista', written.patternDebt.requestGuard.join() === debtFile);
  check('después de consolidar sigue fallando', run(root).code === 1);
  fs.rmSync(root, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n${failures} caso(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodos los casos pasaron.');
