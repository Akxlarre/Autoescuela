/**
 * agents-mirror.js — ARCH-30: .agents/ es un espejo de .claude/, no una segunda fuente.
 *
 * Antigravity lee sus reglas y skills de .agents/rules y .agents/skills. Son copias de
 * .claude/rules y .claude/skills: si alguien cambia una regla en .claude/ y no la copia, el
 * agente de Antigravity trabaja con la versión vieja sin que nada avise.
 *
 * Acá solo vive la comparación (funciones puras, sin disco). El runner que lee el disco y
 * copia es scripts/check-agents-mirror.mjs.
 */

/** Pares fuente → espejo, relativos a la raíz del repo. */
export const MIRRORS = [
  { source: '.claude/rules', mirror: '.agents/rules' },
  { source: '.claude/skills', mirror: '.agents/skills' },
];

const TEXT_EXTENSIONS = ['.md', '.txt', '.html', '.json', '.xml', '.js', '.cjs', '.mjs', '.ts'];

function isText(relPath) {
  return TEXT_EXTENSIONS.some((ext) => relPath.toLowerCase().endsWith(ext));
}

/**
 * Dos contenidos son iguales si coinciden byte a byte, o si son texto y solo difieren en los
 * finales de línea (git en Windows puede dejar CRLF en un lado y LF en el otro).
 *
 * @param {string} relPath
 * @param {Buffer} a
 * @param {Buffer} b
 */
export function sameContent(relPath, a, b) {
  if (a.equals(b)) return true;
  if (!isText(relPath)) return false;
  const norm = (buf) => buf.toString('utf8').replace(/\r\n/g, '\n');
  return norm(a) === norm(b);
}

/**
 * Compara una fuente con su espejo.
 *
 * @param {Map<string, Buffer>} sourceFiles  ruta relativa (con "/") → contenido
 * @param {Map<string, Buffer>} mirrorFiles  ruta relativa (con "/") → contenido
 * @returns {{ missing: string[], stale: string[], orphan: string[] }}
 *   missing: está en la fuente y falta en el espejo.
 *   stale:   está en los dos con contenido distinto.
 *   orphan:  está solo en el espejo (se borró o renombró en la fuente).
 */
export function diffMirror(sourceFiles, mirrorFiles) {
  const missing = [];
  const stale = [];
  const orphan = [];

  for (const [rel, content] of sourceFiles) {
    if (!mirrorFiles.has(rel)) missing.push(rel);
    else if (!sameContent(rel, content, mirrorFiles.get(rel))) stale.push(rel);
  }
  for (const rel of mirrorFiles.keys()) {
    if (!sourceFiles.has(rel)) orphan.push(rel);
  }

  return { missing: missing.sort(), stale: stale.sort(), orphan: orphan.sort() };
}
