/**
 * patch-architect-arch08-arch25.js — fix-160-b.
 *
 * Hace dos cosas en `scripts/architect.js`:
 *
 *   1. ARCH-08 (ampliada): reemplaza las DOS copias de la regex de colores hardcodeados
 *      (una para .ts, otra para .html) por llamadas a `scripts/lib/hardcoded-colors.js`.
 *      La regex vieja sólo matcheaba colores de paleta CON número (`text-red-500`), así que
 *      dejaba pasar `bg-white`, `text-black` y el hex arbitrario `bg-[#hex]` — aun cuando
 *      `visual-system.md` nombra explícitamente ese último como prohibido. Eso permitió un
 *      bug real: la patente del vehículo en Flota, invisible en modo oscuro (`bg-white` con
 *      texto heredado `rgb(244,244,245)`, contraste 1.05:1), con `lint:arch` en exit 0.
 *
 *   2. ARCH-25 (nueva, ratchet): card compuesta a mano en vez de `.card`. La implementación
 *      vive en `scripts/lib/card-composition.js` y entra al MISMO baseline compartido que
 *      ARCH-15/16/17/19 (`DS_RULES` en class-discipline.js ya la incluye).
 *
 * `scripts/architect.js` está protegido por el File Protector: un agente no puede editarlo.
 * Eso es el diseño funcionando, no un bloqueo a destrabar — un agente no debe poder cambiar
 * los guardrails que lo evalúan. Este patcher existe para que una PERSONA aplique el cambio
 * con un comando, igual que `patch-architect-arch24.js`.
 *
 * Toda la lógica vive en las libs (no protegidas, con micro-suite propia). Lo que se inyecta
 * acá es cableado, para que el diff sobre el archivo protegido sea trivial de revisar.
 *
 * Uso:
 *   node scripts/harness/patch-architect-arch08-arch25.js [ruta-a-architect.js]
 *   npm run lint:arch -- --update-ds-baseline     # sella la cuota inicial de ARCH-25
 *
 * Idempotente: si ARCH-25 ya está, no toca nada. Aborta sin escribir si algún ancla no
 * matchea exactamente (mejor no aplicar que aplicar a medias).
 */

import fs from 'fs';

const target = process.argv[2] || 'scripts/architect.js';

const HARDCODED_TS_ANCHOR = `    // ── Regla 8: Colores Tailwind hardcodeados en .ts ───────────────────────
    const hardcodedColorRe =
        /(?:text|bg|border|ring|from|to|via)-(?:red|blue|green|yellow|purple|pink|orange|teal|cyan|indigo|emerald|rose|amber|lime|sky|violet|fuchsia)-\\d{2,3}/g;
    const colorMatches = content.match(hardcodedColorRe);
    if (colorMatches) {
        reportError(
            'ARCH-08', filePath,
            \`Colores Tailwind hardcodeados detectados: \${[...new Set(colorMatches)].join(', ')}\`,
        );
    }`;

const HARDCODED_HTML_ANCHOR = `    // ── Regla 8: Colores Tailwind hardcodeados en .html ─────────────────────
    const hardcodedColorRe =
        /(?:text|bg|border|ring|from|to|via)-(?:red|blue|green|yellow|purple|pink|orange|teal|cyan|indigo|emerald|rose|amber|lime|sky|violet|fuchsia)-\\d{2,3}/g;
    const colorMatches = content.match(hardcodedColorRe);
    if (colorMatches) {
        reportError(
            'ARCH-08', filePath,
            \`Colores Tailwind hardcodeados en template: \${[...new Set(colorMatches)].join(', ')}\`,
            'Usa tokens semánticos: text-text-primary, text-text-muted, bg-surface, bg-base.'
        );
    }`;

