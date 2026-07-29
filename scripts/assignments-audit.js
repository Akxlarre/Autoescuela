#!/usr/bin/env node
/**
 * assignments-audit.js — Auditor de integridad entre specs/ASSIGNMENTS.md y los
 * tracks reales en el filesystem (specs/fixes/fix-*, specs/hotfixes/*, specs/*).
 *
 * Solo reporta — no escribe nada. Ver specs/AUTHORS.md y specs/ASSIGNMENTS.md.
 *
 * Chequea:
 *   1. Naming     — cada dir de spec/fix/hotfix matchea <tipo>-NNN-<autor>-slug,
 *                    con <autor> en specs/AUTHORS.md. (Encontró fix-086-flota-kpi-en-taller-hero
 *                    sin código de autor — corregido a mano, este check evita que se repita.)
 *   2. Colisiones — dos tracks del MISMO autor con el MISMO número (la numeración
 *                    es independiente por autor, así que esto sí sería un choque real).
 *   3. Refs colgantes — `> refs: ASG-X-NNN` en un fix/hotfix que no existe en
 *                    specs/assignments/ ni en ninguna tabla de ASSIGNMENTS.md.
 *   4. Filas stale — track con `status: done` y `refs: ASG-X-NNN`, pero esa fila
 *                    sigue en la tabla "Pendientes" de ASSIGNMENTS.md (nunca se movió
 *                    a Completadas).
 *
 * Uso: npm run assignments:audit
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SPECS_DIR = path.join(ROOT, 'specs');
const SPEC_TRACKS_DIR = path.join(SPECS_DIR, 'specs');
const FIX_TRACKS_DIR = path.join(SPECS_DIR, 'fixes');
const HOTFIX_DIR = path.join(SPECS_DIR, 'hotfixes');
const ASSIGNMENTS_MD = path.join(SPECS_DIR, 'ASSIGNMENTS.md');
const AUTHORS_MD = path.join(SPECS_DIR, 'AUTHORS.md');

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function readAuthorCodes(authorsContent) {
  const codes = new Set();
  const rowRe = /^\|\s*`([a-z]+)`\s*\|/gm;
  let m;
  while ((m = rowRe.exec(authorsContent)) !== null) codes.add(m[1]);
  return codes;
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/** Parsea un nombre de dir de track contra <prefix>-NNN-autor-slug (specs sin prefix: NNNN-autor-slug). */
function parseTrackName(prefix, name, numDigits) {
  const re = prefix
    ? new RegExp(`^${prefix}-(\\d{${numDigits}})-([a-z]+)-(.+)$`)
    : new RegExp(`^(\\d{${numDigits}})-([a-z]+)-(.+)$`);
  const m = name.match(re);
  if (!m) return null;
  return { number: m[1], author: m[2], slug: m[3] };
}

