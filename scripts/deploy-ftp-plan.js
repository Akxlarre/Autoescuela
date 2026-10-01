#!/usr/bin/env node
/**
 * deploy-ftp-plan.js — I/O del plan de borrado del deploy FTP de producción (spec 0046-b).
 *
 * Uso: node scripts/deploy-ftp-plan.js <dir-del-build> [<manifiesto-remoto.json>]
 *
 * Lee los archivos del build y el manifiesto que estaba en el servidor (puede no existir: primer
 * deploy), y escribe:
 *   - <dir-del-build>/.deploy-manifest.json → el manifiesto nuevo, a subir AL FINAL del deploy.
 *   - delete-list.txt (en el cwd)          → una ruta remota por línea, a borrar DESPUÉS de subir
 *                                             index.html.
 *
 * La decisión de qué borrar vive en scripts/lib/deploy-manifest.js (función pura con test).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { planDeploy, MANIFEST_NAME } from './lib/deploy-manifest.js';

const [buildDir, remoteManifestPath] = process.argv.slice(2);

if (!buildDir || !existsSync(buildDir) || !statSync(buildDir).isDirectory()) {
  console.error(`[deploy-ftp-plan] Directorio del build inválido: "${buildDir ?? ''}"`);
  process.exit(2);
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [relative(buildDir, full).replace(/\\/g, '/')];
  });
}

function readRemoteManifest(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    console.warn('[deploy-ftp-plan] Manifiesto remoto ilegible → no se borra nada en este deploy.');
    return 'ilegible';
  }
}

const currentFiles = listFiles(buildDir).filter((f) => f !== MANIFEST_NAME);
const { toDelete, nextManifest } = planDeploy({ currentFiles, remoteManifest: readRemoteManifest(remoteManifestPath) });

writeFileSync(join(buildDir, MANIFEST_NAME), JSON.stringify(nextManifest, null, 2) + '\n');
writeFileSync('delete-list.txt', toDelete.length ? toDelete.join('\n') + '\n' : '');

console.log(`[deploy-ftp-plan] ${nextManifest.current.length} archivo(s) en el build, ${toDelete.length} a borrar del servidor.`);
for (const f of toDelete) console.log(`  - ${f}`);
