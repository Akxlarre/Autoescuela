#!/usr/bin/env node
/**
 * check-qa-guardrails.mjs — Runner de ARCH-31 a ARCH-42.
 *
 * Reglas que vigilan lo que architect.js no recorre: el propio harness y las capas de test fuera
 * de src/app. La detección vive en scripts/lib; acá solo se lee el disco.
 *
 *   ARCH-31  hook sin conectar en settings.json, o documentado como activo sin respaldo   error
 *   ARCH-32  la recuperación tras compactar inyecta más que su techo                      trinquete
 *   ARCH-33  fila de un índice demasiado larga (el índice se vuelve historial)            trinquete
 *   ARCH-34  credencial escrita en un archivo versionado                                  error
 *   ARCH-35  tests desactivados y esperas fijas de los e2e                                trinquete
 *   ARCH-36  edge function que no importa un guard de autorización                        error
 *   ARCH-37  migración que cambia permisos sin un test SQL que la nombre                  error
 *   ARCH-38  ruta del catálogo de patrones que ya no existe                               error
 *   ARCH-39  Facade que filtra por sede sin guard de orden de respuestas                  deuda
 *   ARCH-40  Facade con initialize() sin la bandera o el refresco silencioso de SWR       deuda
 *   ARCH-41  página con .bento-grid sin modificador app-like ni entrada en el registro    error
 *   ARCH-42  regla, antipatrón o skill sin alcance declarado (boilerplate o proyecto)     error
 *
 * Un "error" falla siempre. Un "trinquete" compara contra la línea base: avisa en modo normal y
 * falla con --strict, que es como corre el CI de pull requests. Una "deuda" es una lista de archivos
 * con nombre en la línea base: un caso que no está en la lista falla siempre, y la lista solo se
 * achica al consolidar.
 *
 *   node scripts/check-qa-guardrails.mjs                        → lo corre npm run lint:arch
 *   node scripts/check-qa-guardrails.mjs --strict               → lo corre npm run lint:arch:strict
 *   node scripts/check-qa-guardrails.mjs --update-qa-baseline   → registra el estado actual
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  checkPayloadBudget,
  compareIndexRows,
  findMissingReferences,
  findStaleNotWired,
  findUnbackedDocumentedHooks,
  findUnwiredHooks,
  findScopeGaps,
  measureLongRows,
  parseDocumentedHooks,
  parseScopeTable,
  SCOPES,
} from './lib/harness-selfcheck.js';
import {
  classifyDebt,
  hasGridWithoutFillScreen,
  isBranchScopedWithoutGuard,
  isInRegistry,
  nextDebt,
  swrGaps,
} from './lib/pattern-guards.js';
import {
  compareHygiene,
  countE2eSkips,
  countFixedWaits,
  countUnitSkips,
  countVitestExcludedSpecs,
  findStaleGuardExemptions,
  findUnguardedFunctions,
  findUntestedPermissionMigrations,
} from './lib/test-discipline.js';
import {
  compareCredentialCounts,
  findCredentialLiterals,
  isUnitTestFixture,
} from './lib/versioned-credentials.js';

const ROOT = process.cwd();
const STRICT = process.argv.includes('--strict');
const UPDATE = process.argv.includes('--update-qa-baseline');
const ALLOWLIST_PATH = path.join(ROOT, 'scripts', 'lib', 'qa-guardrails.allowlist.json');
const BASELINE_PATH = path.join(ROOT, 'scripts', 'lib', 'qa-guardrails.baseline.json');

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

const abs = (rel) => path.join(ROOT, rel);
const toPosix = (p) => p.replace(/\\/g, '/');

function read(rel) {
  try {
    return fs.readFileSync(abs(rel), 'utf8');
  } catch {
    return null;
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Rutas relativas (con /) de los archivos bajo `rel` que cumplen `keep`. */
function walk(rel, keep, out = []) {
  const dir = abs(rel);
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const childRel = `${rel}/${name}`;
    if (fs.statSync(abs(childRel)).isDirectory()) {
      if (name !== 'node_modules') walk(childRel, keep, out);
    } else if (keep(childRel)) out.push(childRel);
  }
  return out;
}

const allow = readJson(ALLOWLIST_PATH, {});
const baseline = readJson(BASELINE_PATH, {});

let errors = 0;
let warnings = 0;

