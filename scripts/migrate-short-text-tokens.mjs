/**
 * migrate-short-text-tokens.mjs — Codemod fix-033.
 *
 * Reemplaza las formas cortas de tokens de texto (muertas, resucitadas por error
 * en a4675ee vía alias en @theme que este fix elimina) por la forma canónica
 * establecida en fix-030: text-text-{secondary,muted,disabled}.
 *
 * Ámbito ESTRICTO: solo tokens dentro de atributos `class="..."` (mismo patrón
 * que CLASS_ATTR_RE en scripts/lib/class-discipline.js). NUNCA toca `var(--text-muted)`
 * ni otras referencias CSS crudas — un primer intento con substring-replace ciego
 * corrompía esas referencias (ej. dashboard.facade.ts, que no tiene templates).
 *
 * Uso:
 *   node scripts/migrate-short-text-tokens.mjs --dry   # solo reporta
 *   node scripts/migrate-short-text-tokens.mjs <file>  # migra un archivo
 *   node scripts/migrate-short-text-tokens.mjs         # migra todo src/app
 */
import fs from 'fs';
import path from 'path';

const MAP = new Map([
  ['text-secondary', 'text-text-secondary'],
  ['text-muted', 'text-text-muted'],
  ['text-disabled', 'text-text-disabled'],
]);

const CLASS_ATTR_RE = /\bclass\s*=\s*"([^"]*)"/g;

const DRY = process.argv.includes('--dry');
const fileArg = process.argv.slice(2).find((a) => !a.startsWith('--'));

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts')) yield full;
  }
}

/** Reemplaza tokens exactos (con variant prefix opcional, ej. "hover:text-muted")
 * dentro de una lista de clases separada por espacios. */
function migrateClassList(classAttrValue) {
  let count = 0;
  const tokens = classAttrValue.split(/(\s+)/).map((tok) => {
    if (/^\s+$/.test(tok) || tok === '') return tok;
    const variantMatch = tok.match(/^([\w-]+:)?([\w-]+)$/);
    if (!variantMatch) return tok;
    const [, variant = '', base] = variantMatch;
    if (MAP.has(base)) {
      count++;
      return `${variant}${MAP.get(base)}`;
    }
    return tok;
  });
  return { result: tokens.join(''), count };
}

function migrateFile(file) {
  const content = fs.readFileSync(file, 'utf-8');
  let total = 0;
  let out = '';
  let lastIndex = 0;
  CLASS_ATTR_RE.lastIndex = 0;
  let m;
  while ((m = CLASS_ATTR_RE.exec(content)) !== null) {
    const [full, classValue] = m;
    const { result, count } = migrateClassList(classValue);
    out += content.slice(lastIndex, m.index);
    out += full.replace(classValue, result);
    total += count;
    lastIndex = m.index + full.length;
  }
  out += content.slice(lastIndex);

  if (total > 0 && !DRY) fs.writeFileSync(file, out);
  return total;
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
