#!/usr/bin/env node
/**
 * check-date-discipline.mjs — Runner de ARCH-27 (app + edge functions) y ARCH-28 (migraciones).
 *
 * La detección vive en scripts/lib/date-discipline.js; acá solo se recorre el disco, se aplica
 * el allowlist y se compara contra la línea base.
 *
 *   node scripts/check-date-discipline.mjs                    → falla ante regresiones
 *   node scripts/check-date-discipline.mjs --update-baseline  → consolida una mejora
 *   node scripts/check-date-discipline.mjs --list [tipo]      → lista el backlog actual
 *
 * La línea base solo puede achicarse: --update-baseline se niega a escribir si hay regresiones.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  DATE_RULE,
  SQL_DATE_RULE,
  SQL_KINDS,
  buildDateBaseline,
  compareDateBaseline,
  findDateViolations,
  findSqlDateViolations,
  fixHint,
  isAllowed,
  isSqlAudited,
  validateAllowlist,
} from './lib/date-discipline.js';

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, 'scripts', 'lib', 'date-discipline.baseline.json');
const ALLOWLIST_PATH = path.join(ROOT, 'scripts', 'lib', 'date-discipline.allowlist.json');
const CODE_DIRS = ['src/app', 'supabase/functions'];
const MIGRATIONS_DIR = 'supabase/migrations';

const UPDATE = process.argv.includes('--update-baseline');
const LIST = process.argv.includes('--list');
const LIST_KIND = LIST ? process.argv[process.argv.indexOf('--list') + 1] : undefined;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts') || full.endsWith('.html')) out.push(full);
  }
  return out;
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

let errors = 0;
const fail = (rule, file, message, hint) => {
  errors++;
  console.error(red(`❌ [${rule}] ${file}`));
  console.error(`   ${message}`);
  if (hint) console.error(`   → ${hint}`);
};

// ── Allowlist ────────────────────────────────────────────────────────────────
const allowlist = readJson(ALLOWLIST_PATH, []);
for (const problem of validateAllowlist(allowlist)) {
  fail(DATE_RULE, 'scripts/lib/date-discipline.allowlist.json', problem);
}

// ── ARCH-27: app + edge functions ────────────────────────────────────────────
const counts = new Map();
const detail = [];
for (const dir of CODE_DIRS) {
  for (const full of walk(path.join(ROOT, dir))) {
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    const byKind = {};
    for (const v of findDateViolations(fs.readFileSync(full, 'utf8'), rel)) {
      if (isAllowed(allowlist, rel, v.kind)) continue;
      byKind[v.kind] ??= { count: 0, sample: v.sample };
      byKind[v.kind].count++;
      detail.push({ file: rel, ...v });
    }
    if (Object.keys(byKind).length > 0) counts.set(rel, byKind);
  }
}

if (LIST) {
  for (const v of detail) {
    if (LIST_KIND && v.kind !== LIST_KIND) continue;
    console.log(`${v.file}:${v.line}  [${v.kind}]  ${v.sample}`);
  }
  process.exit(0);
}

const baseline = readJson(BASELINE_PATH, null);
const current = buildDateBaseline(counts);

if (!baseline) {
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n');
  console.log(cyan(`ℹ ${DATE_RULE}: línea base creada (${current.total} ocurrencias).`));
} else {
  const { regressions, currentTotal, baselineTotal, improved } = compareDateBaseline(counts, baseline);
  for (const r of regressions) {
    fail(
      DATE_RULE,
      r.file,
      `Cálculo de fecha fuera de la util de hora de Chile [${r.kind}]: ${r.now} caso(s) (cuota: ${r.was}). Ejemplo: ${r.sample}`,
      fixHint(r.kind, r.file),
    );
  }
  if (UPDATE) {
    if (regressions.length > 0) {
      console.error(red('La línea base solo puede achicarse: corrige las regresiones antes de actualizarla.'));
    } else {
      fs.writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n');
      console.log(cyan(`ℹ ${DATE_RULE}: línea base actualizada (${baselineTotal} → ${currentTotal}).`));
    }
  } else if (improved && regressions.length === 0) {
    console.log(
      cyan(
        `ℹ ${DATE_RULE}: el backlog bajó (${baselineTotal} → ${currentTotal}). Consolida con 'node scripts/check-date-discipline.mjs --update-baseline'.`,
      ),
    );
  }
}

// ── ARCH-28: migraciones posteriores al corte ────────────────────────────────
const migrationsDir = path.join(ROOT, MIGRATIONS_DIR);
if (fs.existsSync(migrationsDir)) {
  for (const name of fs.readdirSync(migrationsDir)) {
    if (!name.endsWith('.sql') || !isSqlAudited(name)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8');
    for (const v of findSqlDateViolations(sql)) {
      fail(
        SQL_DATE_RULE,
        `${MIGRATIONS_DIR}/${name}:${v.line}`,
        `Fecha de negocio derivada con la zona de la sesión [${v.kind}]: ${v.sample}`,
        `Usa ${SQL_KINDS[v.kind]}.`,
      );
    }
  }
}

if (errors > 0) {
  console.error(red(`\n❌ Disciplina de fechas: ${errors} error(es).`));
  process.exit(1);
}
const summary = Object.entries(current.kinds)
  .map(([kind, n]) => `${kind}: ${n}`)
  .join(' | ');
console.log(green(`✅ ${DATE_RULE}/${SQL_DATE_RULE}: sin regresiones. Backlog: ${current.total}${summary ? ` (${summary})` : ''}.`));