function report(rule, hard, where, message, fix) {
  const isError = hard || STRICT;
  if (isError) errors++;
  else warnings++;
  const paint = isError ? red : yellow;
  console.error(paint(`${isError ? '❌' : '⚠️ '} [${rule}] ${where}`));
  console.error(`   ${message}`);
  if (fix) console.error(cyan(`   Fix: ${fix}`));
}
const fail = (rule, where, message, fix) => report(rule, true, where, message, fix);
// Al registrar la línea base no se reportan los trinquetes: lo que se mide pasa a ser la base.
const ratchet = (rule, where, message, fix) => {
  if (!UPDATE) report(rule, false, where, message, fix);
};
const note = (rule, message) => console.log(`ℹ ${rule}: ${message}`);

// ══ ARCH-31 — hooks conectados y hooks documentados ════════════════════════════════════════
const settingsText = read('.claude/settings.json');
if (settingsText === null) {
  note('ARCH-31', 'no se encontró .claude/settings.json, se omite.');
} else {
  const hookFiles = walk('.claude/hooks', (f) => f.endsWith('.js'));
  const notWired = allow.hooks?.notWired ?? {};

  for (const file of findUnwiredHooks(hookFiles, settingsText, notWired)) {
    fail(
      'ARCH-31',
      file,
      'El hook está en el directorio y settings.json no lo nombra: no corre.',
      'Conéctalo en .claude/settings.json (lo aplica una persona: el archivo está protegido), o decláralo con su motivo en hooks.notWired de scripts/lib/qa-guardrails.allowlist.json.',
    );
  }
  for (const { file, reason } of findStaleNotWired(hookFiles, settingsText, notWired)) {
    fail(
      'ARCH-31',
      file,
      `Figura como "no conectado" en la lista de excepciones, pero ${reason}.`,
      'Quita la entrada de hooks.notWired en scripts/lib/qa-guardrails.allowlist.json.',
    );
  }

  const claudeMd = read('.claude/CLAUDE.md');
  if (claudeMd !== null) {
    const names = parseDocumentedHooks(claudeMd);
    for (const f of findUnbackedDocumentedHooks(names, allow.hooks?.documented ?? {}, settingsText)) {
      fail(
        'ARCH-31',
        `.claude/CLAUDE.md → "${f.name}"`,
        f.problem === 'sin-mapa'
          ? 'Se presenta como hook activo y no hay registro de qué lo implementa.'
          : `Se presenta como hook activo, pero settings.json no contiene "${f.proof}".`,
        'Si el hook corre, agrega su respaldo en hooks.documented de scripts/lib/qa-guardrails.allowlist.json. Si no corre, sácalo de la sección "Sistema de Hooks Activo".',
      );
    }
  }
}

