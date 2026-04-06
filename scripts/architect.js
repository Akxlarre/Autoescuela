/**
 * architect.js — Linter Arquitectónico (Guardrails) v2.0
 *
 * Analiza el código fuente usando el AST real de TypeScript en lugar de Regex.
 * Esto elimina falsos positivos por imports comentados, strings, etc.
 *
 * Reglas activas (AST):
 *   1. Ningún archivo en la capa UI puede importar '@supabase/supabase-js' directamente.
 *   2. Ningún *.component.ts en features/ o shared/ puede inyectar un *Service directamente
 *      (solo Facades están permitidos en los componentes vista).
 *   3. Todo *.facade.ts y *.service.ts dentro de core/ debe tener su .spec.ts compañero.
 *   4. Todo *.component.ts debe usar ChangeDetectionStrategy.OnPush.
 *   5. Ningún archivo puede importar desde '@angular/animations'.
 *
 * Reglas activas (Regex sobre templates .html):
 *   6. Prohibido *ngIf, *ngFor, [ngClass], [ngStyle] en templates.
 *
 * Reglas activas (Regex sobre estilos .scss):
 *   7. Prohibido @keyframes en archivos SCSS dentro de src/app/.
 *
 * Regla activa (Regex sobre .ts y .html):
 *   8. Prohibido colores Tailwind hardcodeados (text-red-500, bg-blue-200, etc.).
 *
 * Uso: npm run lint:arch
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

// TypeScript es una dependencia de Angular. Usamos createRequire para importar
// el paquete CJS de TypeScript desde un contexto ESM de forma segura.
const require = createRequire(import.meta.url);
const ts = require('typescript');

// ─── Colores de consola ───────────────────────────────────────────────────────
const red    = '\x1b[31m%s\x1b[0m';
const green  = '\x1b[32m%s\x1b[0m';
const yellow = '\x1b[33m%s\x1b[0m';
const cyan   = '\x1b[36m%s\x1b[0m';

console.log(yellow, '🔍 Iniciando Auditoría Arquitectónica (AST Mode v2.0)...');
console.log('');

// ─── Stack flags (lee blueprint.json para saltar reglas según configuración) ──
let STACK = { angular: true, tailwind: true, primeng: true, gsap: true, supabase: true };
try {
    const blueprintPath = path.join(process.cwd(), 'blueprint.json');
    if (fs.existsSync(blueprintPath)) {
        const bp = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8'));
        if (bp.stack && typeof bp.stack === 'object') {
            STACK = { ...STACK, ...bp.stack };
        }
    }
} catch { /* fail-open: usar defaults */ }

const RULES = {
    'ARCH-01': {
        name: 'No Supabase in UI',
        doc: 'docs/TECH-STACK-RULES.md#arch-01',
        fix: 'Mueve la lógica de datos a un FacadeService (@Injectable).',
    },
    'ARCH-02': {
        name: 'Facade-only injection',
        doc: 'docs/TECH-STACK-RULES.md#arch-02',
        fix: 'Los componentes vista solo deben inyectar clases tipo Facade (*FacadeService).',
    },
    'ARCH-03': {
        name: 'TDD required for core logic',
        doc: 'docs/TECH-STACK-RULES.md#arch-03',
        fix: 'Escribe el archivo .spec.ts compañero (Agentic TDD obligatorio).',
    },
    'ARCH-04': {
        name: 'OnPush required',
        doc: 'docs/TECH-STACK-RULES.md#arch-04',
        fix: 'Agrega changeDetection: ChangeDetectionStrategy.OnPush al decorador @Component.',
    },
    'ARCH-05': {
        name: 'No @angular/animations',
        doc: 'docs/TECH-STACK-RULES.md#arch-05',
        fix: 'Usa GsapAnimationsService para todas las animaciones. GSAP es obligatorio.',
    },
    'ARCH-06': {
        name: 'No legacy template directives',
        doc: 'docs/TECH-STACK-RULES.md#arch-06',
        fix: 'Usa Control Flow nativo (Angular 17+): @if/@for y bindings directos.',
    },
    'ARCH-07': {
        name: 'No @keyframes in app styles',
        doc: 'docs/TECH-STACK-RULES.md#arch-07',
        fix: 'Usa GsapAnimationsService para animaciones. GSAP es obligatorio en este proyecto.',
    },
    'ARCH-08': {
        name: 'No hardcoded Tailwind colors',
        doc: 'docs/TECH-STACK-RULES.md#arch-08',
        fix: 'Usa tokens semánticos: text-primary, text-muted, bg-surface, bg-base, var(--ds-brand).',
    },
    'ARCH-09': {
        name: 'Complexity warning (shared components)',
        doc: 'docs/TECH-STACK-RULES.md#arch-09',
        fix: 'Divide el componente en subcomponentes o extrae lógica a servicios/utilidades. Mantén shared/ simple.',
    },
    'ARCH-10': {
        name: 'Complexity warning (facades)',
        doc: 'docs/TECH-STACK-RULES.md#arch-10',
        fix: 'Extrae lógica a helpers/servicios y reduce inject() y métodos largos. Mantén la Facade como orquestador.',
    },
};

