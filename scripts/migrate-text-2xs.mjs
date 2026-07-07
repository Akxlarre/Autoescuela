/**
 * migrate-text-2xs.mjs — Codemod fix-032 (fase 3 roadmap DS).
 *
 * Reemplaza tamaños de fuente arbitrarios por tokens de la escala:
 *   text-[10px] → text-2xs   (nuevo token, 10px)
 *   text-[11px] → text-2xs   (se normaliza hacia abajo: nunca provoca overflow)
 *   text-[12px] → text-xs    (match exacto)
 *   text-[14px] → text-sm    (match exacto)
 *   text-[16px] → text-base  (match exacto)
 *   text-[18px] → text-lg    (match exacto)
 *
 * Fuera de scope (decisión de diseño pendiente, AP-014): 8/9/13/15/17/22px.
 *
 * Uso:
 *   node scripts/migrate-text-2xs.mjs --dry            # solo reporta
 *   node scripts/migrate-text-2xs.mjs <archivo>        # migra un archivo (smoke test)
 *   node scripts/migrate-text-2xs.mjs                  # migra todo src/app
 */
import fs from 'fs';
import path from 'path';

const MAP = new Map([
  ['text-[10px]', 'text-2xs'],
  ['text-[11px]', 'text-2xs'],
  ['text-[12px]', 'text-xs'],
  ['text-[14px]', 'text-sm'],
  ['text-[16px]', 'text-base'],
  ['text-[18px]', 'text-lg'],
]);

const DRY = process.argv.includes('--dry');
const fileArg = process.argv.slice(2).find((a) => !a.startsWith('--'));

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts')) yield full;
  }
}

function migrateFile(file) {
  const src = fs.readFileSync(file, 'utf-8');
  let out = src;
  let count = 0;
  for (const [from, to] of MAP) {
    // split/join = replace literal sin interpretar regex (los [] del patrón)
    const parts = out.split(from);
    count += parts.length - 1;
    out = parts.join(to);
  }
  if (count > 0 && !DRY) fs.writeFileSync(file, out);
  return count;
}

const targets = fileArg ? [path.resolve(fileArg)] : [...walk(path.resolve('src', 'app'))];
let totalFiles = 0;
let totalRepl = 0;
for (const file of targets) {
  const n = migrateFile(file);
  if (n > 0) {
    totalFiles++;
    totalRepl += n;
    console.log(`${DRY ? '[dry] ' : ''}${path.relative(process.cwd(), file)}: ${n}`);
  }
}
console.log(`\n${DRY ? 'DRY RUN — ' : ''}${totalRepl} reemplazo(s) en ${totalFiles} archivo(s).`);
