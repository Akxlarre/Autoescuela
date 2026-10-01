/**
 * next-version.js — número de la próxima versión de producción (fix-177-b, F1).
 *
 * "Publicar en producción" le pregunta a la persona el TIPO de cambio, no el número:
 *   - arreglo → vX.Y.(Z+1)
 *   - mejora  → vX.(Y+1).0
 * Así nadie tiene que mirar qué tags existen ni conocer semver.
 *
 * Solo cuentan los tags semver puros (`v1.2.3`). Los de prueba o pre-release (`v0.0.0-ace5`,
 * `v1.0.0-rc1`) se ignoran: el pipeline nunca los crea y no deben correr la numeración.
 * La base es el MAYOR tag existente, no el último publicado, porque un tag cuyo deploy se rechazó
 * igual existe en el repo y su número no se puede reutilizar.
 *
 * Función pura: recibe la lista de tags (salida de `git tag -l`) y no toca git.
 */

const SEMVER_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** `'v1.2.3'` → `[1, 2, 3]`; cualquier otra cosa → `null`. */
export function parseVersion(tag) {
  const m = SEMVER_TAG.exec(String(tag).trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** El mayor tag semver de la lista, o `null` si no hay ninguno. */
export function latestVersion(tags) {
  const versions = tags.map(parseVersion).filter(Boolean).sort(compare);
  if (versions.length === 0) return null;
  const [major, minor, patch] = versions[versions.length - 1];
  return `v${major}.${minor}.${patch}`;
}

/**
 * @param {string[]} tags  tags existentes en el repo
 * @param {'arreglo' | 'mejora'} tipo
 * @returns {string} tag de la próxima versión (sin tags previos: `v0.1.0`)
 */
export function nextVersion(tags, tipo) {
  if (tipo !== 'arreglo' && tipo !== 'mejora') {
    throw new Error(`Tipo de cambio desconocido: "${tipo}" (se espera "arreglo" o "mejora").`);
  }
  const latest = latestVersion(tags);
  if (latest === null) return 'v0.1.0';
  const [major, minor, patch] = parseVersion(latest);
  return tipo === 'arreglo' ? `v${major}.${minor}.${patch + 1}` : `v${major}.${minor + 1}.0`;
}