const targetDirs = [
    path.join(process.cwd(), 'src', 'app', 'features'),
    path.join(process.cwd(), 'src', 'app', 'shared'),
    path.join(process.cwd(), 'src', 'app', 'core'),
    path.join(process.cwd(), 'src', 'app', 'layout'),
];

let errors = 0;
let warnings = 0;

// ─── Utilidades ──────────────────────────────────────────────────────────────

/** Comprueba si un segmento de ruta pertenece a un directorio concreto. */
function pathContainsSegment(filePath, segment) {
    return filePath.split(path.sep).includes(segment);
}

/** Recorre un nodo AST y sus descendientes en profundidad. */
function walkAst(node, visitor) {
    visitor(node);
    ts.forEachChild(node, child => walkAst(child, visitor));
}

function reportError(ruleId, filePath, message, solutionOverride) {
    const relativePath = path.relative(process.cwd(), filePath);
    const rule = RULES[ruleId];
    const ruleName = rule?.name ? `${rule.name}: ` : '';
    console.error(red, `🚨 [${ruleId}] ${ruleName}${message}`);
    console.error(cyan, `   Archivo: ${relativePath}`);
    const fix = solutionOverride || rule?.fix;
    if (fix) console.error(yellow, `   Fix: ${fix}`);
    if (rule?.doc) console.error(cyan, `   Doc: ${rule.doc}`);
    console.error('');
    errors++;
}

function reportWarning(ruleId, filePath, message, fixOverride) {
    const relativePath = path.relative(process.cwd(), filePath);
    const rule = RULES[ruleId];
    const ruleName = rule?.name ? `${rule.name}: ` : '';
    console.warn(yellow, `⚠️  [${ruleId}] ${ruleName}${message}`);
    console.warn(cyan, `   Archivo: ${relativePath}`);
    const fix = fixOverride || rule?.fix;
    if (fix) console.warn(yellow, `   Fix: ${fix}`);
    if (rule?.doc) console.warn(cyan, `   Doc: ${rule.doc}`);
    console.warn('');
    warnings++;
}

// ─── Análisis TypeScript (AST) ──────────────────────────────────────────────

function getLineSpan(sourceFile, node) {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
    return { startLine: start + 1, endLine: end + 1, lines: (end - start) + 1 };
}

