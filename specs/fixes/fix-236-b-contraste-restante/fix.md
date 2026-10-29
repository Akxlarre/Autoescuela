# Fix: contraste restante tras la spec 0055-b (badges, estados, texto sobre la marca)
> id: fix-236-b-contraste-restante
> refs: spec 0055-b, spec 0054-b
> status: done
> created: 2026-10-28

## Root Cause
La spec 0055-b corrigió las dos causas grandes de `color-contrast` (gris muted y celeste de marca
como texto). El análisis por elemento de axe (32 pantallas, 375 claro / 1440 claro / 1440 oscuro,
2026-10-28) dejó ~144 nodos con estas causas:

| Causa | Ejemplo | Contraste |
|---|---|---|
| `--text-muted` sobre `bg-subtle` (chips, cabeceras de tabla de cuadratura, tabs inactivas) | claro `#6b6b74`/`#e4e4e7` · oscuro `#929299`/`#2d2d30` | 4,15 · 4,44 |
| `.badge-brand` con el celeste brillante | `#0ea5e9`/`#ecf8fd` | 2,56 |
| Verde de éxito sobre fondo tintado (licencia vigente, estado de secretaria, cobro) | `#15803d`/`#e3f0e8` | 4,27 |
| Texto blanco sobre `bg-brand` en oscuro (`#38bdf8`): acción rápida, "Hoy" del calendario, chip activo | blanco/`#38bdf8` | 2,14 |
| Insignias de curso con color del curso de fondo y texto blanco fijo (Promociones) | blanco/`#f59e0b` | 2,14 |
| Textos con `opacity-*` encima de color de marca o de estado (contadores de tabs, rótulos de cuadratura) | `#3385b3`/`#f2f7fa` | 3,78 |
| Otros puntuales (avatar con fondo de error en oscuro, texto gris fijo) | blanco/`#f87171` | 2,76 |

## ACs Afectados
- AC1/AC2 de la spec 0055-b se ajustan: el gris muted pasa a `#63636b` (claro) y `#98989f` (oscuro)
  para cumplir también sobre `bg-subtle` (4,69 y 4,79).
- **T1:** `--state-success` claro cumple 4,5:1 sobre los fondos tintados de éxito.
- **T2:** `.badge-brand` usa `--brand-strong`.
- **T3:** el texto sobre un fondo de marca sólido usa `--btn-primary-text` (blanco en claro, azul
  marino en oscuro), no blanco fijo.
- **T4:** las insignias de curso cumplen 4,5:1 con su texto blanco (se oscurecieron los colores de curso).
- **T5:** sin `opacity-*` sobre textos que ya están en el límite de contraste.
- **T6:** el análisis por elemento queda sin `color-contrast` en las pantallas revisadas; la línea base
  se regenera.

## Cambio
- `_variables.scss`: `--text-muted` `#63636b` / `#98989f`; `--state-success` claro `#166534`.
- `tailwind.css`: `.badge-brand` en `--brand-strong`; nuevo `--color-on-brand` (`text-on-brand`) =
  `--btn-primary-text` para texto sobre `bg-brand`.
- `course-colors.ts`: A2–A5 y fallback en tonos 600/700 (≥4,5:1 con blanco). Nuevo
  `core/utils/color-contrast.utils.ts` (`contrastRatio`).
- Texto blanco fijo sobre `--brand-strong` → `--btn-primary-text` (6 componentes) y `text-white` →
  `text-on-brand` (3 plantillas).
- Bindings `[style.color]` de texto activo (tabs de Asistencia y Asistencia Profesional, subnav del
  Libro de Clases, "hoy" de semana/horario, paso del wizard de curso) → `--brand-strong`.
- Sin `opacity-*` en contadores de filtro y rótulos de cuadratura; avatares de alerta con
  `text-surface`; estado vacío de pagos con `text-text-muted` (la opacidad solo en el ícono).

## Progreso
- [x] Tokens (`--text-muted`, `--state-success`), `.badge-brand`, texto sobre `bg-brand` (`text-on-brand`)
- [x] Colores de curso 600/700 + `contrastRatio()` con tests (7/7) · `test:ci` 4631 ✅ · `ng build` ✅ · `lint:arch` ✅
- [x] Análisis axe por elemento: `color-contrast` 144 → 1 → 0 (bindings `[style.color]` de tabs)
- [x] Barrido completo 53/53 (4 celdas inestables por carga pasan solas) · línea base `color-contrast` **43 → 0**
- [x] "Cambio" completo · commit, PR, merge

## Test de regresión
- Util nuevo de color legible con su `.spec.ts`.
- Análisis axe por elemento + barrido con línea base regenerada.
