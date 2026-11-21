/**
 * test-discipline.js — Disciplina de tests fuera de src/app (ARCH-35, ARCH-36, ARCH-37).
 *
 * architect.js exige un .spec.ts a los facades y services de core/. Nada cubría las otras capas:
 * que no crezcan los tests desactivados ni las esperas fijas, que cada edge function valide a
 * quien la llama, y que un cambio de permisos en la base llegue con su test.
 *
 * Funciones puras. El disco lo lee scripts/check-qa-guardrails.mjs.
 */

// ── ARCH-35: trinquete de tests desactivados y esperas fijas ───────────────────────────────

// El paréntesis va pegado a propósito: así una mención en prosa ("están en describe.skip (ver…)")
// no cuenta como un test desactivado.
const UNIT_SKIP_RE = /\b(?:describe|it|test)\.(?:skip|todo)\(|\bx(?:it|describe)\(/g;
const E2E_FIXED_WAIT_RE = /\.waitForTimeout\(/g;
const E2E_SKIP_RE = /\btest\.(?:skip|fixme)\(/g;

const count = (text, re) => (text.match(re) ?? []).length;

/** Tests unitarios desactivados en un spec: describe.skip, it.skip, test.todo, xit, xdescribe. */
export const countUnitSkips = (text) => count(text, UNIT_SKIP_RE);

/** Esperas por reloj en un e2e. */
export const countFixedWaits = (text) => count(text, E2E_FIXED_WAIT_RE);

/** Saltos en un e2e: el test deja de correr según una condición y nadie se entera. */
export const countE2eSkips = (text) => count(text, E2E_SKIP_RE);

/** Specs que vitest.config.ts deja fuera de la corrida. */
export function countVitestExcludedSpecs(configText) {
  const block = configText.match(/exclude\s*:\s*\[([\s\S]*?)\]/);
  if (!block) return 0;
  return (block[1].match(/['"][^'"]+\.spec\.ts['"]/g) ?? []).length;
}

/**
 * @param {Record<string, number>} current  medida → valor de hoy
 * @param {Record<string, number>} baseline medida → valor registrado
 */
export function compareHygiene(current, baseline = {}) {
  const regressions = [];
  const improvements = [];
  for (const [metric, now] of Object.entries(current)) {
    const before = baseline[metric] ?? 0;
    if (now > before) regressions.push({ metric, now, before });
    else if (now < before) improvements.push({ metric, now, before });
  }
  return { regressions, improvements };
}

// ── ARCH-36: edge function que no valida a quien la llama ──────────────────────────────────

/** Guards de autorización compartidos de supabase/functions/_shared. */
export const SHARED_AUTH_GUARDS = ['staff-auth', 'service-role-auth', 'user-edit-authz'];

const GUARD_IMPORT_RE = new RegExp(
  `from\\s+['"]\\.\\./_shared/(?:${SHARED_AUTH_GUARDS.join('|')})(?:\\.ts)?['"]`,
);

/**
 * Importar el guard no prueba que se lo llame, pero una función que ni lo importa seguro no lo
 * usa: es la mitad barata del chequeo.
 */
export const importsSharedGuard = (source) => GUARD_IMPORT_RE.test(source);

/**
 * @param {{ name: string, source: string }[]} functions index.ts de cada edge function
 * @param {Record<string, string>} exempt función → por qué valida de otra forma o no lo necesita
 */
export function findUnguardedFunctions(functions, exempt = {}) {
  return functions
    .filter((fn) => !importsSharedGuard(fn.source) && !(fn.name in exempt))
    .map((fn) => fn.name);
}

/** Excepciones que ya no aplican: la función pasó a usar un guard compartido, o se borró. */
export function findStaleGuardExemptions(functions, exempt = {}) {
  const byName = new Map(functions.map((fn) => [fn.name, fn]));
  return Object.keys(exempt)
    .filter((name) => !byName.has(name) || importsSharedGuard(byName.get(name).source))
    .map((name) => ({
      name,
      reason: byName.has(name) ? 'ya usa un guard compartido' : 'ya no existe',
    }));
}

// ── ARCH-37: migración que cambia permisos sin test SQL ────────────────────────────────────

const PERMISSION_CHANGE_RE = /\b(?:CREATE|ALTER|DROP)\s+POLICY\b|\bSECURITY\s+DEFINER\b/i;

/** Quita los comentarios de línea: una política comentada no cambia permisos. */
const stripSqlLineComments = (sql) => sql.replace(/--[^\n]*/g, '');

/** Crea, cambia o borra una política de RLS, o define una función que se salta la RLS. */
export const changesPermissions = (sql) => PERMISSION_CHANGE_RE.test(stripSqlLineComments(sql));

/** Los 14 dígitos con que empieza el nombre de una migración. */
export function migrationTimestamp(fileName) {
  return fileName.match(/^(\d{14})/)?.[1] ?? null;
}

/**
 * Versiones de migración que usan dos o más archivos. La CLI de Supabase identifica una migración
 * solo por su versión (los 14 dígitos): al aplicar una, registra esa versión y salta la otra
 * creyéndola aplicada, sin avisar.
 *
 * @param {string[]} fileNames nombres de archivo de supabase/migrations
 * @returns {{ version: string, files: string[] }[]}
 */
export function findDuplicateMigrationVersions(fileNames) {
  const byVersion = new Map();
  for (const name of fileNames) {
    const version = migrationTimestamp(name);
    if (!version) continue;
    byVersion.set(version, [...(byVersion.get(version) ?? []), name]);
  }
  return [...byVersion]
    .filter(([, files]) => files.length > 1)
    .map(([version, files]) => ({ version, files }));
}

/**
 * Migraciones posteriores al corte que cambian permisos y que ningún test de supabase/tests
 * nombra. El vínculo es explícito: el test menciona el timestamp de la migración.
 *
 * @param {{ name: string, sql: string }[]} migrations
 * @param {string} testsText contenido concatenado de supabase/tests
 * @param {{ after: string, exempt?: Record<string, string> }} options `after`: timestamp desde
 *        el que rige la regla; las anteriores quedan fuera. `exempt`: migración → por qué no
 *        necesita test.
 */
export function findUntestedPermissionMigrations(migrations, testsText, { after, exempt = {} }) {
  return migrations
    .filter((m) => {
      const ts = migrationTimestamp(m.name);
      if (!ts || ts <= after) return false;
      if (m.name in exempt) return false;
      return changesPermissions(m.sql) && !testsText.includes(ts);
    })
    .map((m) => m.name);
}