function analyzeTypeScript(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Parsear con el compilador de TypeScript (AST real)
    const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ true,
    );

    const isInFeatures = pathContainsSegment(filePath, 'features');
    const isInShared = pathContainsSegment(filePath, 'shared');
    const isInCore = pathContainsSegment(filePath, 'core');
    const isFacade = filePath.endsWith('.facade.ts') && isInCore;
    const isComponent = filePath.endsWith('.component.ts');
    const isViewComponent = isComponent && (isInFeatures || isInShared);

    // ── Regla 1: Sin importación directa de Supabase en la capa UI ──────────
    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement)) {
            const specifier = statement.moduleSpecifier
                .getText(sourceFile)
                .replace(/['"]/g, '');

            // Regla 1: Supabase directo en UI (skip si stack.supabase === false)
            if (STACK.supabase && specifier === '@supabase/supabase-js' && (isInFeatures || isInShared)) {
                reportError(
                    'ARCH-01', filePath,
                    'Importación directa de Supabase en capa UI',
                );
            }

            // Regla 5: @angular/animations prohibido (skip si stack.gsap === false)
            if (STACK.gsap && specifier.startsWith('@angular/animations')) {
                reportError(
                    'ARCH-05', filePath,
                    'Importación de @angular/animations detectada',
                );
            }
        }
    }

    // ── Regla 2: Sin inject(*Service) en componentes vista ──────────────────
    // Servicios de infraestructura permitidos en componentes (no son Facades pero
    // son parte del design system y no acceden a datos externos directamente).
    const ALLOWED_SERVICES_IN_COMPONENTS = ['GsapAnimationsService'];

    if (isViewComponent) {
        walkAst(sourceFile, node => {
            if (!ts.isCallExpression(node)) return;

            const callee = node.expression;
            if (!ts.isIdentifier(callee) || callee.text !== 'inject') return;
            if (node.arguments.length === 0) return;

            const argText = node.arguments[0].getText(sourceFile);

            // Dispara si el argumento termina en 'Service' pero NO en 'FacadeService'
            // y no está en la whitelist de servicios de infraestructura permitidos.
            if (
                argText.endsWith('Service') &&
                !argText.endsWith('FacadeService') &&
                !ALLOWED_SERVICES_IN_COMPONENTS.includes(argText)
            ) {
                reportError(
                    'ARCH-02', filePath,
                    `Inyección directa de '${argText}' en componente vista`,
                );
            }
        });
    }

    // ── Regla 4: OnPush obligatorio en todos los componentes ────────────────
    if (isComponent) {
        let hasComponentDecorator = false;
        let hasOnPush = false;

        walkAst(sourceFile, node => {
            // Buscar el decorador @Component
            if (ts.isDecorator(node)) {
                const expr = node.expression;
                if (ts.isCallExpression(expr)) {
                    const callee = expr.expression;
                    if (ts.isIdentifier(callee) && callee.text === 'Component') {
                        hasComponentDecorator = true;
                    }
                }
            }
        });

        if (hasComponentDecorator) {
            // Verificar si OnPush aparece en el archivo (quick check)
            hasOnPush = content.includes('ChangeDetectionStrategy.OnPush') ||
                        content.includes('changeDetection: ChangeDetectionStrategy.OnPush');

            if (!hasOnPush) {
                reportError(
                    'ARCH-04', filePath,
                    'Componente sin ChangeDetectionStrategy.OnPush',
                );
            }
        }
    }

    // ── Regla 8: Colores Tailwind hardcodeados en .ts ───────────────────────
    const hardcodedColorRe =
        /(?:text|bg|border|ring|from|to|via)-(?:red|blue|green|yellow|purple|pink|orange|teal|cyan|indigo|emerald|rose|amber|lime|sky|violet|fuchsia)-\d{2,3}/g;
    const colorMatches = content.match(hardcodedColorRe);
    if (colorMatches) {
        reportError(
            'ARCH-08', filePath,
            `Colores Tailwind hardcodeados detectados: ${[...new Set(colorMatches)].join(', ')}`,
        );
    }

    // ── ARCH-09 (WARNING): shared/**/*.component.ts con clase >200 líneas ────
    if (isComponent && isInShared) {
        walkAst(sourceFile, node => {
            if (!ts.isClassDeclaration(node)) return;
            const span = getLineSpan(sourceFile, node);
            if (span.lines > 200) {
                reportWarning(
                    'ARCH-09',
                    filePath,
                    `Clase demasiado grande (${span.lines} líneas). Límite recomendado: 200.`,
                );
            }
        });
    }

    // ── ARCH-10 (WARNING): facades complejas ────────────────────────────────
    if (isFacade) {
        let injectCalls = 0;
        walkAst(sourceFile, node => {
            if (!ts.isCallExpression(node)) return;
            const callee = node.expression;
            if (ts.isIdentifier(callee) && callee.text === 'inject') injectCalls++;
        });

        if (injectCalls > 5) {
            reportWarning(
                'ARCH-10',
                filePath,
                `Demasiadas llamadas a inject() (${injectCalls}). Límite recomendado: 5.`,
            );
        }

        walkAst(sourceFile, node => {
            if (!ts.isMethodDeclaration(node)) return;
            if (!node.body) return;
            const span = getLineSpan(sourceFile, node);
            if (span.lines > 50) {
                const methodName = node.name?.getText(sourceFile) || '<método>';
                reportWarning(
                    'ARCH-10',
                    filePath,
                    `Método demasiado largo: ${methodName}() (${span.lines} líneas). Límite recomendado: 50.`,
                );
            }
        });
    }
}

