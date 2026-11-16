/**
 * harness-selfcheck.js — El harness se comprueba a sí mismo (ARCH-31, ARCH-32, ARCH-33).
 *
 * Un guardrail que existe pero no corre es igual a no tenerlo, y nada avisa cuando pasa:
 * un hook en el directorio sin conectar, una regla que se cita como activa sin respaldo, una
 * recuperación de contexto que creció hasta no caber, un índice que se volvió historial.
 *
 * Funciones puras: reciben texto y devuelven hallazgos. El disco lo lee
 * scripts/check-qa-guardrails.mjs.
 */

// ── ARCH-31: hooks conectados y hooks documentados ─────────────────────────────────────────

/** Nombre de archivo de un hook, sin la ruta. */
function baseName(file) {
  return file.replace(/\\/g, '/').split('/').pop();
}

/**
 * Hooks que están en el directorio y que settings.json no nombra.
 *
 * @param {string[]} hookFiles    rutas de los .js bajo .claude/hooks
 * @param {string}   settingsText contenido de .claude/settings.json
 * @param {Record<string, string>} notWired excepciones: ruta → por qué no está conectado
 */
export function findUnwiredHooks(hookFiles, settingsText, notWired = {}) {
  return hookFiles
    .map((file) => file.replace(/\\/g, '/'))
    .filter((file) => !settingsText.includes(baseName(file)) && !(file in notWired));
}

/**
 * Excepciones que ya no describen la realidad: el hook se conectó o se borró.
 * La lista tiene que seguir siendo verdad, o deja de servir como registro.
 */
export function findStaleNotWired(hookFiles, settingsText, notWired = {}) {
  const present = new Set(hookFiles.map((file) => file.replace(/\\/g, '/')));
  return Object.keys(notWired)
    .filter((file) => !present.has(file) || settingsText.includes(baseName(file)))
    .map((file) => ({ file, reason: present.has(file) ? 'ya está conectado' : 'ya no existe' }));
}

/**
 * Nombres de los hooks que CLAUDE.md presenta como activos: las viñetas `- **Nombre** —` de la
 * sección "Sistema de Hooks Activo", hasta el siguiente encabezado.
 */
export function parseDocumentedHooks(claudeMd) {
  const start = claudeMd.search(/^##\s+Sistema de Hooks Activo\s*$/m);
  if (start === -1) return [];
  const rest = claudeMd.slice(start).split('\n').slice(1);
  const names = [];
  for (const line of rest) {
    if (/^##\s/.test(line)) break;
    const match = line.match(/^-\s+\*\*([^*]+)\*\*\s+[—-]/);
    if (match) names.push(match[1].trim());
  }
  return names;
}

/**
 * Hooks documentados como activos sin respaldo en settings.json.
 *
 * @param {string[]} names        salida de parseDocumentedHooks
 * @param {Record<string, string>} evidence nombre → texto que debe aparecer en settings.json
 *                                (el archivo del hook, o una frase propia de un hook de tipo prompt)
 * @param {string}   settingsText contenido de .claude/settings.json
 */
export function findUnbackedDocumentedHooks(names, evidence, settingsText) {
  const findings = [];
  for (const name of names) {
    const proof = evidence[name];
    if (!proof) findings.push({ name, problem: 'sin-mapa' });
    else if (!settingsText.includes(proof)) findings.push({ name, problem: 'sin-respaldo', proof });
  }
  return findings;
}

// ── ARCH-38: el catálogo de patrones apunta a archivos que existen ─────────────────────────

const REPO_PATH_RE = /`((?:src|supabase|scripts|e2e|\.claude|docs|indices)\/[^`\s]+)`/g;

/**
 * Rutas del repositorio citadas entre backticks en un índice. Un catálogo que manda a copiar un
 * archivo que ya no está es peor que no tener catálogo.
 */
export function extractRepoPaths(text) {
  return [...new Set([...text.matchAll(REPO_PATH_RE)].map((match) => match[1]))];
}

/**
 * @param {string} text contenido del catálogo
 * @param {(relPath: string) => boolean} exists consulta al disco, inyectada por el runner
 */
export function findMissingReferences(text, exists) {
  return extractRepoPaths(text).filter((relPath) => !exists(relPath));
}

// ── ARCH-32: presupuesto de la recuperación tras compactar ─────────────────────────────────

/**
 * @param {number} bytes    lo que el hook escribe al contexto
 * @param {number} maxBytes techo vigente
 * @returns {{ over: boolean, excess: number }}
 */
export function checkPayloadBudget(bytes, maxBytes) {
  return { over: bytes > maxBytes, excess: Math.max(0, bytes - maxBytes) };
}

// ── ARCH-33: filas de índice que se volvieron historial ────────────────────────────────────

/** Una fila de más de este largo ya no es una entrada de índice: es un registro de cambios. */
export const INDEX_ROW_LIMIT = 1200;

/**
 * @param {string} text contenido de un índice
 * @returns {{ count: number, chars: number }} cuántas filas pasan el límite y cuánto suman
 */
export function measureLongRows(text, limit = INDEX_ROW_LIMIT) {
  let count = 0;
  let chars = 0;
  for (const line of text.split('\n')) {
    if (line.length > limit) {
      count++;
      chars += line.length;
    }
  }
  return { count, chars };
}

/**
 * Trinquete: un índice no puede sumar filas largas ni alargar las que ya tiene.
 *
 * @param {Record<string, { count: number, chars: number }>} current  medición de hoy por archivo
 * @param {Record<string, { count: number, chars: number }>} baseline medición registrada
 */
export function compareIndexRows(current, baseline = {}) {
  const regressions = [];
  const improvements = [];
  for (const [file, now] of Object.entries(current)) {
    const before = baseline[file] ?? { count: 0, chars: 0 };
    if (now.count > before.count) {
      regressions.push({ file, kind: 'fila-nueva', now: now.count, before: before.count });
    } else if (now.chars > before.chars) {
      regressions.push({ file, kind: 'fila-crecio', now: now.chars, before: before.chars });
    } else if (now.chars < before.chars) {
      improvements.push({ file, now: now.chars, before: before.chars });
    }
  }
  return { regressions, improvements };
}
