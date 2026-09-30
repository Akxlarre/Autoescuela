/**
 * deploy-manifest.js — qué archivos puede borrar el pipeline FTP de producción (spec 0046-b, AC-E3).
 *
 * El servidor guarda `.deploy-manifest.json` = { version, current, previous }:
 *   - current  → archivos del último deploy (N-1)
 *   - previous → archivos del deploy anterior a ese (N-2)
 *
 * Al desplegar N solo se borra `previous − N − current`: archivos que ESTE pipeline subió hace dos
 * versiones y que ya nadie usa. La versión de gracia existe porque quien tiene abierta la app N-1
 * sigue pidiendo sus chunks lazy después del deploy; si se borraran de inmediato, su siguiente
 * navegación fallaría.
 *
 * Falla segura: ante un manifiesto remoto que no se entiende, no se borra nada. Un archivo huérfano
 * cuesta unos KB; un borrado equivocado tumba el sitio o el SSL de cPanel.
 *
 * Función pura: sin fs ni red. El I/O vive en scripts/deploy-ftp-plan.js.
 */

export const MANIFEST_VERSION = 1;
export const MANIFEST_NAME = '.deploy-manifest.json';

/** Rutas que el pipeline nunca registra ni borra, aunque aparezcan en un manifiesto. */
const PROTECTED = [/^\.htaccess$/, new RegExp(`^${MANIFEST_NAME.replace(/\./g, '\\.')}$`), /^cgi-bin\//, /^\.well-known\//];

export function normalizePath(p) {
  return String(p).replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/^\/+/, '');
}

function isSafePath(p) {
  return p !== '' && !p.split('/').includes('..');
}

function isProtected(p) {
  return PROTECTED.some((re) => re.test(p));
}

/** Lista limpia: normalizada, sin rutas inseguras ni protegidas, sin duplicados. */
function cleanList(list) {
  return [...new Set(list.map(normalizePath))].filter((p) => isSafePath(p) && !isProtected(p));
}

function isValidManifest(m) {
  return (
    m !== null &&
    typeof m === 'object' &&
    m.version === MANIFEST_VERSION &&
    Array.isArray(m.current) &&
    Array.isArray(m.previous) &&
    [...m.current, ...m.previous].every((p) => typeof p === 'string' && isSafePath(normalizePath(p)))
  );
}

/**
 * @param {{ currentFiles: string[], remoteManifest: unknown }} input
 *   currentFiles: rutas relativas del build a desplegar (N).
 *   remoteManifest: contenido parseado del manifiesto del servidor, o null si no existe.
 * @returns {{ toDelete: string[], nextManifest: { version: number, current: string[], previous: string[] } }}
 */
export function planDeploy({ currentFiles, remoteManifest }) {
  const current = cleanList(currentFiles).sort();

  if (!isValidManifest(remoteManifest)) {
    // Primer deploy, o manifiesto que no entendemos: no se borra nada y se arranca de cero.
    return { toDelete: [], nextManifest: { version: MANIFEST_VERSION, current, previous: [] } };
  }

  const keep = new Set([...current, ...cleanList(remoteManifest.current)]);
  const toDelete = cleanList(remoteManifest.previous)
    .filter((p) => !keep.has(p))
    .sort();

  return {
    toDelete,
    nextManifest: { version: MANIFEST_VERSION, current, previous: cleanList(remoteManifest.current).sort() },
  };
}
