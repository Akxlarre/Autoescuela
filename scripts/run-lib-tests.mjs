#!/usr/bin/env node
/**
 * Corre todas las micro-suites de scripts/lib (los tests de los propios guardrails de lint:arch
 * y del pipeline de deploy) y termina en 1 si alguna falla.
 *
 * Las suites se descubren por nombre (*.test.mjs): una suite nueva entra sola, sin registrarla
 * acá ni en el workflow de CI.
 *
 * Uso: npm run test:scripts
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib');

const suites = readdirSync(LIB_DIR)
  .filter((name) => name.endsWith('.test.mjs'))
  .sort();

// Un directorio sin suites es un error de ruta, no un "todo en verde".
if (suites.length === 0) {
  console.error(`✖ No se encontró ninguna micro-suite (*.test.mjs) en ${LIB_DIR}.`);
  process.exit(1);
}

const failed = [];
for (const suite of suites) {
  const run = spawnSync(process.execPath, [path.join(LIB_DIR, suite)], { encoding: 'utf8' });
  if (run.status === 0) {
    console.log(`✔ ${suite}`);
    continue;
  }
  failed.push(suite);
  console.error(`✖ ${suite} (exit ${run.status ?? 'sin código'})`);
  // Solo se imprime la salida de la suite que falló: 15 suites en verde no deben tapar el fallo.
  if (run.stdout) console.error(run.stdout.trimEnd());
  if (run.stderr) console.error(run.stderr.trimEnd());
}

if (failed.length > 0) {
  console.error(
    `\n✖ Fallaron ${failed.length} de ${suites.length} micro-suites: ${failed.join(', ')}`,
  );
  process.exit(1);
}
console.log(`\n✔ ${suites.length} micro-suites en verde`);
