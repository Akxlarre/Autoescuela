# Plan — Spec 0055-b (contraste del gris muted y de la marca)

> **Status:** approved (decisiones del owner del 2026-10-20 en el chat)

## Cambios

1. **`src/styles/tokens/_variables.scss`**
   - claro: `--text-muted: #6b6b74`; nuevo `--brand-strong: #0369a1`; `--btn-primary-bg:
     var(--brand-strong)`; `--btn-primary-bg-hover: #075985`.
   - oscuro: `--text-muted: #929299`; `--brand-strong: #38bdf8`; `--btn-primary-text: #082f49`.
2. **`src/tailwind.css`**: `--color-brand: var(--brand-strong)`.
3. **SCSS / estilos de componentes** (excluye `_public-enrollment.scss` y `features/public-enrollment/`):
   `color: var(--ds-brand|--color-primary)` y `background(-color): var(--ds-brand|--color-primary)`
   → `var(--brand-strong)`.
4. **PrimeNG**: `.p-paginator-current` con `color: var(--text-secondary)` en los overrides.
5. Verificación: análisis de contraste por par de colores (antes/después), barrido con axe y línea base
   regenerada, capturas en claro y oscuro, `ng build`, `lint:arch`.
