/**
 * test-arch24-patches.js — valida los dos parches de ARCH-24 (fix-156-b / ASG-b-092)
 * ANTES de tocar los archivos protegidos reales.
 *
 * Corre sobre COPIAS parcheadas, nunca sobre los originales. Lección de ASG-b-097: `node
 * --check` valida sintaxis, no comportamiento ni sistema de módulos — para un script de un
 * solo uso, la única verificación que sirve es ejecutarlo.
 *
 * Cubre las DOS direcciones. Un guard "arreglado" que deje pasar escrituras reales es peor
 * que el falso positivo que vino a corregir.
 *
 * Uso:  node scripts/harness/test-arch24-patches.js
 * Salida esperada con los parches sanos: todos PASS, exit 0.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync, spawnSync } from 'child_process';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}${detail ? `\n       ${detail}` : ''}`);
    failures++;
  }
}
function skip(name, motivo) {
  console.log(`SKIP --   ${name} (${motivo})`);
}

/**
 * Este script corre en dos escenarios y tiene que dar verde en ambos:
 *   ANTES de aplicar  → valida que los parches hacen lo que dicen.
 *   DESPUÉS de aplicar → sirve de verificación de que el estado real es el correcto.
 *
 * Los casos de control ("el hook SIN parchear reproduce el falso positivo") solo tienen
 * sentido en el primer escenario: una vez aplicado el parche, el original ya no está sin
 * parchear y esos casos se saltean en vez de fallar. La primera versión de este script no
 * lo contemplaba y salía en rojo al re-verificar después de aplicar — un falso rojo enseña
 * a ignorar la suite, que es exactamente lo que un guardrail no puede permitirse.
 */
const architectYaAplicado = fs
  .readFileSync(path.join('scripts', 'architect.js'), 'utf8')
  .includes("'ARCH-24'");
const hookYaAplicado = fs
  .readFileSync(path.join('.claude', 'hooks', 'pre-write-guard.js'), 'utf8')
  .includes('shared-roles.js');

if (architectYaAplicado || hookYaAplicado) {
  console.log(
    `\nℹ️  Estado actual: architect.js ${architectYaAplicado ? 'YA' : 'NO'} parcheado · ` +
      `pre-write-guard.js ${hookYaAplicado ? 'YA' : 'NO'} parcheado.`,
  );
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arch24-'));
const cleanup = [];
function onExit() {
  for (const fn of cleanup.reverse()) {
    try { fn(); } catch { /* best-effort */ }
  }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best-effort */ }
}
process.on('exit', onExit);

// ─────────────────────────────────────────────────────────────────────────────
// PARCHE 1 — architect.js
// La copia va en scripts/ (no en tmp) para que sus imports relativos ./lib/* resuelvan.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Parche 1: scripts/architect.js ─────────────────────────────');

const architectCopy = path.join('scripts', '__arch24-architect-test.js');
fs.copyFileSync(path.join('scripts', 'architect.js'), architectCopy);
cleanup.push(() => fs.unlinkSync(architectCopy));

const patch1 = execFileSync('node', ['scripts/harness/patch-architect-arch24.js', architectCopy], {
  encoding: 'utf8',
});
check(
  'patcher aplica sin abortar',
  architectYaAplicado ? /ya tiene ARCH-24/.test(patch1) : /ARCH-24 aplicado/.test(patch1),
  patch1.trim(),
);

const patched = fs.readFileSync(architectCopy, 'utf8');
check('inyecta la entrada ARCH-24 en RULES', patched.includes(`'ARCH-24': {`));
check('inyecta la invocación por archivo', patched.includes('checkSharedRoles(filePath, content)'));
check('inyecta el import de la lib', patched.includes(`from './lib/shared-roles.js'`));

const syntax = spawnSync('node', ['--check', architectCopy], { encoding: 'utf8' });
check('la copia parcheada es sintácticamente válida', syntax.status === 0, syntax.stderr);

const patch1again = execFileSync('node', ['scripts/harness/patch-architect-arch24.js', architectCopy], {
  encoding: 'utf8',
});
check('idempotente: segunda corrida no duplica', /ya tiene ARCH-24/.test(patch1again));
check('…y sigue habiendo una sola entrada ARCH-24', fs.readFileSync(architectCopy, 'utf8').split(`'ARCH-24': {`).length - 1 === 1);

// Aborta limpio si el ancla no existe.
const roto = path.join(tmp, 'architect-roto.js');
fs.writeFileSync(roto, 'const nada = 1;\n');
const abort = spawnSync('node', ['scripts/harness/patch-architect-arch24.js', roto], { encoding: 'utf8' });
check('aborta si las anclas no matchean', abort.status === 1 && /Abortado sin tocar/.test(abort.stderr));
check('…y deja el archivo intacto', fs.readFileSync(roto, 'utf8') === 'const nada = 1;\n');

