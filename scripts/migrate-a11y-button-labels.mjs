#!/usr/bin/env node
/**
 * migrate-a11y-button-labels.mjs — fix-079-b (ASG-b-054)
 *
 * Agrega aria-label a <button> icon-only (contienen <app-icon>, sin texto visible,
 * sin aria-label) usando SOLO texto que ya existe en el propio archivo — nunca inventa
 * redacción nueva, para no arriesgar un label que describa mal la acción real:
 *
 *   Pass 1 — reusa pTooltip="..." / title="..." literal tal cual (ya es texto humano
 *            pensado para describir la acción, solo le falta ser accesible).
 *   Pass 2 — "sibling": si un botón sin tooltip tiene el MISMO ícono + MISMO handler de
 *            (click) que otro botón en el mismo archivo que sí tiene tooltip (típico
 *            patrón vista tabla/card duplicada), reusa esa etiqueta.
 *
 * Los botones sin tooltip propio, sin sibling en el archivo, o con ícono dinámico
 * ([name]="expr") NO se tocan — quedan reportados para revisión manual (fix.md los
 * detalla uno por uno con la acción real leída del handler).
 *
 * Uso:
 *   node scripts/migrate-a11y-button-labels.mjs --dry
 *   node scripts/migrate-a11y-button-labels.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const DRY = process.argv.includes('--dry');

const files = execSync('git ls-files "src/app/**/*.ts"', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

const BUTTON_RE = /<button\b[^>]*>[\s\S]*?<\/button>/g;

function analyzeBlock(block) {
  const hasIcon = /<app-icon\b/.test(block);
  const hasAriaLabel = /aria-label/.test(block);
  const hasDynamicTitle = /\[title\]=/.test(block);
  const stripped = block.replace(/<[^>]*>/g, ' ').replace(/\{\{[\s\S]*?\}\}/g, 'X');
  const hasVisibleText = stripped.split(' ').join('').trim().length > 0;
  const tooltip =
    block.match(/pTooltip="([^"]+)"/)?.[1] ?? block.match(/(?<!\[)title="([^"]+)"/)?.[1] ?? null;
  const iconStatic = block.match(/<app-icon\s+name="([^"]+)"/)?.[1] ?? null;
  const iconDynamic = /<app-icon\s+\[name\]=/.test(block);
  const click = (block.match(/\(click\)="([\s\S]*?)"/)?.[1] ?? '').replace(/\s+/g, ' ').trim();

  return {
    isTarget: hasIcon && !hasAriaLabel && !hasVisibleText && !hasDynamicTitle,
    tooltip,
    icon: iconStatic,
    iconDynamic,
    click,
  };
}

function insertAriaLabel(block, label) {
  const escaped = label.replace(/"/g, '&quot;');
  // Inserta justo después de `<button` (antes del resto de atributos).
  return block.replace(/^<button\b/, `<button aria-label="${escaped}"`);
}

let filesChanged = 0;
let pass1 = 0;
let pass2 = 0;
const unresolved = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const blocks = [...src.matchAll(BUTTON_RE)].map((m) => ({
    text: m[0],
    index: m.index,
    ...analyzeBlock(m[0]),
  }));

  const targets = blocks.filter((b) => b.isTarget);
  if (targets.length === 0) continue;

  // Mapa sibling: (icon|click) -> tooltip, construido desde TODOS los botones del
  // archivo (incluso los que no son target) que sí tengan tooltip propio.
  const siblingMap = new Map();
  for (const b of blocks) {
    if (b.tooltip && b.icon && b.click) {
      siblingMap.set(`${b.icon}|${b.click}`, b.tooltip);
    }
  }

  let changed = false;
  let out = src;
  // Reconstruir reemplazando de atrás hacia adelante para no invalidar índices.
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    let label = null;
    let via = null;

    if (t.tooltip) {
      label = t.tooltip;
      via = 'tooltip';
    } else if (t.icon && t.click && siblingMap.has(`${t.icon}|${t.click}`)) {
      label = siblingMap.get(`${t.icon}|${t.click}`);
      via = 'sibling';
    }

    if (!label) {
      unresolved.push({
        file,
        icon: t.icon ?? (t.iconDynamic ? '(dinámico)' : '?'),
        click: t.click.slice(0, 70),
      });
      continue;
    }

    const fixed = insertAriaLabel(t.text, label);
    out = out.slice(0, t.index) + fixed + out.slice(t.index + t.text.length);
    changed = true;
    if (via === 'tooltip') pass1++;
    else pass2++;
  }

  if (changed) {
    filesChanged++;
    if (!DRY) writeFileSync(file, out, 'utf8');
  }
}

console.log(`${DRY ? '[DRY RUN] ' : ''}Archivos modificados: ${filesChanged}`);
console.log(`  → aria-label desde tooltip:  ${pass1}`);
console.log(`  → aria-label desde sibling:  ${pass2}`);
console.log(`  → SIN resolver (manual):     ${unresolved.length}`);
if (unresolved.length) {
  console.log('\nSin resolver:');
  unresolved.forEach((u) => console.log(`  ${u.file}  icon=${u.icon}  click=${u.click}`));
}
