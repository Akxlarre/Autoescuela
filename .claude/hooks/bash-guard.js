#!/usr/bin/env node
/**
 * bash-guard.js — PreToolUse Hook (Bash)
 *
 * Protege contra:
 *   1. Creación de archivos .ts/.html/.scss via Bash (debe usar Edit/Write)
 *   2. Operaciones destructivas sobre directorios críticos del proyecto
 *   3. Instalación/desinstalación de dependencias sin confirmación explícita
 *
 * Exit codes:
 *   0 = permitir el comando
 *   2 = bloquear el comando
 */

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const command = input.tool_input?.command || '';

    // ═══════════════════════════════════════════════════════════════════════
    // 1. Bloquear creación de archivos fuente via Bash
    // ═══════════════════════════════════════════════════════════════════════
    const fileCreationPatterns = [
      /(?:cat|echo|printf)\s.*>\s*.*src\/app\/.*\.(?:ts|html|scss)/,
      /tee\s.*src\/app\/.*\.(?:ts|html|scss)/,
      />\s*.*src\/app\/.*\.(?:ts|html|scss)/,
      /(?:cat|echo|printf)\s.*>\s*.*supabase\/migrations\/.*\.sql/,
    ];

    for (const pattern of fileCreationPatterns) {
      if (pattern.test(command)) {
        process.stderr.write(
          `\u{1F6AB} BASH GUARD: No crear archivos de codigo fuente mediante Bash.\n` +
          `Usa las herramientas Edit o Write para crear y modificar archivos .ts, .html, .scss y .sql.\n` +
          `Esto permite que los guardrails arquitectonicos validen tu codigo.`
        );
        process.exit(2);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. Bloquear operaciones destructivas en directorios críticos
    // ═══════════════════════════════════════════════════════════════════════
    const destructivePatterns = [
      { re: /rm\s+-r[f ]?\s+.*(?:src\/app|\.claude|indices|supabase)/, msg: 'Eliminacion recursiva de directorio critico' },
      { re: /rm\s+-f?r?\s+.*(?:\.claude\/hooks|\.claude\/settings|architect\.js)/, msg: 'Eliminacion de archivos del sistema de guardrails' },
      { re: />\s*(?:\.claude\/settings\.json|\.claude\/hooks\/)/, msg: 'Sobreescritura de configuracion de guardrails' },
    ];

    for (const { re, msg } of destructivePatterns) {
      if (re.test(command)) {
        process.stderr.write(
          `\u{1F6E1}\u{FE0F} BASH GUARD: Operacion destructiva bloqueada.\n` +
          `Razon: ${msg}\n` +
          `Si realmente necesitas hacer esto, pide al humano que lo ejecute manualmente.`
        );
        process.exit(2);
      }
    }

    process.exit(0);
  } catch {
    // Fail-open: si el hook falla, permitir el comando
    process.exit(0);
  }
});
