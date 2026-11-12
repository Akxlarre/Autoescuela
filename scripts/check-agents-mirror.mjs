#!/usr/bin/env node
/**
 * check-agents-mirror.mjs — Runner de ARCH-30 (.agents/ desfasado respecto de .claude/).
 *
 * La comparación vive en scripts/lib/agents-mirror.js; acá solo se lee y escribe el disco.
 *
 *   node scripts/check-agents-mirror.mjs        → falla si algún espejo difiere de su fuente
 *   node scripts/check-agents-mirror.mjs --fix  → copia .claude/ sobre .agents/ (npm run agents:sync)
 *
 * --fix copia lo que falta y lo desfasado, pero NO borra los huérfanos (archivos que solo
 * existen en .agents/): esos se reportan y hay que borrarlos a mano, para que una regla o
 * skill propia de Antigravity nunca desaparezca sin que alguien lo decida.
 */
import fs from 'node:fs';
import path from 'node:path';
import { MIRRORS, diffMirror } from './lib/agents-mirror.js';

const RULE = 'ARCH-30';
const ROOT = process.cwd();
const FIX = process.argv.includes('--fix');

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

/** Lee un árbol como Map(ruta relativa con "/" → Buffer). */
function readTree(dir) {
  const out = new Map();
  if (!fs.existsSync(dir)) return out;
  const walk = (current) => {
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else out.set(path.relative(dir, full).split(path.sep).join('/'), fs.readFileSync(full));
    }
  };
  walk(dir);
  return out;
}

// Sin .agents/ no hay adaptador de Antigravity que mantener.
if (!fs.existsSync(path.join(ROOT, '.agents'))) {
  console.log(green(`${RULE}: sin .agents/, nada que verificar.`));
  process.exit(0);
}

let problems = 0;
let copied = 0;

for (const { source, mirror } of MIRRORS) {
  const srcDir = path.join(ROOT, source);
  const mirrorDir = path.join(ROOT, mirror);
  const { missing, stale, orphan } = diffMirror(readTree(srcDir), readTree(mirrorDir));

  if (FIX) {
    for (const rel of [...missing, ...stale]) {
      const dest = path.join(mirrorDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(srcDir, rel), dest);
      console.log(`  copiado ${mirror}/${rel}`);
      copied++;
    }
  } else {
    for (const rel of missing) {
      console.error(red(`${RULE} ${mirror}/${rel}: falta (existe en ${source}/${rel}).`));
      problems++;
    }
    for (const rel of stale) {
      console.error(red(`${RULE} ${mirror}/${rel}: desfasado respecto de ${source}/${rel}.`));
      problems++;
    }
  }
  for (const rel of orphan) {
    console.error(
      red(`${RULE} ${mirror}/${rel}: no existe en ${source}/. Borralo o agregalo en ${source}/.`),
    );
    problems++;
  }
}

if (problems) {
  console.error(
    red(
      `\n${RULE}: .agents/ es copia de .claude/ (Antigravity lee de ahí). ` +
        (FIX
          ? 'Quedan huérfanos por resolver a mano.'
          : 'Corré "npm run agents:sync" y commiteá el resultado.'),
    ),
  );
  process.exit(1);
}

console.log(
  green(
    FIX
      ? `${RULE}: ${copied} archivo(s) copiado(s) a .agents/.`
      : `${RULE}: .agents/ al día con .claude/.`,
  ),
);
