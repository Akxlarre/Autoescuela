#!/usr/bin/env node
/**
 * compact-recovery.js — SessionStart Hook (matcher: "compact")
 *
 * Después de compactar se pierde la memoria de qué índices existen y qué trae cada uno.
 * Este hook devuelve un MAPA de los índices (tamaño y secciones), no su contenido: los índices
 * completos pesan más que una ventana de contexto entera. El contenido se lee con Read cuando
 * hace falta, por sección.
 *
 * stdout → se agrega al contexto de Claude. Presupuesto: MAX_BYTES, que verifica ARCH-32
 * (scripts/check-qa-guardrails.mjs).
 */

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const INDICES_DIR = path.join(cwd, 'indices');

const MAX_BYTES = 60000;
const MAX_HEADINGS_PER_FILE = 40;
const MAX_HEADING_CHARS = 110;

// Primero los que más pesan al escribir código: qué no hacer y qué trampas ya se pisaron.
const FIRST = ['ANTI-PATTERNS.md', 'DOMAIN-GOTCHAS.md'];

function listIndexFiles() {
  if (!fs.existsSync(INDICES_DIR)) return [];
  const names = fs.readdirSync(INDICES_DIR).filter((name) => name.endsWith('.md'));
  const rank = (name) => (FIRST.includes(name) ? FIRST.indexOf(name) : FIRST.length);
  return names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function describe(name) {
  const content = fs.readFileSync(path.join(INDICES_DIR, name), 'utf-8');
  const lines = content.split('\n');
  const headings = lines
    .filter((line) => /^#{1,3}\s/.test(line))
    .map((line) => (line.length > MAX_HEADING_CHARS ? `${line.slice(0, MAX_HEADING_CHARS)}…` : line));

  let block = `--- indices/${name} (${Math.round(content.length / 1024)} KB, ${lines.length} lineas) ---\n`;
  block += headings.slice(0, MAX_HEADINGS_PER_FILE).join('\n');
  if (headings.length > MAX_HEADINGS_PER_FILE) {
    block += `\n(+${headings.length - MAX_HEADINGS_PER_FILE} secciones mas: busca con Grep)`;
  }
  return `${block}\n\n`;
}

let output = '';
output += '══════════════════════════════════════════════════════════════\n';
output += ' MAPA DE INDICES (post-compactacion por Koa Hooks)\n';
output += '══════════════════════════════════════════════════════════════\n\n';
output += 'El contexto fue compactado. Esto es el MAPA de los indices del proyecto,\n';
output += 'no su contenido. Antes de crear un componente, servicio, facade o migracion,\n';
output += 'lee con Read la seccion del indice que corresponde.\n\n';

const files = listIndexFiles();
let listed = 0;
const omitted = [];

for (const name of files) {
  const block = describe(name);
  if (Buffer.byteLength(output + block, 'utf-8') > MAX_BYTES - 500) {
    omitted.push(name);
    continue;
  }
  output += block;
  listed++;
}

if (files.length === 0) {
  output += '(No se encontraron archivos de indices en el proyecto)\n';
} else {
  output += '══════════════════════════════════════════════════════════════\n';
  output += `${listed} indices en el mapa.`;
  if (omitted.length > 0) output += ` Sin detalle por presupuesto: ${omitted.join(', ')}.`;
  output += '\n══════════════════════════════════════════════════════════════\n';
}

process.stdout.write(output);
