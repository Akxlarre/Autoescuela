#!/usr/bin/env node
/**
 * patch-018-compact-recovery-y-base-real.js — EJECUTAR A MANO, POR UNA PERSONA.
 *
 * Aplica los dos cambios de specs/madurez-qa/018-mejoras-al-harness.md que tocan archivos
 * protegidos, más los dos ajustes que dependen de ellos:
 *
 *   1. Reemplaza .claude/hooks/compact-recovery.js por la versión que inyecta un MAPA de los
 *      índices (unos 18 KB) en vez de su contenido completo (unos 742 KB).
 *   2. Agrega a .claude/hooks/bash-guard.js un bloque que frena `supabase db reset` contra el
 *      proyecto enlazado, que es la base real (indices/DOMAIN-GOTCHAS.md DG-128).
 *   3. Baja el techo de ARCH-32 en scripts/lib/qa-guardrails.baseline.json a su objetivo.
 *   4. Corrige la viñeta de Compact Recovery en .claude/CLAUDE.md.
 *
 * Este script existe porque .claude/hooks/ está protegido a propósito (File Protector): un
 * agente no puede cambiar las reglas que lo evalúan. **Revisá el diff antes de commitear.**
 *
 * Uso:
 *   node scripts/harness/patch-018-compact-recovery-y-base-real.js             aplica
 *   node scripts/harness/patch-018-compact-recovery-y-base-real.js --dry-run   solo informa
 *   node scripts/harness/patch-018-compact-recovery-y-base-real.js --completo  el bloque de
 *        bash-guard frena además `db push`, `functions deploy|delete` y `secrets set|unset`.
 *        Usar solo si esas operaciones las va a ejecutar siempre una persona.
 *   --root <carpeta>   aplica sobre otra carpeta (para probar el parche sobre una copia).
 *
 * Es idempotente y aborta sin escribir nada si no encuentra alguna de sus anclas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const FULL = args.includes('--completo');
const rootArg = args.indexOf('--root');
const ROOT = rootArg !== -1 ? path.resolve(args[rootArg + 1]) : process.cwd();

const at = (rel) => path.join(ROOT, rel);
const RECOVERY = '.claude/hooks/compact-recovery.js';
const BASH_GUARD = '.claude/hooks/bash-guard.js';
const BASELINE = 'scripts/lib/qa-guardrails.baseline.json';
const CLAUDE_MD = '.claude/CLAUDE.md';

function abort(message) {
  console.error(`✖ ${message}\n  No se escribió nada.`);
  process.exit(1);
}

for (const rel of [RECOVERY, BASH_GUARD, BASELINE, CLAUDE_MD]) {
  if (!fs.existsSync(at(rel))) abort(`No existe ${rel} en ${ROOT}.`);
}

const writes = [];
const notes = [];

// ── 1. compact-recovery.js ──────────────────────────────────────────────────────────────────
const newRecovery = fs.readFileSync(path.join(HERE, '018', 'compact-recovery.js'), 'utf8');
if (fs.readFileSync(at(RECOVERY), 'utf8') === newRecovery) {
  notes.push(`= ${RECOVERY}: ya estaba aplicado.`);
} else {
  writes.push([RECOVERY, newRecovery]);
  notes.push(`✔ ${RECOVERY}: reemplazado por la versión que inyecta el mapa de índices.`);
}

// ── 2. bash-guard.js ────────────────────────────────────────────────────────────────────────
const RULES = [
  ["/supabase\\s+db\\s+reset\\b[^;|&]*--(?:linked|db-url)/", 'db reset contra el proyecto enlazado borra la base real', false],
  ["/supabase\\s+db\\s+push\\b/", 'db push aplica migraciones a la base real', true],
  ["/supabase\\s+functions\\s+(?:deploy|delete)\\b/", 'publica o borra una edge function en produccion', true],
  ["/supabase\\s+secrets\\s+(?:set|unset)\\b/", 'cambia un secreto de produccion', true],
];
const ruleLines = RULES.filter(([, , onlyFull]) => FULL || !onlyFull)
  .map(([re, msg]) => `      { re: ${re}, msg: '${msg}' },`)
  .join('\n');

const BLOCK = [
  '    // ═══════════════════════════════════════════════════════════════════════',
  '    // 4. BASE REAL — el proyecto enlazado es la base que usan los clientes',
  '    //    (indices/DOMAIN-GOTCHAS.md DG-128)',
  '    // ═══════════════════════════════════════════════════════════════════════',
  '    const linkedDbPatterns = [',
  ruleLines,
  '    ];',
  '',
  '    for (const { re, msg } of linkedDbPatterns) {',
  '      if (re.test(command)) {',
  '        process.stderr.write(',
  '          `\\u{1F6D1} BASH GUARD: Operacion sobre la base real bloqueada.\\n` +',
  '          `Razon: ${msg}\\n` +',
  '          `No existe una base de desarrollo (DG-128). Pide al humano que lo ejecute en su terminal.`',
  '        );',
  '        process.exit(2);',
  '      }',
  '    }',
  '',
].join('\n');

const guard = fs.readFileSync(at(BASH_GUARD), 'utf8');
if (guard.includes('linkedDbPatterns')) {
  notes.push(`= ${BASH_GUARD}: el bloque de base real ya estaba.`);
} else {
  // Ancla: el process.exit(0) que cierra el try, justo antes del catch.
  const anchor = /\n[ \t]*process\.exit\(0\);\r?\n[ \t]*\} catch \{/;
  const match = guard.match(anchor);
  if (!match) abort(`${BASH_GUARD}: no se encontró el cierre del try (process.exit(0) antes del catch).`);
  const patched = guard.slice(0, match.index) + '\n' + BLOCK + guard.slice(match.index);
  writes.push([BASH_GUARD, patched]);
  notes.push(
    `✔ ${BASH_GUARD}: bloque de base real agregado (${FULL ? 'las cuatro operaciones' : 'solo db reset; --completo suma las otras tres'}).`,
  );
}

// ── 3. techo de ARCH-32 ─────────────────────────────────────────────────────────────────────
const baseline = JSON.parse(fs.readFileSync(at(BASELINE), 'utf8'));
const target = baseline.compactRecovery?.targetBytes;
if (typeof target !== 'number') abort(`${BASELINE}: falta compactRecovery.targetBytes.`);
if (baseline.compactRecovery.maxBytes === target) {
  notes.push(`= ${BASELINE}: el techo ya era ${target}.`);
} else {
  baseline.compactRecovery.maxBytes = target;
  baseline.compactRecovery.$nota =
    'Techo de lo que compact-recovery.js inyecta al contexto. El hook inyecta un mapa de los índices, no su contenido.';
  writes.push([BASELINE, `${JSON.stringify(baseline, null, 2)}\n`]);
  notes.push(`✔ ${BASELINE}: techo de ARCH-32 bajado a ${target} bytes.`);
}

// ── 4. viñeta de CLAUDE.md ──────────────────────────────────────────────────────────────────
const OLD_BULLET = '- **Compact Recovery** — Si el contexto se compacta, los índices se re-inyectan automáticamente.';
const NEW_BULLET =
  '- **Compact Recovery** — Si el contexto se compacta, se re-inyecta el mapa de los índices (qué hay y dónde), no su contenido: vuelve a leer con Read la sección que necesites.';
const claudeMd = fs.readFileSync(at(CLAUDE_MD), 'utf8');
if (claudeMd.includes(NEW_BULLET)) {
  notes.push(`= ${CLAUDE_MD}: la viñeta ya estaba corregida.`);
} else if (!claudeMd.includes(OLD_BULLET)) {
  abort(`${CLAUDE_MD}: no se encontró la viñeta de Compact Recovery.`);
} else {
  writes.push([CLAUDE_MD, claudeMd.replace(OLD_BULLET, NEW_BULLET)]);
  notes.push(`✔ ${CLAUDE_MD}: viñeta de Compact Recovery corregida.`);
}

// ── Escribir: todo o nada ───────────────────────────────────────────────────────────────────
for (const note of notes) console.log(note);
if (DRY) {
  console.log(`\n--dry-run: ${writes.length} archivo(s) cambiarían. No se escribió nada.`);
  process.exit(0);
}
for (const [rel, content] of writes) fs.writeFileSync(at(rel), content);
console.log(
  `\n${writes.length} archivo(s) escritos. Sigue: npm run lint:arch:strict && npm run test:scripts, y revisar git diff.`,
);
