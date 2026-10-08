/**
 * date-discipline.js — Detección de cálculos de fecha que no pasan por la util de hora de Chile.
 *
 * Detectores puros (Data In → Data Out, sin fs) + helpers de baseline (ratchet):
 *
 *   ARCH-27  findDateViolations     — código de app o edge function que convierte un instante
 *                                     en día (o formatea una fecha) con la zona del proceso o
 *                                     con UTC, en vez de usar chile-time.
 *   ARCH-28  findSqlDateViolations  — migración que deriva un día de negocio con la zona de
 *                                     la sesión (CURRENT_DATE y similares) o crea columnas de
 *                                     fecha y hora sin zona.
 *
 * Ratchet: el backlog pre-existente vive en date-discipline.baseline.json, por archivo y por
 * tipo. Solo se reportan REGRESIONES (un archivo supera su cuota). Las excepciones legítimas
 * se declaran en date-discipline.allowlist.json con su justificación.
 *
 * Runner: `node scripts/check-date-discipline.mjs`
 * Micro-suite: `node scripts/lib/date-discipline.test.mjs`
 */

export const DATE_RULE = 'ARCH-27';
export const SQL_DATE_RULE = 'ARCH-28';

/** Migraciones con timestamp de nombre menor o igual a este no se auditan (historia). */
export const SQL_CUTOFF = '20261008120000';

const APP_UTIL = 'core/utils/chile-time.utils.ts';
const EDGE_UTIL = 'supabase/functions/_shared/chile-time.ts';

/** Módulos que SON la util — único lugar donde estos patrones son legítimos. */
export const DATE_EXEMPT_SUFFIXES = [`src/app/${APP_UTIL}`, EDGE_UTIL];

export function isDateDisciplineExempt(relPath) {
  const p = relPath.replace(/\\/g, '/');
  if (/\.(spec|test)\.ts$/.test(p)) return true;
  return DATE_EXEMPT_SUFFIXES.some((suffix) => p.endsWith(suffix));
}

function utilFor(relPath) {
  return relPath.replace(/\\/g, '/').startsWith('supabase/functions') ? EDGE_UTIL : APP_UTIL;
}

/** Qué usar en lugar de cada patrón. La clave es el tipo de violación. */
export const DATE_KINDS = {
  'utc-slice': 'chileToday() para hoy, toChileDate(instante) para el día de un instante',
  'naive-time-suffix':
    'chileDayRange()/chileRange() para rangos, chileWallTimeToInstant() para una hora de Chile, addDaysIso()/diffDaysIso() para aritmética',
  'format-no-zone': 'formatChileDate()/formatChileTime()',
  'local-date-parts':
    'chileParts(instante) para leer, addDaysIso()/addMonthsIso()/mondayOfIso() para calcular, calendarDateToIso() para un selector de fechas',
  'angular-date-pipe': 'el pipe chileDate',
  'deprecated-date-api':
    'chileToday(), toChileDate(instante) o calendarDateToIso(fecha); chileDayRange() en vez de getChileDateTimeRange()',
};

// ── Limpieza de comentarios ──────────────────────────────────────────────────
// Un patrón nombrado en un comentario no es una violación. Los bloques se reemplazan por
// espacios conservando los saltos de línea, para que los números de línea no se muevan.
export function stripComments(content) {
  const blank = (text) => text.replace(/[^\n]/g, ' ');
  return content
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, pre) => pre + blank(m.slice(pre.length)));
}

/** Texto entre el paréntesis que abre en `openIndex` y su cierre balanceado. */
export function argsAt(content, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < content.length; i++) {
    const ch = content[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return content.slice(openIndex + 1, i);
    }
  }
  return content.slice(openIndex + 1);
}

function lineOf(content, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (content.charCodeAt(i) === 10) line++;
  return line;
}

const DATE_OPTION_KEYS =
  /\b(day|month|year|hour|minute|second|weekday|dateStyle|timeStyle|hour12|hourCycle)\s*:/;