// ─── Análisis de Templates HTML ─────────────────────────────────────────────

function analyzeTemplate(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');

    // ── Regla 6: Directivas deprecadas ──────────────────────────────────────
    const deprecatedDirectives = [
        { pattern: /\*ngIf/g, name: '*ngIf', replacement: '@if {}' },
        { pattern: /\*ngFor/g, name: '*ngFor', replacement: '@for {}' },
        { pattern: /\[ngClass\]/g, name: '[ngClass]', replacement: '[class.nombre]="expr"' },
        { pattern: /\[ngStyle\]/g, name: '[ngStyle]', replacement: '[style.prop]="expr"' },
    ];

    for (const { pattern, name, replacement } of deprecatedDirectives) {
        if (pattern.test(content)) {
            reportError(
                'ARCH-06', filePath,
                `Directiva deprecada ${name} detectada en template`,
                `Usa ${replacement}.`
            );
        }
    }

    // ── Regla 8: Colores Tailwind hardcodeados en .html ─────────────────────
    const hardcodedColorRe =
        /(?:text|bg|border|ring|from|to|via)-(?:red|blue|green|yellow|purple|pink|orange|teal|cyan|indigo|emerald|rose|amber|lime|sky|violet|fuchsia)-\d{2,3}/g;
    const colorMatches = content.match(hardcodedColorRe);
    if (colorMatches) {
        reportError(
            'ARCH-08', filePath,
            `Colores Tailwind hardcodeados en template: ${[...new Set(colorMatches)].join(', ')}`,
            'Usa tokens semánticos: text-primary, text-muted, bg-surface, bg-base.'
        );
    }
}

// ─── Análisis de Estilos SCSS ───────────────────────────────────────────────

function analyzeStyles(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');

    // ── Regla 7: @keyframes prohibido (skip si stack.gsap === false) ─────────
    if (STACK.gsap && /@keyframes\s/.test(content)) {
        reportError(
            'ARCH-07', filePath,
            '@keyframes detectado en archivo de estilos',
        );
    }
}

// ─── Recorrido de directorios ─────────────────────────────────────────────────

function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    for (const file of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanDirectory(fullPath);
            continue;
        }

        // TypeScript files (excluir specs del análisis de código)
        if (fullPath.endsWith('.ts') && !fullPath.endsWith('.spec.ts')) {
            analyzeTypeScript(fullPath);

            // ── Regla 3: TDD — Core Services y Facades deben tener .spec.ts ──
            const isCoreLogic =
                pathContainsSegment(fullPath, 'core') &&
                (fullPath.endsWith('.facade.ts') || fullPath.endsWith('.service.ts'));

            if (isCoreLogic) {
                const specPath = fullPath.replace('.ts', '.spec.ts');
                if (!fs.existsSync(specPath)) {
                    reportError(
                        'ARCH-03', fullPath,
                        'Falta test unitario para lógica Core',
                    );
                }
            }
        }

        // HTML templates
        if (fullPath.endsWith('.html')) {
            analyzeTemplate(fullPath);
        }

        // SCSS styles (solo dentro de src/app/)
        if (fullPath.endsWith('.scss') || fullPath.endsWith('.css')) {
            analyzeStyles(fullPath);
        }
    }
}

// ─── Ejecución ────────────────────────────────────────────────────────────────

for (const dir of targetDirs) {
    scanDirectory(dir);
}

console.log('');

if (errors > 0) {
    console.error(red, `❌ Auditoría falló: ${errors} error(es), ${warnings} advertencia(s).`);
    console.error('');
    console.log(yellow, '📋 Reglas validadas:');
    for (const [ruleId, meta] of Object.entries(RULES)) {
        const doc = meta.doc ? ` — ${meta.doc}` : '';
        console.log(`   ${ruleId} — ${meta.name}${doc}`);
    }
    console.log('');
    process.exit(1);
} else {
    console.log(green, `✅ Auditoría completada: ${errors} errores, ${warnings} advertencias.`);
    console.log(green, '   El proyecto cumple con todas las reglas arquitectónicas.');
}
