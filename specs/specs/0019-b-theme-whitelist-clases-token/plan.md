# Plan 0019-b — Whitelist de clases token derivada del @theme

> **Status:** approved
> **Approved by:** Akxlarre ("empecemos entonces, todas menos la 23", 2026-07-01)
> **Modelo ejecutor:** Fable 5

## Diseño

### Módulo compartido `scripts/lib/theme-tokens.js` (nuevo, no protegido)

- `parseThemeTokens(cssPath)` → `{ tokens: Set<string>, vocab: Set<string> }`
  - `tokens`: sufijos de todos los `--color-X` del bloque `@theme` de `src/tailwind.css`
    (35 tokens hoy: brand, surface, text-primary, success-subtle, …).
  - `vocab`: todos los segmentos-hyphen de esos tokens ∪ {`state`, `bg`, `surface`, `divider`}
    (las familias muertas conocidas de AP-011).
- `findDeadTokenClasses(content, theme)` → `[{ cls, suggestion }]`
  - Candidatos: regex `(?<![\w-])(text|bg|border|ring|from|to|via|divide|outline|fill|stroke|accent|caret)-([a-z][a-z-]*)(?![\w-])`.
  - Válido si: sufijo ∈ tokens, o ∈ {transparent, current, inherit, white, black, none, auto}.
  - **Muerto** solo si el primer segmento del sufijo ∈ vocab (acota falsos positivos:
    `text-sm`, `text-center`, `bg-gradient-primary`, `text-editor` quedan fuera porque su
    vocabulario no es del DS).
  - Sugerencia por heurística: prepend del prefijo (`text-primary`→`text-text-primary`),
    strip `bg-`/`state-` duplicado, strip sufijo `-hover/-base/-elevated`.
  - Los modificadores `/N` y variantes `dark:`/`hover:` quedan cubiertos por los boundaries
    de la regex (no requieren manejo especial).

### `scripts/architect.js` (protegido — staging + copia)

- Eliminar la regex hardcodeada de ARCH-11; reemplazar por `findDeadTokenClasses` sobre
  `.ts` y `.html`.
- Rollout AC5: por defecto **warning** por archivo (clases únicas + sugerencias) + contador
  global impreso antes del veredicto final; con `--strict` → **error**.
- El set del @theme se parsea una vez al inicio (costo despreciable).

### `scripts/lint-arch-wrapper.js` (no protegido)

- Reenviar `process.argv.slice(2)` al hijo para que `npm run lint:arch -- --strict` funcione.

## Verificación

1. Unit-check del módulo vía `node -e`: los 4 patrones de la lista negra vieja
   (`bg-bg-base`, `text-state-error`, `bg-surface-hover`, `border-divider`) → muertos (AC4);
   `text-primary/secondary/muted` → muertos con sugerencia (AC2);
   `text-text-primary`, `bg-surface/50`, `dark:text-text-muted`, `text-sm`, `text-center`,
   `bg-gradient-primary`, `from-brand` → válidos/ignorados (AC1/AC3/AC-E1/AC-E2).
2. `lint:arch` default: ARCH-11 desaparece de errores (5→0) y aparece el resumen del backlog.
3. `lint:arch -- --strict`: los muertos cuentan como error.
4. AC-E3 ([class.x]) cubierto porque se escanea el contenido completo del archivo.
