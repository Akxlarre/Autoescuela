#!/usr/bin/env node
/**
 * context-enrichment-guard.js — PreToolUse Hook (Edit|Write|MultiEdit)
 *
 * Fase 0: Day 0 Context Seeding Guard
 * 
 * Este guardrail evita el problema del "lienzo en blanco" (vacío de conocimiento de negocio).
 * Si los índices clave (DOMAIN_DICTIONARY.md, DATABASE.md) están vacíos o contienen 
 * el texto "template" o "TODO", bloqueamos a Claude para que no genere código fuente.
 * Lo obligamos a pedir contexto de negocio al humano.
 */

const fs = require('fs');
const path = require('path');

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path || input.tool_input?.path || '';
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Solo activamos este verificador si intentamos escribir código fuente
    const isSourceCode =
      (normalizedPath.includes('src/app/') && !normalizedPath.endsWith('.spec.ts')) ||
      normalizedPath.includes('supabase/migrations/');

    if (isSourceCode) {
      // Ubicaciones de los archivos de contexto crítico
      const workspaceRoot = process.cwd();
      const domainDictPath = path.join(workspaceRoot, 'indices', 'DOMAIN_DICTIONARY.md');
      const dbPath = path.join(workspaceRoot, 'indices', 'DATABASE.md');

      let contextMissing = false;
      let missingFiles = [];

      // Verificar DOMAIN_DICTIONARY.md (Lenguaje Ubicuo)
      if (!fs.existsSync(domainDictPath)) {
        contextMissing = true;
        missingFiles.push('DOMAIN_DICTIONARY.md (falta archivo)');
      } else {
        const domainContent = fs.readFileSync(domainDictPath, 'utf8').trim();
        if (domainContent.length < 50 || domainContent.includes('[TODO]')) {
          contextMissing = true;
          missingFiles.push('DOMAIN_DICTIONARY.md (el archivo está vacío o es un template)');
        }
      }

      // Verificar DATABASE.md (Modelo de datos emparejado)
      if (!fs.existsSync(dbPath)) {
        contextMissing = true;
        missingFiles.push('DATABASE.md (falta archivo)');
      } else {
        const dbContent = fs.readFileSync(dbPath, 'utf8').trim();
        if (dbContent.length < 50 || dbContent.includes('[TODO]')) {
          contextMissing = true;
          missingFiles.push('DATABASE.md (el archivo está vacío o es un template)');
        }
      }

      if (contextMissing) {
        process.stderr.write(
          `\u{1F6A7} DAY 0 CONTEXT GUARD: Prohibido programar a ciegas en un dominio nuevo.\n\n` +
          `Detecto que este proyecto o modulo carece de Contexto de Negocio fundacional.\n` +
          `Faltan o estan incompletos los siguientes indices vitales:\n` +
          missingFiles.map(f => `  - ${f}`).join('\n') + `\n\n` +
          `INSTRUCCION PARA TI (AGENTE):\n` +
          `Dile al usuario exactamente esto: "Alto. Este es un proyecto nuevo o le falta contexto. Por favor, proveeme un documento explicativo (brief) o detallame cual es el Lenguaje Ubicuo (Vocabulario de negocio) y el modelo preliminar de Supabase para nutrir indices/DOMAIN_DICTIONARY.md e indices/DATABASE.md ANTES de que yo empiece a codificar interfaces o facades a ciegas."\n\n` +
          `No escribas codigo fuente hasta rellenar esa base de conocimiento.`
        );
        process.exit(2);
      }
    }

    process.exit(0);
  } catch (e) {
    // Fail-open: si falla el script de validación, permitir
    process.exit(0);
  }
});