function readField(content, field) {
  const m = content.match(new RegExp(`^>\\s*${field}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim() : null;
}

/** ASG-<autor>-<NNN> — contador por autor, igual que los tracks (ver specs/AUTHORS.md). */
const ASG_ID_RE = /ASG-[a-z]+-\d+/;

function extractAsgRef(refsValue) {
  if (!refsValue) return null;
  const m = refsValue.match(ASG_ID_RE);
  return m ? m[0] : null;
}

function extractAsgIdsFromSection(md, sectionHeader, nextHeaders) {
  const startIdx = md.indexOf(sectionHeader);
  if (startIdx === -1) return new Set();
  let endIdx = md.length;
  for (const h of nextHeaders) {
    const idx = md.indexOf(h, startIdx + sectionHeader.length);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }
  const section = md.slice(startIdx, endIdx);
  const ids = new Set();
  const re = new RegExp(ASG_ID_RE.source, 'g');
  let m;
  while ((m = re.exec(section)) !== null) ids.add(m[0]);
  return ids;
}

function main() {
  if (!fs.existsSync(ASSIGNMENTS_MD) || !fs.existsSync(AUTHORS_MD)) {
    console.error(red('No se encontró specs/ASSIGNMENTS.md o specs/AUTHORS.md.'));
    process.exit(1);
  }

  const authorsContent = fs.readFileSync(AUTHORS_MD, 'utf-8');
  const validAuthors = readAuthorCodes(authorsContent);
  const assignmentsContent = fs.readFileSync(ASSIGNMENTS_MD, 'utf-8');

  const pendientes = extractAsgIdsFromSection(assignmentsContent, '## Pendientes', [
    '## Reclamadas',
  ]);
  const reclamadas = extractAsgIdsFromSection(assignmentsContent, '## Reclamadas', [
    '## Completadas',
  ]);
  const completadas = extractAsgIdsFromSection(assignmentsContent, '## Completadas', [
    '## Convenciones',
    '## Archived',
  ]);
  const allKnownAsg = new Set([...pendientes, ...reclamadas, ...completadas]);

  const namingViolations = [];
  const collisions = []; // key: `${type}:${author}:${number}` -> [dirs]
  const danglingRefs = [];
  const staleRows = [];

  const seen = new Map();

  function processTrack(type, prefix, numDigits, dirName, fullPath, fileName) {
    const parsed = parseTrackName(prefix, dirName, numDigits);
    if (!parsed) {
      namingViolations.push({ type, dir: dirName });
      return;
    }
    if (!validAuthors.has(parsed.author)) {
      namingViolations.push({ type, dir: dirName, reason: `autor '${parsed.author}' no está en specs/AUTHORS.md` });
    }
    const key = `${type}:${parsed.author}:${parsed.number}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(dirName);

    const filePath = path.join(fullPath, fileName);
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    const status = readField(content, 'status');
    const refs = readField(content, 'refs');
    const asgRef = extractAsgRef(refs);

    if (asgRef) {
      const asgFile = path.join(SPECS_DIR, 'assignments', `${asgRef}-*.md`);
      const hasAsgFile = fs
        .readdirSync(path.join(SPECS_DIR, 'assignments'))
        .some((f) => f.startsWith(`${asgRef}-`));
      if (!allKnownAsg.has(asgRef) && !hasAsgFile) {
        danglingRefs.push({ track: dirName, asgRef });
      }
      if (status === 'done' && pendientes.has(asgRef) && !completadas.has(asgRef)) {
        staleRows.push({ track: dirName, asgRef });
      }
    }
  }

  for (const dir of listDirs(SPEC_TRACKS_DIR)) {
    processTrack('spec', '', 4, dir, path.join(SPEC_TRACKS_DIR, dir), 'spec.md');
  }
  for (const dir of listDirs(FIX_TRACKS_DIR)) {
    processTrack('fix', 'fix', 3, dir, path.join(FIX_TRACKS_DIR, dir), 'fix.md');
  }
  for (const dir of listDirs(HOTFIX_DIR)) {
    processTrack('hotfix', 'hotfix', 3, dir, path.join(HOTFIX_DIR, dir), 'hotfix.md');
  }

  // Tracks sueltos en la raíz de specs/ — no deberían existir tras la migración
  // a estructura anidada (specs/{specs,fixes,hotfixes}/).
  for (const dir of listDirs(SPECS_DIR)) {
    if (['specs', 'fixes', 'hotfixes', 'assignments'].includes(dir)) continue;
    namingViolations.push({
      type: 'raíz',
      dir,
      reason: 'track suelto en specs/ — debe vivir en specs/{specs,fixes,hotfixes}/',
    });
  }

  // Asignaciones: mismo contrato de naming/colisión que los tracks (contador por autor).
  const asgDir = path.join(SPECS_DIR, 'assignments');
  if (fs.existsSync(asgDir)) {
    for (const f of fs.readdirSync(asgDir).filter((x) => x.endsWith('.md'))) {
      const m = f.match(/^ASG-([a-z]+)-(\d{3})-(.+)\.md$/);
      if (!m) {
        namingViolations.push({ type: 'asg', dir: f, reason: 'no matchea ASG-<autor>-NNN-slug.md' });
        continue;
      }
      if (!validAuthors.has(m[1])) {
        namingViolations.push({ type: 'asg', dir: f, reason: `autor '${m[1]}' no está en specs/AUTHORS.md` });
      }
      const key = `asg:${m[1]}:${m[2]}`;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(f);
    }
  }

  for (const [key, dirs] of seen) {
    if (dirs.length > 1) collisions.push({ key, dirs });
  }

  // Links muertos en ROADMAP.md — 32/33 apuntaban a nombres previos al rename de
  // julio (sin código de autor) y el archivo renderizaba perfecto igual.
  const deadLinks = [];
  const roadmapMd = path.join(SPECS_DIR, 'ROADMAP.md');
  if (fs.existsSync(roadmapMd)) {
    const rm = fs.readFileSync(roadmapMd, 'utf-8');
    const re = /\]\(\.\/([^)]+)\)/g;
    let m;
    while ((m = re.exec(rm)) !== null) {
      if (!fs.existsSync(path.join(SPECS_DIR, m[1]))) deadLinks.push(m[1]);
    }
  }

  console.log(bold('\n=== assignments-audit ===\n'));

  console.log(bold(`Naming violations (${namingViolations.length})`));
  if (namingViolations.length === 0) console.log(green('  ninguna'));
  for (const v of namingViolations) {
    console.log(red(`  [${v.type}] ${v.dir}${v.reason ? ` — ${v.reason}` : ' — no matchea <tipo>-NNN-autor-slug'}`));
  }

  console.log(bold(`\nColisiones de numeración (${collisions.length})`));
  if (collisions.length === 0) console.log(green('  ninguna'));
  for (const c of collisions) {
    console.log(red(`  ${c.key}: ${c.dirs.join(', ')}`));
  }

  console.log(bold(`\nRefs colgantes a ASG inexistente (${danglingRefs.length})`));
  if (danglingRefs.length === 0) console.log(green('  ninguna'));
  for (const d of danglingRefs) {
    console.log(yellow(`  ${d.track} → refs: ${d.asgRef} (no está en specs/assignments/ ni en ASSIGNMENTS.md)`));
  }

  console.log(bold(`\nFilas stale en ASSIGNMENTS.md (${staleRows.length})`));
  if (staleRows.length === 0) console.log(green('  ninguna'));
  for (const s of staleRows) {
    console.log(yellow(`  ${s.asgRef} sigue en "Pendientes" pero ${s.track} ya está status:done`));
  }

  console.log(bold(`\nLinks muertos en ROADMAP.md (${deadLinks.length})`));
  if (deadLinks.length === 0) console.log(green('  ninguno'));
  for (const d of deadLinks) console.log(red(`  ./${d} no existe`));

  console.log(dim('\n(Solo reporte — no se modificó ningún archivo)\n'));

  const totalIssues =
    namingViolations.length + collisions.length + staleRows.length + deadLinks.length;
  process.exit(totalIssues > 0 ? 1 : 0);
}

main();
