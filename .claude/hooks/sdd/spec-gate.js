#!/usr/bin/env node
/**
 * spec-gate.js — PreToolUse Hook (Edit|Write|MultiEdit)
 *
 * Bloquea escrituras en codigo de produccion si no hay una spec SDD activa.
 *
 * COMPORTAMIENTO (fail-open por defecto):
 *   - Si el proyecto NO tiene carpeta `specs/` -> permite (SDD no esta activo)
 *   - Si el archivo a tocar NO es codigo de produccion (es .md, config, spec, etc.) -> permite
 *   - Si hay `specs/.active` con ID valido y `specs/<id>/spec.md` existe -> permite
 *   - Si la spec activa NO tiene `plan.md` -> BLOQUEA (debe correr /spec-plan)
 *   - Si NO hay spec activa -> BLOQUEA (debe correr /spec-new o /spec-activate)
 *
 * Exit codes:
 *   0 = permitir
 *   2 = bloquear (stderr se envia a Claude como feedback)
 */

const fs = require('fs');
const path = require('path');

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path || input.tool_input?.path || '';
    if (!filePath) return process.exit(0);

    const cwd = process.cwd();
    const specsDir = path.join(cwd, 'specs');

    // GATE 1 - Proyecto sin SDD -> permitir
    if (!fs.existsSync(specsDir) || !fs.statSync(specsDir).isDirectory()) {
      return process.exit(0);
    }

    // GATE 2 - Archivo exento -> permitir
    const rel = path.relative(cwd, filePath).replace(/\\/g, '/');

    const exemptPathPrefixes = [
      'specs/', '.claude/', 'docs/', 'indices/', 'scripts/',
      'supabase/seed', 'tests/',
      'node_modules/', '.git/',
      'dist/', 'build/', 'coverage/', '.next/', '.angular/',
    ];
    if (exemptPathPrefixes.some(p => rel.startsWith(p))) {
      return process.exit(0);
    }

    const exemptExtensions = ['.md', '.mdx', '.json', '.yaml', '.yml', '.toml', '.lock', '.gitignore', '.npmrc', '.env', '.editorconfig'];
    const exemptBasenames = ['Dockerfile', 'Makefile', 'LICENSE', 'README'];
    const ext = path.extname(filePath).toLowerCase();
    const base = path.basename(filePath);
    if (exemptExtensions.includes(ext) || exemptBasenames.includes(base)) {
      return process.exit(0);
    }

    if (rel.endsWith('.spec.ts') || rel.endsWith('.spec.js') ||
        rel.endsWith('.test.ts') || rel.endsWith('.test.js') ||
        rel.endsWith('.test.tsx') || rel.endsWith('.test.jsx')) {
      return process.exit(0);
    }

    const isProductCode =
      rel.startsWith('src/') ||
      rel.startsWith('app/') ||
      rel.startsWith('lib/') ||
      rel.startsWith('supabase/migrations/') ||
      /^packages\/[^/]+\/src\//.test(rel);

    if (!isProductCode) {
      return process.exit(0);
    }

    // GATE 3 - Spec activa?
    const activeFile = path.join(specsDir, '.active');
    let activeId = '';
    if (fs.existsSync(activeFile)) {
      activeId = fs.readFileSync(activeFile, 'utf8').trim().split('\n')[0].trim();
    }

    if (!activeId) {
      process.stderr.write(
        '\u{1F6E1}\u{FE0F} SPEC GATE: No hay spec SDD activa.\n' +
        'Estas intentando tocar codigo de produccion (' + rel + ') sin un contrato declarado.\n\n' +
        'Que hacer:\n' +
        '  - Si la feature ya tiene spec: /spec-activate <ID>\n' +
        '  - Si no existe: /spec-new "titulo de la feature"\n' +
        '  - Para bypass de emergencia: el usuario debe escribir en specs/.active la linea:\n' +
        '    --bypass <motivo>\n'
      );
      process.exit(2);
    }

    // GATE 3.5 - Bypass
    if (activeId.startsWith('--bypass')) {
      return process.exit(0);
    }

    // GATE 3.6 - Hotfix track (solo requiere hotfix.md, auto-close al terminar sesión)
    if (activeId.startsWith('hotfix-')) {
      const hotfixMd = path.join(specsDir, 'fixes', 'hotfixes', activeId, 'hotfix.md');
      if (!fs.existsSync(hotfixMd)) {
        process.stderr.write(
          '\u{1F6E1}\u{FE0F} SPEC GATE: El hotfix track "' + activeId + '" no tiene hotfix.md.\n' +
          'Esperaba encontrar: ' + path.relative(process.cwd(), hotfixMd) + '\n\n' +
          'Que hacer:\n' +
          '  - /hotfix "descripcion" para crear el contrato del hotfix\n' +
          '  - O revisa el contenido de specs/.active\n'
        );
        process.exit(2);
      }
      return process.exit(0);
    }

    // GATE 3.7 - Fix track (solo requiere fix.md, no plan.md)
    if (activeId.startsWith('fix-')) {
      const fixDir = path.join(specsDir, activeId);
      const fixMd = path.join(fixDir, 'fix.md');
      if (!fs.existsSync(fixMd)) {
        process.stderr.write(
          '\u{1F6E1}\u{FE0F} SPEC GATE: El fix track "' + activeId + '" no tiene fix.md.\n' +
          'Esperaba encontrar: ' + path.relative(process.cwd(), fixMd) + '\n\n' +
          'Que hacer:\n' +
          '  - /fix-new "descripcion" para crear el contrato del fix\n' +
          '  - O revisa el contenido de specs/.active\n'
        );
        process.exit(2);
      }
      return process.exit(0);
    }

    // GATE 4 - Spec + plan existen?
    const specDir = path.join(specsDir, activeId);
    const specMd = path.join(specDir, 'spec.md');
    const planMd = path.join(specDir, 'plan.md');

    if (!fs.existsSync(specMd)) {
      process.stderr.write(
        '\u{1F6E1}\u{FE0F} SPEC GATE: La spec activa "' + activeId + '" no existe en disco.\n' +
        'Esperaba encontrar: ' + path.relative(cwd, specMd) + '\n\n' +
        'Que hacer:\n' +
        '  - Verifica el contenido de specs/.active\n' +
        '  - /spec-new si necesitas crearla\n' +
        '  - /spec-activate <ID_valido> si querias activar otra\n'
      );
      process.exit(2);
    }

    if (!fs.existsSync(planMd)) {
      process.stderr.write(
        '\u{1F6E1}\u{FE0F} SPEC GATE: La spec "' + activeId + '" no tiene plan.md.\n' +
        'No podes escribir codigo sin un plan tecnico aprobado.\n\n' +
        'Que hacer:\n' +
        '  - /spec-plan  (Claude genera plan.md basado en spec.md + indices)\n' +
        '  - Revisa y aprueba el plan antes de continuar\n'
      );
      process.exit(2);
    }

    process.exit(0);
  } catch (e) {
    process.exit(0);
  }
});