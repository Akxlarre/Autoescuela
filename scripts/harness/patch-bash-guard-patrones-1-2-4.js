#!/usr/bin/env node
/**
 * patch-bash-guard-patrones-1-2-4.js — EJECUTAR A MANO, POR UNA PERSONA.
 *
 * Completa la corrección que `ASG-b-097` dejó a medias. Aquel parche arregló **1 de 4**
 * patrones; los otros 3 arrastraban el mismo defecto de raíz: un `.*` que **cruza
 * separadores de comando** (`;` `|` `&`), y en dos de ellos además un `>` sin anclar que
 * confunde los redirects de diagnóstico (`2>&1`, `/dev/null`) con escritura de archivo.
 *
 * Uso:
 *   node scripts/harness/patch-bash-guard-patrones-1-2-4.js .claude/hooks/bash-guard.js
 *
 * Verificación obligatoria después (13 casos, las dos direcciones):
 *   node scripts/harness/test-bash-guard-patch.js .claude/hooks/bash-guard.js
 *
 * Es idempotente y aborta sin tocar nada si no encuentra sus anclas.
 *
 * ── Qué cambia y por qué ────────────────────────────────────────────────────────────
 *
 * PATRÓN 1  (cat|echo|printf ... > ... ruta de fuente)  →  SE ELIMINA
 *   Es un subconjunto estricto del patrón de `src/app` ya corregido, que atrapa cualquier
 *   `>` hacia una ruta de fuente sin importar el verbo. Mantenerlo solo duplica superficie
 *   donde el bug puede reaparecer. El test prueba que `echo ... > componente.ts` SIGUE
 *   bloqueado después de eliminarlo.
 *
 * PATRÓN 2  (tee)  →  SE ANCLA
 *   No usa `>`, pero su `.*` cruza separadores igual: `ls | tee /tmp/x.log; grep ... comp.ts`
 *   quedaba bloqueado sin motivo.
 *
 * PATRÓN 4  (migraciones)  →  SE ANCLA, espejando al de `src/app`
 *   Pasa a ser agnóstico del verbo. Es estrictamente más fuerte que exigir `cat|echo|printf`,
 *   y deja de confundir `2>/dev/null` con una escritura.
 *
 * ── Hueco conocido que este parche NO cierra (a propósito) ───────────────────────────
 *   `tee supabase/migrations/x.sql` no queda cubierto — tampoco lo estaba antes, porque el
 *   patrón 4 siempre exigió un `>`. Se deja anotado en vez de ampliarlo en silencio: este
 *   parche corrige falsos positivos, no cambia el alcance de lo que se bloquea.
 *
 * ── Nota de implementación ──────────────────────────────────────────────────────────
 *   Trabaja **por líneas**, no por coincidencia exacta de bloques. El hook tiene
 *   terminaciones MIXTAS (CRLF y LF): un patcher que ancle strings multilínea con `\n`
 *   falla en silencio contra ese archivo. Detecta el estilo dominante y lo preserva.
 */
import fs from 'fs';

const target = process.argv[2];
if (!target) {
  console.error('Uso: node scripts/harness/patch-bash-guard-patrones-1-2-4.js <ruta a bash-guard.js>');
  process.exit(1);
}

const raw = fs.readFileSync(target, 'utf8');

if (raw.includes('ASG-b-098')) {
  console.log('SIN CAMBIOS: el parche ya estaba aplicado.');
  process.exit(0);
}

// Preservar el estilo de fin de línea dominante del archivo.
const crlfCount = (raw.match(/\r\n/g) || []).length;
const lfCount = (raw.match(/(?<!\r)\n/g) || []).length;
const EOL = crlfCount >= lfCount ? '\r\n' : '\n';

const lines = raw.split(/\r?\n/);

// Señas por CONTENIDO, no por coincidencia exacta — inmune a espacios y a CRLF.
const esVerbo = (l) => l.includes('cat|echo|printf');
const idxP1 = lines.findIndex((l) => esVerbo(l) && l.includes('src\\/app\\/'));
const idxP2 = lines.findIndex((l) => l.includes('/tee\\s'));
const idxP4 = lines.findIndex((l) => esVerbo(l) && l.includes('supabase\\/migrations\\/'));

for (const [nombre, idx] of [['patrón 1', idxP1], ['patrón 2', idxP2], ['patrón 4', idxP4]]) {
  if (idx === -1) {
    console.error(`ANCLA NO ENCONTRADA (${nombre}) — abortado, no se modificó nada.`);
    console.error('El hook puede haber cambiado desde 2026-08-24. Revisar a mano.');
    process.exit(1);
  }
}

const P2_NEW = [
  '      // Anclado (ASG-b-098): `tee` no usa redirect, pero su `.*` cruzaba separadores de',
  '      // comando igual — un tee a un log seguido de leer un componente se bloqueaba.',
  '      /tee\\s[^;|&]*' + 'src\\/app\\/' + '[^;|&]*\\.(?:ts|html|scss)/,',
];

const P4_NEW = [
  '      // Espeja al patrón de src/app (ASG-b-098): agnóstico del verbo, no cruza separadores',
  '      // y no confunde 2>&1 ni /dev/null con una escritura.',
  '      /(?<![0-9&])' + '>>?\\s*(?!\\/dev\\/null)[^;|&]*' + 'supabase\\/migrations\\/' + '[^;|&]*\\.sql/,',
];

// De mayor a menor índice, para no invalidar los índices al mutar.
const ediciones = [
  { idx: idxP4, reemplazo: P4_NEW },
  { idx: idxP2, reemplazo: P2_NEW },
  { idx: idxP1, reemplazo: [] }, // eliminado por redundante
].sort((a, b) => b.idx - a.idx);

for (const { idx, reemplazo } of ediciones) {
  lines.splice(idx, 1, ...reemplazo);
}

fs.writeFileSync(target, lines.join(EOL));
console.log('OK: patrón 1 eliminado (redundante), patrones 2 y 4 anclados en ' + target);
console.log('Verificá AHORA con:');
console.log('  node scripts/harness/test-bash-guard-patch.js ' + target);
console.log('Debe dar 13 pass · 0 fail. Si algún BLOQUEAR falla, revertí con git checkout.');
