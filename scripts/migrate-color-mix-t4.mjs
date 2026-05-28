/**
 * migrate-color-mix-t4.mjs
 *
 * Migrates color-mix() inline style attributes to Tailwind v4 opacity-modifier classes.
 * Targets: src/app/features/**\/*.ts and src/app/shared/**\/*.ts
 *
 * Strategy:
 *  - color-mix(in srgb, var(--TOKEN) N%, transparent) → bg-COLORNAME/N or border-COLORNAME/N
 *  - Uses Tailwind v4 / syntax: bg-brand/10, border-success/25, etc.
 *  - Compound style attributes are split: each prop mapped to its class
 *  - Unmappable props (box-shadow, gradient-bg, etc.) are kept in a reduced style=""
 *  - Skips [style.xxx]="..." Angular bindings
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

// Token → Tailwind color name mapping
const TOKEN_TO_COLOR = {
  '--state-success': 'success',
  '--state-warning': 'warning',
  '--state-error': 'error',
  '--state-danger': 'error',
  '--state-info': 'info',
  '--ds-brand': 'brand',
  '--color-primary': 'brand',
  '--color-brand': 'brand',
  '--color-success': 'success',
  '--color-warning': 'warning',
  '--color-danger': 'error',
  '--color-primary-dark': 'brand-dark',
  '--text-muted': 'text-muted',
  '--bg-surface': 'surface',
};

/**
 * Parse color-mix(in srgb, var(--TOKEN) N%, transparent)
 * Returns { color: 'brand', pct: 10 } or null if unmappable.
 */
function parseColorMix(value) {
  const m = value.match(
    /color-mix\(\s*in\s+srgb\s*,\s*var\((--[a-zA-Z0-9-]+)\)\s+(\d+)%\s*,\s*transparent\s*\)/i,
  );
  if (!m) return null;
  const token = m[1];
  const pct = m[2];
  const color = TOKEN_TO_COLOR[token];
  if (!color) return null;
  return { color, pct };
}

/**
 * Map a single CSS property declaration to Tailwind class(es).
 * Returns { classes: string[], remaining: string|null }
 *  - classes: Tailwind classes that replace this prop
 *  - remaining: null if fully mapped, or the original "prop: value" if not
 */
function mapProp(prop, value) {
  const p = prop.trim().toLowerCase();
  const v = value.trim();

  // background: color-mix(...)
  if (p === 'background') {
    // Special: background: var(--gradient-primary)
    if (v === 'var(--gradient-primary)') {
      return { classes: ['bg-gradient-primary'], remaining: null };
    }

    // background: color-mix(..., transparent)
    const cm = parseColorMix(v);
    if (cm) {
      return { classes: [`bg-${cm.color}/${cm.pct}`], remaining: null };
    }

    // Unmappable background (rgba, hex, gradient with box-shadow, etc.)
    return { classes: [], remaining: `${prop}: ${value}` };
  }

  // background-color: color-mix(...)
  if (p === 'background-color') {
    const cm = parseColorMix(v);
    if (cm) {
      return { classes: [`bg-${cm.color}/${cm.pct}`], remaining: null };
    }
    return { classes: [], remaining: `${prop}: ${value}` };
  }

  // border-color: color-mix(...)
  if (p === 'border-color') {
    const cm = parseColorMix(v);
    if (cm) {
      return { classes: [`border-${cm.color}/${cm.pct}`], remaining: null };
    }
    return { classes: [], remaining: `${prop}: ${value}` };
  }

  // border: 1px solid color-mix(...)
  if (p === 'border') {
    const m = v.match(/^1px\s+solid\s+(.+)$/i);
    if (m) {
      const cm = parseColorMix(m[1].trim());
      if (cm) {
        return { classes: ['border', `border-${cm.color}/${cm.pct}`], remaining: null };
      }
    }
    return { classes: [], remaining: `${prop}: ${value}` };
  }

  // box-shadow: always unmappable (keep as-is)
  if (p === 'box-shadow') {
    return { classes: [], remaining: `${prop}: ${value}` };
  }

  // Anything else: unmappable
  return { classes: [], remaining: `${prop}: ${value}` };
}

/**
 * Process a full style attribute value (possibly semicolon-separated props).
 * Returns { classes: string[], remainingStyle: string|null }
 */
function processStyleValue(styleVal) {
  // Split by semicolons, filter empty
  const parts = styleVal
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const allClasses = [];
  const remainingParts = [];

  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = part.slice(0, colonIdx);
    const val = part.slice(colonIdx + 1);
    const { classes, remaining } = mapProp(prop, val);
    allClasses.push(...classes);
    if (remaining) remainingParts.push(remaining);
  }

  const remainingStyle = remainingParts.length > 0 ? remainingParts.join('; ') : null;
  return { classes: allClasses, remainingStyle };
}

/**
 * Find the position of the class="" attribute nearest to styleStart (backward scan).
 * Returns { start, end } of the attribute value (inside quotes), or null if not found.
 * Stops at element boundaries (< or >) to avoid crossing elements.
 */
