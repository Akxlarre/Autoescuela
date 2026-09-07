/**
 * patch-pre-write-guard-role.js — corrige el check de Facades en shared/ del guard de
 * escritura (fix-156-b / ASG-b-092).
 *
 * QUÉ ARREGLA (dos cosas, ambas verificables sobre el código de hoy):
 *
 * 1. **Regla stale.** El guard enforcea la versión vieja de architecture.md — "shared/ es Dumb,
 *    no inyecta Facades nunca". fix-146-b corrigió esa regla para distinguir por ROL: un
 *    Organismo de dominio SÍ puede inyectar el Facade de su dominio. El guard nunca se
 *    actualizó, así que bloquea escrituras que la regla vigente permite. Rastro en el código:
 *    ex-alumnos-content.component.ts:34 documenta la restricción vieja como si siguiera siendo
 *    la ley.
 *
 * 2. **Falso positivo.** El patrón `/inject\s*\(\s*\w*Facade/` matchea también
 *    `LayoutDrawerFacadeService`, que es plomería de UI de core/services/ui/, no un Facade de
 *    dominio. Lo inyectan 5 de los 8 componentes de shared/ que hoy tocan algo con "Facade" en
 *    el nombre — o sea, el guard bloquea a cualquier componente de shared/ que abra un drawer.
 *
 * La lógica corregida vive en scripts/lib/shared-roles.js (compartida con architect.js, para
 * que linter y guard no vuelvan a divergir — la divergencia ES el bug que este track arregla).
 *
 * Uso:  node scripts/harness/patch-pre-write-guard-role.js [ruta-al-hook]
 *
 * Idempotente y anclado: aborta sin escribir si el ancla no matchea exactamente.
 */

import fs from 'fs';

const target = process.argv[2] || '.claude/hooks/pre-write-guard.js';

const ANCHOR = `      // Dumb component con inject de Facade (shared/ no debe tener Facades)
      if (normalizedPath.includes('shared/') && normalizedPath.endsWith('.component.ts')) {
        if (/inject\\s*\\(\\s*\\w*Facade/.test(newContent))
          violations.push(
            'Componentes en shared/ son Dumb: no deben inyectar Facades.\\n' +
            '     Solo usan input() y output(). Mueve la logica a un Smart component en features/.'
          );
      }`;

const REPLACEMENT = `      // ARCH-24: rol Dumb vs Organismo en shared/ (fix-156-b).
      // La regla NO es "shared/ nunca inyecta Facades" (esa es la version previa a fix-146-b,
      // que equiparaba carpeta con rol). Un Organismo de dominio declarado en el allowlist
      // puede inyectar el Facade de SU dominio; un Dumb no puede inyectar ninguno. Misma
      // implementacion que usa architect.js, para que guard y linter no diverjan.
      if (normalizedPath.includes('shared/') && normalizedPath.endsWith('.component.ts')) {
        try {
          const roles = require(path.join(process.cwd(), 'scripts', 'lib', 'shared-roles.js'));
          const relPath = roles.normalizeRepoPath(filePath);
          for (const v of roles.findSharedRoleViolations(newContent, relPath)) {
            violations.push(v.message);
          }
        } catch {
          // fail-open puntual: si la lib no carga, este check se omite y el resto del hook sigue.
        }
      }`;

function main() {
  if (!fs.existsSync(target)) {
    console.error(`❌ No existe: ${target}`);
    process.exit(1);
  }

  let content = fs.readFileSync(target, 'utf8');

  if (content.includes('shared-roles.js')) {
    console.log(`✅ ${target} ya usa shared-roles.js — nada que hacer (idempotente).`);
    return;
  }

  if (!content.includes(ANCHOR)) {
    console.error('❌ Abortado sin tocar el archivo: el ancla no matchea exactamente.');
    console.error('   El bloque esperado es el check "Dumb component con inject de Facade".');
    console.error('   El hook cambió desde que se escribió el parche — revisá a mano.');
    process.exit(1);
  }

  content = content.replace(ANCHOR, REPLACEMENT);
  fs.writeFileSync(target, content);
  console.log(`✅ Check de rol corregido en ${target}.`);
  console.log('   Verificá con: node scripts/harness/test-arch24-patches.js');
}

main();
