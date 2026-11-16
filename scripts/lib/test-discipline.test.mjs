/**
 * Micro-suite de test-discipline.js. Sin framework: `node scripts/lib/test-discipline.test.mjs`
 * Exit 1 si algún caso falla.
 */
import {
  changesPermissions,
  compareHygiene,
  countE2eSkips,
  countFixedWaits,
  countUnitSkips,
  countVitestExcludedSpecs,
  findStaleGuardExemptions,
  findUnguardedFunctions,
  findUntestedPermissionMigrations,
  importsSharedGuard,
  migrationTimestamp,
} from './test-discipline.js';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}

// ── ARCH-35: conteos ────────────────────────────────────────────────────────────────────────
check('describe.skip cuenta', countUnitSkips("describe.skip('X', () => {})") === 1);
check('it.skip y test.todo cuentan', countUnitSkips("it.skip('a', f); test.todo('b');") === 2);
check('xit y xdescribe cuentan', countUnitSkips("xit('a', f); xdescribe('b', f);") === 2);
check(
  'una mención en un comentario, sin paréntesis, no cuenta',
  countUnitSkips('// los tests de DOM del repo están en describe.skip (ver config)') === 0,
);
check('un describe normal no cuenta', countUnitSkips("describe('X', () => { it('a', f); })") === 0);
check('una palabra que termina en xit no cuenta', countUnitSkips('exit(1)') === 0);

check('waitForTimeout cuenta', countFixedWaits('await page.waitForTimeout(500);') === 1);
check('una espera por condición no cuenta', countFixedWaits('await expect(btn).toBeVisible();') === 0);

check('test.skip condicional cuenta', countE2eSkips("test.skip(!clase, 'No hay clases');") === 1);
check('test.fixme cuenta', countE2eSkips("test.fixme(true, 'roto');") === 1);
check('test.fail (bug conocido) no cuenta', countE2eSkips("test.fail(true, 'B4');") === 0);

const VITEST_CONFIG = `
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'e2e/support/**/*.spec.ts'],
    exclude: [
      'src/app/shared/components/icon/icon.component.spec.ts',
      "src/app/shared/components/kpi-card/kpi-card.component.spec.ts",
    ],
    coverage: { exclude: ['src/test-setup.ts', '**/*.spec.ts'] },
  },
});`;
check('cuenta solo los specs del bloque exclude de test', countVitestExcludedSpecs(VITEST_CONFIG) === 2);
check('config sin exclude → cero', countVitestExcludedSpecs('export default {}') === 0);

// ── ARCH-35: trinquete ──────────────────────────────────────────────────────────────────────
check(
  'una medida que sube → regresión',
  compareHygiene({ e2eFixedWaits: 52 }, { e2eFixedWaits: 51 }).regressions[0]?.metric === 'e2eFixedWaits',
);
check('sin cambios → nada', compareHygiene({ unitSkips: 8 }, { unitSkips: 8 }).regressions.length === 0);
const baja = compareHygiene({ unitSkips: 5 }, { unitSkips: 8 });
check('una medida que baja → mejora', baja.regressions.length === 0 && baja.improvements.length === 1);
check(
  'una medida sin línea base parte de cero',
  compareHygiene({ nueva: 1 }, {}).regressions.length === 1,
);

// ── ARCH-36: guards de autorización ─────────────────────────────────────────────────────────
const conGuard = "import { requireStaff } from '../_shared/staff-auth.ts';\nDeno.serve(...)";
const sinGuard = "import { assemblePdf } from '../_shared/pdf-utils.ts';\nDeno.serve(...)";
check('importa staff-auth → guardada', importsSharedGuard(conGuard));
check(
  'importa en varias líneas → guardada',
  importsSharedGuard("import {\n  requireStaff,\n} from '../_shared/staff-auth.ts';"),
);
check('importa user-edit-authz → guardada', importsSharedGuard("import { x } from '../_shared/user-edit-authz.ts';"));
check('importa otro módulo compartido → no guardada', !importsSharedGuard(sinGuard));
check(
  'nombrar el guard en un comentario no alcanza',
  !importsSharedGuard('// antes usaba _shared/staff-auth\nDeno.serve(...)'),
);

const functions = [
  { name: 'create-secretary', source: conGuard },
  { name: 'nueva-funcion', source: sinGuard },
  { name: 'public-enrollment', source: sinGuard },
];
const exempt = { 'public-enrollment': 'pública por diseño' };
const unguarded = findUnguardedFunctions(functions, exempt);
check('función sin guard y sin excepción → se marca', unguarded.length === 1 && unguarded[0] === 'nueva-funcion');
check('función exenta → no se marca', !unguarded.includes('public-enrollment'));

check(
  'excepción de una función que ahora usa un guard → se marca',
  findStaleGuardExemptions(functions, { 'create-secretary': 'motivo viejo' })[0]?.reason ===
    'ya usa un guard compartido',
);
check(
  'excepción de una función borrada → se marca',
  findStaleGuardExemptions(functions, { borrada: 'motivo' })[0]?.reason === 'ya no existe',
);
check('excepción vigente → no se marca', findStaleGuardExemptions(functions, exempt).length === 0);

// ── ARCH-37: migraciones de permisos ────────────────────────────────────────────────────────
check('CREATE POLICY cambia permisos', changesPermissions('CREATE POLICY p ON t FOR SELECT USING (true);'));
check('DROP POLICY cambia permisos', changesPermissions('drop policy if exists p on t;'));
check('SECURITY DEFINER cambia permisos', changesPermissions('CREATE FUNCTION f() ... SECURITY DEFINER'));
check('una tabla nueva sin políticas no', !changesPermissions('CREATE TABLE t (id int);'));
check(
  'una política solo mencionada en un comentario no',
  !changesPermissions('-- antes: CREATE POLICY p ON t\nALTER TABLE t ADD COLUMN c int;'),
);

check('timestamp de un nombre de migración', migrationTimestamp('20261201100000_rls_alumnos.sql') === '20261201100000');
check('nombre sin timestamp → null', migrationTimestamp('seed.sql') === null);

const migrations = [
  { name: '20260101000000_vieja_politica.sql', sql: 'CREATE POLICY a ON t USING (true);' },
  { name: '20261201100000_politica_sin_test.sql', sql: 'CREATE POLICY b ON t USING (true);' },
  { name: '20261202100000_politica_con_test.sql', sql: 'CREATE POLICY c ON t USING (true);' },
  { name: '20261203100000_solo_columna.sql', sql: 'ALTER TABLE t ADD COLUMN c int;' },
  { name: '20261204100000_exenta.sql', sql: 'CREATE FUNCTION f() ... SECURITY DEFINER' },
];
const tests = '-- Migración: 20261202100000_politica_con_test.sql\nBEGIN; ...';
const untested = findUntestedPermissionMigrations(migrations, tests, {
  after: '20261112200000',
  exempt: { '20261204100000_exenta.sql': 'trigger de auditoría sin lógica de acceso' },
});
check('migración nueva de permisos sin test → se marca', untested.includes('20261201100000_politica_sin_test.sql'));
check('migración anterior al corte → no se marca', !untested.includes('20260101000000_vieja_politica.sql'));
check('migración nombrada por un test → no se marca', !untested.includes('20261202100000_politica_con_test.sql'));
check('migración que no cambia permisos → no se marca', !untested.includes('20261203100000_solo_columna.sql'));
check('migración exenta → no se marca', !untested.includes('20261204100000_exenta.sql'));
check('solo se marca la que corresponde', untested.length === 1);

if (failures > 0) {
  console.error(`\n${failures} caso(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodos los casos pasaron.');
