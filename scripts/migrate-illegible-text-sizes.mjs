#!/usr/bin/env node
/**
 * migrate-illegible-text-sizes.mjs — fix-082-b (ASG-b-055)
 *
 * Migra SOLO los tamaños arbitrarios de la escala tipográfica que NO requieren decisión
 * de diseño:
 *
 *   text-[8px] / text-[9px]   → ilegibles, por debajo del piso absoluto del DS (text-2xs, 10px)
 *   text-[10px] / text-[11px] → drift: fix-032-m ya migró exactamente esta forma a
 *                                text-2xs; volvieron a aparecer en archivos escritos después
 *                                de esa migración
 *
 * Todos migran a `text-2xs` (el token ya existe, es el piso declarado del DS).
 *
 * Deliberadamente NO toca 13/15/17/22px — esas 40 instancias son decisión de diseño real
 * (¿redondear a la escala existente o formalizar un peldaño nuevo?), documentada aparte en
 * fix-082-b.
 *
 * Idempotente: si `text-2xs` ya está presente en el mismo class="", no lo duplica.
 *
 * Uso:
 *   node scripts/migrate-illegible-text-sizes.mjs --dry
 *   node scripts/migrate-illegible-text-sizes.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const DRY = process.argv.includes('--dry');
const TARGET_SIZES = ['text-[8px]', 'text-[9px]', 'text-[10px]', 'text-[11px]'];

const files = execSync('git ls-files "src/app/**/*.ts"', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

let filesChanged = 0;
let totalReplacements = 0;
const perSize = new Map();

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  let changed = false;

  const out = src.replace(/class="([^"]*)"/g, (whole, value) => {
    const parts = value.split(/\s+/).filter(Boolean);
    let hit = false;
    const kept = [];
    for (const p of parts) {
      if (TARGET_SIZES.includes(p)) {
        hit = true;
        perSize.set(p, (perSize.get(p) ?? 0) + 1);
        continue;
      }
      kept.push(p);
    }
    if (!hit) return whole;
    changed = true;
    totalReplacements++;
    if (!kept.includes('text-2xs')) kept.unshift('text-2xs');
    return `class="${kept.join(' ')}"`;
  });

  if (changed) {
    filesChanged++;
    if (!DRY) writeFileSync(file, out, 'utf8');
  }
}

console.log(`${DRY ? '[DRY RUN] ' : ''}Archivos tocados: ${filesChanged}`);
console.log(`Reemplazos totales: ${totalReplacements}`);
for (const [size, count] of [...perSize.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${size} → text-2xs : ${count}`);
}
