/**
 * sql-schema.js — Estado acumulado del esquema desde supabase/migrations/ (spec 0022)
 *
 * Parser por sentencia (regex estructurado, cero dependencias). Filosofía AC7:
 * toda sentencia DDL que no se entienda se registra en warnings y marca la tabla
 * como "parse parcial" — NUNCA se omite en silencio.
 *
 * Fuera de scope consciente (§4 de la spec): seeds (INSERT/UPDATE/DELETE),
 * GRANT/REVOKE, triggers, extensiones, publicaciones Realtime, COMMENT ON COLUMN.
 */

import fs from 'fs';
import path from 'path';

// ─── Split de sentencias ─────────────────────────────────────────────────────

/**
 * Divide un archivo SQL en sentencias individuales.
 * Protege cuerpos dollar-quoted ($$…$$ / $tag$…$tag$) para que sus ';' internos
 * no rompan el split, y elimina comentarios.
 */
export function splitStatements(sql) {
  // 1. Comentarios PRIMERO: un '$$' o ';' dentro de un comentario desalinearía
  //    el pareo de dollar-quotes (caso real: "-- Usamos $$ para evitar…").
  let masked = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  masked = masked
    .split('\n')
    .map(line => {
      // no cortar un -- que esté dentro de un string simple
      let inString = false;
      for (let i = 0; i < line.length - 1; i++) {
        if (line[i] === "'") inString = !inString;
        if (!inString && line[i] === '-' && line[i + 1] === '-') return line.slice(0, i);
      }
      return line;
    })
    .join('\n');

  // 2. Proteger dollar-quoted bodies
  const bodies = [];
  masked = masked.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, (m) => {
    bodies.push(m);
    return `__DOLLAR_BODY_${bodies.length - 1}__`;
  });

  // 3. Proteger strings simples ('' es el escape SQL) — un ';' interno no debe cortar
  const strings = [];
  masked = masked.replace(/'(?:[^']|'')*'/g, (m) => {
    strings.push(m);
    return `__SQL_STRING_${strings.length - 1}__`;
  });

  // 4. Split por ';' y restaurar strings y bodies
  return masked
    .split(';')
    .map(s => s
      .replace(/__SQL_STRING_(\d+)__/g, (_, i) => strings[+i])
      .replace(/__DOLLAR_BODY_(\d+)__/g, (_, i) => bodies[+i])
      .trim())
    .filter(s => s.length > 0);
}

// ─── Utilidades de parseo ────────────────────────────────────────────────────

/** Divide por comas de nivel superior (respeta paréntesis anidados Y strings). */
function splitTopLevel(str) {
  const parts = [];
  let depth = 0, inString = false, current = '';
  for (const ch of str) {
    if (ch === "'") inString = !inString;
    if (!inString) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; continue; }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const ident = (s) => s?.replace(/^(?:public\.)?"?(\w+)"?$/, '$1') ?? null;

const TYPE_RE =
  /^"?(\w+)"?\s+(\w+(?:\s+(?:VARYING|PRECISION|WITH\s+TIME\s+ZONE|WITHOUT\s+TIME\s+ZONE))?(?:\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\))?(?:\[\])?)/i;

function parseColumnDef(def) {
  const m = def.match(TYPE_RE);
  if (!m) return null;
  const [, name, type] = m;
  const rest = def.slice(m[0].length);
  const fkMatch = rest.match(/REFERENCES\s+(?:public\.)?"?(\w+)"?\s*(?:\(\s*"?(\w+)"?\s*\))?/i);
  const defMatch = rest.match(/DEFAULT\s+((?:[^,\s]|\([^)]*\))+(?:\s*\([^)]*\))?)/i);
  return {
    name,
    type: type.replace(/\s+/g, ' ').toUpperCase(),
    notNull: /\bNOT\s+NULL\b/i.test(rest),
    pk: /\bPRIMARY\s+KEY\b/i.test(rest),
    unique: /\bUNIQUE\b/i.test(rest),
    default: defMatch ? defMatch[1] : null,
    fk: fkMatch ? { table: fkMatch[1], column: fkMatch[2] ?? 'id' } : null,
  };
}

function newTable() {
  return {
    columns: new Map(),   // name → col
    tableFks: [],         // FKs de constraints de tabla
    indexes: new Set(),
    policies: new Map(),  // name → { cmd, using, check }
    rls: false,
    description: null,
    parseWarnings: [],
  };
}

// ─── Reducer de sentencias ───────────────────────────────────────────────────