// ── Comportamiento end-to-end del linter parcheado ──────────────────────────
// DIRECCIÓN A: el árbol actual debe pasar (los 6 organismos legítimos están declarados).
const limpio = spawnSync('node', [architectCopy], { encoding: 'utf8' });
check(
  'DEJA PASAR: el repo tal como está no dispara ningún ARCH-24',
  !/ARCH-24/.test(limpio.stdout + limpio.stderr),
  (limpio.stdout + limpio.stderr).split('\n').filter((l) => l.includes('ARCH-24')).join('\n'),
);

// DIRECCIÓN B: un Dumb nuevo que inyecta un Facade debe fallar.
const fixtureDir = path.join('src', 'app', 'shared', 'components', '__arch24_fixture__');
const fixture = path.join(fixtureDir, 'arch24-fixture.component.ts');
fs.mkdirSync(fixtureDir, { recursive: true });
cleanup.push(() => fs.rmSync(fixtureDir, { recursive: true, force: true }));
fs.writeFileSync(
  fixture,
  `import { ChangeDetectionStrategy, Component, inject } from '@angular/core';\n` +
  `import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';\n` +
  `@Component({ selector: 'app-arch24-fixture', template: '', changeDetection: ChangeDetectionStrategy.OnPush })\n` +
  `export class Arch24FixtureComponent { private readonly f = inject(AdminAlumnosFacade); }\n`,
);

const conViolacion = spawnSync('node', [architectCopy], { encoding: 'utf8' });
const salida = conViolacion.stdout + conViolacion.stderr;
check('BLOQUEA: un Dumb de shared/ que inyecta un Facade dispara ARCH-24', /ARCH-24/.test(salida));
check('…y hace fallar la auditoría (exit 1)', conViolacion.status === 1);
check('…nombrando el archivo culpable', salida.includes('arch24-fixture.component.ts'));

// El linter SIN parchear no ve nada: prueba de que el parche es lo que agrega la cobertura.
if (architectYaAplicado) {
  skip(
    'el linter sin parchear NO detecta la misma violación',
    'architect.js ya está parcheado — el control solo aplica antes de aplicar',
  );
} else {
  const sinParche = spawnSync('node', ['scripts/architect.js'], { encoding: 'utf8' });
  check(
    'el linter sin parchear NO detecta la misma violación (la regla es nueva)',
    !/ARCH-24/.test(sinParche.stdout + sinParche.stderr),
  );
}

fs.rmSync(fixtureDir, { recursive: true, force: true });

// ─────────────────────────────────────────────────────────────────────────────
// PARCHE 2 — .claude/hooks/pre-write-guard.js
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Parche 2: .claude/hooks/pre-write-guard.js ──────────────────');

const hookOriginal = path.join('.claude', 'hooks', 'pre-write-guard.js');
const hookDir = path.join(tmp, 'hooks');
fs.mkdirSync(hookDir, { recursive: true });
// El hook es CJS dentro de un repo ESM: necesita su package.json al lado, como el original.
fs.copyFileSync(path.join('.claude', 'hooks', 'package.json'), path.join(hookDir, 'package.json'));
const hookCopy = path.join(hookDir, 'pre-write-guard.js');
fs.copyFileSync(hookOriginal, hookCopy);

const patch2 = execFileSync('node', ['scripts/harness/patch-pre-write-guard-role.js', hookCopy], {
  encoding: 'utf8',
});
check(
  'patcher aplica sin abortar',
  hookYaAplicado ? /ya usa shared-roles/.test(patch2) : /Check de rol corregido/.test(patch2),
  patch2.trim(),
);
check('usa la lib compartida', fs.readFileSync(hookCopy, 'utf8').includes('shared-roles.js'));
check(
  'elimina el patrón viejo que matcheaba LayoutDrawerFacadeService',
  !fs.readFileSync(hookCopy, 'utf8').includes('shared/ no debe tener Facades'),
);
const syntax2 = spawnSync('node', ['--check', hookCopy], { encoding: 'utf8' });
check('la copia parcheada es sintácticamente válida', syntax2.status === 0, syntax2.stderr);
const patch2again = execFileSync('node', ['scripts/harness/patch-pre-write-guard-role.js', hookCopy], {
  encoding: 'utf8',
});
check('idempotente: segunda corrida no duplica', /ya usa shared-roles/.test(patch2again));

