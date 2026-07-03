#!/usr/bin/env node
/**
 * plan-injector.js — PreToolUse Hook (Edit|Write|MultiEdit)
 *
 * Si hay una spec SDD activa y el archivo a tocar es codigo de produccion,
 * inyecta el contenido de spec.md + plan.md + tasks.md como additionalContext
 * para que Claude trabaje con el contrato vivo.
 *
 * Se ejecuta DESPUES de spec-gate.js. Si el gate no bloqueo, este inyecta.
 *
 * Exit code 0 siempre (este hook nunca bloquea; solo enriquece contexto).
 */

const fs = require('fs');
const path = require('path');

const MAX_SECTION_CHARS = 8000;

function readCapped(filePath, label) {
  if (!fs.existsSync(filePath)) return '';
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.length > MAX_SECTION_CHARS) {
    content = content.slice(0, MAX_SECTION_CHARS) + '\n\n... [truncado a ' + MAX_SECTION_CHARS + ' chars]';
  }
  return '\n\n----- ' + label + ' (' + path.basename(filePath) + ') -----\n' + content;
}

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path || input.tool_input?.path || '';
    if (!filePath) return process.exit(0);

    const cwd = process.cwd();
    const specsDir = path.join(cwd, 'specs');
    if (!fs.existsSync(specsDir)) return process.exit(0);

    const rel = path.relative(cwd, filePath).replace(/\\/g, '/');

    const exemptPathPrefixes = [
      'specs/', '.claude/', 'docs/', 'indices/', 'scripts/',
      'node_modules/', '.git/', 'dist/', 'build/', 'coverage/',
    ];
    if (exemptPathPrefixes.some(p => rel.startsWith(p))) return process.exit(0);

    const exemptExtensions = ['.md', '.json', '.yaml', '.yml', '.toml', '.lock'];
    if (exemptExtensions.includes(path.extname(filePath).toLowerCase())) return process.exit(0);

    const isProductCode =
      rel.startsWith('src/') ||
      rel.startsWith('app/') ||
      rel.startsWith('lib/') ||
      rel.startsWith('supabase/migrations/') ||
      /^packages\/[^/]+\/src\//.test(rel);

    if (!isProductCode) return process.exit(0);

    const activeFile = path.join(specsDir, '.active');
    if (!fs.existsSync(activeFile)) return process.exit(0);

    const activeId = fs.readFileSync(activeFile, 'utf8').trim().split('\n')[0].trim();
    if (!activeId || activeId.startsWith('--bypass')) return process.exit(0);

    const itemDir = path.join(specsDir, activeId);
    if (!fs.existsSync(itemDir)) return process.exit(0);

    let context;

    // Fix track: inyectar solo fix.md (sin spec/plan/tasks)
    if (activeId.startsWith('fix-')) {
      context = '\u{1F527} FIX TRACK - Fix activo: ' + activeId;
      context += readCapped(path.join(itemDir, 'fix.md'), 'FIX (contrato)');
      context += '\n\n----- INSTRUCCIONES -----\n' +
        '1. El cambio debe limitarse estrictamente a lo declarado en fix.md (Root Cause + Cambio).\n' +
        '2. Si descubris scope adicional durante la implementacion -> DETENETE, avisale al usuario y crea una spec/fix nuevo.\n' +
        '3. El test de regresion mencionado en fix.md DEBE quedar verde antes de correr /fix-close.\n' +
        '4. Un fix = una causa raiz = un archivo tocado. Si necesitas tocar mas, revisá si es un fix o una spec.\n';
    } else {
      // Spec track: inyectar spec + plan + tasks
      context = '\u{1F4CB} SDD CONTEXT - Spec activa: ' + activeId;
      context += readCapped(path.join(itemDir, 'spec.md'), 'SPEC (contrato)');
      context += readCapped(path.join(itemDir, 'plan.md'), 'PLAN (como)');
      context += readCapped(path.join(itemDir, 'tasks.md'), 'TASKS (estado)');
      context += '\n\n----- INSTRUCCIONES -----\n' +
        '1. Cada cambio que hagas debe mapear a un AC de la SPEC o a una tarea de TASKS.\n' +
        '2. Si lo que vas a escribir esta fuera del scope declarado -> DETENETE y avisale al usuario.\n' +
        '3. Si descubris una tarea no listada que SI esta en scope -> agregala al final de tasks.md antes de hacerla.\n' +
        '4. Al cerrar la spec corre /spec-verify para validar AC contra evidencia.\n';
    }

    const output = JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: context,
      },
    });
    process.stdout.write(output);
    process.exit(0);
  } catch (e) {
    process.exit(0);
  }
});