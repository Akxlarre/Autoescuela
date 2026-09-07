/**
 * shared-roles.js — ARCH-24: rol (Dumb vs Organismo) de los componentes de shared/
 *
 * `.claude/rules/architecture.md` §Smart vs Dumb Components distingue por ROL, no por
 * carpeta:
 *   - Dumb presentacional  → prohibido inyectar cualquier Facade. Recibe datos por input().
 *   - Organismo de dominio → puede inyectar el Facade de SU dominio, nunca uno transversal.
 *
 * Esa regla vivía solo en prosa: nada la verificaba, y el guard de escritura enforceaba la
 * versión vieja (carpeta = rol → "shared/ no inyecta Facades nunca"). Este módulo es la
 * implementación única de la regla corregida, compartida por el linter (architect.js) y el
 * guard de escritura (.claude/hooks/pre-write-guard.js) — una sola fuente para que no vuelvan
 * a divergir, que es exactamente lo que hizo falta arreglar.
 *
 * El rol NO se infiere del código: se declara en shared-organisms.allowlist.json. Un tag
 * inline (@organism) se lo auto-otorga cualquiera; una entrada en un archivo de gobierno
 * aparece en el diff y se revisa. Mismo precedente que bento-classes.allowlist.json (ARCH-21).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ALLOWLIST_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'shared-organisms.allowlist.json',
);

/** Servicios de core/services/ui/ que llevan "Facade" en el nombre pero son plomería
 *  transversal de UI, no Facades de dominio (LayoutDrawerFacadeService es el caso real:
 *  lo inyectan 5 componentes de shared/ solo para abrir un drawer). */
const UI_SERVICE_PATH_RE = /services\/ui\//;

/** Carga el allowlist. Fail-closed a "sin organismos" si el archivo no existe o no parsea:
 *  sin allowlist, todo shared/ se trata como Dumb — el comportamiento más estricto, nunca
 *  el más permisivo. */
export function loadOrganismAllowlist(allowlistPath = ALLOWLIST_PATH) {
  try {
    const raw = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
    return {
      organisms: raw.organisms ?? {},
      transversalFacades: raw.transversalFacades ?? ['AuthFacade', 'BranchFacade'],
    };
  } catch {
    return { organisms: {}, transversalFacades: ['AuthFacade', 'BranchFacade'] };
  }
}

/** Normaliza a path POSIX relativo a la raíz del repo, que es como están las claves del
 *  allowlist. Acepta tanto absoluto como relativo (el linter pasa absoluto, el hook relativo). */
export function normalizeRepoPath(filePath, cwd = process.cwd()) {
  const posix = String(filePath).replace(/\\/g, '/');
  const root = String(cwd).replace(/\\/g, '/').replace(/\/$/, '');
  if (posix.startsWith(root + '/')) return posix.slice(root.length + 1);
  return posix.replace(/^\.\//, '');
}

/** ¿Este archivo está bajo el alcance de ARCH-24? Solo componentes de shared/. */
export function isSharedComponent(relPath) {
  return /(^|\/)src\/app\/shared\//.test(relPath) && relPath.endsWith('.component.ts');
}

/** Mapa identificador importado → module specifier, con regex (sin AST): el hook de escritura
 *  no tiene el compilador de TS disponible y necesita la misma respuesta que el linter. */
export function parseImportSpecifiers(content) {
  const map = new Map();
  const importRe = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRe.exec(content)) !== null) {
    const [, names, specifier] = match;
    for (const raw of names.split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) map.set(name, specifier);
    }
  }
  return map;
}

/** Nombres inyectados con inject(X) que son Facades de dominio (excluye la plomería de UI). */
export function findInjectedFacades(content) {
  const specifiers = parseImportSpecifiers(content);
  const injected = new Set();
  const injectRe = /inject\s*\(\s*([A-Za-z_$][\w$]*)\s*[),]/g;
  let match;
  while ((match = injectRe.exec(content)) !== null) {
    const name = match[1];
    if (!name.includes('Facade')) continue;
    if (UI_SERVICE_PATH_RE.test(specifiers.get(name) ?? '')) continue;
    injected.add(name);
  }
  return [...injected];
}

/**
 * Violaciones de ARCH-24 en un componente de shared/.
 * Devuelve [] para cualquier archivo fuera de alcance, así el caller no necesita pre-filtrar.
 *
 * @returns {{type: 'dumb-injects-facade'|'organism-injects-transversal', facade: string, message: string}[]}
 */
export function findSharedRoleViolations(content, relPath, allowlist = loadOrganismAllowlist()) {
  if (!isSharedComponent(relPath)) return [];

  const facades = findInjectedFacades(content);
  if (facades.length === 0) return [];

  const entry = allowlist.organisms[relPath];

  if (!entry) {
    return facades.map((facade) => ({
      type: 'dumb-injects-facade',
      facade,
      message:
        `Componente Dumb de shared/ inyecta '${facade}'. Un Dumb recibe sus datos por input(). ` +
        `Si de verdad es un Organismo de dominio (no puede recibir inputs porque se abre vía ` +
        `LayoutDrawerFacadeService.open()), declaralo en scripts/lib/shared-organisms.allowlist.json ` +
        `con su justificación.`,
    }));
  }

  const waived = entry.allowTransversal ?? [];
  return facades
    .filter((f) => allowlist.transversalFacades.includes(f) && !waived.includes(f))
    .map((facade) => ({
      type: 'organism-injects-transversal',
      facade,
      message:
        `Organismo de shared/ inyecta el Facade transversal '${facade}'. Un organismo solo puede ` +
        `inyectar el Facade de SU dominio: mové ese computed() al Facade de dominio en vez de ` +
        `inyectar el transversal en el componente (architecture.md §Smart vs Dumb Components).`,
    }));
}
