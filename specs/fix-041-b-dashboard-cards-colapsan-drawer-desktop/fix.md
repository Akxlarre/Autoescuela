# Fix: Dashboard cards colapsan al abrir drawer en desktop
> id: fix-041-b-dashboard-cards-colapsan-drawer-desktop
> refs: —
> status: done
> created: 2026-07-08
> closed: 2026-07-09

## Root Cause
El bento-grid del dashboard (`.bento-grid--fill-screen-2`) y las clases de proporción
(`bento-wide`, etc.) responden a **container queries** contra `<main>` (`@container
layoutmain`, ver `_bento-grid.scss` y `_bento-grid.README.md`) — por diseño, para que el
grid reaccione al ancho *disponible*, no al viewport completo. Esto es intencional:
`LayoutDrawerComponent` en desktop toma `Math.max(400, innerWidth * 0.45)` de ancho como
hermano flex de `<main>` (`gsap-animations.service.ts:917`), angostando el contenedor
`layoutmain` sin cambiar el viewport.

Sin embargo, 3 elementos usan el prefijo `lg:` de Tailwind (**viewport**, no contenedor)
para neutralizar su `min-height` de fallback en desktop:
- `dashboard.component.ts` — "Actividad reciente": `min-h-[300px] lg:min-h-0`
- `dashboard.component.ts` — "Alertas Importantes": `min-h-[250px] lg:min-h-0`
- `live-classes-panel.component.ts` (host) — `min-h-[450px] lg:min-h-0`

Al abrir el drawer, el viewport sigue siendo ≥1024px → `lg:min-h-0` permanece activo y
elimina el piso de altura. Pero el contenedor `layoutmain` cae por debajo de 1024px →
`.bento-grid--fill-screen-2` deja de forzar `grid-template-rows: auto minmax(0,1fr)
minmax(0,1fr)` (vuelve a `grid-auto-rows: minmax(120px, auto)`). Las cards quedan sin
piso de altura (`min-h-0` viewport) y sin fila `1fr` de la que estirarse (grid ya
angostado) → colapsan a su altura de contenido ("se acoplan"). El hero no se ve afectado
porque `.bento-hero` tiene `min-height: 180px` fijo, no condicionado por `lg:`.

## ACs Afectados
Ninguno — fix autónomo (bug reportado por QA manual del owner, sin spec asociada).

- AC-1: Al abrir cualquier drawer en desktop con el dashboard admin (`/app/admin/dashboard`)
  de fondo, las cards "Clases Actuales", "Actividad reciente" y "Alertas Importantes"
  mantienen su tamaño/proporción visual (no colapsan ni se "acoplan") mientras el drawer
  está abierto, en cualquier ancho de ventana ≥1024px.
- AC-2: El fallback de `min-height` de esas 3 cards se neutraliza según el ancho del
  *contenedor* `layoutmain` (`@container`), no del viewport — consistente con el resto
  del sistema bento-grid.

## Cambio
- **Archivo:** `src/app/features/dashboard/dashboard.component.ts`
  — reemplazar `lg:min-h-0` (Tailwind viewport) por clase `dashboard-panel` + regla
  `@container layoutmain (min-width: 1024px) { .dashboard-panel { min-height: 0; } }`
  en el bloque `styles`, siguiendo el patrón ya usado en `instructor-ficha.component.ts`.
- **Archivo:** `src/app/shared/components/live-classes-panel/live-classes-panel.component.ts`
  — mismo reemplazo en el host binding (`:host` en un nuevo bloque `styles`).

## Test de Regresión
- Verificación visual manual (Playwright) en `/app/admin/dashboard`, desktop ≥1024px:
  abrir un drawer (ej. "Nueva Matrícula") y confirmar que las 3 cards del dashboard no
  colapsan de altura mientras el drawer permanece abierto, en distintos anchos de ventana.
- `ng build` → exit 0 (no hay lógica nueva testeable por Vitest; es un ajuste de CSS/clases).
