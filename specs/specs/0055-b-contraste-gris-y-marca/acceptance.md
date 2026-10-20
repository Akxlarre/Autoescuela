# Acceptance — Spec 0055-b (contraste del gris muted y de la marca)

> **Fecha:** 2026-10-20 · **Resultado:** ✅ PASA

| AC | Evidencia | Estado |
|---|---|---|
| AC1 | `_variables.scss`: `--text-muted` `#6b6b74` (claro, 5,28:1 sobre blanco) y `#929299` (oscuro, 5,73:1 sobre `#18181b`) | ✅ |
| AC2 | Token `--brand-strong` (`#0369a1` / `#38bdf8`). Lo usan el puente Tailwind `--color-brand` (`tailwind.css` y los alias de `_variables.scss`), `--btn-primary-bg`, `--btn-secondary-text`, el `labelColor` por defecto de `app-kpi-card-variant` y 93 declaraciones `color:`/`background:` en ~45 componentes (codemod) | ✅ |
| AC3 | `--ds-brand` y `--color-primary` sin cambios: bordes, degradados, foco e íconos siguen en el celeste brillante (capturas) | ✅ |
| AC4 | Botón principal: claro blanco sobre `#0369a1` (5,93:1), hover `#075985`; oscuro `#082f49` sobre `#38bdf8` (6,48:1) | ✅ |
| AC5 | `_primeng-overrides.scss`: `--p-paginator-current-page-report-color: var(--text-secondary)` y página seleccionada en `--brand-strong` | ✅ |
| AC6 | Análisis por par de colores en 8 pantallas (claro + oscuro): **~470 nodos → 0**. Barrido completo con axe y línea base regenerada: entradas `color-contrast` **98 → 43**, rutas afectadas **49 → 25** | ✅ |
| AC-E1 | `themes/_public-enrollment.scss` redefine su propio `--color-brand` y `--text-muted`; el codemod excluyó `public-enrollment` | ✅ |
| AC-E2 | `.surface-hero` mantiene `--color-primary-text` blanco; dentro del hero el botón principal lleva texto `#0369a1` sobre blanco | ✅ |

**Validación:** `ng build` OK · `npm run lint:arch` exit 0 · barrido 53/53 (3 celdas inestables por carga con 3 workers, pasan al reintentarlas solas).

## Ajuste puntual

- Selector de categoría de licencia en la matrícula: la descripción de la tarjeta seleccionada
  (fondo `bg-brand-muted` en oscuro) pasa a `text-text-secondary` — con `text-muted` quedaba en 4,36:1.

## Pendiente (fuera de alcance)

Las 43 entradas `color-contrast` que quedan en la línea base son otros pares (colores de estado,
badges, textos sobre fondos tintados) en 25 rutas. Se atacan en un fix propio, igual que el resto de
reglas de axe (`aria-prohibited-attr`, `button-name`, …).
