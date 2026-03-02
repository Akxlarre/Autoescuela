#!/usr/bin/env node
/**
 * discovery-tracker.js — PostToolUse Hook (Read)
 *
 * Rastrea cuando Claude lee archivos de indices/.
 * Crea un flag temporal por sesión que el Discovery Gate (pre-write-guard.js)
 * verifica antes de permitir escrituras en código fuente.
 *
 * Flujo:
 *   1. Claude hace Read("indices/COMPONENTS.md")
 *   2. Este hook detecta que es un archivo de indices/
 *   3. Crea/actualiza el flag: ${TEMP}/koa-discovery-${SESSION_ID}.flag
 *   4. El Discovery Gate ya no bloquea escrituras para esta sesión
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = (input.tool_input?.file_path || '').replace(/\\/g, '/');
    const sessionId = process.env.CLAUDE_SESSION_ID || 'default';

    // Detectar lectura de cualquier archivo en indices/
    if (filePath.includes('indices/')) {
      const flagPath = path.join(os.tmpdir(), `koa-discovery-${sessionId}.flag`);
      const timestamp = new Date().toISOString();
      const entry = `${timestamp} | READ | ${filePath}\n`;

      // Crear o appendear al flag file
      fs.appendFileSync(flagPath, entry);
    }
  } catch {
    // Silently skip — no bloquear la operación de Read
  }

  process.exit(0);
});
