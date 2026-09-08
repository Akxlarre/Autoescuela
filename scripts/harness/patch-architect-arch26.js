/**
 * patch-architect-arch26.js — fix-160-b, 2ª pasada. Corrige el patch anterior.
 *
 * QUÉ SALIÓ MAL EN LA 1ª PASADA
 * `patch-architect-arch08-arch25.js` amplió ARCH-08 (colores hardcodeados) manteniéndola
 * como ERROR DURO. Resultado: `lint:arch` pasó de exit 0 a exit 1 con 27 hallazgos. Al
 * revisarlos uno por uno, la mayoría era legítima:
 *
 *   - `bg-white` en un `<iframe>` de PDF (dms-doc-preview, route-sheet) → es el papel.
 *   - `bg-white` con `opacity-10` (daily-schedule-timeline) → es un velo, no una superficie.
 *   - `bg-white` en la perilla de un toggle (arqueo-cierre) → convención de switch.
 *   - los 20 `text-white` → texto sobre gradiente de marca.
 *
 * De 5 `bg-white`, **uno solo** era el bug real (la patente en Flota, invisible en oscuro).
 *
 * Dejar el linter en rojo con hallazgos mayormente correctos es exactamente cómo un
 * guardrail se vuelve ruido y el equipo aprende a ignorarlo — la advertencia que estaba
 * escrita en el header de `card-composition.js` y que la 1ª pasada igual pisó.
 *
 * QUÉ HACE ESTE PARCHE
 *   1. ARCH-08 vuelve a ser error duro pero SÓLO sobre colores de paleta
 *      (`text-red-500`): nunca son correctos y el repo ya está en cero.
 *   2. ARCH-26 (nueva, ratchet): absolutos opacos (`bg-white`/`text-black`) y hex arbitrario.
 *      Son *a veces* correctos, así que van al baseline compartido y sólo pueden bajar.
 *      La lib ya excluye los velos (`/50`, `opacity-N`) por regla, no por excepción.
 *
 * Requiere: `patch-architect-arch08-arch25.js` ya aplicado.
 *
 * Uso:
 *   node scripts/harness/patch-architect-arch26.js [ruta-a-architect.js]
 *   npm run lint:arch -- --update-ds-baseline
 *
 * Idempotente. Aborta sin escribir si algún ancla no matchea.
 */

import fs from 'fs';

const target = process.argv[2] || 'scripts/architect.js';

const PATCHES = [
  {
    name: 'import de los dos finders separados',
    anchor: `import { findHardcodedColors, HARDCODED_COLOR_FIX } from './lib/hardcoded-colors.js';`,
    replacement:
      `import {\n` +
      `    findHardcodedPaletteColors,\n` +
      `    findHardcodedAbsoluteColors,\n` +
      `    HARDCODED_COLOR_FIX,\n` +
      `} from './lib/hardcoded-colors.js';`,
  },
  {
    name: 'entrada ARCH-26 en RULES',
    anchor: `};\n\n// ── ARCH-14: acumuladores de íconos`,
    replacement:
      `    'ARCH-26': {\n` +
      `        name: 'Blanco/negro opaco o hex arbitrario (ratchet)',\n` +
      `        doc: '.claude/rules/visual-system.md (§Tokens de color) + fix-160-b',\n` +
      `        fix: HARDCODED_COLOR_FIX,\n` +
      `    },\n` +
      `};\n\n// ── ARCH-14: acumuladores de íconos`,
  },
  {
    name: 'ARCH-26 en el mapa de dsCounts',
    anchor: `    'ARCH-25': new Map(),\n};`,
    replacement: `    'ARCH-25': new Map(),\n    'ARCH-26': new Map(),\n};`,
  },
  {
    name: 'acumulación de ARCH-26 en trackClassDiscipline',
    anchor: `    add('ARCH-25', adHocCards.length, adHocCards[0]);`,
    replacement:
      `    add('ARCH-25', adHocCards.length, adHocCards[0]);\n` +
      `    const absoluteColors = findHardcodedAbsoluteColors(content);\n` +
      `    add('ARCH-26', absoluteColors.length, absoluteColors.join(', '));`,
  },
  {
    name: 'ARCH-08 sólo paleta en .ts',
    anchor:
      `    // ── Regla 8: colores hardcodeados en .ts (lib única, ver hardcoded-colors.js) ──\n` +
      `    const hardcodedColors = findHardcodedColors(content);`,
    replacement:
      `    // ── Regla 8: colores de PALETA en .ts (error duro; los absolutos → ARCH-26) ──\n` +
      `    const hardcodedColors = findHardcodedPaletteColors(content);`,
  },
  {
    name: 'ARCH-08 sólo paleta en .html',
    anchor:
      `    // ── Regla 8: colores hardcodeados en .html (misma lib que la ruta .ts) ────\n` +
      `    const hardcodedColors = findHardcodedColors(content);`,
    replacement:
      `    // ── Regla 8: colores de PALETA en .html (error duro; los absolutos → ARCH-26) ──\n` +
      `    const hardcodedColors = findHardcodedPaletteColors(content);`,
  },
];

function main() {
  if (!fs.existsSync(target)) {
    console.error(`❌ No existe: ${target}`);
    process.exit(1);
  }

  let content = fs.readFileSync(target, 'utf8');

  if (content.includes("'ARCH-26'")) {
    console.log(`✅ ${target} ya tiene ARCH-26 — nada que hacer (idempotente).`);
    return;
  }
  if (!content.includes("'ARCH-25'")) {
    console.error(`❌ Falta la 1ª pasada. Corré primero:`);
    console.error(`   node scripts/harness/patch-architect-arch08-arch25.js`);
    process.exit(1);
  }

  // Normalización de fin de línea (CRLF en checkouts de Windows).
  const usesCRLF = content.includes('\r\n');
  const toEol = (s) => (usesCRLF ? s.replace(/\r?\n/g, '\r\n') : s.replace(/\r\n/g, '\n'));
  const patches = PATCHES.map((p) => ({
    ...p,
    anchor: toEol(p.anchor),
    replacement: toEol(p.replacement),
  }));

  const missing = patches.filter((p) => !content.includes(p.anchor));
  if (missing.length > 0) {
    console.error('❌ Abortado sin tocar el archivo. Anclas que no matchean:');
    missing.forEach((p) => console.error(`   - ${p.name}`));
    process.exit(1);
  }

  for (const p of patches) {
    if (content.split(p.anchor).length - 1 !== 1) {
      console.error(`❌ Abortado: el ancla "${p.name}" aparece más de una vez.`);
      process.exit(1);
    }
    content = content.replace(p.anchor, p.replacement);
  }

  fs.writeFileSync(target, content);
  console.log(`✅ ARCH-26 aplicado a ${target} (${patches.length} anclas).`);
  console.log('\nPaso siguiente (sella la cuota y devuelve lint:arch a verde):');
  console.log('   npm run lint:arch -- --update-ds-baseline');
}

main();