const SIMPLE_PATTERNS = [
  ['utc-slice', /\.toISOString\(\)\s*\.\s*(?:slice|split|substring|substr)\(/g],
  // Hora sin zona que cierra un literal: '...T00:00:00', `${d}T23:59:59`, + 'T12:00:00'.
  ['naive-time-suffix', /T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?=['"`])/g],
  [
    'local-date-parts',
    /\.(?:getFullYear|getMonth|getDate|getDay|getHours|getMinutes|setFullYear|setMonth|setDate|setHours|setMinutes)\(/g,
  ],
  ['deprecated-date-api', /\b(?:toISODate|getChileDateTimeRange)\(/g],
];

const FORMAT_CALL = /(\.toLocaleDateString|\.toLocaleTimeString|\.toLocaleString|Intl\.DateTimeFormat)\(/g;
const DATE_PIPE = /\|\s*date\b(?!\s*=)/g;

/**
 * Violaciones ARCH-27 de un archivo. `relPath` relativo a la raíz del repo.
 * Devuelve [{ kind, line, sample }].
 */
export function findDateViolations(content, relPath) {
  if (isDateDisciplineExempt(relPath)) return [];
  const p = relPath.replace(/\\/g, '/');
  const src = stripComments(content);
  const hits = [];
  const push = (kind, index, length) =>
    hits.push({
      kind,
      line: lineOf(src, index),
      sample: src.slice(index, index + Math.max(length, 40)).split('\n')[0].trim(),
    });

  for (const [kind, pattern] of SIMPLE_PATTERNS) {
    // La definición de las funciones deprecadas vive en date.utils.ts.
    if (kind === 'deprecated-date-api' && p.endsWith('core/utils/date.utils.ts')) continue;
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(src)) !== null) push(kind, m.index, m[0].length);
  }

  FORMAT_CALL.lastIndex = 0;
  let m;
  while ((m = FORMAT_CALL.exec(src)) !== null) {
    const args = argsAt(src, m.index + m[0].length - 1);
    if (/\btimeZone\s*:/.test(args)) continue;
    if (m[1] === '.toLocaleString') {
      // toLocaleString también formatea números: solo cuenta si las opciones son de fecha
      // o si se encadena directo sobre un `new Date(...)`.
      const before = src.slice(Math.max(0, m.index - 80), m.index);
      const onDate = /new Date\([^()]*(?:\([^()]*\)[^()]*)*\)\s*$/.test(before);
      if (!onDate && !DATE_OPTION_KEYS.test(args)) continue;
    }
    push('format-no-zone', m.index, m[0].length);
  }

  if (p.endsWith('.html') || p.endsWith('.component.ts')) {
    DATE_PIPE.lastIndex = 0;
    while ((m = DATE_PIPE.exec(src)) !== null) push('angular-date-pipe', m.index, m[0].length);
  }

  return hits.sort((a, b) => a.line - b.line);
}

/** Mensaje de corrección para un tipo de violación en un archivo dado. */
export function fixHint(kind, relPath) {
  return `Usa ${DATE_KINDS[kind]} (${utilFor(relPath)}).`;
}

// ── ARCH-28: migraciones ─────────────────────────────────────────────────────

export const SQL_KINDS = {
  'current-date': 'public.chile_today()',
  'now-cast-date': 'public.chile_today() o public.chile_date(instante)',
  'local-timestamp': 'now() con conversión explícita vía public.chile_date()',
  'timestamp-without-zone': 'timestamptz para un instante, date para un día',
};

const SQL_PATTERNS = [
  ['current-date', /\bCURRENT_DATE\b/gi],
  ['now-cast-date', /\b(?:now\(\)|CURRENT_TIMESTAMP)\s*\)?\s*::\s*date\b/gi],
  ['local-timestamp', /\bLOCALTIME(?:STAMP)?\b/gi],
  ['timestamp-without-zone', /\btimestamp\b(?!\s+with\s+time\s+zone)/gi],
];

export function stripSqlComments(content) {
  const blank = (text) => text.replace(/[^\n]/g, ' ');
  return content.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/--[^\n]*/g, blank);
}

/** True si la migración es posterior al corte y por lo tanto se audita. */
export function isSqlAudited(fileName) {
  const stamp = (fileName.match(/^(\d{14})/) || [])[1];
  return !!stamp && stamp > SQL_CUTOFF;
}

/** Violaciones ARCH-28 de una migración. Devuelve [{ kind, line, sample }]. */
export function findSqlDateViolations(content) {
  const src = stripSqlComments(content);
  const hits = [];
  for (const [kind, pattern] of SQL_PATTERNS) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(src)) !== null) {
      hits.push({
        kind,
        line: lineOf(src, m.index),
        sample: src.slice(m.index, m.index + 50).split('\n')[0].trim(),
      });
    }
  }
  return hits.sort((a, b) => a.line - b.line);
}

// ── Excepciones declaradas ───────────────────────────────────────────────────

/**
 * Valida el allowlist: cada entrada necesita archivo, tipo conocido y justificación.
 * Devuelve la lista de problemas (vacía si está bien).
 */
export function validateAllowlist(entries) {
  const problems = [];
  if (!Array.isArray(entries)) return ['el allowlist debe ser un arreglo'];
  entries.forEach((entry, i) => {
    const where = `entrada ${i + 1}`;
    if (!entry?.file) problems.push(`${where}: falta "file"`);
    if (!entry?.kind || !(entry.kind in DATE_KINDS)) problems.push(`${where}: "kind" desconocido`);
    if (!entry?.reason || String(entry.reason).trim().length < 20) {
      problems.push(`${where}: falta "reason" (mínimo 20 caracteres)`);
    }
  });
  return problems;
}

export function isAllowed(entries, relPath, kind) {
  const p = relPath.replace(/\\/g, '/');
  return (entries || []).some((e) => e.file === p && e.kind === kind);
}

// ── Baseline (ratchet) ───────────────────────────────────────────────────────

/** `counts`: Map<archivo, { [kind]: { count, sample } }>. */
export function buildDateBaseline(counts) {
  const files = {};
  const kinds = {};
  let total = 0;
  for (const [file, byKind] of [...counts.entries()].sort()) {
    files[file] = {};
    for (const kind of Object.keys(byKind).sort()) {
      const n = byKind[kind].count;
      files[file][kind] = n;
      kinds[kind] = (kinds[kind] || 0) + n;
      total += n;
    }
  }
  return { total, kinds, files };
}

/** Regresión = un archivo supera su cuota para un tipo (o aparece nuevo con violaciones). */
export function compareDateBaseline(counts, baseline) {
  const regressions = [];
  let currentTotal = 0;
  for (const [file, byKind] of counts.entries()) {
    for (const [kind, info] of Object.entries(byKind)) {
      currentTotal += info.count;
      const allowed = baseline?.files?.[file]?.[kind] || 0;
      if (info.count > allowed) {
        regressions.push({ file, kind, was: allowed, now: info.count, sample: info.sample });
      }
    }
  }
  const baselineTotal = baseline?.total || 0;
  return { regressions, currentTotal, baselineTotal, improved: currentTotal < baselineTotal };
}
