#!/usr/bin/env node
/**
 * sync-check.js — Stop Hook (comando)
 *
 * Reemplaza al Sync Check de tipo prompt. Aquel decidía leyendo la conversación y pedía
 * actualizar índices en sesiones que nombraban archivos de src/app sin haberlos creado. Este
 * decide con dos hechos:
 *
 *   1. La transcripción de la sesión: qué archivos escribió una herramienta (Write/Edit).
 *   2. git: cuáles de esos archivos son nuevos (sin seguimiento o recién agregados).
 *
 * Bloquea el cierre (exit 2) solo cuando la sesión CREÓ un artefacto indexable en src/app
 * (componente, facade, servicio, directiva, pipe, guard) y no escribió ningún índice. Una
 * modificación a un archivo que ya existía no bloquea: decidir si cambió su contrato requiere
 * juicio, y esa parte queda en el paso SINCRONIZAR del flujo, no en este hook.
 *
 * Ante cualquier duda de infraestructura (sin transcripción, sin git) deja pasar: un hook de
 * cierre que bloquea por un error propio deja la sesión sin salida.
 */

const fs = require('fs');
const { spawnSync } = require('child_process');

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);
const ARTIFACT_RE = /\.(?:component|facade|service|directive|pipe|guard)\.ts$/;
// USAGE-MAP.md lo regenera un script: escribirlo no cuenta como haber sincronizado.
const GENERATED_INDEX_RE = /\/USAGE-MAP\.md$/;

const posix = (p) => String(p || '').replace(/\\/g, '/');

/** Rutas que escribió una herramienta en la sesión, separadas por tipo de herramienta. */
function sessionWrites(transcriptPath) {
  const created = new Set();
  const touched = new Set();
  let text;
  try {
    text = fs.readFileSync(transcriptPath, 'utf8');
  } catch {
    return null;
  }
  for (const line of text.split('\n')) {
    if (!line.includes('"tool_use"')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const content = entry && entry.message && entry.message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || block.type !== 'tool_use' || !WRITE_TOOLS.has(block.name)) continue;
      const file = posix(block.input && (block.input.file_path || block.input.path));
      if (!file) continue;
      touched.add(file);
      if (block.name === 'Write') created.add(file);
    }
  }
  return { created: [...created], touched: [...touched] };
}

/** De una lista de rutas, las que git ve como nuevas (sin seguimiento o agregadas). */
function newInGit(files, cwd) {
  const run = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ...files], {
    cwd,
    encoding: 'utf8',
  });
  if (run.status !== 0) return null;
  return run.stdout
    .split('\n')
    .filter((row) => /^(?:\?\?|A[ M]?)\s/.test(row))
    .map((row) => posix(row.slice(3).trim().replace(/^"|"$/g, '')));
}

let data = '';
process.stdin.on('data', (chunk) => (data += chunk));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data || '{}');
    // Segunda pasada tras un bloqueo: nunca bloquear de nuevo.
    if (input.stop_hook_active) process.exit(0);

    const writes = sessionWrites(input.transcript_path);
    if (!writes) process.exit(0);

    const candidates = writes.created.filter(
      (file) => file.includes('/src/app/') && ARTIFACT_RE.test(file) && !file.endsWith('.spec.ts'),
    );
    if (candidates.length === 0) process.exit(0);

    const wroteAnIndex = writes.touched.some(
      (file) => /\/indices\/[^/]+\.md$/.test(file) && !GENERATED_INDEX_RE.test(file),
    );
    if (wroteAnIndex) process.exit(0);

    const cwd = input.cwd || process.cwd();
    const fresh = newInGit(candidates, cwd);
    if (!fresh || fresh.length === 0) process.exit(0);

    process.stderr.write(
      'SYNC CHECK: la sesion creo artefactos nuevos en src/app y no actualizo ningun indice.\n' +
        fresh.map((file) => `  - ${file}`).join('\n') +
        '\nAgrega cada uno a indices/COMPONENTS.md, FACADES.md, SERVICES.md, DIRECTIVES.md, ' +
        'UTILS.md o GUARDS.md segun corresponda (skill /sync-indices).',
    );
    process.exit(2);
  } catch {
    process.exit(0);
  }
});