function findNearestClass(content, styleStart) {
  const SCAN_BACK = 800;
  const searchFrom = Math.max(0, styleStart - SCAN_BACK);
  const region = content.slice(searchFrom, styleStart);

  // Find the last occurrence of class=" or class=' before styleStart
  // Make sure we don't cross an opening < or >
  let lastClassPos = -1;
  let lastClassType = null; // '"' or "'"

  const classRegex = /\bclass=(["'])/g;
  let m;
  while ((m = classRegex.exec(region)) !== null) {
    // Check there's no > between this match and styleStart (we're in the same element)
    const between = region.slice(m.index + m[0].length);
    if (!between.includes('>')) {
      lastClassPos = searchFrom + m.index;
      lastClassType = m[1];
    }
  }

  if (lastClassPos === -1) return null;

  // Find matching closing quote
  const attrStart = lastClassPos + 'class='.length + 1; // skip class="
  const closeIdx = content.indexOf(lastClassType, attrStart);
  if (closeIdx === -1) return null;

  return { start: attrStart, end: closeIdx, quote: lastClassType };
}

/**
 * Find end of nearest class="" after styleEnd.
 */
function findNextClass(content, styleEnd) {
  const SCAN_FWD = 800;
  const region = content.slice(styleEnd, styleEnd + SCAN_FWD);

  const m = region.match(/\bclass=(["'])/);
  if (!m) return null;

  // Make sure no > between styleEnd and this class attr
  const gap = region.slice(0, m.index);
  if (gap.includes('>')) return null;

  const attrStart = styleEnd + m.index + m[0].length;
  const closeIdx = content.indexOf(m[1], attrStart);
  if (closeIdx === -1) return null;

  return { start: attrStart, end: closeIdx, quote: m[1] };
}

let totalFiles = 0;
let totalReplacements = 0;
let totalSkipped = 0;

const files = globSync('src/app/{features,shared}/**/*.ts', {
  ignore: ['**/*.spec.ts'],
  cwd: process.cwd(),
  absolute: true,
});

for (const filePath of files) {
  let content = readFileSync(filePath, 'utf-8');
  const originalContent = content;

  // Find all inline style="..." attributes with color-mix
  // Use dotAll to match multi-line style values
  const styleRegex = /\bstyle=(["'])([\s\S]*?)\1/g;

  const replacements = []; // { start, end, newText }

  let m;
  while ((m = styleRegex.exec(content)) !== null) {
    const fullMatch = m[0];
    const quote = m[1];
    const styleVal = m[2];
    const matchStart = m.index;
    const matchEnd = m.index + fullMatch.length;

    // Skip Angular binding [style.xxx]="..."
    const charBefore = content[matchStart - 1];
    if (charBefore === ']' || charBefore === '[') continue;

    // Only process if contains color-mix
    if (!styleVal.includes('color-mix')) continue;

    const { classes, remainingStyle } = processStyleValue(styleVal);

    if (classes.length === 0) {
      // Nothing was mapped — leave as-is
      totalSkipped++;
      continue;
    }

    const newClassStr = classes.join(' ');

    // Build the replacement
    if (remainingStyle) {
      // Some props remain: replace style value with only remaining props
      replacements.push({
        start: matchStart,
        end: matchEnd,
        newText: `style="${remainingStyle}"`,
        classes: newClassStr,
        action: 'partial',
      });
    } else {
      // All props mapped: remove style attribute entirely
      replacements.push({
        start: matchStart,
        end: matchEnd,
        newText: '',
        classes: newClassStr,
        action: 'full',
      });
    }
  }

  if (replacements.length === 0) continue;

  // Apply replacements in reverse order (to preserve offsets)
  // But first, we need to also inject classes into existing class="" attributes
  // Sort by start descending
  replacements.sort((a, b) => b.start - a.start);

  for (const rep of replacements) {
    // Find nearest class attribute to append classes to
    const classAttr =
      findNearestClass(content, rep.start) || findNextClass(content, rep.end);

    if (classAttr) {
      // Append to existing class attribute
      const existingClasses = content.slice(classAttr.start, classAttr.end);
      const newClasses = existingClasses
        ? existingClasses + ' ' + rep.classes
        : rep.classes;

      // We need to do both edits. Since we're going in reverse, the class attr
      // might be BEFORE the style attr (classAttr.start < rep.start) — common case.
      // Or AFTER (classAttr.start > rep.start) — less common.

      if (classAttr.end < rep.start) {
        // class attr is before style attr (most common)
        // Apply style replacement first (it's at higher offset since we sort descending)
        content = content.slice(0, rep.start) + rep.newText + content.slice(rep.end);
        // Now update class attr (offset unchanged since it's before rep.start)
        content =
          content.slice(0, classAttr.start) + newClasses + content.slice(classAttr.end);
      } else {
        // class attr is after style attr
        // Apply class update first (higher offset)
        content =
          content.slice(0, classAttr.start) + newClasses + content.slice(classAttr.end);
        // Then apply style replacement (lower offset, already adjusted)
        content = content.slice(0, rep.start) + rep.newText + content.slice(rep.end);
      }
    } else {
      // No nearby class attr — insert class="" with the new classes before the style attr
      // Find the whitespace before the style attr to place new attr nicely
      const insertPos = rep.start;
      const classInsert = `class="${rep.classes}" `;
      content =
        content.slice(0, insertPos) + classInsert + rep.newText + content.slice(rep.end);
    }

    totalReplacements++;
  }

  // Clean up empty style="" artifacts
  content = content.replace(/\s*style=""\s*/g, ' ');
  // Clean up double spaces in class values
  content = content.replace(/class="([^"]*)\s{2,}([^"]*)"/g, (_, a, b) => `class="${a} ${b}"`);

  if (content !== originalContent) {
    writeFileSync(filePath, content, 'utf-8');
    totalFiles++;
    console.log(`✅ ${filePath.split('src/app/')[1]} (${replacements.length} replacements)`);
  }
}

console.log(`\nDone: ${totalReplacements} replacements across ${totalFiles} files`);
console.log(`Skipped (unmappable): ${totalSkipped}`);
