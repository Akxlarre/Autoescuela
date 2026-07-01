#!/usr/bin/env node
/**
 * indices-sync.js — Auto-indexer (v7.0)
 *
 * Escanea el proyecto Angular usando el AST de TypeScript y actualiza
 * automáticamente las secciones entre marcadores en los archivos indices/*.md
 *
 * Marcadores soportados (en cada índice):
 *   <!-- AUTO-GENERATED:BEGIN -->
 *   <!-- AUTO-GENERATED:END -->
 *
 * Solo reescribe entre los marcadores, preservando el contenido manual del resto.
 *
 * Cache incremental por mtime: solo re-parsea archivos modificados desde la
 * última ejecución. Cache en .claude/temp/indices-cache.json (ya en .gitignore).
 *
 * Uso: npm run indices:sync
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// ─── Colors ──────────────────────────────────────────────────────────────────
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan   = (s) => `\x1b[36m${s}\x1b[0m`;
const bold   = (s) => `\x1b[1m${s}\x1b[0m`;
const dim    = (s) => `\x1b[2m${s}\x1b[0m`;

const ROOT        = process.cwd();
const INDICES_DIR = path.join(ROOT, 'indices');
const SRC_APP     = path.join(ROOT, 'src', 'app');
const CACHE_DIR   = path.join(ROOT, '.claude', 'temp');
const CACHE_FILE  = path.join(CACHE_DIR, 'indices-cache.json');

// ─── mtime Cache ────────────────────────────────────────────────────────────

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf-8');
}

/**
 * Reads a file only if it changed since last run (by mtime).
 * Returns { content, changed } or { content: null, changed: false } if cached.
 */
function readIfChanged(filePath, cache) {
  const mtimeMs = fs.statSync(filePath).mtimeMs;
  if (cache[filePath] && cache[filePath] >= mtimeMs) {
    return { content: null, changed: false };
  }
  cache[filePath] = mtimeMs;
  return { content: fs.readFileSync(filePath, 'utf-8'), changed: true };
}

// ─── AST Utilities ───────────────────────────────────────────────────────────

function walkAst(node, visitor) {
  visitor(node);
  ts.forEachChild(node, child => walkAst(child, visitor));
}

function extractInterfaces(sourceFile) {
  const names = [];
  walkAst(sourceFile, node => {
    if (ts.isInterfaceDeclaration(node)) names.push(node.name.text);
    if (ts.isTypeAliasDeclaration(node)) names.push(node.name.text);
  });
  return names;
}

