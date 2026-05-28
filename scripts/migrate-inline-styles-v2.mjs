/**
 * migrate-inline-styles-v2.mjs
 *
 * Compound-aware inline style migrator (robust single-pass version).
 *
 * For each style="..." attribute:
 *   1. Split by ; into individual CSS declarations
 *   2. Map each to a Tailwind class via PROP_MAP (skip color-mix/clamp/etc.)
 *   3. Find the nearest class="..." on the same element and merge into it
 *   4. If no class attr found, prepend class="..." before the style attr
 *   5. Remove the style attr entirely if all props were mapped; reduce it otherwise
 */

import fs from 'fs';
import path from 'path';

// ── PROP_MAP ─────────────────────────────────────────────────────────────────
const PROP_MAP = {
  // color
  'color: var(--ds-brand)': 'text-brand',
  'color:var(--ds-brand)': 'text-brand',
  'color: var(--ds-brand);': 'text-brand',
  'color: var(--color-brand)': 'text-brand',
  'color: var(--color-primary)': 'text-brand',
  'color:var(--color-primary)': 'text-brand',
  'color: var(--color-primary);': 'text-brand',
  'color: var(--state-error)': 'text-error',
  'color:var(--state-error)': 'text-error',
  'color: var(--state-error);': 'text-error',
  'color: var(--state-warning)': 'text-warning',
  'color:var(--state-warning)': 'text-warning',
  'color: var(--state-success)': 'text-success',
  'color:var(--state-success)': 'text-success',
  'color: var(--state-info)': 'text-info',
  'color: var(--state-danger)': 'text-error',
  'color: var(--color-success)': 'text-success',
  'color: var(--color-error)': 'text-error',
  'color: var(--color-warning)': 'text-warning',
  'color: var(--color-danger)': 'text-error',
  'color: var(--text-muted)': 'text-text-muted',
  'color: var(--text-primary)': 'text-text-primary',
  'color: var(--text-secondary)': 'text-text-secondary',
  'color: var(--text-disabled)': 'text-text-disabled',
  'color: var(--color-text-muted)': 'text-text-muted',
  'color: var(--color-text-primary)': 'text-text-primary',

  // background
  'background: var(--ds-brand)': 'bg-brand',
  'background:var(--ds-brand)': 'bg-brand',
  'background: var(--color-brand)': 'bg-brand',
  'background: var(--color-primary)': 'bg-brand',
  'background:var(--color-primary)': 'bg-brand',
  'background: var(--bg-base)': 'bg-base',
  'background:var(--bg-base)': 'bg-base',
  'background: var(--bg-surface)': 'bg-surface',
  'background:var(--bg-surface)': 'bg-surface',
  'background: var(--bg-elevated)': 'bg-elevated',
  'background:var(--bg-elevated)': 'bg-elevated',
  'background: var(--bg-subtle)': 'bg-subtle',
  'background:var(--bg-subtle)': 'bg-subtle',
  'background: var(--bg-tinted)': 'bg-brand-tint',
  'background:var(--bg-tinted)': 'bg-brand-tint',
  'background: var(--bg-surface-elevated)': 'bg-elevated',
  'background:var(--bg-surface-elevated)': 'bg-elevated',
  'background: var(--surface-elevated)': 'bg-elevated',
  'background: var(--color-primary-tint)': 'bg-brand-tint',
  'background:var(--color-primary-tint)': 'bg-brand-tint',
  'background: var(--color-primary-muted)': 'bg-brand-muted',
  'background:var(--color-primary-muted)': 'bg-brand-muted',
  'background: var(--color-brand-muted)': 'bg-brand-muted',
  'background: var(--bg-brand-muted)': 'bg-brand-muted',
  'background: var(--color-success-muted)': 'bg-success-subtle',
  'background: var(--color-warning-muted)': 'bg-warning-subtle',
  'background: var(--color-error-muted)': 'bg-error-subtle',
  'background: var(--state-success)': 'bg-success',
  'background: var(--state-error)': 'bg-error',
  'background: var(--state-warning)': 'bg-warning',
  'background: var(--state-error-bg)': 'bg-error-subtle',
  'background: var(--state-warning-bg)': 'bg-warning-subtle',
  'background: var(--state-success-bg)': 'bg-success-subtle',
  'background: transparent': 'bg-transparent',
  'background:transparent': 'bg-transparent',
  'background-color: var(--ds-brand)': 'bg-brand',

  // border-color
  'border-color: var(--border-muted)': 'border-border-muted',
  'border-color:var(--border-muted)': 'border-border-muted',
  'border-color: var(--border-subtle)': 'border-border-subtle',
  'border-color:var(--border-subtle)': 'border-border-subtle',
  'border-color: var(--border-default)': 'border-border-default',
  'border-color:var(--border-default)': 'border-border-default',
  'border-color: var(--border-strong)': 'border-border-strong',
  'border-color: var(--state-error)': 'border-error',
  'border-color: var(--state-success)': 'border-success',
  'border-color: var(--state-warning)': 'border-warning',
  'border-color: var(--ds-brand)': 'border-brand',
  'border-color: var(--color-primary)': 'border-brand',

  // border shorthand (mapped to border + border-color utilities)
  'border-bottom: 1px solid var(--border-subtle)': 'border-b border-border-subtle',
  'border-top: 1px solid var(--border-subtle)': 'border-t border-border-subtle',
  'border-bottom: 1px solid var(--border-default)': 'border-b border-border-default',
  'border-top: 1px solid var(--border-default)': 'border-t border-border-default',
  'border: 1px solid var(--border-subtle)': 'border border-border-subtle',
  'border: 1px solid var(--border-muted)': 'border border-border-muted',
  'border: 1px solid var(--border-default)': 'border border-border-default',
  'border: 1px dashed var(--border-subtle)': 'border border-dashed border-border-subtle',
  'border: 1px dashed var(--border-default)': 'border border-dashed border-border-default',
  'border: 2px dashed var(--border-default)': 'border-2 border-dashed border-border-default',
  'border: 2px solid var(--state-success)': 'border-2 border-success',
  'border: none': 'border-none',
  'border:none': 'border-none',

  // border-style
  'border-style: dashed': 'border-dashed',

  // outline
  'outline: none': 'outline-none',
  'outline:none': 'outline-none',
  'outline: 1px solid var(--state-warning)': 'outline outline-warning',

  // font-size (only exact token matches — no clamp)
  'font-size: var(--text-xs)': 'text-xs',
  'font-size:var(--text-xs)': 'text-xs',
  'font-size: var(--text-sm)': 'text-sm',
  'font-size:var(--text-sm)': 'text-sm',
  'font-size: var(--text-base)': 'text-base',
  'font-size:var(--text-base)': 'text-base',
  'font-size: var(--text-3xl)': 'text-3xl',

  // font-weight
  'font-weight: var(--font-semibold)': 'font-semibold',
  'font-weight:var(--font-semibold)': 'font-semibold',
  'font-weight: var(--font-medium)': 'font-medium',
  'font-weight:var(--font-medium)': 'font-medium',
  'font-weight: var(--font-bold)': 'font-bold',
  'font-weight:var(--font-bold)': 'font-bold',

  // text utilities
  'text-transform: uppercase': 'uppercase',
  'letter-spacing: 0.05em': 'tracking-wider',
  'white-space: nowrap': 'whitespace-nowrap',
  'white-space: pre-wrap': 'whitespace-pre-wrap',
  'word-break: break-word': 'break-words',
  'text-decoration: none': 'no-underline',

  // layout/interaction
  'overflow: hidden': 'overflow-hidden',
  'cursor: default': 'cursor-default',
  'cursor: pointer': 'cursor-pointer',
  'cursor: not-allowed': 'cursor-not-allowed',
  'pointer-events: none': 'pointer-events-none',
  'flex-shrink: 0': 'shrink-0',
  'resize: none': 'resize-none',
  'display:inline': 'inline',
  'vertical-align:middle': 'align-middle',
};