/** Tipos que se ignoran a propósito (no son esquema o están fuera de scope §4). */
const IGNORED_RE =
  /^(?:INSERT|UPDATE|DELETE|GRANT|REVOKE|DO|SET|BEGIN|COMMIT|SELECT|TRUNCATE|NOTIFY|CREATE\s+EXTENSION|CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER|DROP\s+TRIGGER|COMMENT\s+ON\s+(?:COLUMN|FUNCTION|POLICY|VIEW|INDEX|SCHEMA|EXTENSION|CONSTRAINT)|ALTER\s+PUBLICATION|CREATE\s+PUBLICATION|ALTER\s+(?:FUNCTION|VIEW|INDEX|SEQUENCE|SCHEMA|DEFAULT\s+PRIVILEGES)|CREATE\s+SEQUENCE|CREATE\s+SCHEMA|CREATE\s+TYPE|ALTER\s+TYPE|DROP\s+TYPE|REINDEX|ANALYZE|VACUUM)\b/i;

export function applyStatement(state, stmt, file) {
  const s = stmt.trim();

  // ── CREATE TABLE ──
  let m = s.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?\s*\(([\s\S]*)\)[^)]*$/i);
  if (m) {
    const name = m[1];
    if (state.tables.has(name)) return; // idempotencia: primera definición gana (AC-E1)
    const table = newTable();
    for (const def of splitTopLevel(m[2])) {
      if (/^(?:CONSTRAINT\s+"?\w+"?\s+)?FOREIGN\s+KEY/i.test(def)) {
        const fk = def.match(/FOREIGN\s+KEY\s*\(\s*"?(\w+)"?\s*\)\s*REFERENCES\s+(?:public\.)?"?(\w+)"?\s*(?:\(\s*"?(\w+)"?\s*\))?/i);
        if (fk) table.tableFks.push({ column: fk[1], table: fk[2], refColumn: fk[3] ?? 'id' });
        continue;
      }
      if (/^(?:CONSTRAINT\s+"?\w+"?\s+)?PRIMARY\s+KEY/i.test(def)) {
        const pk = def.match(/PRIMARY\s+KEY\s*\(([^)]*)\)/i);
        if (pk) for (const c of pk[1].split(',')) {
          const col = table.columns.get(ident(c.trim()));
          if (col) col.pk = true;
        }
        continue;
      }
      if (/^(?:CONSTRAINT|UNIQUE|CHECK|EXCLUDE|LIKE)\b/i.test(def)) continue; // metadatos sin columnas
      const col = parseColumnDef(def);
      if (col) table.columns.set(col.name, col);
      else table.parseWarnings.push(`columna no parseada: "${def.slice(0, 60)}" (${file})`);
    }
    state.tables.set(name, table);
    return;
  }

  // ── ALTER TABLE ──
  m = s.match(/^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?"?(\w+)"?\s+([\s\S]*)$/i);
  if (m) {
    const name = m[1];
    const table = state.tables.get(name);
    if (!table) {
      state.warnings.push(`ALTER sobre tabla desconocida '${name}' (${file})`);
      return;
    }
    for (const action of splitTopLevel(m[2])) {
      let a;
      if ((a = action.match(/^ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([\s\S]+)$/i)) && !/^ADD\s+CONSTRAINT/i.test(action)) {
        const col = parseColumnDef(a[1]);
        if (col) { if (!table.columns.has(col.name)) table.columns.set(col.name, col); }
        else table.parseWarnings.push(`ADD COLUMN no parseado: "${a[1].slice(0, 60)}" (${file})`);
      } else if ((a = action.match(/^DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?"?(\w+)"?/i))) {
        table.columns.delete(a[1]);
      } else if ((a = action.match(/^RENAME\s+COLUMN\s+"?(\w+)"?\s+TO\s+"?(\w+)"?/i))) {
        const col = table.columns.get(a[1]);
        if (col) { table.columns.delete(a[1]); col.name = a[2]; table.columns.set(a[2], col); }
      } else if ((a = action.match(/^RENAME\s+TO\s+"?(\w+)"?/i))) {
        state.tables.delete(name);
        state.tables.set(a[1], table);
      } else if ((a = action.match(/^ADD\s+CONSTRAINT\s+"?\w+"?\s+FOREIGN\s+KEY\s*\(\s*"?(\w+)"?\s*\)\s*REFERENCES\s+(?:public\.)?"?(\w+)"?\s*(?:\(\s*"?(\w+)"?\s*\))?/i))) {
        table.tableFks.push({ column: a[1], table: a[2], refColumn: a[3] ?? 'id' });
      } else if (/^ADD\s+CONSTRAINT\b/i.test(action)) {
        // CHECK/UNIQUE constraints: metadatos, no cambian columnas
      } else if (/^ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(action)) {
        table.rls = true;
      } else if (/^(?:DISABLE|FORCE|NO\s+FORCE)\s+ROW\s+LEVEL\s+SECURITY/i.test(action)) {
        if (/^DISABLE/i.test(action)) table.rls = false;
      } else if ((a = action.match(/^ALTER\s+(?:COLUMN\s+)?"?(\w+)"?\s+([\s\S]+)$/i))) {
        const col = table.columns.get(a[1]);
        if (col) {
          let b;
          if ((b = a[2].match(/^(?:SET\s+DATA\s+)?TYPE\s+([\w\s(),]+?)(?:\s+USING[\s\S]*)?$/i))) col.type = b[1].trim().toUpperCase();
          else if ((b = a[2].match(/^SET\s+DEFAULT\s+([\s\S]+)$/i))) col.default = b[1].trim();
          else if (/^DROP\s+DEFAULT/i.test(a[2])) col.default = null;
          else if (/^SET\s+NOT\s+NULL/i.test(a[2])) col.notNull = true;
          else if (/^DROP\s+NOT\s+NULL/i.test(a[2])) col.notNull = false;
          else table.parseWarnings.push(`ALTER COLUMN no entendido: "${action.slice(0, 60)}" (${file})`);
        }
      } else if (/^DROP\s+CONSTRAINT/i.test(action)) {
        // sin efecto en el modelo simplificado
      } else {
        table.parseWarnings.push(`acción ALTER no entendida: "${action.slice(0, 60)}" (${file})`);
      }
    }
    return;
  }

  // ── DROP TABLE ──
  m = s.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?/i);
  if (m) { state.tables.delete(m[1]); return; }

  // ── CREATE INDEX / DROP INDEX ──
  m = s.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?\s+ON\s+(?:public\.)?"?(\w+)"?/i);
  if (m) { state.tables.get(m[2])?.indexes.add(m[1]); return; }
  if (/^DROP\s+INDEX\b/i.test(s)) {
    const name = s.match(/"?(\w+)"?\s*$/)?.[1];
    if (name) for (const t of state.tables.values()) t.indexes.delete(name);
    return;
  }

  // ── CREATE POLICY / DROP POLICY ──
  // Policies sobre schemas ajenos (storage.objects, auth.*) — fuera del esquema del app.
  if (/^(?:CREATE|DROP)\s+POLICY\s+[\s\S]*?\bON\s+(?!public\.)\w+\./i.test(s)) return;
  m = s.match(/^CREATE\s+POLICY\s+"?([\w\s-]+?)"?\s+ON\s+(?:public\.)?"?(\w+)"?([\s\S]*)$/i);
  if (m) {
    const table = state.tables.get(m[2]);
    if (!table) { state.warnings.push(`POLICY sobre tabla desconocida '${m[2]}' (${file})`); return; }
    const rest = m[3];
    const cmd = rest.match(/\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i)?.[1]?.toUpperCase() ?? 'ALL';
    const clip = (t) => t ? (t.replace(/\s+/g, ' ').trim().length > 80 ? t.replace(/\s+/g, ' ').trim().slice(0, 77) + '…' : t.replace(/\s+/g, ' ').trim()) : null;
    const using = clip(rest.match(/\bUSING\s*\(([\s\S]*?)\)\s*(?:WITH\s+CHECK|$)/i)?.[1]);
    const check = clip(rest.match(/\bWITH\s+CHECK\s*\(([\s\S]*)\)\s*$/i)?.[1]);
    table.policies.set(m[1].trim(), { cmd, using, check });
    return;
  }
  m = s.match(/^DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"?([\w\s-]+?)"?\s+ON\s+(?:public\.)?"?(\w+)"?/i);
  if (m) { state.tables.get(m[2])?.policies.delete(m[1].trim()); return; }

  // ── FUNCTION / VIEW ──
  m = s.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?"?(\w+)"?\s*\(([^)]*)\)/i);
  if (m) { state.functions.set(m[1], m[2].replace(/\s+/g, ' ').trim()); return; }
  m = s.match(/^DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?/i);
  if (m) { state.functions.delete(m[1]); return; }
  m = s.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:public\.)?"?(\w+)"?/i);
  if (m) { state.views.set(m[1], file); return; }
  m = s.match(/^DROP\s+(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?/i);
  if (m) { state.views.delete(m[1]); return; }

  // ── COMMENT ON TABLE → descripción ──
  m = s.match(/^COMMENT\s+ON\s+TABLE\s+(?:public\.)?"?(\w+)"?\s+IS\s+'([\s\S]*)'$/i);
  if (m) {
    const t = state.tables.get(m[1]);
    if (t) t.description = m[2].replace(/''/g, "'");
    return;
  }

  // ── Ignorados conscientes ──
  if (IGNORED_RE.test(s)) return;

  // ── AC7: sentencia no entendida ──
  state.warnings.push(`sentencia no entendida en ${file}: "${s.slice(0, 80).replace(/\s+/g, ' ')}"`);
}

