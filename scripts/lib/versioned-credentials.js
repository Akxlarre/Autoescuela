/**
 * versioned-credentials.js — Credenciales escritas en archivos versionados (ARCH-34).
 *
 * El detector de secretos de pre-write-guard.js busca asignaciones de 16 o más caracteres en
 * código. No ve una contraseña corta ni una escrita en prosa ("Contraseña única: `…`"), que es
 * como una credencial de prueba termina copiada en guías, skills y specs.
 *
 * Detecta por forma, no por valor: este archivo no conoce ninguna contraseña.
 *
 * Funciones puras. El disco y git los lee scripts/check-qa-guardrails.mjs.
 */

const KEYWORD_RE = /contrase[ñn]a|password|passwd/i;

// Un valor entre comillas o backticks, sin espacios, de largo razonable para una contraseña.
const QUOTED_TOKEN_RE = /[`'"]([^`'"\s]{8,40})[`'"]/g;

// Rutas, llamadas, marcadores de posición y referencias a tracks: tienen letras y números, y no
// son credenciales.
const NOT_A_VALUE_RE = /[/\\.:(){}<>$*=,;[\]|]|^(?:fix|hotfix|spec|asg)-/i;

// Nombre de variable de entorno: solo mayúsculas, dígitos y guion bajo. Sin la bandera `i`, o
// calzaría con cualquier valor alfanumérico.
const ENV_NAME_RE = /^[A-Z0-9_]+$/;

function looksLikeCredential(token) {
  if (NOT_A_VALUE_RE.test(token) || ENV_NAME_RE.test(token)) return false;
  // Una palabra sola o un número solo no alcanza: se exige mezcla de letras y dígitos.
  return /[a-zA-Z]/.test(token) && /[0-9]/.test(token);
}

/**
 * Líneas que nombran una contraseña y traen, en la misma línea, un valor entre comillas con forma
 * de credencial.
 *
 * @param {string} text contenido de un archivo
 * @returns {{ line: number }[]} sin el valor: el reporte no debe copiar la credencial
 */
export function findCredentialLiterals(text) {
  const findings = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!KEYWORD_RE.test(line)) continue;
    for (const match of line.matchAll(QUOTED_TOKEN_RE)) {
      if (looksLikeCredential(match[1])) {
        findings.push({ line: i + 1 });
        break;
      }
    }
  }
  return findings;
}

/**
 * Archivos donde una credencial de fixture es normal y no viaja a ningún sistema real: los tests
 * unitarios de la app y de las edge functions. Los e2e NO entran acá: sus cuentas existen.
 */
export function isUnitTestFixture(file) {
  const normalized = file.replace(/\\/g, '/');
  return (
    (normalized.startsWith('src/') && normalized.endsWith('.spec.ts')) ||
    (normalized.startsWith('supabase/functions/') && /\.test\.ts$/.test(normalized))
  );
}

/**
 * Trinquete por archivo: no puede aparecer una credencial en un archivo nuevo, ni sumarse otra
 * en uno que ya tenía.
 *
 * @param {Record<string, number>} current  archivo → cantidad de líneas marcadas hoy
 * @param {Record<string, number>} baseline archivo → cantidad registrada
 */
export function compareCredentialCounts(current, baseline = {}) {
  const regressions = [];
  const cleaned = [];
  for (const [file, count] of Object.entries(current)) {
    const before = baseline[file] ?? 0;
    if (count > before) regressions.push({ file, now: count, before });
  }
  for (const [file, before] of Object.entries(baseline)) {
    const now = current[file] ?? 0;
    if (now < before) cleaned.push({ file, now, before });
  }
  return { regressions, cleaned };
}