function extractSelector(sourceFile) {
  let selector = null;
  walkAst(sourceFile, node => {
    if (!ts.isPropertyAssignment(node)) return;
    if (node.name?.getText(sourceFile) === 'selector') {
      selector = node.initializer?.getText(sourceFile)?.replace(/['"]/g, '') ?? null;
    }
  });
  return selector;
}

function extractSignalInputsOutputs(content) {
  const inputs  = [];
  const outputs = [];
  const inRe  = /(\w+)\s*=\s*input[^(]*\(/g;
  const outRe = /(\w+)\s*=\s*output[^(]*\(/g;
  let m;
  while ((m = inRe.exec(content))  !== null) inputs.push(m[1]);
  while ((m = outRe.exec(content)) !== null) outputs.push(m[1]);
  return { inputs, outputs };
}

function extractInjected(content) {
  const deps = [];
  const re = /inject\s*\(\s*(\w+)\s*\)/g;
  let m;
  while ((m = re.exec(content)) !== null) deps.push(m[1]);
  return [...new Set(deps)];
}

function extractPublicSignals(content) {
  const signals = [];
  const re = /public\s+readonly\s+(\w+)\s*=/g;
  let m;
  while ((m = re.exec(content)) !== null) signals.push(m[1]);
  return signals;
}

/**
 * Extracts inline template content from a component .ts file.
 * Falls back to reading external templateUrl if no inline template found.
 */
function extractTemplateContent(tsContent, filePath) {
  // Try inline template: template: `...`
  const inlineMatch = tsContent.match(/template\s*:\s*`([\s\S]*?)`/);
  if (inlineMatch) return inlineMatch[1];

  // Fallback: external templateUrl
  const urlMatch = tsContent.match(/templateUrl\s*:\s*['"](.+?)['"]/);
  if (urlMatch) {
    const htmlPath = path.resolve(path.dirname(filePath), urlMatch[1]);
    if (fs.existsSync(htmlPath)) return fs.readFileSync(htmlPath, 'utf-8');
  }

  return '';
}

/**
 * Detects UI patterns in a template string.
 * Returns { loading, empty, error, skeleton } booleans.
 */
function detectPagePatterns(templateContent) {
  const t = templateContent;
  return {
    loading:  /isLoading\s*\(/.test(t) || /\bloading\]/.test(t),
    empty:    /app-empty-state/.test(t) || /emptymessage/.test(t),
    error:    /app-alert-card[\s\S]{0,120}error/.test(t) || /error-state/.test(t) || /\.error\s*\(/.test(t),
    skeleton: /skeleton-block/.test(t) || /-skeleton[\s>"']/.test(t),
  };
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converts a directive selector string to a RegExp for template detection.
 * Handles:
 *   [attrName]               → \battrName\b
 *   element[attrName]        → \battrName\b
 *   *structName              → \*structName\b
 *   comma-separated          → takes first part
 */
function directiveSelectorToPattern(selector) {
  if (!selector) return null;
  // Take first part if comma-separated
  const first = selector.split(',')[0].trim();
  // [attrName] or element[attrName]
  const attrMatch = first.match(/\[([^\]]+)\]/);
  if (attrMatch) {
    return new RegExp(`\\b${escapeRegex(attrMatch[1])}\\b`);
  }
  // *structDirective
  if (first.startsWith('*')) {
    return new RegExp(`\\*${escapeRegex(first.slice(1))}\\b`);
  }
  // element selector
  return new RegExp(`<${escapeRegex(first)}[\\s/>]`);
}

// ─── Directory Walker ─────────────────────────────────────────────────────────

function* walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkDir(fullPath);
    else yield fullPath;
  }
}

// ─── Data Collection ──────────────────────────────────────────────────────────

function collectComponents(cache, prevResults) {
  const results = [];
  const prevMap = new Map((prevResults ?? []).map(r => [r.filePath, r]));
  let skipped = 0;
  const sharedDir = path.join(SRC_APP, 'shared');
  for (const filePath of walkDir(sharedDir)) {
    if (!filePath.endsWith('.component.ts') || filePath.endsWith('.spec.ts')) continue;
    if (filePath.endsWith('-skeleton.component.ts')) continue;
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    try {
      const { content, changed } = readIfChanged(filePath, cache);
      if (!changed && prevMap.has(relPath)) { results.push(prevMap.get(relPath)); skipped++; continue; }
      const src = content ?? fs.readFileSync(filePath, 'utf-8');
      const sf = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true);
      const selector = extractSelector(sf);
      const { inputs, outputs } = extractSignalInputsOutputs(src);
      results.push({ selector: selector ?? path.basename(filePath, '.component.ts'), inputs, outputs, filePath: relPath });
    } catch { /* skip unparseable */ }
  }
  if (skipped > 0) process.stdout.write(dim(` (${skipped} cached)`));
  return results;
}

function collectServices(cache, prevResults) {
  const results = [];
  const prevMap = new Map((prevResults ?? []).map(r => [r.filePath, r]));
  let skipped = 0;
  const coreDir = path.join(SRC_APP, 'core');
  for (const filePath of walkDir(coreDir)) {
    if (!filePath.endsWith('.service.ts') || filePath.endsWith('.spec.ts')) continue;
    if (filePath.endsWith('.facade.ts')) continue;
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    try {
      const { content, changed } = readIfChanged(filePath, cache);
      if (!changed && prevMap.has(relPath)) { results.push(prevMap.get(relPath)); skipped++; continue; }
      const src = content ?? fs.readFileSync(filePath, 'utf-8');
      const classMatch = src.match(/export\s+class\s+(\w+)/);
      const className = classMatch?.[1] ?? path.basename(filePath, '.ts');
      results.push({ className, deps: extractInjected(src), filePath: relPath });
    } catch { /* skip */ }
  }
  if (skipped > 0) process.stdout.write(dim(` (${skipped} cached)`));
  return results;
}

function collectFacades(cache, prevResults) {
  const results = [];
  const prevMap = new Map((prevResults ?? []).map(r => [r.filePath, r]));
  let skipped = 0;
  const coreDir = path.join(SRC_APP, 'core');
  for (const filePath of walkDir(coreDir)) {
    if (!filePath.endsWith('.facade.ts') || filePath.endsWith('.spec.ts')) continue;
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    try {
      const { content, changed } = readIfChanged(filePath, cache);
      if (!changed && prevMap.has(relPath)) { results.push(prevMap.get(relPath)); skipped++; continue; }
      const src = content ?? fs.readFileSync(filePath, 'utf-8');
      const classMatch = src.match(/export\s+class\s+(\w+)/);
      const className = classMatch?.[1] ?? path.basename(filePath, '.ts');
      results.push({ className, deps: extractInjected(src), signals: extractPublicSignals(src), filePath: relPath });
    } catch { /* skip */ }
  }
  if (skipped > 0) process.stdout.write(dim(` (${skipped} cached)`));
  return results;
}

function collectModels(cache, prevResults) {
  const results = [];
  const prevMap = new Map((prevResults ?? []).map(r => [r.filePath, r]));
  let skipped = 0;
  const modelsDir = path.join(SRC_APP, 'core', 'models');
  for (const filePath of walkDir(modelsDir)) {
    if (!filePath.endsWith('.model.ts') || filePath.endsWith('.spec.ts')) continue;
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    try {
      const { content, changed } = readIfChanged(filePath, cache);
      if (!changed && prevMap.has(relPath)) { results.push(prevMap.get(relPath)); skipped++; continue; }
      const src = content ?? fs.readFileSync(filePath, 'utf-8');
      const sf = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true);
      const interfaces = extractInterfaces(sf);
      if (interfaces.length === 0) continue;
      const category = relPath.includes('/dto/') ? 'dto' : relPath.includes('/ui/') ? 'ui' : 'other';
      results.push({ interfaces, filePath: relPath, category });
    } catch { /* skip */ }
  }
  if (skipped > 0) process.stdout.write(dim(` (${skipped} cached)`));
  return results;
}

function collectDirectives(cache, prevResults) {
  const results = [];
  const prevMap = new Map((prevResults ?? []).map(r => [r.filePath, r]));
  let skipped = 0;
  const directivesDir = path.join(SRC_APP, 'core', 'directives');
  for (const filePath of walkDir(directivesDir)) {
    if (!filePath.endsWith('.directive.ts') || filePath.endsWith('.spec.ts')) continue;
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    try {
      const { content, changed } = readIfChanged(filePath, cache);
      if (!changed && prevMap.has(relPath)) { results.push(prevMap.get(relPath)); skipped++; continue; }
      const src = content ?? fs.readFileSync(filePath, 'utf-8');
      const classMatch = src.match(/export\s+(?:class\s+(\w+)|const\s+(\w+))/);
      const className = classMatch?.[1] ?? classMatch?.[2] ?? path.basename(filePath, '.directive.ts');
      const selectorMatch = src.match(/selector\s*:\s*['"]([^'"]+)['"]/);
      const selector = selectorMatch?.[1] ?? null;
      const { inputs, outputs } = extractSignalInputsOutputs(src);
      results.push({ className, selector, inputs, outputs, filePath: relPath });
    } catch { /* skip */ }
  }
  if (skipped > 0) process.stdout.write(dim(` (${skipped} cached)`));
  return results;
}

function collectGuards(cache, prevResults) {
  const results = [];
  const prevMap = new Map((prevResults ?? []).map(r => [r.filePath, r]));
  let skipped = 0;
  const guardsDir = path.join(SRC_APP, 'core', 'guards');
  for (const filePath of walkDir(guardsDir)) {
    if (!filePath.endsWith('.guard.ts') || filePath.endsWith('.spec.ts')) continue;
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    try {
      const { content, changed } = readIfChanged(filePath, cache);
      if (!changed && prevMap.has(relPath)) { results.push(prevMap.get(relPath)); skipped++; continue; }
      const src = content ?? fs.readFileSync(filePath, 'utf-8');
      // Guards can be classes or arrow functions / const functions
      const nameMatch = src.match(/export\s+(?:class\s+(\w+)|(?:const|function)\s+(\w+))/);
      const name = nameMatch?.[1] ?? nameMatch?.[2] ?? path.basename(filePath, '.guard.ts');
      const deps = extractInjected(src);
      // Detect CanActivateFn vs CanDeactivateFn
      const type = /CanDeactivate/.test(src) ? 'CanDeactivateFn'
        : /CanMatch/.test(src) ? 'CanMatchFn'
        : 'CanActivateFn';
      results.push({ name, deps, type, filePath: relPath });
    } catch { /* skip */ }
  }
  if (skipped > 0) process.stdout.write(dim(` (${skipped} cached)`));
  return results;
}

function collectUtils(cache, prevResults) {
  const results = [];
  const prevMap = new Map((prevResults ?? []).map(r => [r.filePath, r]));
  let skipped = 0;
  const utilsDir = path.join(SRC_APP, 'core', 'utils');
  for (const filePath of walkDir(utilsDir)) {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) continue;
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    try {
      const { content, changed } = readIfChanged(filePath, cache);
      if (!changed && prevMap.has(relPath)) { results.push(prevMap.get(relPath)); skipped++; continue; }
      const src = content ?? fs.readFileSync(filePath, 'utf-8');
      const exports = [];
      const re = /export\s+(?:(?:async\s+)?function\s+(\w+)|const\s+(\w+)|class\s+(\w+)|type\s+(\w+)|interface\s+(\w+))/g;
      let m;
      while ((m = re.exec(src)) !== null) {
        const name = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5];
        if (name) exports.push(name);
      }
      if (exports.length === 0) continue;
      results.push({ filePath: relPath, exports });
    } catch { /* skip */ }
  }
  if (skipped > 0) process.stdout.write(dim(` (${skipped} cached)`));
  return results;
}

function collectStyles() {
  const STYLES_DIR = path.join(ROOT, 'src', 'styles');

  // ── 1. Parse SCSS source files ────────────────────────────────────────────
  const tokensBySection = new Map(); // section label → [{name, value}]
  const semanticClasses = [];        // [{name, file}]
  const bentoClasses    = [];
  const primengGroups   = new Map(); // base-component → Set<selector>

  const varsPath = path.join(STYLES_DIR, 'tokens', '_variables.scss');
  if (fs.existsSync(varsPath)) {
    const src = fs.readFileSync(varsPath, 'utf-8');
    let currentSection = 'General';

    for (const line of src.split('\n')) {
      // Section header patterns:
      //   /* ── Section Name ──────... */
      //   /* Section Name */
      const secMatch =
        line.match(/\/\*\s*─+\s*([^─\n*]{4,80}?)\s*─*\s*\*\//) ??
        line.match(/\/\*\s+([A-ZÁÉÍÓÚ][^─\n*]{3,60}?)\s+\*\//);
      if (secMatch) {
        const candidate = secMatch[1].trim().replace(/^CAPA\s+\d+\s*[—–-]\s*/i, '');
        if (candidate.length >= 4 && !/={3}/.test(candidate)) currentSection = candidate;
      }

      // CSS custom property declaration
      const varMatch = line.match(/^\s+(--[\w-]+)\s*:\s*(.+?);/);
      if (varMatch) {
        if (!tokensBySection.has(currentSection)) tokensBySection.set(currentSection, []);
        tokensBySection.get(currentSection).push({ name: varMatch[1], value: varMatch[2].trim() });
      }

      // Top-level semantic class (not nested, not state pseudo-class)
      const clsMatch = line.match(/^(\.[\w-]+)\s*\{/);
      if (clsMatch && !clsMatch[1].startsWith('.p-')) {
        semanticClasses.push({ name: clsMatch[1], file: 'src/styles/tokens/_variables.scss' });
      }
    }
  }

  const bentoPath = path.join(STYLES_DIR, 'layout', '_bento-grid.scss');
  if (fs.existsSync(bentoPath)) {
    const src = fs.readFileSync(bentoPath, 'utf-8');
    const re = /\.(bento-[\w-]+)/g;
    let m;
    while ((m = re.exec(src)) !== null) bentoClasses.push(m[1]);
  }

  const primePath = path.join(STYLES_DIR, 'vendors', '_primeng-overrides.scss');
  if (fs.existsSync(primePath)) {
    const src = fs.readFileSync(primePath, 'utf-8');
    const re = /\.(p-[\w][\w-]*)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const sel  = m[1];
      const base = sel.replace(/^p-/, '').split('-')[0];
      if (!primengGroups.has(base)) primengGroups.set(base, new Set());
      primengGroups.get(base).add('.' + sel);
    }
  }

  // ── 2. Cross-reference: count token/class usage in all templates ──────────
  const allTokenNames = [];
  for (const tokens of tokensBySection.values()) allTokenNames.push(...tokens.map(t => t.name));
  const classNames = semanticClasses.map(c => c.name.replace(/^\./, ''));

  const tokenUsage = {};
  const classUsage = {};
  let   typoSize     = 0;   // text-4xl/3xl/2xl → candidatas a clase semántica
  let   typoWeight   = 0;   // font-bold/semibold → peso genérico, informativo
  const typoClusters = new Map();
  const TYPO_UTIL_RE = /\b(?:text-4xl|text-3xl|text-2xl|font-bold|font-semibold)\b/;

  for (const filePath of walkDir(SRC_APP)) {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts')) continue;
    let content;
    try { content = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
    const template = extractTemplateContent(content, filePath);
    const full     = content + template;

    // Token usage: var(--token-name) — one pass via regex
    const varRe = /var\((--[\w-]+)\)/g;
    let m;
    while ((m = varRe.exec(full)) !== null) {
      tokenUsage[m[1]] = (tokenUsage[m[1]] ?? 0) + 1;
    }

    // Semantic class usage: los guards (?<![\w-]) / (?![\w-]) evitan contar
    // `card` dentro de `card-accent`, `bento-card`, `kpi-card`, etc.
    for (const cls of classNames) {
      if (template.includes(cls)) {
        const n = (template.match(new RegExp(`(?<![\\w-])${escapeRegex(cls)}(?![\\w-])`, 'g')) ?? []).length;
        if (n > 0) classUsage[cls] = (classUsage[cls] ?? 0) + n;
      }
    }

    // Typography drift — conteo crudo, separado por intención.
    // size = candidata a clase semántica de número/título; weight = peso genérico (informativo).
    typoSize   += (template.match(/\b(?:text-4xl|text-3xl|text-2xl)\b/g) ?? []).length;
    typoWeight += (template.match(/\b(?:font-bold|font-semibold)\b/g) ?? []).length;

    // Clusters repetidos: combinaciones idénticas de utilidades con tipografía
    // que se repiten → candidatas a promoverse a una clase del DS.
    const classRe = /(?<![\w-])class\s*=\s*"([^"]*)"/g;
    let cm;
    while ((cm = classRe.exec(template)) !== null) {
      const raw = cm[1].trim();
      if (!TYPO_UTIL_RE.test(raw)) continue;
      const tokens = raw.split(/\s+/).filter(Boolean);
      if (tokens.length < 3) continue; // necesita ser un "combo" real, no un font-bold suelto
      const key = [...tokens].sort().join(' ');
      const entry = typoClusters.get(key) ?? { count: 0, sample: raw };
      entry.count += 1;
      typoClusters.set(key, entry);
    }
  }

  return {
    tokensBySection,
    tokenUsage,
    semanticClasses,
    classUsage,
    bentoClasses: [...new Set(bentoClasses)].sort(),
    primengGroups,
    typoSize,
    typoWeight,
    typoClusters,
  };
}

function collectUsageMap(cache, prevResults, sharedSelectors, directiveItems, facadeNames) {
  const results = {
    componentUsage:  {},
    directiveUsage:  {},
    facadeUsage:     {},
    serviceUsage:    {},
    pagePatterns:    [],
  };
  const prevPages = new Map((prevResults?.pagePatterns ?? []).map(r => [r.filePath, r]));
  let skipped = 0;

  // Pre-compile directive patterns (done once, not per-template)
  const directivesWithPatterns = (directiveItems ?? [])
    .filter(d => d.selector)
    .map(d => ({ selector: d.selector, pattern: directiveSelectorToPattern(d.selector) }))
    .filter(d => d.pattern !== null);

  const selectors = new Set(sharedSelectors);
  const directiveSelectorSet = new Set(directivesWithPatterns.map(d => d.selector));
  const facadeSet = new Set(facadeNames ?? []);

  // Scan features/ and layout/
  const scanDirs = [
    { dir: path.join(SRC_APP, 'features'), isPage: true },
    { dir: path.join(SRC_APP, 'layout'),   isPage: false },
  ];

  for (const { dir, isPage } of scanDirs) {
    for (const filePath of walkDir(dir)) {
      if (!filePath.endsWith('.component.ts') || filePath.endsWith('.spec.ts')) continue;
      const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
      const consumer = relPath
        .replace(/^src\/app\//, '')
        .replace(/\/[^/]+\.component\.ts$/, '');

      try {
        const { content, changed } = readIfChanged(filePath, cache);
        const src = content ?? fs.readFileSync(filePath, 'utf-8');

        // If unchanged and we have prev data, reuse it.
        // Los hits previos se filtran contra los artefactos actuales: si un
        // componente/directiva/facade fue eliminado, no debe reaparecer en el mapa.
        if (!changed && prevPages.has(relPath)) {
          const prev = prevPages.get(relPath);
          if (prev._componentHits) prev._componentHits.filter(s => selectors.has(s)).forEach(s => {
            (results.componentUsage[s] ??= new Set()).add(consumer);
          });
          if (prev._directiveHits) prev._directiveHits.filter(s => directiveSelectorSet.has(s)).forEach(s => {
            (results.directiveUsage[s] ??= new Set()).add(consumer);
          });
          if (prev._facadeHits) prev._facadeHits.filter(f => facadeSet.has(f)).forEach(f => {
            (results.facadeUsage[f] ??= new Set()).add(consumer);
          });
          if (prev._serviceHits) prev._serviceHits.forEach(s => {
            (results.serviceUsage[s] ??= new Set()).add(consumer);
          });
          if (isPage) results.pagePatterns.push(prev);
          skipped++;
          continue;
        }

        const templateContent = extractTemplateContent(src, filePath);

        // Shared component usage
        const componentHits = [];
        for (const sel of selectors) {
          const tagRe = new RegExp(`<${sel}[\\s/>]`);
          if (tagRe.test(templateContent)) {
            (results.componentUsage[sel] ??= new Set()).add(consumer);
            componentHits.push(sel);
          }
        }

        // Directive usage in templates
        const directiveHits = [];
        for (const { selector, pattern } of directivesWithPatterns) {
          if (pattern.test(templateContent)) {
            (results.directiveUsage[selector] ??= new Set()).add(consumer);
            directiveHits.push(selector);
          }
        }

        // Injected facades and services
        const injected = extractInjected(src);
        const facadeHits = [];
        const serviceHits = [];
        for (const dep of injected) {
          if (dep.endsWith('Facade')) {
            (results.facadeUsage[dep] ??= new Set()).add(consumer);
            facadeHits.push(dep);
          } else if (dep.endsWith('Service')) {
            (results.serviceUsage[dep] ??= new Set()).add(consumer);
            serviceHits.push(dep);
          }
        }

        if (isPage) {
          const patterns = detectPagePatterns(templateContent);
          results.pagePatterns.push({
            page: consumer,
            filePath: relPath,
            patterns,
            _componentHits:  componentHits,
            _directiveHits:  directiveHits,
            _facadeHits:     facadeHits,
            _serviceHits:    serviceHits,
          });
        }
      } catch { /* skip unparseable */ }
    }
  }

  // Convert Sets to sorted arrays for serialization
  for (const key of Object.keys(results.componentUsage)) {
    results.componentUsage[key] = [...results.componentUsage[key]].sort();
  }
  for (const key of Object.keys(results.directiveUsage)) {
    results.directiveUsage[key] = [...results.directiveUsage[key]].sort();
  }
  for (const key of Object.keys(results.facadeUsage)) {
    results.facadeUsage[key] = [...results.facadeUsage[key]].sort();
  }
  for (const key of Object.keys(results.serviceUsage)) {
    results.serviceUsage[key] = [...results.serviceUsage[key]].sort();
  }

  if (skipped > 0) process.stdout.write(dim(` (${skipped} cached)`));
  return results;
}

// ─── Markdown Table Generators ────────────────────────────────────────────────

function generateComponentsTable(items) {
  if (items.length === 0) return '_Sin componentes auto-detectados aún._\n';
  const header = '| Selector | Inputs | Outputs | Archivo |\n|----------|--------|---------|---------|';
  const rows = items.map(c => {
    const ins  = c.inputs.length  > 0 ? c.inputs.map(i => `\`${i}\``).join(', ') : '—';
    const outs = c.outputs.length > 0 ? c.outputs.map(o => `\`${o}\``).join(', ') : '—';
    return `| \`${c.selector}\` | ${ins} | ${outs} | \`${c.filePath}\` |`;
  });
  return header + '\n' + rows.join('\n') + '\n';
}

function generateServicesTable(items) {
  if (items.length === 0) return '_Sin servicios auto-detectados aún._\n';
  const header = '| Clase | Dependencias | Archivo |\n|-------|-------------|---------|';
  const rows = items.map(s => {
    const deps = s.deps.length > 0 ? s.deps.map(d => `\`${d}\``).join(', ') : '—';
    return `| \`${s.className}\` | ${deps} | \`${s.filePath}\` |`;
  });
  return header + '\n' + rows.join('\n') + '\n';
}

function generateFacadesTable(items) {
  if (items.length === 0) return '_Sin facades auto-detectadas aún._\n';
  const header = '| Clase | Dependencias | Signals expuestos | Archivo |\n|-------|-------------|------------------|---------|';
  const rows = items.map(f => {
    const deps = f.deps.length    > 0 ? f.deps.map(d => `\`${d}\``).join(', ') : '—';
    const sigs = f.signals.length > 0 ? f.signals.map(s => `\`${s}\``).join(', ') : '—';
    return `| \`${f.className}\` | ${deps} | ${sigs} | \`${f.filePath}\` |`;
  });
  return header + '\n' + rows.join('\n') + '\n';
}

function generateModelsTable(items) {
  if (items.length === 0) return '_Sin modelos auto-detectados aún._\n';
  const header = '| Interfaces | Categoría | Archivo |\n|-----------|----------|---------|';
  const rows = items.map(m => {
    const ifaces = m.interfaces.map(i => `\`${i}\``).join(', ');
    return `| ${ifaces} | \`${m.category}\` | \`${m.filePath}\` |`;
  });
  return header + '\n' + rows.join('\n') + '\n';
}

function generateDirectivesAutoTable(items) {
  if (items.length === 0) return '_Sin directivas auto-detectadas aún._\n';
  const header = '| Clase | Selector | Inputs | Outputs | Archivo |\n|-------|----------|--------|---------|---------|';
  const rows = items.map(d => {
    const ins  = d.inputs.length  > 0 ? d.inputs.map(i => `\`${i}\``).join(', ') : '—';
    const outs = d.outputs.length > 0 ? d.outputs.map(o => `\`${o}\``).join(', ') : '—';
    const sel  = d.selector ? `\`${d.selector}\`` : '—';
    return `| \`${d.className}\` | ${sel} | ${ins} | ${outs} | \`${d.filePath}\` |`;
  });
  return header + '\n' + rows.join('\n') + '\n';
}

function generateGuardsTable(items) {
  if (items.length === 0) return '_Sin guards auto-detectados aún._\n';
  const header = '| Guard | Tipo | Dependencias | Archivo |\n|-------|------|-------------|---------|';
  const rows = items.map(g => {
    const deps = g.deps.length > 0 ? g.deps.map(d => `\`${d}\``).join(', ') : '—';
    return `| \`${g.name}\` | \`${g.type}\` | ${deps} | \`${g.filePath}\` |`;
  });
  return header + '\n' + rows.join('\n') + '\n';
}

function generateUtilsTable(items) {
  if (items.length === 0) return '_Sin utilidades auto-detectadas aún._\n';
  const header = '| Archivo | Exports |\n|---------|---------|';
  const rows = items.map(u => {
    const exps = u.exports.map(e => `\`${e}\``).join(', ');
    return `| \`${u.filePath}\` | ${exps} |`;
  });
  return header + '\n' + rows.join('\n') + '\n';
}

function generateStylesContent(data) {
  const lines = [];

  // ── Top 25 tokens by usage ────────────────────────────────────────────────
  // Build a flat map name → value for quick lookup
  const tokenValueMap = new Map();
  for (const tokens of data.tokensBySection.values()) {
    for (const t of tokens) tokenValueMap.set(t.name, t.value);
  }

  const topTokens = Object.entries(data.tokenUsage)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25);

  if (topTokens.length > 0) {
    lines.push('## Tokens canónicos — top 25 por frecuencia de uso real\n');
    lines.push('| Token | Usos | Valor |');
    lines.push('|-------|------|-------|');
    for (const [token, count] of topTokens) {
      const val = tokenValueMap.get(token) ?? '—';
      const display = val.length > 60 ? val.slice(0, 57) + '…' : val;
      lines.push(`| \`${token}\` | ${count} | \`${display}\` |`);
    }
    lines.push('');
  }

  // ── Semantic classes with usage ───────────────────────────────────────────
  const semanticWithUsage = data.semanticClasses
    .map(c => ({ ...c, usage: data.classUsage[c.name.replace(/^\./, '')] ?? 0 }))
    .sort((a, b) => b.usage - a.usage);

  if (semanticWithUsage.length > 0) {
    lines.push('## Clases semánticas del Design System\n');
    lines.push('| Clase | Usos en templates | Archivo |');
    lines.push('|-------|------------------|---------|');
    for (const cls of semanticWithUsage) {
      lines.push(`| \`${cls.name}\` | ${cls.usage || '—'} | \`${cls.file}\` |`);
    }
    lines.push('');
  }

  // ── Bento grid cells ──────────────────────────────────────────────────────
  if (data.bentoClasses.length > 0) {
    lines.push('## Bento Grid — Clases de celda disponibles\n');
    lines.push('| Clase CSS | Proporción |');
    lines.push('|-----------|-----------|');
    const descriptions = {
      'bento-grid':    'Contenedor raíz (con [appBentoGridLayout])',
      'bento-hero':    '100% ancho — para app-section-hero',
      'bento-banner':  '100% ancho — para tablas y listados',
      'bento-wide':    '2/3 ancho',
      'bento-square':  '1/3 ancho (cuadrado)',
      'bento-tall':    '1/3 ancho × 2 filas',
      'bento-feature': '2/3 ancho × 2 filas',
      'bento-media':   'Celda de media (imagen/video)',
      'bento-card':    'Alias visual de celda con card',
    };
    for (const cls of data.bentoClasses) {
      lines.push(`| \`.${cls}\` | ${descriptions[cls] ?? '—'} |`);
    }
    lines.push('');
  }

  // ── PrimeNG override coverage ─────────────────────────────────────────────
  const primeEntries = [...data.primengGroups.entries()]
    .filter(([base]) => base.length > 1)
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (primeEntries.length > 0) {
    lines.push('## PrimeNG — Componentes con override en _primeng-overrides.scss\n');
    lines.push('| Componente | Selectores |');
    lines.push('|-----------|-----------|');
    for (const [base, selectors] of primeEntries) {
      const selList = [...selectors].sort().slice(0, 5).map(s => `\`${s}\``).join(' · ');
      const extra   = selectors.size > 5 ? ` +${selectors.size - 5}` : '';
      lines.push(`| **${base}** | ${selList}${extra} |`);
    }
    lines.push('');
  }

  // ── Typography drift ──────────────────────────────────────────────────────
  lines.push('## Tipografía — drift de utilidades\n');
  lines.push('> Conteo crudo de utilidades de tipografía en templates. **No es deuda directa:** el peso de fuente (`font-bold/semibold`) es legítimo en botones, headers y títulos, y no tiene una clase semántica que lo reemplace. La señal accionable son los _clusters repetidos_ (abajo).\n');
  lines.push('| Categoría | Usos | Interpretación |');
  lines.push('|-----------|------|----------------|');
  lines.push(`| Tamaño display (\`text-4xl/3xl/2xl\`) | ${data.typoSize} | Candidatas a \`.kpi-value\` o heading semántico |`);
  lines.push(`| Peso de fuente (\`font-bold/semibold\`) | ${data.typoWeight} | Informativo — legítimo en botones/headers/títulos |`);
  lines.push('');

  const typoClusters = [...data.typoClusters.entries()]
    .map(([, v]) => v)
    .filter(c => c.count >= 5)
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  if (typoClusters.length > 0) {
    lines.push('### Clusters repetidos (candidatos a clase semántica)\n');
    lines.push('Combinaciones idénticas de utilidades (que incluyen tipografía) repetidas ≥5 veces → promover a una clase del DS:\n');
    lines.push('| Repeticiones | Cluster |');
    lines.push('|--------------|---------|');
    for (const c of typoClusters) {
      lines.push(`| ${c.count} | \`${c.sample}\` |`);
    }
    lines.push('');
  }

  return lines.join('\n') + '\n';
}

function generateUsageMapContent(usageData) {
  const lines = [];

  // ── Componentes shared → Consumidores
  const compEntries = Object.entries(usageData.componentUsage).sort((a, b) => a[0].localeCompare(b[0]));
  if (compEntries.length > 0) {
    lines.push('## Componentes shared → Consumidores\n');
    lines.push('| Componente | Usado en |');
    lines.push('|------------|----------|');
    for (const [sel, consumers] of compEntries) {
      lines.push(`| \`${sel}\` | ${consumers.map(c => `\`${c}\``).join(', ')} |`);
    }
    lines.push('');
  }

  // ── Directivas → Consumidores
  const dirEntries = Object.entries(usageData.directiveUsage ?? {}).sort((a, b) => a[0].localeCompare(b[0]));
  if (dirEntries.length > 0) {
    lines.push('## Directivas → Consumidores\n');
    lines.push('| Directiva | Usada en |');
    lines.push('|-----------|---------|');
    for (const [sel, consumers] of dirEntries) {
      lines.push(`| \`${sel}\` | ${consumers.map(c => `\`${c}\``).join(', ')} |`);
    }
    lines.push('');
  }

  // ── Facades → Consumidores
  const facEntries = Object.entries(usageData.facadeUsage).sort((a, b) => a[0].localeCompare(b[0]));
  if (facEntries.length > 0) {
    lines.push('## Facades → Consumidores\n');
    lines.push('| Facade | Inyectada en |');
    lines.push('|--------|-------------|');
    for (const [name, consumers] of facEntries) {
      lines.push(`| \`${name}\` | ${consumers.map(c => `\`${c}\``).join(', ')} |`);
    }
    lines.push('');
  }

  // ── Services → Consumidores
  const svcEntries = Object.entries(usageData.serviceUsage).sort((a, b) => a[0].localeCompare(b[0]));
  if (svcEntries.length > 0) {
    lines.push('## Services → Consumidores\n');
    lines.push('| Service | Inyectado en |');
    lines.push('|---------|-------------|');
    for (const [name, consumers] of svcEntries) {
      lines.push(`| \`${name}\` | ${consumers.map(c => `\`${c}\``).join(', ')} |`);
    }
    lines.push('');
  }

  // ── Matriz de patrones por página (solo features/, no layout/)
  if (usageData.pagePatterns.length > 0) {
    lines.push('## Matriz de patrones por página\n');
    lines.push('| Página | Loading | Empty | Error | Skeleton |');
    lines.push('|--------|---------|-------|-------|----------|');
    const sorted = [...usageData.pagePatterns].sort((a, b) => a.page.localeCompare(b.page));
    for (const entry of sorted) {
      const p = entry.patterns;
      const flag = (v) => v ? '✅' : '❌';
      lines.push(`| \`${entry.page}\` | ${flag(p.loading)} | ${flag(p.empty)} | ${flag(p.error)} | ${flag(p.skeleton)} |`);
    }
    lines.push('');
  }

  return lines.length > 0 ? lines.join('\n') + '\n' : '_Sin consumidores detectados aún._\n';
}

