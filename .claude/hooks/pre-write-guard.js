#!/usr/bin/env node
/**
 * pre-write-guard.js — PreToolUse Hook (Edit|Write|MultiEdit)
 *
 * Sistema de guardrails que se ejecuta ANTES de cada escritura de archivo.
 * Cuatro capas de protección:
 *
 *   1. FILE PROTECTION    — Bloquea edits a archivos críticos del sistema de hooks
 *   2. DISCOVERY GATE     — Obliga a leer los índices antes de escribir código fuente
 *   3. ARCHITECT GUARD    — Validación rápida de reglas arquitectónicas en el contenido nuevo
 *   4. CONTEXT INJECTION  — Inyecta rules y skills relevantes según el tipo de archivo
 *
 * Exit codes:
 *   0 = permitir la operación (opcionalmente con additionalContext via JSON stdout)
 *   2 = bloquear la operación (stderr se envía a Claude como feedback)
 *
 * Salida JSON (cuando se permite):
 *   { hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: "..." } }
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path || input.tool_input?.path || '';
    const newContent = input.tool_input?.new_string || input.tool_input?.content || '';
    const toolName = input.tool_name || '';
    const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
    const normalizedPath = filePath.replace(/\\/g, '/');

    // ═══════════════════════════════════════════════════════════════════════
    // 1. FILE PROTECTION — Archivos del sistema de guardrails
    // ═══════════════════════════════════════════════════════════════════════
    const protectedPatterns = [
      '.claude/hooks/',
      '.claude/settings.json',
      '.claude/settings.local.json',
      'scripts/architect.js',
    ];

    for (const pattern of protectedPatterns) {
      if (normalizedPath.includes(pattern)) {
        process.stderr.write(
          `\u{1F6E1}\u{FE0F} FILE PROTECTOR: ${path.basename(filePath)} es parte del sistema de guardrails.\n` +
          `No se permite modificar archivos en: ${pattern}\n` +
          `Si necesitas cambiar la configuracion de hooks, pide al humano que lo haga manualmente.`
        );
        process.exit(2);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. DISCOVERY GATE — Leer índices antes de escribir código fuente
    // ═══════════════════════════════════════════════════════════════════════
    const isSourceCode =
      (normalizedPath.includes('src/app/') && !normalizedPath.endsWith('.spec.ts')) ||
      normalizedPath.includes('supabase/migrations/');

    if (isSourceCode) {
      const flagPath = path.join(os.tmpdir(), `koa-discovery-${sessionId}.flag`);
      if (!fs.existsSync(flagPath)) {
        process.stderr.write(
          `\u{1F50D} DISCOVERY GATE: Debes leer los indices del proyecto ANTES de escribir codigo.\n` +
          `Lee al menos uno de estos archivos primero:\n` +
          `  - indices/COMPONENTS.md\n` +
          `  - indices/SERVICES.md\n` +
          `  - indices/DATABASE.md\n` +
          `  - indices/DIRECTIVES.md\n` +
          `  - indices/STYLES.md\n` +
          `  - indices/PIPES.md\n` +
          `Esto te ayudara a reutilizar lo que ya existe y no duplicar trabajo.\n` +
          `El bloqueo se levantara automaticamente cuando leas cualquier archivo de indices/.`
        );
        process.exit(2);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. ARCHITECT GUARD — Validación rápida de reglas en contenido nuevo
    // ═══════════════════════════════════════════════════════════════════════

    const violations = [];

    // --- TypeScript / HTML checks (solo en src/app/) ---
    if (normalizedPath.includes('src/app/') && (normalizedPath.endsWith('.ts') || normalizedPath.endsWith('.html'))) {

      // Directivas Angular deprecadas
      if (newContent.includes('*ngIf'))
        violations.push('Usa @if {} en vez de *ngIf (Angular 17+ control flow)');
      if (newContent.includes('*ngFor'))
        violations.push('Usa @for {} en vez de *ngFor (Angular 17+ control flow)');
      if (/\[ngClass\]/.test(newContent))
        violations.push('Usa [class.nombre]="expr" en vez de [ngClass]');
      if (/\[ngStyle\]/.test(newContent))
        violations.push('Usa [style.prop]="expr" en vez de [ngStyle]');

      // Decoradores deprecados
      if (/@Input\s*\(/.test(newContent))
        violations.push('Usa input() signal en vez de @Input() decorator');
      if (/@Output\s*\(/.test(newContent))
        violations.push('Usa output() signal en vez de @Output() decorator');

      // Import directo de Supabase en capa UI
      if (
        (normalizedPath.includes('features/') || normalizedPath.includes('shared/')) &&
        newContent.includes('@supabase/supabase-js')
      )
        violations.push('No importar @supabase/supabase-js en la capa UI. Usa un FacadeService.');

      // @angular/animations prohibido
      if (newContent.includes('@angular/animations'))
        violations.push('No usar @angular/animations. Usa GsapAnimationsService (GSAP).');

      // OnPush check — solo para Write (archivo completo) en .component.ts
      if (
        toolName === 'Write' &&
        normalizedPath.endsWith('.component.ts') &&
        newContent.includes('@Component') &&
        !newContent.includes('OnPush')
      )
        violations.push(
          'Falta changeDetection: ChangeDetectionStrategy.OnPush en el componente.\n' +
          '     Importa { ChangeDetectionStrategy } de @angular/core.'
        );

      // Colores Tailwind hardcodeados
      const hardcodedColorRe =
        /(?:text|bg|border|ring|from|to|via)-(?:red|blue|green|yellow|purple|pink|orange|teal|cyan|indigo|emerald|rose|amber|lime|sky|violet|fuchsia)-\d{2,3}/;
      if (hardcodedColorRe.test(newContent))
        violations.push(
          'No usar colores Tailwind hardcodeados (ej: text-red-500, bg-blue-200).\n' +
          '     Usa tokens semanticos: text-primary, text-muted, bg-surface, bg-base, var(--ds-brand).'
        );

      // Dumb component con inject de Facade (shared/ no debe tener Facades)
      if (normalizedPath.includes('shared/') && normalizedPath.endsWith('.component.ts')) {
        if (/inject\s*\(\s*\w*Facade/.test(newContent))
          violations.push(
            'Componentes en shared/ son Dumb: no deben inyectar Facades.\n' +
            '     Solo usan input() y output(). Mueve la logica a un Smart component en features/.'
          );
      }
    }

    // --- SCSS / CSS checks (solo en src/) ---
    if (normalizedPath.includes('src/') && (normalizedPath.endsWith('.scss') || normalizedPath.endsWith('.css'))) {
      // @keyframes: BLOQUEADO en estilos de componente (src/app/).
      // PERMITIDO en archivos del design system global (src/styles/) para loops de estado continuo
      // como .indicator-live y .badge-pulse. Esos @keyframes ya viven en _variables.scss.
      const isComponentStyle = normalizedPath.includes('src/app/');
      if (isComponentStyle && /@keyframes\s/.test(newContent))
        violations.push(
          'No usar @keyframes en estilos de componente.\n' +
          '     Para animaciones de entrada: GsapAnimationsService (animateBentoGrid, animateHero, animateCounter).\n' +
          '     Para loops de estado continuo (pulso, spin): usar .indicator-live o .badge-pulse del design system.'
        );

      const hardcodedColorRe =
        /(?:text|bg|border|ring)-(?:red|blue|green|yellow|purple|pink|orange|teal|cyan|indigo|emerald|rose|amber|lime|sky|violet|fuchsia)-\d{2,3}/;
      if (hardcodedColorRe.test(newContent))
        violations.push('No usar colores Tailwind hardcodeados en SCSS. Usa var(--ds-*) tokens.');
    }

    // --- SQL migration checks ---
    if (normalizedPath.includes('supabase/migrations/')) {
      const fileName = path.basename(filePath);

      // Validar naming convention
      if (toolName === 'Write' && !/^\d{14}_\w+\.sql$/.test(fileName))
        violations.push(
          'Nombre de migracion invalido. Formato: YYYYMMDDHHMMSS_dominio_tipo_descripcion.sql\n' +
          '     Ejemplo: 20250301120000_auth_create_profiles.sql'
        );

      // Verificar que CREATE TABLE incluya RLS
      if (/CREATE\s+TABLE/i.test(newContent) && !/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(newContent))
        violations.push(
          'Toda tabla nueva DEBE tener RLS activado.\n' +
          '     Agrega: ALTER TABLE nombre ENABLE ROW LEVEL SECURITY;'
        );
    }

    // --- Reportar violaciones ---
    if (violations.length > 0) {
      process.stderr.write(
        `\u{1F6A8} ARCHITECT GUARD: Violaciones detectadas en ${path.basename(filePath)}:\n` +
        violations.map(v => `  \u274C ${v}`).join('\n') +
        `\nCorrige el codigo antes de escribirlo.`
      );
      process.exit(2);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 4. CONTEXT INJECTION — Inyectar rules y skills relevantes
    // ═══════════════════════════════════════════════════════════════════════
    // Si todas las validaciones pasaron, inyectar contexto relevante
    // para que Claude tenga las reglas presentes al escribir.

    const contextParts = [];

    // --- Componentes Angular (features/ o shared/) ---
    if (normalizedPath.endsWith('.component.ts')) {
      if (normalizedPath.includes('features/')) {
        contextParts.push(
          '[REGLA architecture.md] Este es un SMART component (features/).',
          '  - Puede inyectar FacadeServices.',
          '  - Coordina Dumb components de shared/ pasando signals.',
          '  - OnPush obligatorio. Signals para estado, no BehaviorSubject.',
          '[REGLA visual-system.md] Prioridad UI: 1) indices/COMPONENTS.md 2) PrimeNG 3) Custom.',
          '  - Colores: solo tokens (text-primary, bg-surface, var(--ds-brand)).',
          '  - Regla 3-2-1: max 3 elementos con var(--ds-brand) por viewport (2 interactivos, 1 decorativo).',
          '  - Layout: usar .bento-grid con clases de proporcion. Solo 1 .card-accent por seccion.',
          '  - KPIs: usar <app-kpi-card> (ya existe en shared/). No recrear composicion KPI manualmente.',
          '  - Iconos: <app-icon name="kebab-case" [size]="20" /> SIEMPRE. PROHIBIDO emojis en UI.',
          '  - Animaciones: GsapAnimationsService en ngAfterViewInit. No @angular/animations.',
          '[SKILL angular-component] Usa input(), output(), @if/@for, host bindings, ChangeDetectionStrategy.OnPush.',
          '[SKILL design-system] Consulta indices/STYLES.md para tokens disponibles.',
          '[SKILL angular-signals] signal() para estado UI, computed() para derivados, effect() para side-effects.'
        );
      }
      if (normalizedPath.includes('shared/')) {
        contextParts.push(
          '[REGLA architecture.md] Este es un DUMB component (shared/).',
          '  - Solo input() y output(). SIN inyeccion de Facades ni Services.',
          '  - Si recibe data async, debe tener un skeleton colocated: {nombre}-skeleton.component.ts al lado.',
          '[REGLA visual-system.md] Colores: solo tokens semanticos. No hardcodear.',
          '  - Cards: .card (base), .card-accent (1 por seccion), .card-tinted (KPIs).',
          '  - Radios: var(--radius-lg) minimo en cards, var(--radius-full) en botones.',
          '  - Iconos: <app-icon name="kebab-case" /> (shared/components/icon). PROHIBIDO emojis ni SVG inline.',
          '  - KPIs: .kpi-value para el numero principal, .kpi-label para la etiqueta. NUNCA text-4xl plano.',
          '  - Superficies: .surface-hero (banners/hero), .surface-glass (overlays flotantes).',
          '  - Indicadores: .indicator-live (sistema activo/online), .badge-pulse (nuevos items/alertas).',
          '[SKILL angular-component] Usa input(), output(), host bindings. No decoradores legacy.',
          '[SKILL design-system] Checklist: OnPush, var(--*) colores, GSAP entrada, dark/light mode.'
        );
      }
      if (normalizedPath.includes('layout/')) {
        contextParts.push(
          '[REGLA architecture.md] Este es un componente de LAYOUT (shell de la app).',
          '  - Puede inyectar services de core/ directamente (LayoutService, ThemeService, etc.).',
          '[REGLA visual-system.md] Dark mode: ThemeService con [data-mode="dark"]. PrimeNG: darkModeSelector ".fake-dark-mode".'
        );
      }
    }

    // --- Services y Facades ---
    if (normalizedPath.includes('core/services/') && normalizedPath.endsWith('.ts') && !normalizedPath.endsWith('.spec.ts')) {
      if (normalizedPath.includes('.facade.')) {
        contextParts.push(
          '[REGLA architecture.md] Este es un FACADE.',
          '  - Media entre UI (features/) y APIs de datos (SupabaseService/HttpClient).',
          '  - Expone estado al template con toSignal().',
          '  - Captura errores con catchError y expone signal de error.',
          '  - DEBE tener .spec.ts companero (Agentic TDD).',
          '[SKILL angular-signals] Usa signal() para estado, computed() para derivados, toSignal() para RxJS->template.'
        );
      } else if (normalizedPath.includes('.service.')) {
        contextParts.push(
          '[REGLA architecture.md] Este es un CORE SERVICE.',
          '  - La UI NUNCA lo inyecta directamente (solo via Facades).',
          '  - Usa RxJS para flujos async internos.',
          '  - DEBE tener .spec.ts companero (Agentic TDD).',
          '[SKILL angular-signals] En services usar RxJS internamente. toSignal() solo en Facades.'
        );
      }
    }

    // --- Migraciones SQL ---
    if (normalizedPath.includes('supabase/migrations/')) {
      contextParts.push(
        '[REGLA database.md] Migracion SQL detectada.',
        '  - Naming: YYYYMMDDHHMMSS_dominio_tipo_descripcion.sql',
        '  - Scripts idempotentes: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.',
        '  - SIEMPRE activar RLS: ALTER TABLE x ENABLE ROW LEVEL SECURITY;',
        '  - Documentar tabla en indices/DATABASE.md con columnas clave y policies.',
        '[SKILL supabase-data-model] Checklist RLS: policies SELECT, INSERT (WITH CHECK), UPDATE, DELETE.',
        '  - Realtime: RxJS Observable -> toSignal() en Facade. Cancelar en ngOnDestroy.'
      );
    }

    // --- Templates HTML ---
    if (normalizedPath.includes('src/app/') && normalizedPath.endsWith('.html')) {
      contextParts.push(
        '[REGLA architecture.md] Template Angular: usa @if/@for/@switch, no *ngIf/*ngFor.',
        '  - Bindings: [class.x]="expr", [style.x]="expr". No [ngClass]/[ngStyle].',
        '[REGLA visual-system.md] Colores: text-primary, text-muted, bg-surface, bg-base. No Tailwind hardcodeado.',
        '  - Bento Grid: .bento-grid + [appBentoGridLayout]. Hijos: .bento-square/.bento-wide/.bento-tall/.bento-feature/.bento-hero.',
        '  - Iconos: <app-icon name="kebab-case" [size]="16" /> SIEMPRE. PROHIBIDO emojis en la UI.',
        '  - KPIs: <span class="kpi-value">24K</span> + <span class="kpi-label">USUARIOS</span>. No text-4xl plano.',
        '  - Superficies: class="surface-hero" en banners/hero sections. class="surface-glass" en overlays flotantes.',
        '  - Indicadores: class="indicator-live" para estado en tiempo real. class="badge-pulse" en badges de conteo.',
        '[REGLA ai-readability.md] Botones de mutacion: data-llm-action="accion". Inputs criticos: data-llm-description="desc". Nav: data-llm-nav.',
        '[SKILL angular-primeng] Imports standalone: import { Button, Select, Table } no modules. Lazy loading para +1000 registros.'
      );
    }

    // --- Estilos SCSS ---
    if (normalizedPath.includes('src/') && (normalizedPath.endsWith('.scss') || normalizedPath.endsWith('.css'))) {
      contextParts.push(
        '[REGLA visual-system.md] Estilos: usar var(--*) tokens de _variables.scss. No hex hardcodeados.',
        '  - Layouts: .page-centered, .page-narrow, .page-wide (no max-width ad-hoc).',
        '  - Grids: .bento-grid con clases de proporcion (no grids custom).',
        '  - Motion en componentes (src/app/): NO @keyframes. GSAP para entradas, View Transitions para rutas.',
        '  - Loops de estado continuo: usar .indicator-live o .badge-pulse — ya tienen @keyframes en el design system.',
        '  - Clases semanticas disponibles: .kpi-value, .kpi-label, .surface-hero, .surface-glass, .indicator-live, .badge-pulse.',
        '  - PrimeNG overrides: ya estan en _primeng-overrides.scss. No sobrescribir en componentes.',
        '[SKILL design-system] Consulta indices/STYLES.md para la lista completa de tokens y layout helpers.'
      );
    }

    // --- Directivas ---
    if (normalizedPath.includes('core/directives/') && normalizedPath.endsWith('.ts')) {
      contextParts.push(
        '[REGLA architecture.md] Directiva en core/directives/.',
        '  - Documentar en indices/DIRECTIVES.md con selector, proposito e inputs.',
        '[SKILL angular-component] Directivas: usar host bindings, inject() para DI, OnPush si es structural.'
      );
    }

    // --- Emitir contexto si hay algo relevante ---
    if (contextParts.length > 0) {
      const context = contextParts.join('\n');
      const output = JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext: context
        }
      });
      process.stdout.write(output);
    }

    process.exit(0);
  } catch (e) {
    // Si el hook falla por error interno, permitir la operación (fail-open)
    process.exit(0);
  }
});