// ── Comportamiento del hook: se ejecuta de verdad, con stdin JSON ────────────
const SESSION = 'arch24-test-session';
const flag = path.join(os.tmpdir(), `koa-discovery-${SESSION}.flag`);
fs.writeFileSync(flag, 'ok'); // levantar el Discovery Gate, que no es lo que estamos probando
cleanup.push(() => fs.rmSync(flag, { force: true }));

function runHook(hookPath, filePath, content) {
  const res = spawnSync('node', [hookPath], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath, content } }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_SESSION_ID: SESSION },
  });
  return { blocked: res.status === 2, stderr: res.stderr || '' };
}

const abs = (p) => path.join(process.cwd(), p);
const DUMB = abs('src/app/shared/components/kpi-card/kpi-card.component.ts');
const AJUSTES = abs('src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts');
const DRAWER_ORGANISMO = abs('src/app/shared/components/pago-instructor-modal/pago-instructor-modal.component.ts');

const OK_HEADER = `import { ChangeDetectionStrategy, Component, inject } from '@angular/core';\n`;

const casos = [
  {
    name: 'BLOQUEA: Dumb que inyecta un Facade de dominio',
    file: DUMB,
    content: OK_HEADER + `import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';\nconst f = inject(AdminAlumnosFacade); // OnPush`,
    esperado: true,
  },
  {
    name: 'DEJA PASAR: Organismo declarado con el Facade de su dominio',
    file: DRAWER_ORGANISMO,
    content: OK_HEADER + `import { LiquidacionesFacade } from '@core/facades/liquidaciones.facade';\nconst f = inject(LiquidacionesFacade); // OnPush`,
    esperado: false,
  },
  {
    name: 'DEJA PASAR: LayoutDrawerFacadeService (falso positivo que se vino a arreglar)',
    file: DUMB,
    content: OK_HEADER + `import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';\nconst d = inject(LayoutDrawerFacadeService); // OnPush`,
    esperado: false,
  },
  {
    name: 'DEJA PASAR: Organismo con waiver explícito de transversales (ajustes-drawer)',
    file: AJUSTES,
    content: OK_HEADER + `import { AuthFacade } from '@core/facades/auth.facade';\nconst a = inject(AuthFacade); // OnPush`,
    esperado: false,
  },
  {
    name: 'BLOQUEA: Organismo que inyecta un transversal SIN waiver',
    file: DRAWER_ORGANISMO,
    content: OK_HEADER + `import { BranchFacade } from '@core/facades/branch.facade';\nconst b = inject(BranchFacade); // OnPush`,
    esperado: true,
  },
  {
    name: 'DEJA PASAR: Dumb puro sin inyecciones',
    file: DUMB,
    content: OK_HEADER + `export class KpiCardComponent { valor = input.required<number>(); } // OnPush`,
    esperado: false,
  },
];

for (const caso of casos) {
  const r = runHook(hookCopy, caso.file, caso.content);
  check(caso.name, r.blocked === caso.esperado, r.stderr.slice(0, 400));
}

// El hook SIN parchear reproduce el falso positivo: prueba de que el parche cambia algo real.
if (hookYaAplicado) {
  skip(
    'los 2 controles del hook sin parchear',
    'pre-write-guard.js ya está parcheado — el original ya no reproduce el bug',
  );
} else {
  const fpSinParche = runHook(
    hookOriginal,
    DUMB,
    OK_HEADER + `import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';\nconst d = inject(LayoutDrawerFacadeService); // OnPush`,
  );
  check('el hook sin parchear SÍ bloquea LayoutDrawerFacadeService (falso positivo reproducido)', fpSinParche.blocked);

  const organismoSinParche = runHook(
    hookOriginal,
    DRAWER_ORGANISMO,
    OK_HEADER + `import { LiquidacionesFacade } from '@core/facades/liquidaciones.facade';\nconst f = inject(LiquidacionesFacade); // OnPush`,
  );
  check('el hook sin parchear bloquea a un organismo legítimo (regla stale reproducida)', organismoSinParche.blocked);
}

// Con los parches ya aplicados, el valor de este script es verificar el estado REAL.
if (hookYaAplicado) {
  const casosReales = casos.map((c) => ({ ...c }));
  for (const caso of casosReales) {
    const r = runHook(hookOriginal, caso.file, caso.content);
    check(`[archivo real] ${caso.name}`, r.blocked === caso.esperado, r.stderr.slice(0, 400));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`❌ ${failures} caso(s) fallaron. NO apliques los parches sobre los archivos reales.`);
  process.exit(1);
}
if (architectYaAplicado && hookYaAplicado) {
  console.log('✅ ARCH-24: parches YA aplicados y verificados sobre los archivos reales.');
} else {
  console.log('✅ ARCH-24: los dos parches están validados sobre copias. Seguro aplicarlos.');
}
