/**
 * Micro-suite del hook de cierre scripts/harness/018/sync-check.js y de su parche. Monta un repo
 * temporal con git, una transcripción falsa, y corre el hook como lo corre Claude Code.
 * Sin framework: `node scripts/lib/sync-check-hook.test.mjs`. Exit 1 si algún caso falla.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOOK_SOURCE = path.join(HERE, '..', 'harness', '018', 'sync-check.js');
const PATCH = path.join(HERE, '..', 'harness', 'patch-018-sync-check.js');

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`PASS ok   ${name}`);
  else {
    console.error(`FALLO: ${name}`);
    failures++;
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-check-'));
const put = (rel, content) => {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full.replace(/\\/g, '/');
};
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });

// El hook es CommonJS (como el resto de .claude/hooks): se corre desde una copia con su package.json.
put('.claude/hooks/package.json', '{"type": "commonjs"}');
const hook = put('.claude/hooks/sync-check.js', fs.readFileSync(HOOK_SOURCE, 'utf8'));

git('init', '-q');
git('config', 'user.email', 'test@example.invalid');
git('config', 'user.name', 'test');
const existing = put('src/app/core/facades/viejo.facade.ts', '// ya existía\n');
git('add', '-A');
git('commit', '-q', '-m', 'base');

const toolUse = (name, file) =>
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input: { file_path: file } }] } });
const prose = (text) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } });

let n = 0;
function run(lines, extra = {}) {
  const transcript = put(`t/${n++}.jsonl`, lines.join('\n'));
  const result = spawnSync(process.execPath, [hook], {
    cwd: root,
    encoding: 'utf8',
    input: JSON.stringify({ transcript_path: transcript, cwd: root, ...extra }),
  });
  return { code: result.status, err: result.stderr ?? '' };
}

const fresh = put('src/app/shared/components/nuevo/nuevo.component.ts', '// nuevo\n');
const freshSpec = put('src/app/shared/components/nuevo/nuevo.component.spec.ts', '// spec\n');
const index = put('indices/COMPONENTS.md', '| `app-nuevo` |\n');
const usageMap = put('indices/USAGE-MAP.md', 'generado\n');

check('sesión sin escrituras → deja cerrar', run([prose('hola')]).code === 0);
check(
  'nombrar un archivo de src/app en la conversación, sin escribirlo → deja cerrar',
  run([prose(`revisé ${fresh} y ${existing}`)]).code === 0,
);
check(
  'escribir solo en scripts/ y specs/ → deja cerrar',
  run([toolUse('Write', put('scripts/x.mjs', '1')), toolUse('Write', put('specs/a.md', 'a'))]).code === 0,
);
{
  const r = run([toolUse('Write', fresh)]);
  check('crear un componente y no tocar índices → bloquea', r.code === 2);
  check('el mensaje nombra el archivo creado', r.err.includes('nuevo.component.ts'));
}
check(
  'crear un componente y editar un índice → deja cerrar',
  run([toolUse('Write', fresh), toolUse('Edit', index)]).code === 0,
);
check(
  'USAGE-MAP.md no cuenta como índice actualizado',
  run([toolUse('Write', fresh), toolUse('Write', usageMap)]).code === 2,
);
check('crear solo un spec → deja cerrar', run([toolUse('Write', freshSpec)]).code === 0);
check(
  'editar un facade que ya existía → deja cerrar',
  run([toolUse('Edit', existing), toolUse('Write', existing)]).code === 0,
);
check(
  'segunda pasada (stop_hook_active) → nunca bloquea',
  run([toolUse('Write', fresh)], { stop_hook_active: true }).code === 0,
);
{
  const result = spawnSync(process.execPath, [hook], {
    cwd: root,
    encoding: 'utf8',
    input: JSON.stringify({ transcript_path: path.join(root, 'no-existe.jsonl'), cwd: root }),
  });
  check('sin transcripción → deja cerrar', result.status === 0);
}
{
  const result = spawnSync(process.execPath, [hook], { cwd: root, encoding: 'utf8', input: 'no es json' });
  check('entrada inválida → deja cerrar', result.status === 0);
}

// ── El parche ───────────────────────────────────────────────────────────────────────────────
const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-check-patch-'));
const putCopy = (rel, content) => {
  fs.mkdirSync(path.dirname(path.join(copy, rel)), { recursive: true });
  fs.writeFileSync(path.join(copy, rel), content);
};
const readCopy = (rel) => fs.readFileSync(path.join(copy, rel), 'utf8');
const settingsBefore =
  '{\r\n  "hooks": {\r\n    "Stop": [\r\n      {\r\n        "hooks": [\r\n          {\r\n            "type": "prompt",\r\n            "prompt": "You are a sync-check auditor. Respond {\\"ok\\": true}."\r\n          },\r\n          {\r\n            "type": "prompt",\r\n            "prompt": "You are the SDD Acceptance Criteria Verifier."\r\n          }\r\n        ]\r\n      }\r\n    ]\r\n  }\r\n}\r\n';
putCopy('.claude/settings.json', settingsBefore);
putCopy('scripts/lib/qa-guardrails.allowlist.json', '{ "hooks": { "documented": { "Sync Check": "sync-check auditor" } } }\n');
putCopy('docs/HOOKS-SYSTEM.md', '### 5. Sync Check (prompt hook)\n- viejo\n\n### 6. Prettier\n- sigue\n');
const patch = (...args) => spawnSync(process.execPath, [PATCH, '--root', copy, ...args], { encoding: 'utf8' });

check('--dry-run no escribe', patch('--dry-run').status === 0 && readCopy('.claude/settings.json') === settingsBefore);
check('el parche aplica', patch().status === 0);
{
  const after = JSON.parse(readCopy('.claude/settings.json'));
  const hooks = after.hooks.Stop[0].hooks;
  check('el Sync Check queda como comando', hooks[0].type === 'command' && hooks[0].command.endsWith('sync-check.js'));
  check('el AC Verifier no se toca', hooks[1].type === 'prompt' && hooks[1].prompt.includes('Acceptance'));
  check('settings.json conserva sus saltos de línea', readCopy('.claude/settings.json').includes('\r\n'));
  check('el hook queda en su lugar', readCopy('.claude/hooks/sync-check.js') === fs.readFileSync(HOOK_SOURCE, 'utf8'));
  check('el respaldo de ARCH-31 apunta al archivo', readCopy('scripts/lib/qa-guardrails.allowlist.json').includes('"sync-check.js"'));
  const docs = readCopy('docs/HOOKS-SYSTEM.md');
  check('la documentación cambia y la sección siguiente queda', docs.includes('determinista') && docs.includes('### 6. Prettier\n- sigue'));
}
{
  const before = readCopy('.claude/settings.json');
  const again = patch();
  check('aplicarlo dos veces no cambia nada', again.status === 0 && again.stdout.includes('0 archivo(s)') && readCopy('.claude/settings.json') === before);
}
{
  putCopy('.claude/settings.json', '{ "hooks": {} }\n');
  fs.rmSync(path.join(copy, '.claude/hooks/sync-check.js'));
  const r = patch();
  check('sin el ancla aborta y no crea el hook', r.status === 1 && !fs.existsSync(path.join(copy, '.claude/hooks/sync-check.js')));
}

fs.rmSync(root, { recursive: true, force: true });
fs.rmSync(copy, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n${failures} caso(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodos los casos pasaron.');
