#!/usr/bin/env node
/**
 * Spec 0008 — T3.5 bulk migration
 * Replaces simple single-property style="token" with Tailwind utility classes.
 * Only touches EXACT single-property styles — compound styles are skipped.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DIRS = [
  path.join(ROOT, 'src/app/features'),
  path.join(ROOT, 'src/app/shared'),
];

// Map: regex that matches the normalized style VALUE → Tailwind class
const STYLE_MAP = [
  // Text colors (AC1 / AC2)
  [/^color:\s*var\(--text-muted\)$/, 'text-text-muted'],
  [/^color:\s*var\(--text-primary\)$/, 'text-text-primary'],
  [/^color:\s*var\(--text-secondary\)$/, 'text-text-secondary'],
  [/^color:\s*var\(--text-disabled\)$/, 'text-text-disabled'],
  // Border colors (AC3)
  [/^border-color:\s*var\(--border-default\)$/, 'border-border-default'],
  [/^border-color:\s*var\(--border-subtle\)$/, 'border-border-subtle'],
  // Backgrounds (AC4) — simple token-only, no color-mix()
  [/^background:\s*var\(--bg-subtle\)$/, 'bg-subtle'],
  [/^background:\s*var\(--bg-surface\)$/, 'bg-surface'],
  [/^background:\s*var\(--bg-elevated\)$/, 'bg-elevated'],
  [/^background:\s*var\(--bg-base\)$/, 'bg-base'],
];

/** Returns the Tailwind class for a simple style value, or null for complex/unknown. */
function getTwClass(styleVal) {
  // Normalize: trim whitespace and remove trailing semicolons
  const normalized = styleVal.trim().replace(/;\s*$/, '').trim();
  // Skip compound styles (contain another property after semicolon)
  if (normalized.includes(';')) return null;
  for (const [pattern, twClass] of STYLE_MAP) {
    if (pattern.test(normalized)) return twClass;
  }
  return null;
}

function walkTs(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkTs(full));
    else if (entry.name.endsWith('.ts')) results.push(full);
  }
  return results;
}

let modifiedFiles = 0;
let totalReplacements = 0;

for (const dir of DIRS) {
  for (const file of walkTs(dir)) {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;
    let n = 0;

    // ── Pass A: class="EXISTING" [whitespace] style="SIMPLE"
    // \s+ handles both same-line spaces and multiline newline+indent
    content = content.replace(
      /class="([^"]*)"(\s+)style="([^"]*)"/g,
      (match, existingClass, ws, styleVal) => {
        const twClass = getTwClass(styleVal);
        if (!twClass) return match;
        n++;
        return `class="${existingClass} ${twClass}"`;
      },
    );

    // ── Pass B: style="SIMPLE" [whitespace] class="EXISTING"
    content = content.replace(
      /style="([^"]*)"(\s+)(class="[^"]*")/g,
      (match, styleVal, ws, clsAttr) => {
        const twClass = getTwClass(styleVal);
        if (!twClass) return match;
        n++;
        // Insert twClass before the closing quote of the class attribute
        return clsAttr.replace(/"$/, ` ${twClass}"`);
      },
    );

    // ── Pass C: standalone style (line has no class= at all)
    // Handles elements like <app-icon style="color: var(--text-muted)" />
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes('class=') && lines[i].includes('style=')) {
        lines[i] = lines[i].replace(/style="([^"]*)"/g, (match, styleVal) => {
          const twClass = getTwClass(styleVal);
          if (!twClass) return match;
          n++;
          return `class="${twClass}"`;
        });
      }
    }
    content = lines.join('\n');

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      modifiedFiles++;
      totalReplacements += n;
      console.log(`  [${n}] ${path.relative(ROOT, file)}`);
    }
  }
}

console.log(`\nDone: ${modifiedFiles} files modified, ${totalReplacements} replacements total.`);