// ─── API principal ───────────────────────────────────────────────────────────

export function parseMigrations(dir) {
  const state = { tables: new Map(), views: new Map(), functions: new Map(), warnings: [] };
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    for (const stmt of splitStatements(sql)) {
      try {
        applyStatement(state, stmt, file);
      } catch (e) {
        state.warnings.push(`excepción parseando ${file}: ${String(e?.message || e)}`);
      }
    }
  }
  return state;
}

export function renderDatabaseMd(state) {
  const lines = [];
  const tables = [...state.tables.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  lines.push(`## Esquema efectivo (${tables.length} tablas, acumulado de las migraciones)\n`);

  for (const [name, t] of tables) {
    const partial = t.parseWarnings.length > 0 ? ' ⚠ parse parcial' : '';
    const rls = t.rls ? '🔒 RLS' : '🔓 sin RLS';
    lines.push(`### \`${name}\` — ${rls}${partial}\n`);
    if (t.description) lines.push(`> ${t.description}\n`);

    lines.push('| Columna | Tipo | Null | Default | FK |');
    lines.push('|---------|------|------|---------|----|');
    const fkByCol = new Map(t.tableFks.map(fk => [fk.column, fk]));
    for (const col of t.columns.values()) {
      const fk = col.fk ?? fkByCol.get(col.name);
      const fkTxt = fk ? `→ \`${fk.table}.${fk.column ?? fk.refColumn}\`` : '—';
      const flags = [col.pk ? 'PK' : null, col.unique ? 'UQ' : null].filter(Boolean).join(' ');
      lines.push(
        `| \`${col.name}\`${flags ? ` ${flags}` : ''} | ${col.type} | ${col.notNull || col.pk ? 'NO' : 'sí'} | ${col.default ? `\`${col.default}\`` : '—'} | ${fkTxt} |`,
      );
    }
    lines.push('');

    if (t.policies.size > 0) {
      lines.push('**Policies:**\n');
      lines.push('| Policy | Cmd | USING | WITH CHECK |');
      lines.push('|--------|-----|-------|------------|');
      for (const [pName, p] of t.policies) {
        lines.push(`| ${pName} | ${p.cmd} | ${p.using ? `\`${p.using}\`` : '—'} | ${p.check ? `\`${p.check}\`` : '—'} |`);
      }
      lines.push('');
    }
    if (t.indexes.size > 0) {
      lines.push(`**Índices:** ${[...t.indexes].sort().map(i => `\`${i}\``).join(', ')}\n`);
    }
    for (const w of t.parseWarnings) lines.push(`> ⚠ ${w}`);
    if (t.parseWarnings.length > 0) lines.push('');
  }

  if (state.views.size > 0) {
    lines.push('## Vistas\n');
    lines.push('| Vista | Definida en |');
    lines.push('|-------|-------------|');
    for (const [v, file] of [...state.views.entries()].sort()) lines.push(`| \`${v}\` | \`${file}\` |`);
    lines.push('');
  }

  if (state.functions.size > 0) {
    lines.push('## Funciones (helpers RLS y lógica de BD)\n');
    lines.push('| Función | Argumentos |');
    lines.push('|---------|-----------|');
    for (const [f, args] of [...state.functions.entries()].sort()) lines.push(`| \`${f}\` | \`(${args || ''})\` |`);
    lines.push('');
  }

  if (state.warnings.length > 0) {
    lines.push('## ⚠ Sentencias no parseadas (AC7 — revisar a mano)\n');
    for (const w of state.warnings) lines.push(`- ${w}`);
    lines.push('');
  }

  return lines.join('\n') + '\n';
}
