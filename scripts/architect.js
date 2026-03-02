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

function reportError(rule, filePath, message, solution) {
    const relativePath = path.relative(process.cwd(), filePath);
    console.error(red, `🚨 [REGLA ${rule}] ${message}`);
    console.error(cyan, `   Archivo: ${relativePath}`);
    if (solution) console.error(yellow, `   Solución: ${solution}`);
    console.error('');
    errors++;
}

function reportWarning(filePath, message) {
    const relativePath = path.relative(process.cwd(), filePath);
    console.warn(yellow, `⚠️  ${message}: ${relativePath}`);
    warnings++;
}

// ─── Análisis TypeScript (AST) ──────────────────────────────────────────────

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
    const isComponent = filePath.endsWith('.component.ts');
    const isViewComponent = isComponent && (isInFeatures || isInShared);

    // ── Regla 1: Sin importación directa de Supabase en la capa UI ──────────
    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement)) {
            const specifier = statement.moduleSpecifier
                .getText(sourceFile)
                .replace(/['"]/g, '');

            // Regla 1: Supabase directo en UI
            if (specifier === '@supabase/supabase-js' && (isInFeatures || isInShared)) {
                reportError(
                    1, filePath,
                    'Importación directa de Supabase en capa UI',
                    'Mueve la lógica de datos a un FacadeService (@Injectable).'
                );
            }

            // Regla 5: @angular/animations prohibido
            if (specifier.startsWith('@angular/animations')) {
                reportError(
                    5, filePath,
                    'Importación de @angular/animations detectada',
                    'Usa GsapAnimationsService para todas las animaciones. GSAP es obligatorio.'
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
                    2, filePath,
                    `Inyección directa de '${argText}' en componente vista`,
                    'Los componentes vista solo deben inyectar clases tipo Facade (*FacadeService).'
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
                    4, filePath,
                    'Componente sin ChangeDetectionStrategy.OnPush',
                    'Agrega changeDetection: ChangeDetectionStrategy.OnPush al decorador @Component.'
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
            8, filePath,
            `Colores Tailwind hardcodeados detectados: ${[...new Set(colorMatches)].join(', ')}`,
            'Usa tokens semánticos: text-primary, text-muted, bg-surface, bg-base, var(--ds-brand).'
        );
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
                6, filePath,
                `Directiva deprecada ${name} detectada en template`,
                `Usa ${replacement} (Angular 17+ control flow).`
            );
        }
    }

    // ── Regla 8: Colores Tailwind hardcodeados en .html ─────────────────────
    const hardcodedColorRe =
        /(?:text|bg|border|ring|from|to|via)-(?:red|blue|green|yellow|purple|pink|orange|teal|cyan|indigo|emerald|rose|amber|lime|sky|violet|fuchsia)-\d{2,3}/g;
    const colorMatches = content.match(hardcodedColorRe);
    if (colorMatches) {
        reportError(
            8, filePath,
            `Colores Tailwind hardcodeados en template: ${[...new Set(colorMatches)].join(', ')}`,
            'Usa tokens semánticos: text-primary, text-muted, bg-surface, bg-base.'
        );
    }
}

// ─── Análisis de Estilos SCSS ───────────────────────────────────────────────

function analyzeStyles(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');

    // ── Regla 7: @keyframes prohibido ───────────────────────────────────────
    if (/@keyframes\s/.test(content)) {
        reportError(
            7, filePath,
            '@keyframes detectado en archivo de estilos',
            'Usa GsapAnimationsService para animaciones. GSAP es obligatorio en este proyecto.'
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
                        3, fullPath,
                        'Falta test unitario para lógica Core',
                        'Escribe el archivo .spec.ts compañero (Agentic TDD obligatorio).'
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
    console.log('   1. Sin @supabase/supabase-js en UI (features/shared)');
    console.log('   2. Sin inject(*Service) directo en componentes vista');
    console.log('   3. TDD: .spec.ts para facades y services en core/');
    console.log('   4. OnPush obligatorio en todos los componentes');
    console.log('   5. Sin @angular/animations (usar GSAP)');
    console.log('   6. Sin *ngIf/*ngFor/[ngClass]/[ngStyle] en templates');
    console.log('   7. Sin @keyframes en SCSS (usar GSAP)');
    console.log('   8. Sin colores Tailwind hardcodeados');
    console.log('');
    process.exit(1);
} else {
    console.log(green, `✅ Auditoría completada: ${errors} errores, ${warnings} advertencias.`);
    console.log(green, '   El proyecto cumple con todas las reglas arquitectónicas.');
}