const PATCHES = [
  {
    name: 'import de las libs',
    anchor: `import { findSharedRoleViolations, loadOrganismAllowlist, normalizeRepoPath } from './lib/shared-roles.js';`,
    replacement:
      `import { findSharedRoleViolations, loadOrganismAllowlist, normalizeRepoPath } from './lib/shared-roles.js';\n` +
      `import { findHardcodedColors, HARDCODED_COLOR_FIX } from './lib/hardcoded-colors.js';\n` +
      `import { findAdHocCardCompositions, CARD_COMPOSITION_FIX } from './lib/card-composition.js';`,
  },
  {
    name: 'entrada ARCH-25 en RULES',
    anchor: `};\n\n// ── ARCH-14: acumuladores de íconos`,
    replacement:
      `    'ARCH-25': {\n` +
      `        name: 'Card compuesta a mano en vez de .card (ratchet)',\n` +
      `        doc: '.claude/rules/visual-system.md (§Cards) + .claude/rules/architecture.md (§Clases Semánticas vs Tailwind Genérico) + fix-160-b',\n` +
      `        fix: CARD_COMPOSITION_FIX,\n` +
      `    },\n` +
      `};\n\n// ── ARCH-14: acumuladores de íconos`,
  },
  {
    name: 'ARCH-25 en el mapa de dsCounts',
    anchor: `    'ARCH-19': new Map(),\n};`,
    replacement: `    'ARCH-19': new Map(),\n    'ARCH-25': new Map(),\n};`,
  },
  {
    name: 'acumulación de ARCH-25 en trackClassDiscipline',
    anchor:
      `    if (!isTypographyWhitelisted(rel)) {\n` +
      `        const clusters = findAdhocTypography(content);\n` +
      `        add('ARCH-19', clusters.length, [...new Set(clusters)].join(', '));\n` +
      `    }\n` +
      `}`,
    replacement:
      `    if (!isTypographyWhitelisted(rel)) {\n` +
      `        const clusters = findAdhocTypography(content);\n` +
      `        add('ARCH-19', clusters.length, [...new Set(clusters)].join(', '));\n` +
      `    }\n` +
      `    const adHocCards = findAdHocCardCompositions(content);\n` +
      `    add('ARCH-25', adHocCards.length, adHocCards[0]);\n` +
      `}`,
  },
  {
    name: 'ARCH-08 ampliada en .ts (reemplaza la regex duplicada #1)',
    anchor: HARDCODED_TS_ANCHOR,
    replacement:
      `    // ── Regla 8: colores hardcodeados en .ts (lib única, ver hardcoded-colors.js) ──\n` +
      `    const hardcodedColors = findHardcodedColors(content);\n` +
      `    if (hardcodedColors.length > 0) {\n` +
      `        reportError(\n` +
      `            'ARCH-08', filePath,\n` +
      `            \`Colores hardcodeados detectados: \${hardcodedColors.join(', ')}\`,\n` +
      `            HARDCODED_COLOR_FIX,\n` +
      `        );\n` +
      `    }`,
  },
  {
    name: 'ARCH-08 ampliada en .html (reemplaza la regex duplicada #2)',
    anchor: HARDCODED_HTML_ANCHOR,
    replacement:
      `    // ── Regla 8: colores hardcodeados en .html (misma lib que la ruta .ts) ────\n` +
      `    const hardcodedColors = findHardcodedColors(content);\n` +
      `    if (hardcodedColors.length > 0) {\n` +
      `        reportError(\n` +
      `            'ARCH-08', filePath,\n` +
      `            \`Colores hardcodeados en template: \${hardcodedColors.join(', ')}\`,\n` +
      `            HARDCODED_COLOR_FIX,\n` +
      `        );\n` +
      `    }`,
  },
];

function main() {
  if (!fs.existsSync(target)) {
    console.error(`❌ No existe: ${target}`);
    process.exit(1);
  }

  let content = fs.readFileSync(target, 'utf8');

  if (content.includes("'ARCH-25'")) {
    console.log(`✅ ${target} ya tiene ARCH-25 — nada que hacer (idempotente).`);
    return;
  }

  // ── Normalización de fin de línea ──────────────────────────────────────────
  // En un checkout de Windows `architect.js` viene con CRLF. Las anclas de este archivo
  // están escritas con \n, así que sin esto NINGUNA matchea y el parche aborta entero
  // (pasó al escribirlo). No es un detalle del entorno de quien lo escribió: el mismo
  // parche tiene que poder correr en Windows y en Linux.
  const usesCRLF = content.includes('\r\n');
  const toEol = (s) => (usesCRLF ? s.replace(/\r?\n/g, '\r\n') : s.replace(/\r\n/g, '\n'));
  const patches = PATCHES.map((p) => ({
    ...p,
    anchor: toEol(p.anchor),
    replacement: toEol(p.replacement),
  }));

  // Verificar TODAS las anclas antes de escribir ninguna.
  const missing = patches.filter((p) => !content.includes(p.anchor));
  if (missing.length > 0) {
    console.error('❌ Abortado sin tocar el archivo. Anclas que no matchean:');
    missing.forEach((p) => console.error(`   - ${p.name}`));
    console.error('\nEl archivo cambió desde que se escribió el parche. Revisá a mano.');
    process.exit(1);
  }

  for (const p of patches) {
    if (content.split(p.anchor).length - 1 !== 1) {
      console.error(`❌ Abortado: el ancla "${p.name}" aparece más de una vez. Revisá a mano.`);
      process.exit(1);
    }
    content = content.replace(p.anchor, p.replacement);
  }

  fs.writeFileSync(target, content);
  console.log(`✅ ARCH-08 (ampliada) + ARCH-25 aplicados a ${target} (${patches.length} anclas).`);
  console.log('\nPasos siguientes:');
  console.log('   1. npm run lint:arch -- --update-ds-baseline   # sella la cuota inicial de ARCH-25');
  console.log('   2. npm run lint:arch                            # ARCH-08 debería listar los 30 colores reales');
}

main();
