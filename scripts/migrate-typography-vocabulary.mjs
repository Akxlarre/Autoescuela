#!/usr/bin/env node
/**
 * migrate-typography-vocabulary.mjs — fix-078-b (ASG-b-053)
 *
 * Migra los clusters tipográficos ad-hoc a las clases semánticas del DS:
 *
 *   uppercase + text-text-muted + text-xs [+ font-* ] [+ tracking-*]  →  .overline
 *   text-sm + text-text-primary + font-{semibold,bold} (sin uppercase) →  .item-title
 *
 * IDEMPOTENTE Y RE-EJECUTABLE. A diferencia de `migrate-color-mix-t4.mjs` (que corrió una sola
 * vez en may-2026 y dejó driftear 11 archivos nuevos, ver ASG-b-034), este script está pensado
 * para re-correrse: si una clase ya está migrada no la vuelve a tocar, y correrlo dos veces
 * produce el mismo resultado.
 *
 * NO toca la familia `text-2xs` del overline (68 instancias): migrarlas subiría 10px→12px, un
 * cambio de densidad visible dentro de tablas. Decisión explícita pendiente — ver fix-078-b.
 *
 * Uso:
 *   node scripts/migrate-typography-vocabulary.mjs --dry    # reporta sin escribir
 *   node scripts/migrate-typography-vocabulary.mjs          # aplica
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const DRY = process.argv.includes('--dry');

const files = execSync('git ls-files "src/app/**/*.ts"', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

const WEIGHT = /^font-(?:medium|semibold|bold|extrabold)$/;
const TRACKING = /^tracking-(?:tight|normal|wide|wider|widest)$/;

/** Reescribe un atributo class="..."; devuelve null si no aplica ninguna regla. */
function rewrite(classValue) {
  const parts = classValue.split(/\s+/).filter(Boolean);
  const has = (c) => parts.includes(c);

  // Ya migrada → no tocar (idempotencia)
  if (has('overline') || has('item-title')) return null;

  // ── Regla 1: overline (solo familia text-xs) ──
  if (has('uppercase') && has('text-text-muted') && has('text-xs')) {
    const kept = parts.filter(
      (p) =>
        p !== 'uppercase' &&
        p !== 'text-text-muted' &&
        p !== 'text-xs' &&
        !WEIGHT.test(p) &&
        !TRACKING.test(p),
    );
    return { value: ['overline', ...kept].join(' '), rule: 'overline' };
  }

  // ── Regla 2: item-title ──
  if (
    !has('uppercase') &&
    has('text-sm') &&
    has('text-text-primary') &&
    parts.some((p) => p === 'font-semibold' || p === 'font-bold')
  ) {
    const kept = parts.filter(
      (p) =>
        p !== 'text-sm' &&
        p !== 'text-text-primary' &&
        p !== 'font-semibold' &&
        p !== 'font-bold',
    );
    return { value: ['item-title', ...kept].join(' '), rule: 'item-title' };
  }

  return null;
}

let touchedFiles = 0;
const counts = { overline: 0, 'item-title': 0 };
const perFile = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  let changes = 0;

  const out = src.replace(/class="([^"]+)"/g, (whole, value) => {
    const res = rewrite(value);
    if (!res) return whole;
    changes++;
    counts[res.rule]++;
    return `class="${res.value}"`;
  });

  if (changes > 0) {
    touchedFiles++;
    perFile.push({ file, changes });
    if (!DRY) writeFileSync(file, out, 'utf8');
  }
}

console.log(`${DRY ? '[DRY RUN] ' : ''}Archivos tocados: ${touchedFiles}`);
console.log(`  → .overline:   ${counts.overline}`);
console.log(`  → .item-title: ${counts['item-title']}`);
console.log(`  TOTAL: ${counts.overline + counts['item-title']}`);
if (DRY) {
  console.log('\nTop 15 archivos por cantidad de cambios:');
  perFile
    .sort((a, b) => b.changes - a.changes)
    .slice(0, 15)
    .forEach((p) => console.log(`  ${String(p.changes).padStart(3)}  ${p.file}`));
}