// Properties containing these patterns are T4-scope or layout — skip
const SKIP_PATTERNS = [
  'color-mix(',
  'clamp(',
  'calc(',
  'rgba(',
  'rgb(',
  'gradient',
  'grid-template-columns',
  'min-width',
  'max-width',
  'min-height',
  'max-height',
  'width:',
  'height:',
  'margin',
  'padding',
  'box-shadow',
  'backdrop-filter',
  '-webkit-backdrop-filter',
  'transform',
  'top:',
  'left:',
  'right:',
  'bottom:',
  'z-index',
  'opacity',
  'font-size: 2rem',
  'font-size: 10px',
  'font-size: inherit',
  'font-weight: inherit',
  'letter-spacing: inherit',
  'container-type',
  '--hover-color',
  '--bento-row',
  '--tw-divide',
  'focus-ring',
  'border-radius',
  'border-left:',
  'border-right:',
  'line-height',
  'overflow-y',
  'overflow-x',
  'white-space: nowrap; overflow: hidden', // compound — handle individually
];

function shouldSkipProp(decl) {
  const lower = decl.toLowerCase().trim();
  return SKIP_PATTERNS.some((p) => lower.includes(p));
}

function normalizeProp(decl) {
  return decl.trim().replace(/\s*:\s*/, ': ').replace(/\s+/g, ' ');
}

