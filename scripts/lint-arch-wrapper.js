#!/usr/bin/env node
/**
 * lint-arch-wrapper.js
 *
 * Ejecuta scripts/architect.js y mantiene memoria de fallos:
 * - Si falla (exit 1): guarda salida en .claude/temp/arch-last-failure.json
 * - Si pasa (exit 0) y existe un fallo previo: añade una entrada a .claude/temp/LESSONS_LEARNED.md y borra el JSON
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const PROJECT_ROOT = process.cwd();
const TEMP_DIR = path.join(PROJECT_ROOT, '.claude', 'temp');
const FAILURE_PATH = path.join(TEMP_DIR, 'arch-last-failure.json');
const LESSONS_PATH = path.join(TEMP_DIR, 'LESSONS_LEARNED.md');
const ARCHITECT_PATH = path.join(PROJECT_ROOT, 'scripts', 'architect.js');

function ensureTempDir() {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function runArchitect() {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [ARCHITECT_PATH], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));

    proc.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
    proc.on('error', (err) =>
      resolve({ code: 1, stdout, stderr: `${stderr}\n${String(err?.message || err)}`.trim() }),
    );
  });
}

function writeFailure(payload) {
  ensureTempDir();
  fs.writeFileSync(FAILURE_PATH, JSON.stringify(payload, null, 2));
}

function appendLessonFromFailure(failure) {
  ensureTempDir();
  const header = fs.existsSync(LESSONS_PATH)
    ? ''
    : `# Lessons Learned (lint:arch)\n\n> Se alimenta automáticamente cuando una auditoría falla y luego vuelve a pasar.\n\n`;

  const entry =
    `## ${new Date().toISOString()} — Recuperación tras fallo ARCH\n\n` +
    `### Contexto\n` +
    `El linter falló y luego fue corregido. Este es el último fallo registrado (útil para evitar recaídas):\n\n` +
    `\`\`\`\n${String(failure?.summary || '').trim()}\n\`\`\`\n\n`;

  fs.appendFileSync(LESSONS_PATH, header + entry, 'utf8');
}

function buildSummary({ stdout, stderr }) {
  const combined = `${stdout || ''}\n${stderr || ''}`.trim();
  const maxChars = 6000;
  return combined.length > maxChars ? `${combined.slice(0, maxChars)}\n... (truncado)` : combined;
}

async function main() {
  if (!fs.existsSync(ARCHITECT_PATH)) {
    console.error(`No se encontró scripts/architect.js en ${ARCHITECT_PATH}`);
    process.exit(1);
  }

  const result = await runArchitect();

  // Reimprimir salidas del linter (conserva UX)
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const passed = result.code === 0;

  if (!passed) {
    writeFailure({
      generatedAt: new Date().toISOString(),
      exitCode: result.code,
      summary: buildSummary(result),
    });
    process.exit(1);
  }

  // Si pasó y había un fallo previo, convertirlo en "lección" y limpiar estado
  if (fs.existsSync(FAILURE_PATH)) {
    try {
      const failure = JSON.parse(fs.readFileSync(FAILURE_PATH, 'utf8'));
      appendLessonFromFailure(failure);
      fs.rmSync(FAILURE_PATH, { force: true });
    } catch {
      // Fail-open: no bloquear lint por memoria corrupta
      try {
        fs.rmSync(FAILURE_PATH, { force: true });
      } catch {
        // ignore
      }
    }
  }

  process.exit(0);
}

main();
