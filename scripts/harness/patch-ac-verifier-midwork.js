#!/usr/bin/env node
/**
 * patch-ac-verifier-midwork.js — EJECUTAR A MANO, POR UNA PERSONA.
 *
 * Agrega una DECISION RULE al prompt del AC Verifier en `.claude/settings.json`, para que
 * no bloquee cuando el propio track declara que el trabajo sigue en curso.
 *
 * Este script existe porque `settings.json` está protegido a propósito (File Protector):
 * un agente no puede cambiar las reglas que lo evalúan. **Revisá el diff antes de correrlo.**
 *
 * Uso:
 *   node scripts/harness/patch-ac-verifier-midwork.js .claude/settings.json
 *
 * Es idempotente, aborta si no encuentra el ancla, y valida que el resultado siga siendo
 * JSON parseable ANTES de escribir.
 *
 * ── El problema ─────────────────────────────────────────────────────────────────────
 * El prompt ya dice "Do NOT block if the user is clearly mid-feature or mid-fix", pero sus
 * DECISION RULES solo reconocen esa situación por frases del usuario ("voy a continuar
 * mañana"). No reconoce la señal que el propio track escribe: una sección de progreso con
 * ítems sin marcar. Resultado: bloqueó un fix con 2 de 4 consumidores hechos, contradiciendo
 * su propia instrucción.
 *
 * ── El fix ──────────────────────────────────────────────────────────────────────────
 * Una regla más: si `fix.md`/`tasks.md` tiene ítems `[ ]` sin marcar, el track está
 * declarando honestamente que va por la mitad → no bloquear.
 *
 * Efecto observable: un track que reporta progreso parcial deja de ser penalizado por
 * hacerlo, que es justo el comportamiento que se quiere fomentar.
 */
// ESM: el package.json del repo declara "type": "module" (misma convención que
// scripts/assignments-sync.js). Con require() esto explota en runtime.
import fs from 'fs';

const target = process.argv[2];
if (!target) {
  console.error('Uso: node scripts/harness/patch-ac-verifier-midwork.js <ruta a settings.json>');
  process.exit(1);
}

const raw = fs.readFileSync(target, 'utf8');

// El ancla está escapada tal como aparece dentro del JSON (comillas escapadas).
const ANCHOR =
  '- For fix track: if ONLY fix.md was created/edited (no src/ changes yet) -> respond `{\\"ok\\": true}`.';

const NEW_RULE =
  ANCHOR +
  '\\n- If fix.md/tasks.md has a progress section with unchecked items ([ ]), the track itself ' +
  'declares the work is still in progress -> respond `{\\"ok\\": true}`. Do not block a track ' +
  'that is honestly reporting partial completion.';

if (raw.includes('declares the work is still in progress')) {
  console.log('SIN CAMBIOS: la regla ya estaba presente.');
  process.exit(0);
}

if (!raw.includes(ANCHOR)) {
  console.error('ANCLA NO ENCONTRADA — abortado, no se modificó nada.');
  console.error('El prompt puede haber cambiado desde 2026-08-22. Revisar a mano.');
  process.exit(1);
}

const out = raw.replace(ANCHOR, NEW_RULE);

try {
  JSON.parse(out);
} catch (e) {
  console.error('El resultado NO es JSON válido — abortado, no se modificó nada:', e.message);
  process.exit(1);
}

fs.writeFileSync(target, out);
console.log('OK: DECISION RULE agregada al AC Verifier en ' + target);