// ─── Marker Injection ─────────────────────────────────────────────────────────

const MARKER_BEGIN = '<!-- AUTO-GENERATED:BEGIN -->';
const MARKER_END   = '<!-- AUTO-GENERATED:END -->';

function injectGenerated(filePath, generatedContent) {
  if (!fs.existsSync(filePath)) {
    console.warn(yellow(`  ⚠  No existe: ${path.relative(ROOT, filePath)}`));
    return false;
  }

  const original = fs.readFileSync(filePath, 'utf-8');
  const beginIdx = original.indexOf(MARKER_BEGIN);
  const endIdx   = original.indexOf(MARKER_END);

  if (beginIdx === -1 || endIdx === -1) {
    console.warn(yellow(`  ⚠  Sin marcadores en ${path.basename(filePath)} — agrega los marcadores AUTO-GENERATED`));
    return false;
  }

  const before     = original.slice(0, beginIdx + MARKER_BEGIN.length);
  const after      = original.slice(endIdx);
  const newContent = `${before}\n${generatedContent}\n${after}`;

  if (newContent === original) return false;
  fs.writeFileSync(filePath, newContent, 'utf-8');
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(bold(cyan('🔄  indices:sync — Auto-indexer (AST Mode + Incremental Cache) v7.0\n')));

  if (!fs.existsSync(INDICES_DIR)) {
    console.error(`\x1b[31mNo se encontró el directorio indices/ en ${ROOT}\x1b[0m`);
    process.exit(1);
  }

  // Load mtime cache and previous results from last run
  const cacheData = loadCache();
  const cache = cacheData.mtimes ?? {};
  const prev  = cacheData.results ?? {};

  // Invalidate cache if this script itself changed
  const selfPath = new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  const selfMtime = fs.statSync(selfPath).mtimeMs;
  if (cacheData.scriptMtime && cacheData.scriptMtime !== selfMtime) {
    console.log(dim('  Cache invalidado (script modificado)\n'));
    Object.keys(cache).forEach(k => delete cache[k]);
  }

  const changes = [];

  // ── COMPONENTS.md ──────────────────────────────────────────────────────────
  process.stdout.write(dim('  Escaneando shared/components/**/*.component.ts...'));
  const components  = collectComponents(cache, prev.components);
  const compChanged = injectGenerated(
    path.join(INDICES_DIR, 'COMPONENTS.md'),
    generateComponentsTable(components),
  );
  process.stdout.write('\r');
  console.log(compChanged
    ? green(`  ✓ COMPONENTS.md actualizado (${components.length} componentes detectados)`)
    : dim(`  — COMPONENTS.md sin cambios    (${components.length} componentes detectados)`),
  );
  if (compChanged) changes.push('COMPONENTS.md');

  // ── SERVICES.md ────────────────────────────────────────────────────────────
  process.stdout.write(dim('  Escaneando core/services/**/*.service.ts...'));
  const services  = collectServices(cache, prev.services);
  const svcChanged = injectGenerated(
    path.join(INDICES_DIR, 'SERVICES.md'),
    generateServicesTable(services),
  );
  process.stdout.write('\r');
  console.log(svcChanged
    ? green(`  ✓ SERVICES.md actualizado (${services.length} servicios detectados)`)
    : dim(`  — SERVICES.md sin cambios    (${services.length} servicios detectados)`),
  );
  if (svcChanged) changes.push('SERVICES.md');

  // ── FACADES.md ─────────────────────────────────────────────────────────────
  process.stdout.write(dim('  Escaneando core/**/*.facade.ts...'));
  const facades  = collectFacades(cache, prev.facades);
  const facChanged = injectGenerated(
    path.join(INDICES_DIR, 'FACADES.md'),
    generateFacadesTable(facades),
  );
  process.stdout.write('\r');
  console.log(facChanged
    ? green(`  ✓ FACADES.md actualizado (${facades.length} facades detectadas)`)
    : dim(`  — FACADES.md sin cambios    (${facades.length} facades detectadas)`),
  );
  if (facChanged) changes.push('FACADES.md');

  // ── MODELS.md ──────────────────────────────────────────────────────────────
  process.stdout.write(dim('  Escaneando core/models/**/*.model.ts...'));
  const models  = collectModels(cache, prev.models);
  const modChanged = injectGenerated(
    path.join(INDICES_DIR, 'MODELS.md'),
    generateModelsTable(models),
  );
  process.stdout.write('\r');
  console.log(modChanged
    ? green(`  ✓ MODELS.md actualizado (${models.length} modelos detectados)`)
    : dim(`  — MODELS.md sin cambios    (${models.length} modelos detectados)`),
  );
  if (modChanged) changes.push('MODELS.md');

  // ── DIRECTIVES.md ──────────────────────────────────────────────────────────
  process.stdout.write(dim('  Escaneando core/directives/**/*.directive.ts...'));
  const directives  = collectDirectives(cache, prev.directives);
  const dirChanged = injectGenerated(
    path.join(INDICES_DIR, 'DIRECTIVES.md'),
    generateDirectivesAutoTable(directives),
  );
  process.stdout.write('\r');
  console.log(dirChanged
    ? green(`  ✓ DIRECTIVES.md actualizado (${directives.length} directivas detectadas)`)
    : dim(`  — DIRECTIVES.md sin cambios    (${directives.length} directivas detectadas)`),
  );
  if (dirChanged) changes.push('DIRECTIVES.md');

  // ── GUARDS.md ──────────────────────────────────────────────────────────────
  process.stdout.write(dim('  Escaneando core/guards/**/*.guard.ts...'));
  const guards  = collectGuards(cache, prev.guards);
  const guardChanged = injectGenerated(
    path.join(INDICES_DIR, 'GUARDS.md'),
    generateGuardsTable(guards),
  );
  process.stdout.write('\r');
  console.log(guardChanged
    ? green(`  ✓ GUARDS.md actualizado (${guards.length} guards detectados)`)
    : dim(`  — GUARDS.md sin cambios    (${guards.length} guards detectados)`),
  );
  if (guardChanged) changes.push('GUARDS.md');

  // ── UTILS.md ───────────────────────────────────────────────────────────────
  process.stdout.write(dim('  Escaneando core/utils/**/*.ts...'));
  const utils  = collectUtils(cache, prev.utils);
  const utilChanged = injectGenerated(
    path.join(INDICES_DIR, 'UTILS.md'),
    generateUtilsTable(utils),
  );
  process.stdout.write('\r');
  console.log(utilChanged
    ? green(`  ✓ UTILS.md actualizado (${utils.length} utilidades detectadas)`)
    : dim(`  — UTILS.md sin cambios    (${utils.length} utilidades detectadas)`),
  );
  if (utilChanged) changes.push('UTILS.md');

  // ── STYLES.md ──────────────────────────────────────────────────────────────
  process.stdout.write(dim('  Escaneando styles/ + cross-ref en templates...'));
  const styles      = collectStyles();
  const styleChanged = injectGenerated(
    path.join(INDICES_DIR, 'STYLES.md'),
    generateStylesContent(styles),
  );
  process.stdout.write('\r');
  const topTokenCount  = Object.values(styles.tokenUsage).filter(c => c > 0).length;
  const semanticCount  = styles.semanticClasses.length;
  const typoDriftTotal = styles.typoSize + styles.typoWeight;
  console.log(styleChanged
    ? green(`  ✓ STYLES.md actualizado (${topTokenCount} tokens en uso, ${semanticCount} clases semánticas, drift: ${typoDriftTotal} [size ${styles.typoSize} · weight ${styles.typoWeight}])`)
    : dim(`  — STYLES.md sin cambios    (${topTokenCount} tokens en uso, ${semanticCount} clases semánticas, drift: ${typoDriftTotal} [size ${styles.typoSize} · weight ${styles.typoWeight}])`),
  );
  if (styleChanged) changes.push('STYLES.md');

  // ── USAGE-MAP.md ───────────────────────────────────────────────────────────
  process.stdout.write(dim('  Escaneando features/ y layout/ (usage map + directivas)...'));
  const sharedSelectors    = components.map(c => c.selector).filter(Boolean);
  const directiveSelectors = directives.filter(d => d.selector);
  const facadeNames = facades.map(f => f.className);
  const usageMap  = collectUsageMap(cache, prev.usageMap, sharedSelectors, directiveSelectors, facadeNames);
  const usageChanged = injectGenerated(
    path.join(INDICES_DIR, 'USAGE-MAP.md'),
    generateUsageMapContent(usageMap),
  );
  process.stdout.write('\r');
  const pageCount = usageMap.pagePatterns.length;
  const compCount = Object.keys(usageMap.componentUsage).length;
  const dirUsageCount = Object.keys(usageMap.directiveUsage).length;
  console.log(usageChanged
    ? green(`  ✓ USAGE-MAP.md actualizado (${pageCount} páginas, ${compCount} componentes, ${dirUsageCount} directivas mapeadas)`)
    : dim(`  — USAGE-MAP.md sin cambios    (${pageCount} páginas, ${compCount} componentes, ${dirUsageCount} directivas mapeadas)`),
  );
  if (usageChanged) changes.push('USAGE-MAP.md');

  // Persist cache for next run
  saveCache({
    scriptMtime: selfMtime,
    mtimes: cache,
    // styles se excluye a propósito: contiene Maps (se serializan como {} en JSON)
    // y collectStyles hace rescan completo en cada corrida, nunca lee resultados previos.
    results: { components, services, facades, models, directives, guards, utils, usageMap },
  });

  console.log('');
  if (changes.length > 0) {
    console.log(green(`✅  ${changes.length} índice(s) actualizado(s): ${changes.join(', ')}`));
  } else {
    console.log(green('✅  Todos los índices están al día. Sin cambios.'));
  }
}

main().catch(err => {
  console.error(`\x1b[31m${String(err?.message || err)}\x1b[0m`);
  process.exit(1);
});
