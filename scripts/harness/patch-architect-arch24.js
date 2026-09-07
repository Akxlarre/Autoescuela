/**
 * patch-architect-arch24.js — agrega ARCH-24 a scripts/architect.js (fix-156-b / ASG-b-092).
 *
 * `scripts/architect.js` está protegido por el File Protector: un agente no puede editarlo.
 * Eso es el diseño funcionando, no un bloqueo a destrabar — un agente no debe poder cambiar
 * los guardrails que lo evalúan. Este patcher existe para que una PERSONA aplique el cambio
 * con un comando, igual que los parches de ASG-b-097.
 *
 * Toda la lógica de la regla vive en scripts/lib/shared-roles.js (no protegido, testeado por
 * scripts/lib/shared-roles.test.mjs). Lo que se inyecta acá son ~20 líneas de cableado, para
 * que el diff sobre el archivo protegido sea trivial de revisar.
 *
 * Uso:  node scripts/harness/patch-architect-arch24.js [ruta-a-architect.js]
 *
 * Idempotente: si ARCH-24 ya está, no toca nada. Aborta sin escribir si algún ancla no
 * matchea exactamente (mejor no aplicar que aplicar a medias).
 */

import fs from 'fs';

const target = process.argv[2] || 'scripts/architect.js';

const PATCHES = [
  {
    name: 'import de la lib',
    anchor: `import { findReservedTailwindClassCollisions } from './lib/tailwind-bare-utilities.js';`,
    replacement:
      `import { findReservedTailwindClassCollisions } from './lib/tailwind-bare-utilities.js';\n` +
      `import { findSharedRoleViolations, loadOrganismAllowlist, normalizeRepoPath } from './lib/shared-roles.js';`,
  },
  {
    name: 'entrada en RULES',
    anchor: `};\n\n// ── ARCH-14: acumuladores de íconos`,
    replacement:
      `    'ARCH-24': {\n` +
      `        name: 'Rol de shared/ (Dumb inyecta Facade / Organismo inyecta transversal)',\n` +
      `        doc: '.claude/rules/architecture.md (§Smart vs Dumb Components) + fix-156-b (ASG-b-092)',\n` +
      `        fix: 'Un Dumb presentacional recibe sus datos por input() y no inyecta ningún Facade. Un Organismo de dominio (se abre vía LayoutDrawerFacadeService.open(), sin padre que le pase inputs) puede inyectar el Facade de SU dominio, nunca uno transversal (AuthFacade/BranchFacade): mové ese computed() al Facade de dominio. Para declarar un organismo nuevo: scripts/lib/shared-organisms.allowlist.json, con justificación.',\n` +
      `    },\n` +
      `};\n\n// ── ARCH-14: acumuladores de íconos`,
  },
  {
    name: 'función de chequeo',
    anchor: `/** Post-barrido: ratchet contra el baseline (crea/actualiza según flags). */`,
    replacement:
      `/** ARCH-24 — error duro, sin ratchet: arranca en CERO (los 6 organismos legítimos están\n` +
      ` *  declarados en el allowlist, verificado sobre los 91 componentes de shared/). */\n` +
      `const organismAllowlist = loadOrganismAllowlist();\n` +
      `function checkSharedRoles(filePath, content) {\n` +
      `    const relPath = normalizeRepoPath(filePath);\n` +
      `    for (const violation of findSharedRoleViolations(content, relPath, organismAllowlist)) {\n` +
      `        reportError('ARCH-24', filePath, violation.message);\n` +
      `    }\n` +
      `}\n\n` +
      `/** Post-barrido: ratchet contra el baseline (crea/actualiza según flags). */`,
  },
  {
    // OJO: el bloque de ARCH-23 aparece 3 veces (TS, template y styles). El ancla incluye el
    // cierre de analyzeTypeScript + el separador de la sección siguiente, que sí es único —
    // ARCH-24 solo aplica a .component.ts, no a .html ni .scss.
    name: 'invocación por archivo (solo en analyzeTypeScript)',
    anchor:
      `    checkHandRolledTapAreas(filePath, content);\n` +
      `}\n\n` +
      `// ─── Análisis de Templates HTML ─────────────────────────────────────────────`,
    replacement:
      `    checkHandRolledTapAreas(filePath, content);\n\n` +
      `    // ── Regla 24: rol Dumb vs Organismo en shared/ (error duro) ───────────────\n` +
      `    checkSharedRoles(filePath, content);\n` +
      `}\n\n` +
      `// ─── Análisis de Templates HTML ─────────────────────────────────────────────`,
  },
];

function main() {
  if (!fs.existsSync(target)) {
    console.error(`❌ No existe: ${target}`);
    process.exit(1);
  }

  let content = fs.readFileSync(target, 'utf8');

  if (content.includes("'ARCH-24'")) {
    console.log(`✅ ${target} ya tiene ARCH-24 — nada que hacer (idempotente).`);
    return;
  }

  // Verificar TODAS las anclas antes de escribir ninguna.
  const missing = PATCHES.filter((p) => !content.includes(p.anchor));
  if (missing.length > 0) {
    console.error('❌ Abortado sin tocar el archivo. Anclas que no matchean:');
    missing.forEach((p) => console.error(`   - ${p.name}`));
    console.error('\nEl archivo cambió desde que se escribió el parche. Revisá a mano.');
    process.exit(1);
  }

  for (const p of PATCHES) {
    if (content.split(p.anchor).length - 1 !== 1) {
      console.error(`❌ Abortado: el ancla "${p.name}" aparece más de una vez. Revisá a mano.`);
      process.exit(1);
    }
    content = content.replace(p.anchor, p.replacement);
  }

  fs.writeFileSync(target, content);
  console.log(`✅ ARCH-24 aplicado a ${target} (${PATCHES.length} anclas).`);
  console.log('   Verificá con: node scripts/harness/test-arch24-patches.js');
}

main();
