# Fix: Tokenizar btn-danger-ghost/solid y btn-neutral + opacidad disabled unificada
> id: fix-031-b-tokens-botones-danger-neutral
> refs: —
> status: done
> closed: 2026-07-06
> created: 2026-07-06

## Root Cause
Las utilidades `btn-danger-ghost`, `btn-danger-solid` y `btn-neutral` en `src/tailwind.css`
usan la paleta cruda de Tailwind vía `theme(colors.red.*)` / `theme(colors.gray.*)` /
`theme(colors.white)`. `theme()` se resuelve a valores fijos en build time, por lo que
estos tres botones **no pasan por el sistema de reasignación semántica de tokens** y no
responden al modo oscuro. Caso más visible: `btn-danger-ghost` renderiza un botón blanco
puro (`background: theme(colors.white)`) en dark mode.

Adicionalmente, el estado `:disabled` usa opacidades inconsistentes entre utilidades
(0.7 secondary/ghost/neutral/danger-ghost, 0.5 warning-soft/success-soft/danger-solid,
0.4 outline) sin token que las gobierne.

## ACs Afectados
Ninguno — fix autónomo (deuda del sistema de diseño detectada en auditoría de botones).

- AC-1: `btn-danger-ghost`, `btn-danger-solid` y `btn-neutral` referencian únicamente
  tokens CSS (`var(--…)`) — cero `theme(colors.*)` en `tailwind.css`.
- AC-2: En dark mode los tres botones renderizan con superficies/textos del tema oscuro
  (sin fondo blanco puro) y el texto de `btn-danger-solid` mantiene contraste AA (≥4.5:1).
- AC-3: Todas las utilidades `btn-*` con `:disabled` por opacidad usan
  `var(--btn-disabled-opacity)`. Excepción canónica documentada: `btn-primary`
  (disabled semántico via `bg-subtle` + `text-muted`).

## Cambio
- **Archivo:** `src/styles/tokens/_variables.scss`
- **Qué cambia:** agrega `--state-error-strong(-hover)` (Capa 2, fondo de acción
  destructiva apto para texto blanco en ambos modos) y `--btn-disabled-opacity` (Capa 4).
- **Archivo:** `src/tailwind.css`
- **Qué cambia:** `btn-danger-ghost`, `btn-danger-solid` y `btn-neutral` migran de
  `theme(colors.*)` a tokens semánticos; todas las opacidades `:disabled` pasan a
  `var(--btn-disabled-opacity)`.

## Test de Regresión
Cambio CSS puro sin lógica TS (sin unidad testeable en Vitest). Verificación ejecutada:
- Grep `theme(colors` en `src/tailwind.css` → **0 resultados** ✓ (AC-1)
- `npm run lint:arch` → sin findings en `tailwind.css`/`_variables.scss` (exit 1 solo por
  backlog pre-existente ARCH-02/03/09/11 en componentes, fuera de scope) ✓
- `ng build` → exit 0 ✓
- `/verify` (Playwright, computed styles en localhost:4200) ✓ (AC-2, AC-3):
  - Light: ghost `#ffffff`/`#b91c1c`/`#fecaca` · solid `#dc2626`+blanco · neutral `#e4e4e7`/`#09090b`
  - Dark: ghost `#18181b`/`#f87171` (sin fondo blanco) · solid `#dc2626`+blanco (AA 4.8:1) ·
    neutral `#2d2d30`/`#f4f4f5`
  - `:disabled` → opacity 0.5 en danger-ghost, secondary y outline (token unificado)
  - Capturas: `fix031-verify-light.png` / `fix031-verify-dark.png` (.playwright-mcp)
  - Nota de medición: `--transition-btn` anima bg/color 200ms — medir estilos computados
    DESPUÉS de la transición al togglear `data-mode`.
