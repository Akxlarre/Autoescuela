#!/usr/bin/env node
/**
 * assignments-sync.js — Regenera las tablas "Reclamadas / En curso" y "Completadas"
 * de specs/ASSIGNMENTS.md desde el frontmatter real de specs/assignments/ASG-X-NNN-*.md,
 * cruzado con el `status`/`closed` del track resultante (fuente de verdad de si
 * "está terminado", no el campo `status` de la propia Asignación — ese lo escribe
 * un humano a mano y es exactamente el campo que se queda desactualizado).
 *
 * Reescribe solo lo que está entre <!-- AUTO-GENERATED:BEGIN/END --> (mismo patrón
 * que scripts/indices-sync.js para indices/*.md). El resto de ASSIGNMENTS.md
 * (Pendientes, Convenciones, notas) no se toca.
 *
 * Uso: npm run assignments:sync
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SPECS_DIR = path.join(ROOT, 'specs');
const ASSIGNMENTS_DIR = path.join(SPECS_DIR, 'assignments');
const ASSIGNMENTS_MD = path.join(SPECS_DIR, 'ASSIGNMENTS.md');

/** `--fix` corrige el drift en disco en vez de solo reportarlo. Ver rewriteAssignmentStatus(). */
const FIX_MODE = process.argv.includes('--fix');

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function readFrontmatterField(content, field) {
  const m = content.match(new RegExp(`^>\\s*\\*\\*${field}:\\*\\*\\s*(.+)$`, 'm'));
  return m ? m[1].trim() : null;
}

function readTrackField(content, field) {
  // Acepta ambos formatos de frontmatter usados por los tracks:
  //   fix.md / hotfix.md → "> status: done"       (sin negrita, minúscula)
  //   spec.md            → "> **Status:** done"   (negrita, mayúscula)
  const m = content.match(new RegExp(`^>\\s*\\*{0,2}${field}:\\*{0,2}\\s*(.+)$`, 'im'));
  return m ? m[1].trim() : null;
}

/** Busca el track (fix/hotfix/spec) por ID en las 3 ubicaciones posibles. */
function locateTrack(trackId) {
  const candidates = [
    { sub: 'fixes', file: 'fix.md' },
    { sub: 'specs', file: 'spec.md' },
    { sub: 'hotfixes', file: 'hotfix.md' },
  ];
  for (const c of candidates) {
    const filePath = path.join(SPECS_DIR, c.sub, trackId, c.file);
    if (fs.existsSync(filePath)) {
      // Relativo a specs/, que es donde vive ASSIGNMENTS.md
      const linkPath = `${c.sub}/${trackId}/${c.file}`;
      return { filePath, linkPath, content: fs.readFileSync(filePath, 'utf-8') };
    }
  }
  return null;
}

/**
 * Con `--fix`, corrige en disco el `status:` del frontmatter de una Asignación para que
 * coincida con el estado real de su track.
 *
 * Por qué existe: el sync ya detectaba este drift pero solo podía imprimirlo, así que la
 * advertencia se repetía en cada corrida y la corrección había que hacerla a mano archivo por
 * archivo. La fuente de verdad es el track, no el frontmatter — por eso la corrección va
 * siempre en esa dirección y nunca al revés.
 */
function rewriteAssignmentStatus(assignment, newStatus) {
  const filePath = path.join(ASSIGNMENTS_DIR, assignment.fileName);
  const content = fs.readFileSync(filePath, 'utf-8');
  const updated = content.replace(
    /^>\s*\*\*status:\*\*\s*.+$/m,
    `> **status:** ${newStatus}`,
  );
  if (updated !== content) fs.writeFileSync(filePath, updated);
}

