/**
 * Micro-suite de versioned-credentials.js. Sin framework:
 * `node scripts/lib/versioned-credentials.test.mjs` — exit 1 si algún caso falla.
 *
 * Los valores de ejemplo son inventados para esta suite; ninguno es una credencial de nada.
 */
import {
  compareCredentialCounts,
  findCredentialLiterals,
  isUnitTestFixture,
} from './versioned-credentials.js';

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}

const marca = (text) => findCredentialLiterals(text).length;

// ── Casos que SÍ deben marcarse ─────────────────────────────────────────────────────────────
check('prosa en Markdown con el valor en backticks', marca('Contraseña única: `Ejemplo12345`') === 1);
check('prosa sin dos puntos', marca('Todas usan la contraseña `Ejemplo12345` del seed.') === 1);
check('asignación en TypeScript', marca("  password: 'Ejemplo12345',") === 1);
check('constante en mayúsculas', marca('const PASSWORD = "Ejemplo12345";') === 1);
check('sin tilde ni eñe', marca('contrasena de la cuenta: `Ejemplo12345`') === 1);
check('informa el número de línea', findCredentialLiterals('uno\ndos\npassword: "Ejemplo12345"')[0].line === 3);
check(
  'dos valores en la misma línea cuentan una vez',
  marca('password: `Ejemplo12345` o `Otro98765x`') === 1,
);
check(
  'el reporte no copia el valor',
  !JSON.stringify(findCredentialLiterals('password: "Ejemplo12345"')).includes('Ejemplo12345'),
);

// ── Casos que NO deben marcarse ─────────────────────────────────────────────────────────────
check('sin la palabra clave en la línea', marca('El id de ejemplo es `Ejemplo12345`.') === 0);
check('variable de entorno', marca('La contraseña se lee de `E2E_PASSWORD`.') === 0);
check('lectura de entorno en código', marca("password: process.env['E2E_PASSWORD'],") === 0);
check('marcador de posición', marca('npx supabase secrets set "SMTP_PASS=…" para la contraseña') === 0);
check('ruta de archivo', marca('La contraseña está en `e2e/support/accounts2.ts`.') === 0);
check('referencia a un track', marca('La contraseña se quitó en `hotfix-007-i`.') === 0);
check('solo dígitos (un RUT)', marca('La contraseña inicial es el RUT (ej. `19658564`).') === 0);
check('solo letras', marca('Escribe la contraseña en el campo `passwordInput`.') === 0);
check('valor demasiado corto', marca('password: "abc123"') === 0);
check('validador de formulario', marca("password: ['', [Validators.minLength(8)]],") === 0);
check('llamada a función', marca('password: `generar(12)`') === 0);

// ── Alcance ─────────────────────────────────────────────────────────────────────────────────
check('spec unitario de la app → fixture', isUnitTestFixture('src/app/core/facades/auth.facade.spec.ts'));
check('test de edge function → fixture', isUnitTestFixture('supabase/functions/_shared/staff-auth.test.ts'));
check('e2e → NO es fixture: sus cuentas existen', !isUnitTestFixture('e2e/auth-sesion.spec.ts'));
check('guía → NO es fixture', !isUnitTestFixture('docs/E2E-PLAYWRIGHT.md'));
check('ruta de Windows', isUnitTestFixture('src\\app\\core\\facades\\auth.facade.spec.ts'));

// ── Trinquete ───────────────────────────────────────────────────────────────────────────────
check(
  'archivo nuevo con una credencial → regresión',
  compareCredentialCounts({ 'docs/NUEVO.md': 1 }, {}).regressions.length === 1,
);
check(
  'archivo conocido que suma otra → regresión',
  compareCredentialCounts({ 'docs/A.md': 2 }, { 'docs/A.md': 1 }).regressions[0]?.now === 2,
);
check(
  'sin cambios → nada',
  compareCredentialCounts({ 'docs/A.md': 1 }, { 'docs/A.md': 1 }).regressions.length === 0,
);
const limpio = compareCredentialCounts({}, { 'docs/A.md': 1 });
check('archivo que dejó de tenerla → limpiado', limpio.regressions.length === 0 && limpio.cleaned.length === 1);

if (failures > 0) {
  console.error(`\n${failures} caso(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodos los casos pasaron.');