/** Split style value into individual declarations, map each to Tailwind. */
function processStyleValue(rawValue) {
  const decls = rawValue
    .split(';')
    .map((d) => d.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const newClasses = [];
  const remaining = [];

  for (const decl of decls) {
    if (!decl.includes(':')) continue;
    if (shouldSkipProp(decl)) {
      remaining.push(decl);
      continue;
    }
    const norm = normalizeProp(decl);
    const mapped = PROP_MAP[norm] ?? null;
    if (mapped) {
      for (const cls of mapped.split(' ')) {
        if (cls && !newClasses.includes(cls)) newClasses.push(cls);
      }
    } else {
      remaining.push(decl);
    }
  }

  return { newClasses, remaining };
}

function mergeClasses(existingStr, toAdd) {
  const existing = existingStr.trim().split(/\s+/).filter(Boolean);
  for (const cls of toAdd) {
    if (!existing.includes(cls)) existing.push(cls);
  }
  return existing.join(' ');
}

/** True if `str` contains a `>` that is NOT inside an attribute value. */
function hasUnquotedGT(str) {
  let inQ = false;
  let qc = '';
  for (const ch of str) {
    if (inQ) {
      if (ch === qc) inQ = false;
    } else if (ch === '"' || ch === "'") {
      inQ = true;
      qc = ch;
    } else if (ch === '>') {
      return true;
    }
  }
  return false;
}

/** True if `str` contains a `<` that is NOT inside an attribute value. */
function hasUnquotedLT(str) {
  let inQ = false;
  let qc = '';
  for (const ch of str) {
    if (inQ) {
      if (ch === qc) inQ = false;
    } else if (ch === '"' || ch === "'") {
      inQ = true;
      qc = ch;
    } else if (ch === '<') {
      return true;
    }
  }
  return false;
}

function walkTs(dir) {
  const results = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) results.push(...walkTs(full));
    else if (e.isFile() && e.name.endsWith('.ts')) results.push(full);
  }
  return results;
}

