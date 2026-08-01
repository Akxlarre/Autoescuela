#!/usr/bin/env node
/**
 * check-bento-classes.js — fix-084-b (ASG-b-057, Nivel 1 punto 3).
 *
 * Freno standalone contra el sprawl del sistema bento (33 clases hoy, sin ninguna
 * revisión que lo frenara). Compara las clases `.bento-*` definidas en
 * `_bento-grid.scss` contra `scripts/lib/bento-classes.allowlist.json` — falla si
 * aparece una clase nueva no revisada.
 *
 * ⚠️ NO está cableado a `npm run lint:arch` — eso requeriría editar `scripts/architect.js`,
 * protegido por el File Protector (mismo patrón que ARCH-19/20 en fix-078-b/079-b: dejar
 * el check escrito y funcional, wiring pendiente de que un humano aplique el patch si lo
 * quiere en el pipeline automático). Correr manualmente:
 *
 *   node scripts/check-bento-classes.js
 *
 * Si agregás una clase bento legítima nueva (revisada, no resuelve con una existente):
 * sumala a `classes` en el allowlist, con una línea explicando por qué no alcanzaba con
 * las que ya había.
 *
 * `diffBentoClasses` es una función pura (Data In → Data Out) — testeable sin fs, ver
 * scripts/lib/bento-classes.test.mjs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

export function extractBentoClasses(scssContent) {
  return new Set([...scssContent.matchAll(/\.(bento-[\w-]+)/g)].map((m) => m[1]));
}

/** @returns {{ newClasses: string[], removedClasses: string[] }} */
export function diffBentoClasses(currentClasses, allowlistClasses) {
  const current = new Set(currentClasses);
  const allow = new Set(allowlistClasses);
  return {
    newClasses: [...current].filter((c) => !allow.has(c)).sort(),
    removedClasses: [...allow].filter((c) => !current.has(c)).sort(),
  };
}

// ── CLI (solo cuando se ejecuta directamente, no al importar en tests) ───────
// pathToFileURL normaliza relativo/absoluto y separadores \ vs / (Windows) — una
// comparación de string a mano acá se rompía en silencio: exit 0 sin correr nada.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const scssPath = join(__dirname, '..', 'src', 'styles', 'layout', '_bento-grid.scss');
  const allowlistPath = join(__dirname, 'lib', 'bento-classes.allowlist.json');

  const current = extractBentoClasses(readFileSync(scssPath, 'utf8'));
  const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8')).classes;
  const { newClasses, removedClasses } = diffBentoClasses(current, allowlist);

  if (newClasses.length > 0) {
    console.error('🚨 Clases .bento-* nuevas, no revisadas en el allowlist:');
    newClasses.forEach((c) => console.error(`   .${c}`));
    console.error(
      '\n¿Ya revisaste que ninguna clase existente resuelve esto? Ver indices/STYLES.md ' +
        "§ 'Cómo elegir: bento + botones'. Si es legítima, sumala a " +
        'scripts/lib/bento-classes.allowlist.json con la justificación.',
    );
    process.exitCode = 1;
  } else {
    console.log(`✅ check-bento-classes: ${current.size} clases, todas en el allowlist.`);
  }

  if (removedClasses.length > 0) {
    console.log(
      `ℹ️  ${removedClasses.length} clase(s) del allowlist ya no existen en el CSS (mejora — re-generar el allowlist): ${removedClasses.join(', ')}`,
    );
  }
}
