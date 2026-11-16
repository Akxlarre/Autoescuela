#!/usr/bin/env node
/**
 * patch-018-sync-check.js — EJECUTAR A MANO, POR UNA PERSONA.
 *
 * Cambia el Sync Check (hook de cierre) de un prompt que decide leyendo la conversación a un
 * comando que decide con la transcripción y git. Detalle del problema y del cambio:
 * specs/madurez-qa/018-mejoras-al-harness.md §2.5.
 *
 *   1. Crea .claude/hooks/sync-check.js (fuente: scripts/harness/018/sync-check.js).
 *   2. En .claude/settings.json reemplaza el hook de tipo prompt "sync-check auditor" por el
 *      comando `node .claude/hooks/sync-check.js`. No toca ningún otro hook.
 *   3. Actualiza el respaldo de "Sync Check" en scripts/lib/qa-guardrails.allowlist.json, para
 *      que ARCH-31 siga encontrando qué lo implementa.
 *   4. Corrige la sección del Sync Check en docs/HOOKS-SYSTEM.md.
 *
 * Este script existe porque .claude/hooks/ y settings.json están protegidos a propósito (File
 * Protector): un agente no puede cambiar las reglas que lo evalúan. **Revisá el diff antes de
 * commitear.**
 *
 * Uso:
 *   node scripts/harness/patch-018-sync-check.js             aplica
 *   node scripts/harness/patch-018-sync-check.js --dry-run   solo informa
 *   --root <carpeta>   aplica sobre otra carpeta (para probar el parche sobre una copia).
 *
 * Es idempotente, aborta sin escribir nada si no encuentra alguna de sus anclas, y valida que
 * settings.json siga siendo JSON antes de escribir.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const rootArg = args.indexOf('--root');
const ROOT = rootArg !== -1 ? path.resolve(args[rootArg + 1]) : process.cwd();

const at = (rel) => path.join(ROOT, rel);
const HOOK = '.claude/hooks/sync-check.js';
const SETTINGS = '.claude/settings.json';
const ALLOWLIST = 'scripts/lib/qa-guardrails.allowlist.json';
const DOCS = 'docs/HOOKS-SYSTEM.md';
const COMMAND = 'node .claude/hooks/sync-check.js';

function abort(message) {
  console.error(`✖ ${message}\n  No se escribió nada.`);
  process.exit(1);
}

for (const rel of [SETTINGS, ALLOWLIST, DOCS]) {
  if (!fs.existsSync(at(rel))) abort(`No existe ${rel} en ${ROOT}.`);
}

const writes = [];
const notes = [];

// ── 1. el hook ──────────────────────────────────────────────────────────────────────────────
const hookSource = fs.readFileSync(path.join(HERE, '018', 'sync-check.js'), 'utf8');
if (fs.existsSync(at(HOOK)) && fs.readFileSync(at(HOOK), 'utf8') === hookSource) {
  notes.push(`= ${HOOK}: ya estaba aplicado.`);
} else {
  writes.push([HOOK, hookSource]);
  notes.push(`✔ ${HOOK}: creado.`);
}

// ── 2. settings.json ────────────────────────────────────────────────────────────────────────
// Se reemplaza sobre el texto, no re-serializando: el resto del archivo queda byte a byte igual.
const settings = fs.readFileSync(at(SETTINGS), 'utf8');
const PROMPT_HOOK =
  /"type":(\s*)"prompt",(\s*)"prompt":\s*"You are a sync-check auditor(?:[^"\\]|\\.)*"/;
if (settings.includes(COMMAND)) {
  notes.push(`= ${SETTINGS}: el Sync Check ya era un comando.`);
} else if (!PROMPT_HOOK.test(settings)) {
  abort(`${SETTINGS}: no se encontró el hook de tipo prompt "sync-check auditor".`);
} else {
  const patched = settings.replace(
    PROMPT_HOOK,
    (_, afterType, between) => `"type":${afterType}"command",${between}"command": "${COMMAND}"`,
  );
  try {
    JSON.parse(patched);
  } catch (error) {
    abort(`${SETTINGS}: el resultado no es JSON válido (${error.message}).`);
  }
  writes.push([SETTINGS, patched]);
  notes.push(`✔ ${SETTINGS}: el Sync Check pasa de prompt a comando.`);
}

// ── 3. respaldo en la lista de ARCH-31 ──────────────────────────────────────────────────────
const allowText = fs.readFileSync(at(ALLOWLIST), 'utf8');
const OLD_PROOF = '"Sync Check": "sync-check auditor"';
const NEW_PROOF = '"Sync Check": "sync-check.js"';
if (allowText.includes(NEW_PROOF)) {
  notes.push(`= ${ALLOWLIST}: el respaldo ya apuntaba al archivo del hook.`);
} else if (!allowText.includes(OLD_PROOF)) {
  abort(`${ALLOWLIST}: no se encontró el respaldo de "Sync Check".`);
} else {
  writes.push([ALLOWLIST, allowText.replace(OLD_PROOF, NEW_PROOF)]);
  notes.push(`✔ ${ALLOWLIST}: el respaldo de "Sync Check" apunta a sync-check.js.`);
}

// ── 4. documentación ────────────────────────────────────────────────────────────────────────
const docs = fs.readFileSync(at(DOCS), 'utf8');
const eol = docs.includes('\r\n') ? '\r\n' : '\n';
const OLD_SECTION = /### 5\. Sync Check \(prompt hook\)[\s\S]*?(?=### 6\. )/;
const NEW_SECTION = [
  '### 5. Sync Check (`sync-check.js`)',
  '- **Evento**: Stop',
  '- **Matcher**: ninguno (se ejecuta en cada respuesta)',
  '- **Tipo**: `command` (determinista, sin modelo)',
  '- **Función**: Lee en la transcripción qué archivos escribió la sesión y le pregunta a git',
  '  cuáles son nuevos. Bloquea el cierre solo si la sesión creó un componente, facade,',
  '  servicio, directiva, pipe o guard en `src/app` y no escribió ningún índice. Modificar un',
  '  archivo que ya existía no bloquea: revisar si cambió su contrato es parte del paso',
  '  SINCRONIZAR.',
  '',
  '',
].join(eol);
if (docs.includes('### 5. Sync Check (`sync-check.js`)')) {
  notes.push(`= ${DOCS}: la sección ya estaba corregida.`);
} else if (!OLD_SECTION.test(docs)) {
  abort(`${DOCS}: no se encontró la sección "5. Sync Check (prompt hook)".`);
} else {
  writes.push([DOCS, docs.replace(OLD_SECTION, NEW_SECTION)]);
  notes.push(`✔ ${DOCS}: sección del Sync Check corregida.`);
}

// ── Escribir: todo o nada ───────────────────────────────────────────────────────────────────
for (const note of notes) console.log(note);
if (DRY) {
  console.log(`\n--dry-run: ${writes.length} archivo(s) cambiarían. No se escribió nada.`);
  process.exit(0);
}
for (const [rel, content] of writes) {
  fs.mkdirSync(path.dirname(at(rel)), { recursive: true });
  fs.writeFileSync(at(rel), content);
}
console.log(
  `\n${writes.length} archivo(s) escritos. Sigue: npm run lint:arch:strict && npm run test:scripts, y revisar git diff.`,
);
