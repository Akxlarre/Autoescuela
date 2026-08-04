#!/usr/bin/env node
/**
 * migrate-text-13px-to-compact.mjs — fix-082-b (ASG-b-055)
 *
 * Migra text-[13px] → text-compact (13px, token nuevo formalizado en este mismo track
 * — ver comentario en src/styles/tokens/_variables.scss). Decisión confirmada por el
 * usuario: formalizar un peldaño nuevo, no redondear (las tablas contables que usan este
 * tamaño tienen grid-template-columns de ancho fijo calibradas para 13px exacto).
 *
 * Idempotente. Uso: node scripts/migrate-text-13px-to-compact.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const DRY = process.argv.includes('--dry');

const files = execSync('git ls-files "src/app/**/*.ts"', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

let filesChanged = 0;
let total = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes('text-[13px]')) continue;

  const out = src.replace(/text-\[13px\]/g, () => {
    total++;
    return 'text-compact';
  });

  filesChanged++;
  if (!DRY) writeFileSync(file, out, 'utf8');
}

console.log(`${DRY ? '[DRY RUN] ' : ''}Archivos tocados: ${filesChanged} | Reemplazos: ${total}`);
