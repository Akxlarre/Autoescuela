#!/usr/bin/env node
/**
 * compact-recovery.js — SessionStart Hook (matcher: "compact")
 *
 * Cuando Claude Code compacta la conversación para liberar contexto,
 * se pierden detalles importantes como el contenido de los índices.
 *
 * Este hook re-inyecta los índices del proyecto al contexto de Claude
 * automáticamente después de cada compactación.
 *
 * stdout → se agrega directamente al contexto de Claude.
 */

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();

const indexFiles = [
  'indices/COMPONENTS.md',
  'indices/SERVICES.md',
  'indices/DATABASE.md',
  'indices/DIRECTIVES.md',
  'indices/STYLES.md',
  'indices/PIPES.md',
];

let output = '';
output += '══════════════════════════════════════════════════════════════\n';
output += ' CONTEXTO RE-INYECTADO (post-compactacion por Koa Hooks)\n';
output += '══════════════════════════════════════════════════════════════\n\n';
output += 'El contexto fue compactado. Los indices del proyecto han sido\n';
output += 'restaurados automaticamente para que no pierdas la memoria\n';
output += 'de lo que ya existe en el proyecto.\n\n';

let injectedCount = 0;

for (const indexFile of indexFiles) {
  const fullPath = path.join(cwd, indexFile);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf-8').trim();
    if (content) {
      output += `--- ${indexFile} ---\n`;
      output += content + '\n\n';
      injectedCount++;
    }
  }
}

if (injectedCount === 0) {
  output += '(No se encontraron archivos de indices en el proyecto)\n';
} else {
  output += '══════════════════════════════════════════════════════════════\n';
  output += `${injectedCount} indices restaurados. Consulta estos datos antes de\n`;
  output += 'crear componentes, servicios o migraciones nuevas.\n';
  output += '══════════════════════════════════════════════════════════════\n';
}

process.stdout.write(output);