// ══ ARCH-32 — presupuesto de la recuperación tras compactar ════════════════════════════════
const RECOVERY_HOOK = '.claude/hooks/compact-recovery.js';
if (fs.existsSync(abs(RECOVERY_HOOK))) {
  const run = spawnSync(process.execPath, [abs(RECOVERY_HOOK)], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const bytes = Buffer.byteLength(run.stdout ?? '', 'utf8');
  const { maxBytes, targetBytes } = baseline.compactRecovery ?? {};
  const kb = (n) => `${Math.round(n / 1024)} KB`;

  if (typeof maxBytes !== 'number') {
    note('ARCH-32', `la recuperación inyecta ${kb(bytes)}; sin techo registrado, se omite.`);
  } else if (checkPayloadBudget(bytes, maxBytes).over) {
    ratchet(
      'ARCH-32',
      RECOVERY_HOOK,
      `Después de cada compactación inyecta ${kb(bytes)} al contexto; el techo es ${kb(maxBytes)}.`,
      'El hook tiene que inyectar un mapa de los índices, no su contenido completo. Aplica el cambio en compact-recovery.js (archivo protegido: lo aplica una persona) y baja compactRecovery.maxBytes al objetivo.',
    );
  } else if (typeof targetBytes === 'number' && bytes > targetBytes) {
    note(
      'ARCH-32',
      `la recuperación inyecta ${kb(bytes)}; objetivo ${kb(targetBytes)}, techo ${kb(maxBytes)}. Pendiente de aplicar el cambio en ${RECOVERY_HOOK}.`,
    );
  }
}

// ══ ARCH-33 — filas de índice ══════════════════════════════════════════════════════════════
const indexRows = {};
for (const file of walk('indices', (f) => f.endsWith('.md'))) {
  const measure = measureLongRows(read(file) ?? '');
  if (measure.count > 0) indexRows[file] = measure;
}
{
  const { regressions, improvements } = compareIndexRows(indexRows, baseline.indexRows ?? {});
  for (const r of regressions) {
    ratchet(
      'ARCH-33',
      r.file,
      r.kind === 'fila-nueva'
        ? `Tiene ${r.now} filas de más de 1.200 caracteres; la línea base registra ${r.before}.`
        : `Sus filas largas suman ${r.now} caracteres; la línea base registra ${r.before}. Una fila que ya era larga creció.`,
      'Un índice describe el estado vigente. El historial de versiones vive en el track (specs/) y en git: deja en la fila qué es y cómo se usa hoy, con un puntero al track.',
    );
  }
  if (improvements.length > 0 && !UPDATE) {
    note('ARCH-33', `${improvements.length} índice(s) con filas más cortas que la línea base. Consolida con --update-qa-baseline.`);
  }
}

// ══ ARCH-34 — credenciales en archivos versionados ═════════════════════════════════════════
const TEXT_EXT = ['.md', '.ts', '.js', '.mjs', '.cjs', '.json', '.html', '.yml', '.yaml', '.sql', '.toml', '.txt'];
function versionedFiles() {
  // Versionados más los nuevos que git no ignora: un archivo recién creado se revisa antes del
  // primer commit, no recién en el CI.
  const git = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (git.status === 0 && git.stdout) return git.stdout.split('\n').filter(Boolean).map(toPosix);
  // Sin git (un export del repo): se recorren las carpetas donde vive la documentación y los e2e.
  return ['docs', '.claude', '.agents', 'specs', 'indices', 'e2e', '.github', 'supabase', 'src'].flatMap(
    (dir) => walk(dir, () => true),
  );
}
const credentials = {};
for (const file of versionedFiles()) {
  if (!TEXT_EXT.some((ext) => file.endsWith(ext))) continue;
  // scripts/ trae los propios detectores y sus casos de ejemplo.
  if (file.startsWith('scripts/') || file === 'package-lock.json' || isUnitTestFixture(file)) continue;
  const text = read(file);
  if (text === null) continue;
  const found = findCredentialLiterals(text).length;
  if (found > 0) credentials[file] = found;
}
{
  const { regressions, cleaned } = compareCredentialCounts(credentials, baseline.credentials ?? {});
  for (const r of regressions) {
    fail(
      'ARCH-34',
      r.file,
      r.before === 0
        ? 'Una línea nombra una contraseña y trae un valor con forma de credencial.'
        : `Tiene ${r.now} líneas con forma de credencial; la línea base registra ${r.before}.`,
      'Una credencial no se escribe en un archivo versionado, tampoco una de prueba: la cuenta existe. Léela de una variable de entorno y, en la documentación, nombra la variable.',
    );
  }
  if (cleaned.length > 0 && !UPDATE) {
    note('ARCH-34', `${cleaned.length} archivo(s) con menos credenciales que la línea base. Consolida con --update-qa-baseline.`);
  }
}

// ══ ARCH-35 — higiene de tests ═════════════════════════════════════════════════════════════
const sum = (files, counter) => files.reduce((total, f) => total + counter(read(f) ?? ''), 0);
const unitSpecs = walk('src', (f) => f.endsWith('.spec.ts'));
const e2eFiles = walk('e2e', (f) => f.endsWith('.ts'));
const testHygiene = {
  unitSkips: sum(unitSpecs, countUnitSkips),
  vitestExcludedSpecs: countVitestExcludedSpecs(read('vitest.config.ts') ?? ''),
  e2eFixedWaits: sum(e2eFiles, countFixedWaits),
  e2eSkips: sum(e2eFiles, countE2eSkips),
};
const HYGIENE_HELP = {
  unitSkips: {
    what: 'tests unitarios desactivados (describe.skip, it.skip, test.todo, xit)',
    fix: 'Un test desactivado no protege nada. Arréglalo o bórralo; si el bug es conocido, déjalo escrito con el comportamiento correcto y márcalo como falla esperada.',
  },
  vitestExcludedSpecs: {
    what: 'specs excluidos en vitest.config.ts',
    fix: 'Un spec excluido no corre y nadie se entera. Resuelve el motivo de la exclusión en vez de sumar otro archivo a la lista.',
  },
  e2eFixedWaits: {
    what: 'esperas por reloj en e2e (waitForTimeout)',
    fix: 'Espera la condición, no el tiempo: expect(locator).toBeVisible(), expect.poll o waitForResponse.',
  },
  e2eSkips: {
    what: 'saltos en e2e (test.skip, test.fixme)',
    fix: 'Un test que se salta según los datos del día deja de probar sin avisar. Siembra lo que el test necesita; para un bug conocido usa knownBug().',
  },
};
{
  const { regressions, improvements } = compareHygiene(testHygiene, baseline.testHygiene ?? {});
  for (const r of regressions) {
    ratchet(
      'ARCH-35',
      HYGIENE_HELP[r.metric]?.what ?? r.metric,
      `Hay ${r.now}; la línea base registra ${r.before}.`,
      HYGIENE_HELP[r.metric]?.fix,
    );
  }
  if (improvements.length > 0 && !UPDATE) {
    note(
      'ARCH-35',
      `bajó ${improvements.map((i) => `${i.metric} (${i.before} → ${i.now})`).join(', ')}. Consolida con --update-qa-baseline.`,
    );
  }
}

// ══ ARCH-36 — edge functions y guards de autorización ══════════════════════════════════════
const FUNCTIONS_DIR = 'supabase/functions';
if (fs.existsSync(abs(FUNCTIONS_DIR))) {
  const functions = fs
    .readdirSync(abs(FUNCTIONS_DIR))
    .filter((name) => name !== '_shared' && fs.existsSync(abs(`${FUNCTIONS_DIR}/${name}/index.ts`)))
    .map((name) => ({ name, source: read(`${FUNCTIONS_DIR}/${name}/index.ts`) ?? '' }));
  const exempt = allow.edgeFunctions?.withoutSharedGuard ?? {};

  for (const name of findUnguardedFunctions(functions, exempt)) {
    fail(
      'ARCH-36',
      `${FUNCTIONS_DIR}/${name}/index.ts`,
      'No importa ningún guard de autorización de _shared (staff-auth, service-role-auth, user-edit-authz). Una función con la clave de servicio se salta la RLS: el control de acceso es solo su propio código.',
      'Valida a quien llama con un guard de _shared. Si la función valida de otra forma o no accede a datos, decláralo con su motivo en edgeFunctions.withoutSharedGuard de scripts/lib/qa-guardrails.allowlist.json.',
    );
  }
  for (const { name, reason } of findStaleGuardExemptions(functions, exempt)) {
    fail(
      'ARCH-36',
      `${FUNCTIONS_DIR}/${name}`,
      `Figura como exenta en la lista de excepciones, pero ${reason}.`,
      'Quita la entrada de edgeFunctions.withoutSharedGuard en scripts/lib/qa-guardrails.allowlist.json.',
    );
  }
}

// ══ ARCH-37 — migraciones de permisos con su test SQL ══════════════════════════════════════
const MIGRATIONS_DIR = 'supabase/migrations';
const after = allow.permissionMigrations?.after;
if (fs.existsSync(abs(MIGRATIONS_DIR)) && typeof after === 'string') {
  // Solo se leen las posteriores al corte: las anteriores quedan fuera de la regla.
  const migrations = fs
    .readdirSync(abs(MIGRATIONS_DIR))
    .filter((name) => name.endsWith('.sql') && name.slice(0, 14) > after)
    .map((name) => ({ name, sql: read(`${MIGRATIONS_DIR}/${name}`) ?? '' }));
  const testsText = walk('supabase/tests', (f) => f.endsWith('.sql'))
    .map((f) => read(f) ?? '')
    .join('\n');

  for (const name of findUntestedPermissionMigrations(migrations, testsText, {
    after,
    exempt: allow.permissionMigrations?.exempt ?? {},
  })) {
    fail(
      'ARCH-37',
      `${MIGRATIONS_DIR}/${name}`,
      'Crea o cambia una política de RLS, o define una función SECURITY DEFINER, y ningún test de supabase/tests la nombra.',
      `Agrega un test en supabase/tests/ que pruebe el permiso (incluido lo que NO se puede hacer) y que nombre la migración por su timestamp (${name.slice(0, 14)}). Si el cambio no altera quién accede a qué, decláralo con su motivo en permissionMigrations.exempt de scripts/lib/qa-guardrails.allowlist.json.`,
    );
  }
}

// ══ ARCH-38 — referencias del catálogo de patrones ═════════════════════════════════════════
const PATTERNS_INDEX = 'indices/PATTERNS.md';
const patternsText = read(PATTERNS_INDEX);
if (patternsText !== null) {
  for (const missing of findMissingReferences(patternsText, (rel) => fs.existsSync(abs(rel)))) {
    fail(
      'ARCH-38',
      `${PATTERNS_INDEX} → ${missing}`,
      'El catálogo de patrones manda a partir de un archivo que no existe.',
      'Si el archivo se movió, actualiza la ruta. Si se borró, elige otra implementación de referencia o deja la fila diciendo que no hay una limpia.',
    );
  }
}

// ══ ARCH-39 y ARCH-40 — patrones de los Facades ════════════════════════════════════════════
const facadeFiles = walk('src/app', (f) => f.endsWith('.facade.ts'));
const facadeExempt = allow.facades ?? {};
const debt = baseline.patternDebt ?? {};

const guardOffenders = facadeFiles.filter(
  (f) => !(f in (facadeExempt.withoutRequestGuard ?? {})) && isBranchScopedWithoutGuard(read(f) ?? ''),
);
const swrMissing = Object.fromEntries(
  facadeFiles
    .filter((f) => !(f in (facadeExempt.withoutSwr ?? {})))
    .map((f) => [f, swrGaps(read(f) ?? '')])
    .filter(([, gaps]) => gaps.length > 0),
);
const swrOffenders = Object.keys(swrMissing);

function checkDebt(rule, offenders, known, describe, fix, exemptKey) {
  const { fresh, resolved } = classifyDebt(offenders, known ?? []);
  // Sin lista previa todavía no hay con qué comparar: la primera consolidación la crea.
  if (Array.isArray(known)) {
    for (const file of fresh) {
      fail(rule, file, describe(file), `${fix} Si el patrón no aplica a este Facade, decláralo con su motivo en ${exemptKey} de scripts/lib/qa-guardrails.allowlist.json.`);
    }
  } else if (!UPDATE) {
    note(rule, `${offenders.length} caso(s) y ninguna lista de deuda registrada. Corre --update-qa-baseline.`);
  }
  if (resolved.length > 0 && !UPDATE) {
    note(rule, `${resolved.length} archivo(s) de la lista de deuda ya cumplen. Consolida con --update-qa-baseline.`);
  }
}
checkDebt(
  'ARCH-39',
  guardOffenders,
  debt.requestGuard,
  () => 'Lee la sede activa (selectedBranchId) y no crea ningún guard de orden: al cambiar de sede rápido, una respuesta vieja puede pisar a la nueva sin error visible.',
  'Usa createRequestGuard() de core/utils/request-guard.utils.ts: next() al inicio del fetch, isCurrent() justo antes de aplicar el resultado (.claude/rules/facades.md §7).',
  'facades.withoutRequestGuard',
);
checkDebt(
  'ARCH-40',
  swrOffenders,
  debt.swr,
  (file) => `Tiene initialize() y le falta ${swrMissing[file].join(' y ')}: cada re-visita vuelve a mostrar skeleton, o no hay refresco sin skeleton después de guardar.`,
  'Sigue .claude/rules/swr-pattern.md: bandera _initialized, y refreshSilently() para re-entrada, Realtime y post-mutación.',
  'facades.withoutSwr',
);
for (const key of ['withoutRequestGuard', 'withoutSwr']) {
  for (const file of Object.keys(facadeExempt[key] ?? {})) {
    if (!fs.existsSync(abs(file))) {
      fail(key === 'withoutSwr' ? 'ARCH-40' : 'ARCH-39', file, 'Figura como exento en la lista de excepciones y el archivo ya no existe.', `Quita la entrada de facades.${key} en scripts/lib/qa-guardrails.allowlist.json.`);
    }
  }
}

// ══ ARCH-41 — páginas con grilla y sin modificador app-like ════════════════════════════════
const APP_LIKE_REGISTRY = 'indices/APP-LIKE-ROLLOUT.md';
const registryText = read(APP_LIKE_REGISTRY);
if (registryText !== null) {
  const nested = allow.appLike?.nestedGrids ?? {};
  const pages = walk('src/app/features', (f) => /.component.(?:ts|html)$/.test(f));
  for (const file of pages) {
    if (file in nested || !hasGridWithoutFillScreen(read(file) ?? '') || isInRegistry(file, registryText)) continue;
    fail(
      'ARCH-41',
      file,
      'Declara una .bento-grid sin modificador de pantalla completa y el registro de app-like no la nombra. App-like es el default de toda página enrutable.',
      `Aplica bento-grid--fill-screen (o -2 / -kpi) con su celda .bento-fill (.claude/rules/visual-system.md §"Patrón App-like"). Si es una excepción justificada, regístrala en ${APP_LIKE_REGISTRY}; si es una grilla interna de una página que ya es app-like, decláralo en appLike.nestedGrids de scripts/lib/qa-guardrails.allowlist.json.`,
    );
  }
  for (const file of Object.keys(nested)) {
    if (!fs.existsSync(abs(file)) || !hasGridWithoutFillScreen(read(file) ?? '')) {
      fail('ARCH-41', file, 'Figura como grilla interna en la lista de excepciones, pero el archivo ya no existe o ya no tiene una grilla sin modificador.', 'Quita la entrada de appLike.nestedGrids en scripts/lib/qa-guardrails.allowlist.json.');
    }
  }
}

// ══ ARCH-42 — alcance de cada pieza del harness ════════════════════════════════════════════
const SCOPE_TABLE = 'docs/HARNESS-SCOPE.md';
const scopeText = read(SCOPE_TABLE);
if (scopeText !== null) {
  const pieces = [
    ...walk('.claude/rules', (f) => f.endsWith('.md')).map((f) => `rules/${f.split('/').pop()}`),
    ...[...(read('indices/ANTI-PATTERNS.md') ?? '').matchAll(/^## (AP-\d+)\b/gm)].map((m) => m[1]),
    ...(fs.existsSync(abs('.claude/skills'))
      ? fs
          .readdirSync(abs('.claude/skills'))
          .filter((name) => fs.statSync(abs(`.claude/skills/${name}`)).isDirectory())
          .map((name) => `skills/${name}`)
      : []),
  ];
  const gaps = findScopeGaps(pieces, parseScopeTable(scopeText));
  for (const id of gaps.missing) {
    fail('ARCH-42', `${SCOPE_TABLE} → ${id}`, 'La pieza existe y la tabla de alcance no la clasifica.', `Agrega su fila con uno de: ${SCOPES.join(', ')}.`);
  }
  for (const id of gaps.stale) {
    fail('ARCH-42', `${SCOPE_TABLE} → ${id}`, 'La tabla de alcance clasifica una pieza que ya no existe.', 'Quita la fila, o corrige el nombre si la pieza se renombró.');
  }
  for (const { id, scope } of gaps.invalid) {
    fail('ARCH-42', `${SCOPE_TABLE} → ${id}`, `El alcance "${scope}" no es válido.`, `Usa uno de: ${SCOPES.join(', ')}.`);
  }
}

// ══ Línea base ═════════════════════════════════════════════════════════════════════════════
if (UPDATE) {
  const next = {
    $schema:
      'Línea base de los trinquetes de scripts/check-qa-guardrails.mjs. Se regenera con --update-qa-baseline. Un valor solo debería bajar: si sube, el diff de este archivo lo muestra en el PR.',
    generatedAt: new Date().toISOString(),
    compactRecovery: baseline.compactRecovery ?? {},
    indexRows,
    credentials,
    testHygiene,
    patternDebt: {
      $nota:
        'Facades que hoy no siguen el patrón (ARCH-39 guard de orden, ARCH-40 SWR). La lista solo se achica al consolidar: un caso nuevo se arregla o se agrega a mano.',
      requestGuard: nextDebt(guardOffenders, debt.requestGuard),
      swr: nextDebt(swrOffenders, debt.swr),
    },
  };
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log(green(`✔ Línea base escrita en ${toPosix(path.relative(ROOT, BASELINE_PATH))}.`));
  process.exit(0);
}

if (errors > 0) {
  console.error(red(`\n❌ ARCH-31…42: ${errors} error(es).`));
  process.exit(1);
}
if (warnings > 0) {
  console.error(yellow(`\n⚠️  ARCH-31…42: ${warnings} regresión(es) de trinquete. Con --strict son error.`));
  process.exit(0);
}
console.log(green('✅ ARCH-31…42: harness y capas de test sin regresiones.'));
