/**
 * migrate-inline-final.mjs
 *
 * Final cleanup for remaining style="background ..." violations after T3/T4 passes.
 * Handles: CSS fallback var(--TOKEN, rgba(...)), raw rgba, opacity compounds, backdrop-filter,
 *           hex colors, and special cases.
 *
 * Run: node scripts/migrate-inline-final.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = process.cwd();

function r(rel) {
  return resolve(ROOT, rel);
}

// Each entry: { file, from, to }
// from: exact string to replace (as it appears in the file, post-Prettier)
// to:   replacement string
const REPLACEMENTS = [
  // ── admin-configuracion-web ─────────────────────────────────────────────
  {
    file: 'src/app/features/admin/configuracion-web/admin-configuracion-web.component.ts',
    from: `style="background: var(--color-primary-muted, rgba(14, 165, 233, 0.1))"`,
    to: `class="bg-brand-muted"`,
  },
  {
    file: 'src/app/features/admin/configuracion-web/admin-configuracion-web.component.ts',
    from: `style="background: rgba(0,0,0,0.02)"`,
    to: `class="bg-black/[0.02]"`,
  },

  // ── admin-contabilidad-anticipos ─────────────────────────────────────────
  {
    file: 'src/app/features/admin/contabilidad-anticipos/admin-contabilidad-anticipos.component.ts',
    from: `style="background: var(--state-warning-bg, rgba(251,146,60,0.12))"`,
    to: `class="bg-warning-subtle"`,
  },
  {
    file: 'src/app/features/admin/contabilidad-anticipos/admin-contabilidad-anticipos.component.ts',
    from: `style="background: var(--state-success-bg, rgba(34,197,94,0.12))"`,
    to: `class="bg-success-subtle"`,
  },

  // ── admin-curso-singular-inscribir-drawer ────────────────────────────────
  {
    file: 'src/app/features/admin/contabilidad-cursos/admin-curso-singular-inscribir-drawer.component.ts',
    from: `style="background: #0a0a0a; color: white"`,
    to: `class="bg-[#0a0a0a] text-white"`,
  },

  // ── agenda-schedule-drawer ───────────────────────────────────────────────
  // color-mix with non-transparent second color → bg-brand/10 (visual equivalent)
  {
    file: 'src/app/features/agenda/agenda-schedule-drawer.component.ts',
    from: `style="background: color-mix(in srgb, var(--ds-brand) 10%, var(--bg-surface))"`,
    to: `class="bg-brand/10"`,
  },

  // ── student-drawer-detail ────────────────────────────────────────────────
  // --color-divider is undefined; use bg-border-muted as progress track
  {
    file: 'src/app/features/instructor/alumnos/components/student-drawer-detail.component.ts',
    from: `<div class="w-full rounded-full h-2" style="background: var(--color-divider)">`,
    to: `<div class="w-full rounded-full h-2 bg-border-muted">`,
    all: true,
  },

  // ── asistencia-clase-b-content ───────────────────────────────────────────
  {
    file: 'src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts',
    from: `style="background: rgba(0,0,0,0.4)"`,
    to: `class="bg-black/40"`,
  },

  // ── certificacion-clase-b-content ────────────────────────────────────────
  {
    file: 'src/app/shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component.ts',
    from: `style="background: var(--bg-success-muted, rgba(34,197,94,0.1))"`,
    to: `class="bg-success-subtle"`,
    all: true,
  },
  {
    file: 'src/app/shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component.ts',
    from: `style="background: var(--bg-warning-muted, rgba(234,179,8,0.1))"`,
    to: `class="bg-warning-subtle"`,
    all: true,
  },
  {
    file: 'src/app/shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component.ts',
    from: `style="background: var(--bg-warning-muted, rgba(234,179,8,0.08)); border: 1px solid var(--state-warning)"`,
    to: `class="bg-warning-subtle border border-warning"`,
    all: true,
  },

  // ── certificacion-profesional-content ────────────────────────────────────
  {
    file: 'src/app/shared/components/certificacion-profesional-content/certificacion-profesional-content.component.ts',
    from: `style="background: var(--bg-success-muted, rgba(34,197,94,0.1))"`,
    to: `class="bg-success-subtle"`,
    all: true,
  },
  {
    file: 'src/app/shared/components/certificacion-profesional-content/certificacion-profesional-content.component.ts',
    from: `style="background: var(--bg-warning-muted, rgba(234,179,8,0.1))"`,
    to: `class="bg-warning-subtle"`,
    all: true,
  },
  {
    file: 'src/app/shared/components/certificacion-profesional-content/certificacion-profesional-content.component.ts',
    from: `style="background: var(--bg-warning-muted, rgba(234,179,8,0.08)); border: 1px solid var(--state-warning)"`,
    to: `class="bg-warning-subtle border border-warning"`,
    all: true,
  },

  // ── daily-schedule-timeline ──────────────────────────────────────────────
  {
    file: 'src/app/shared/components/daily-schedule-timeline/daily-schedule-timeline.component.ts',
    from: `style="background: rgba(255,255,255,0.2); color: var(--color-primary-text)"`,
    to: `class="bg-white/20 text-brand-text"`,
  },
  // opacity:0.3 compound — extract bg to class, keep opacity as Tailwind class
  {
    file: 'src/app/shared/components/daily-schedule-timeline/daily-schedule-timeline.component.ts',
    from: `style="background: var(--border-subtle); opacity: 0.3"`,
    to: `class="bg-border-subtle opacity-30"`,
  },

  // ── dms-list-content ─────────────────────────────────────────────────────
  {
    file: 'src/app/shared/components/dms-list-content/dms-list-content.component.ts',
    from: `style="background: var(--state-error-bg, #FEF2F2); color: var(--state-error, #DC2626);"`,
    to: `class="bg-error-subtle text-error"`,
  },

  // ── drawer ───────────────────────────────────────────────────────────────
  {
    file: 'src/app/shared/components/drawer/drawer.component.ts',
    from: `style="background: var(--overlay-backdrop); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);"`,
    to: `class="bg-overlay backdrop-blur-sm"`,
  },

  // ── egreso-modal ─────────────────────────────────────────────────────────
  // backdrop-filter: blur(2px) → keep in style (no Tailwind token for 2px blur)
  {
    file: 'src/app/shared/components/egreso-modal/egreso-modal.component.ts',
    from: `style="background: rgba(0,0,0,0.4); backdrop-filter: blur(2px)"`,
    to: `class="bg-black/40" style="backdrop-filter: blur(2px)"`,
  },

  // ── eliminar-alumno-modal ────────────────────────────────────────────────
  {
    file: 'src/app/shared/components/eliminar-alumno-modal/eliminar-alumno-modal.component.ts',
    from: `style="background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);"`,
    to: `class="bg-black/[0.55] backdrop-blur-sm"`,
  },

  // ── weekly-schedule-grid ─────────────────────────────────────────────────
  // rgba(14,165,233,0.04) ≈ brand-tint token
  {
    file: 'src/app/shared/components/weekly-schedule-grid/weekly-schedule-grid.component.ts',
    from: `style="background: rgba(14, 165, 233, 0.04)"`,
    to: `class="bg-brand-tint"`,
  },
  {
    file: 'src/app/shared/components/weekly-schedule-grid/weekly-schedule-grid.component.ts',
    from: `style="background: rgba(255,255,255,0.2)"`,
    to: `class="bg-white/20"`,
  },
];

let totalFiles = 0;
let totalReplacements = 0;

for (const rep of REPLACEMENTS) {
  const filePath = r(rep.file);
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    console.warn(`⚠️  File not found: ${rep.file}`);
    continue;
  }

  const original = content;

  if (rep.all) {
    const escaped = rep.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const count = (content.match(regex) || []).length;
    content = content.replace(regex, rep.to);
    if (content !== original) {
      totalReplacements += count;
    }
  } else {
    if (content.includes(rep.from)) {
      content = content.replace(rep.from, rep.to);
      totalReplacements++;
    } else {
      console.warn(`⚠️  Pattern not found in ${rep.file}:\n   "${rep.from}"`);
    }
  }

  if (content !== original) {
    writeFileSync(filePath, content, 'utf-8');
    totalFiles++;
    console.log(`✅ ${rep.file.split('src/app/')[1]}`);
  }
}

console.log(`\nDone: ${totalReplacements} replacements across ${totalFiles} files`);
