#!/usr/bin/env node
/**
 * hotfix-autoclose.js — Stop Hook (command)
 *
 * Al terminar cada sesión, si el track activo es un hotfix-NNN-slug,
 * lo cierra automáticamente:
 *   1. Marca hotfix.md status: done + agrega closed: <fecha>
 *   2. Limpia specs/.active
 *
 * Diseño: fail-open. Si algo falla, no bloquea el cierre de sesión.
 */

const fs = require('fs');
const path = require('path');

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  try {
    const cwd = process.cwd();
    const specsDir = path.join(cwd, 'specs');
    const activeFile = path.join(specsDir, '.active');

    if (!fs.existsSync(activeFile)) return process.exit(0);

    const activeId = fs.readFileSync(activeFile, 'utf8').trim().split('\n')[0].trim();

    if (!activeId.startsWith('hotfix-')) return process.exit(0);

    // Ubicar hotfix.md
    const hotfixDir = path.join(specsDir, 'fixes', 'hotfixes', activeId);
    const hotfixMd = path.join(hotfixDir, 'hotfix.md');

    if (fs.existsSync(hotfixMd)) {
      const today = new Date().toISOString().split('T')[0];
      let content = fs.readFileSync(hotfixMd, 'utf8');

      // Actualizar status
      content = content.replace(/^> status: in_progress$/m, '> status: done');

      // Agregar closed si no existe
      if (!content.includes('> closed:')) {
        content = content.replace(
          /^(> status: done)$/m,
          `$1\n> closed: ${today}`
        );
      }

      fs.writeFileSync(hotfixMd, content, 'utf8');
    }

    // Limpiar .active
    fs.writeFileSync(activeFile, '', 'utf8');

    process.exit(0);
  } catch {
    // Fail-open: nunca bloquear el cierre de sesión
    process.exit(0);
  }
});