function parseAssignment(fileName) {
  // ASG-<autor>-<NNN>-slug — contador por autor, igual que los tracks (ver specs/AUTHORS.md)
  const idMatch = fileName.match(/^(ASG-[a-z]+-\d+)-/);
  if (!idMatch) return null;
  const id = idMatch[1];
  const content = fs.readFileSync(path.join(ASSIGNMENTS_DIR, fileName), 'utf-8');
  const titleMatch = content.match(/^#\s*Asignación\s+ASG-[a-z]+-\d+\s*—\s*(.+)$/m);
  return {
    id,
    fileName,
    title: titleMatch ? titleMatch[1].trim() : '(sin título)',
    status: readFrontmatterField(content, 'status'),
    owner: readFrontmatterField(content, 'owner'),
    claimedBy: readFrontmatterField(content, 'claimed_by'),
    claimedAt: readFrontmatterField(content, 'claimed_at'),
    resultingTrack: readFrontmatterField(content, 'resulting_track'),
  };
}

function replaceGeneratedSection(md, sectionHeader, newBody) {
  const headerIdx = md.indexOf(sectionHeader);
  if (headerIdx === -1) {
    throw new Error(`No se encontró la sección "${sectionHeader}" en ASSIGNMENTS.md`);
  }
  const beginIdx = md.indexOf('<!-- AUTO-GENERATED:BEGIN -->', headerIdx);
  const endIdx = md.indexOf('<!-- AUTO-GENERATED:END -->', beginIdx);
  if (beginIdx === -1 || endIdx === -1) {
    throw new Error(`No se encontraron marcadores AUTO-GENERATED para "${sectionHeader}"`);
  }
  const before = md.slice(0, beginIdx + '<!-- AUTO-GENERATED:BEGIN -->'.length);
  const after = md.slice(endIdx);
  return `${before}\n${newBody}\n${after}`;
}

function main() {
  if (!fs.existsSync(ASSIGNMENTS_MD) || !fs.existsSync(ASSIGNMENTS_DIR)) {
    console.error('No se encontró specs/ASSIGNMENTS.md o specs/assignments/.');
    process.exit(1);
  }

  const files = fs.readdirSync(ASSIGNMENTS_DIR).filter((f) => f.endsWith('.md'));
  const assignments = files.map(parseAssignment).filter(Boolean);

  const reclamadas = [];
  const completadas = [];
  const drift = [];
  const fixed = [];

  for (const a of assignments) {
    if (!a.resultingTrack || a.resultingTrack === '—') continue; // sigue en Pendientes (manual)

    const track = locateTrack(a.resultingTrack);
    if (!track) {
      drift.push(`${a.id}: resulting_track "${a.resultingTrack}" no se encontró en el filesystem`);
      continue;
    }

    const trackStatus = readTrackField(track.content, 'status');
    const trackDone = trackStatus === 'done';

    if (trackDone) {
      const closed = readTrackField(track.content, 'closed') || a.claimedAt || a.created || '—';
      completadas.push({
        id: a.id,
        title: a.title,
        trackId: a.resultingTrack,
        linkPath: track.linkPath,
        closed,
      });
      if (a.status !== 'completada') {
        if (FIX_MODE) {
          rewriteAssignmentStatus(a, 'completada');
          fixed.push(`${a.id}: status ${a.status} → completada (track ${a.resultingTrack} está done)`);
        } else {
          drift.push(`${a.id}: track ${a.resultingTrack} está status:done pero la Asignación dice status: ${a.status} (no bloquea — corregible con: npm run assignments:sync -- --fix)`);
        }
      }
    } else {
      reclamadas.push({
        id: a.id,
        title: a.title,
        claimedBy: a.claimedBy || a.owner || '—',
        trackId: a.resultingTrack,
        linkPath: track.linkPath,
        fecha: a.claimedAt || '—',
      });
      if (a.status === 'completada') {
        if (FIX_MODE) {
          rewriteAssignmentStatus(a, 'reclamada');
          fixed.push(`${a.id}: status completada → reclamada (track ${a.resultingTrack} sigue ${trackStatus})`);
        } else {
          drift.push(`${a.id}: la Asignación dice status: completada pero el track ${a.resultingTrack} sigue status:${trackStatus} (no bloquea — corregible con: npm run assignments:sync -- --fix)`);
        }
      }
    }
  }

  completadas.sort((x, y) => (x.closed < y.closed ? -1 : x.closed > y.closed ? 1 : 0));
  reclamadas.sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0));

  const reclamadasBody = [
    '| ID | Título | Reclamado por | Track resultante | Fecha |',
    '|----|--------|----------------|-------------------|-------|',
    ...reclamadas.map(
      (r) => `| ${r.id} | ${r.title} | \`${r.claimedBy}\` | [${r.trackId}](${r.linkPath}) | ${r.fecha} |`,
    ),
  ].join('\n');

  const completadasBody = [
    '| ID | Título | Track resultante | Cerrada |',
    '|----|--------|-------------------|---------|',
    ...completadas.map((c) => `| ${c.id} | ${c.title} | [${c.trackId}](${c.linkPath}) | ${c.closed} |`),
  ].join('\n');

  let md = fs.readFileSync(ASSIGNMENTS_MD, 'utf-8');
  md = replaceGeneratedSection(md, '## Reclamadas / En curso', reclamadasBody);
  md = replaceGeneratedSection(md, '## Completadas', completadasBody);
  fs.writeFileSync(ASSIGNMENTS_MD, md);

  console.log(bold('\n=== assignments-sync ===\n'));
  console.log(green(`✅ Reclamadas / En curso: ${reclamadas.length} fila(s)`));
  console.log(green(`✅ Completadas: ${completadas.length} fila(s)`));
  if (fixed.length > 0) {
    console.log(bold(`\n🔧 Drift corregido en disco (${fixed.length}) — el track es la fuente de verdad:`));
    for (const f of fixed) console.log(green(`  ${f}`));
  }

  if (drift.length > 0) {
    console.log(bold(`\n⚠️  Drift detectado (${drift.length}) — el campo status: de la Asignación no coincide con el track, la tabla usa el track como fuente de verdad:`));
    for (const d of drift) console.log(yellow(`  ${d}`));
  }
  console.log(dim('\nspecs/ASSIGNMENTS.md actualizado (solo las secciones AUTO-GENERATED).\n'));
}

main();
