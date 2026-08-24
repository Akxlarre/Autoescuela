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
      // Anclado (ASG-b-098): `tee` no usa redirect, pero su `.*` cruzaba separadores de
      // comando igual — un tee a un log seguido de leer un componente se bloqueaba.
      /tee\s[^;|&]*src\/app\/[^;|&]*\.(?:ts|html|scss)/,
      // El `.*` NO puede cruzar separadores de comando (; | &), y los redirects de
      // diagnostico (2>&1, /dev/null) no cuentan como escritura de archivo. Antes,
      // CUALQUIER comando read-only que usara un redirect y mencionara mas adelante
      // una ruta de fuente quedaba bloqueado. Ver ASG-b-097.
      /(?<![0-9&])>>?\s*(?!\/dev\/null)[^;|&]*src\/app\/[^;|&]*\.(?:ts|html|scss)/,
      // Espeja al patrón de src/app (ASG-b-098): agnóstico del verbo, no cruza separadores
      // y no confunde 2>&1 ni /dev/null con una escritura.
      /(?<![0-9&])>>?\s*(?!\/dev\/null)[^;|&]*supabase\/migrations\/[^;|&]*\.sql/,
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

    // ═══════════════════════════════════════════════════════════════════════
    // 3. SUPPLY CHAIN & EXECUTION GUARD (Ciberseguridad)
    // ═══════════════════════════════════════════════════════════════════════
    const securityPatterns = [
      { re: /npm\s+(?:install|i|uninstall|rm)\s+[^-\s]+/, msg: 'Mutacion de dependencias (paquetes). Pide al humano que apruebe e instale paquetes por motivos de seguridad de la cadena de suministro.' },
      { re: /(?:curl|wget)\s+/, msg: 'Ejecucion de comandos de red (curl/wget). Descargas arbitrarias bloqueadas por seguridad.' },
      { re: /node\s+-e\s+.*(?:http|https)/, msg: 'Ejecucion de red inline con Node.js' }
    ];

    for (const { re, msg } of securityPatterns) {
      if (re.test(command)) {
        process.stderr.write(
          `\u{1F6A8} BASH GUARD (CYBERSECURITY): Operacion bloqueada por seguridad.\n` +
          `Razon: ${msg}\n` +
          `Las politicas de Agentic Security impiden la instalacion de paquetes no verificados o descargas directas.\n` +
          `Si esto es requerido, pide al humano que lo ejecute en su terminal.`
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