let totalFiles = 0;
let totalReplacements = 0;
let totalSkipped = 0;

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Collect replacement operations: { start, end, text }
  // Applied end-to-start to preserve offsets.
  const ops = []; // { start, end, text }

  const styleRe = /\bstyle="([\s\S]*?)"/g;
  let m;

  while ((m = styleRe.exec(content)) !== null) {
    const matchStart = m.index;
    const matchEnd = m.index + m[0].length;
    const rawValue = m[1];

    // Skip Angular property binding: [style.xxx]="..."
    if (matchStart > 0) {
      const cb = content[matchStart - 1];
      if (cb === '[' || cb === '.') continue;
    }

    const { newClasses, remaining } = processStyleValue(rawValue);

    if (newClasses.length === 0) {
      if (remaining.length > 0) totalSkipped++;
      continue;
    }

    const newStyleAttr = remaining.length > 0 ? `style="${remaining.join('; ')}"` : '';

    // ── Find nearest class="..." on the same element ────────────────────────

    const LOOK = 600;
    const beforeText = content.substring(Math.max(0, matchStart - LOOK), matchStart);
    const afterText = content.substring(matchEnd, Math.min(content.length, matchEnd + LOOK));

    // Scan backward: find the LAST class="..." that has no unquoted > between it and our style
    let classBeforeIdx = -1;
    let classBeforeVal = '';
    let classBeforeEnd = -1;
    {
      const re = /\bclass="([^"]*)"/g;
      let cm;
      while ((cm = re.exec(beforeText)) !== null) {
        // Text between end of this class attr and the style attr
        const between = beforeText.substring(cm.index + cm[0].length);
        if (!hasUnquotedGT(between)) {
          const absStart = Math.max(0, matchStart - LOOK) + cm.index;
          classBeforeIdx = absStart;
          classBeforeVal = cm[1];
          classBeforeEnd = absStart + cm[0].length;
        }
      }
    }

    // Scan forward: find the FIRST class="..." with no unquoted < or > before it
    let classAfterIdx = -1;
    let classAfterVal = '';
    let classAfterEnd = -1;
    {
      const re = /\bclass="([^"]*)"/;
      const cm = re.exec(afterText);
      if (cm) {
        const between = afterText.substring(0, cm.index);
        if (!hasUnquotedLT(between) && !hasUnquotedGT(between)) {
          classAfterIdx = matchEnd + cm.index;
          classAfterVal = cm[1];
          classAfterEnd = matchEnd + cm.index + cm[0].length;
        }
      }
    }

    // ── Apply ────────────────────────────────────────────────────────────────
    totalReplacements++;

    if (classBeforeIdx >= 0) {
      // Merge into class attr that precedes style
      const merged = mergeClasses(classBeforeVal, newClasses);
      ops.push({ start: classBeforeIdx, end: classBeforeEnd, text: `class="${merged}"` });
      ops.push({ start: matchStart, end: matchEnd, text: newStyleAttr });
    } else if (classAfterIdx >= 0) {
      // Merge into class attr that follows style
      const merged = mergeClasses(classAfterVal, newClasses);
      ops.push({ start: classAfterIdx, end: classAfterEnd, text: `class="${merged}"` });
      ops.push({ start: matchStart, end: matchEnd, text: newStyleAttr });
    } else {
      // No class attr found — prepend class before style
      const classAttr = `class="${newClasses.join(' ')}"`;
      if (newStyleAttr) {
        ops.push({ start: matchStart, end: matchEnd, text: `${classAttr} ${newStyleAttr}` });
      } else {
        ops.push({ start: matchStart, end: matchEnd, text: classAttr });
      }
    }
  }

  if (ops.length === 0) return;

  // Sort end-to-start, deduplicating overlapping ops
  ops.sort((a, b) => b.start - a.start);

  let newContent = content;
  const seen = new Set();
  for (const op of ops) {
    const key = `${op.start}:${op.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    newContent = newContent.substring(0, op.start) + op.text + newContent.substring(op.end);
  }

  // Clean up any empty style="" that remain
  newContent = newContent.replace(/\s+style=""\s+/g, ' ').replace(/\s+style="">/g, '>');

  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    totalFiles++;
    console.log(`✓ ${path.relative(process.cwd(), filePath)}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
const roots = ['src/app/features', 'src/app/shared'];
const files = roots.flatMap((r) => walkTs(path.resolve(r)));

for (const f of files) {
  processFile(f);
}

console.log(`\n✅ Done: ${totalReplacements} replacements across ${totalFiles} files`);
console.log(`   Skipped (T4 / unmappable): ${totalSkipped} style blocks`);
