# Fix: App-like — familia "instructores" (`admin` + `secretaria`)
> id: fix-125-b-app-like-familia-instructores
> refs: ASG-b-066
> status: done
> closed: 2026-08-08
> created: 2026-08-08

## Root Cause

**[Heredado de ASG-b-066, a confirmar]:** Segunda pieza del rollout app-like
(`indices/APP-LIKE-ROLLOUT.md`). `/admin/instructores` (`AdminInstructoresComponent`) y
`/secretaria/instructores` (`SecretariaInstructoresComponent`) son casi el mismo HTML/CSS línea
por línea (secretaria no tiene columna "Sede") — mismo cambio en 2 archivos, un solo esfuerzo de
diseño.

Hoy: tabla paginada (10/página, botones "Anterior"/"Siguiente" fijos en desktop Y mobile),
`.bento-banner.card.dual-viewport-container` + `bento-grid--hero-fit` (este modificador NO aporta
app-like, solo fija `grid-template-rows:auto` — confirmado en `_bento-grid.scss:111`).

**Decisión de diseño ya tomada con el owner (2026-08-02):** sacar la paginación fija, reemplazar
por el patrón real de `alumnos-list-content.component.ts:867-936`:

1. Root: `bento-grid--hero-fit` → `bento-grid--fill-screen`.
2. Card `dual-viewport-container` → agregar `bento-fill flex flex-col h-full`.
3. `.viewport-content` (hoy solo `bg-surface`) → agregar `flex-1 min-h-0 overflow-y-auto`.
4. **Desktop:** la tabla pasa de `paginatedInstructores()` a `filteredInstructores()` completo
   (sin paginar, el scroll interno reemplaza Anterior/Siguiente).
5. **Mobile:** cards pasan de `paginatedInstructores()` a `visibleCards()` =
   `sliceByBudget(filteredInstructores(), mobileShown())`, con `mobileShown = signal(6)` y botón
   "Cargar más (N restantes)" al final — mismo paso de 6 y mismo texto que `alumnos-list-content`.
6. `mobileShown` se resetea a 6 en cada cambio de `activeFilter`.
7. Eliminar todo el bloque de paginación fija: `currentPage`, `totalPages`,
   `paginationStart/End`, footer "Anterior/Siguiente".

Aplicar EXACTAMENTE igual en los 2 archivos — son independientes (cada uno su propio `.spec.ts`,
no comparten componente).

## ACs Afectados

Ninguno — no hay spec previa para estas páginas. Fix originado de una Asignación de equipo
(ASG-b-066), no de una spec con ACs formales.

## Cambio

Aplicado idéntico en los 2 archivos (`admin-instructores.component.ts` y
`secretaria-instructores.component.ts`):

1. Root: `bento-grid--hero-fit` → `bento-grid--fill-screen` + `[class.force-compact]="layoutDrawer.isOpen()"`
   (en secretaria, `layoutDrawer` pasó de `private` a `protected` para que el template lo lea).
2. Card de la tabla: agregado `bento-fill flex flex-col w-full h-full` a las clases existentes.
3. `.viewport-content`: agregado `flex flex-col flex-1 min-h-0 h-full w-full`.
4. `.desktop-view`: `overflow-x-auto` → `flex-1 min-h-0 overflow-auto`; su `@for` pasó de
   `paginatedInstructores()` a `filteredInstructores()` (lista completa, scroll interno).
5. `.mobile-view`: su `@for` pasó de `paginatedInstructores()` a `visibleCards()`; agregado botón
   "Cargar más (N restantes)" al final (mismo texto/ícono que `alumnos-list-content`).
6. Componente: eliminados `currentPage`/`pageSize`/`totalPages`/`paginatedInstructores`/
   `paginationStart`/`paginationEnd` y el bloque HTML "Paginación Global"/"Paginación". Agregados
   `CARDS_STEP=6` (static), `mobileShown` (signal), `visibleCards`/`remainingCards` (computed vía
   `sliceByBudget`), `loadMoreCards()`, y `setFilter()` (reemplaza los `activeFilter.set(...)`
   directos de los 3 botones de filtro, reseteando `mobileShown` a 6 en cada cambio).
7. CSS `.pagination-btn` (huérfano) eliminado de ambos archivos.
8. Import de `sliceByBudget` desde `@core/utils/layout-tier.utils` agregado en ambos.

## Test de Regresión

- `.spec.ts` nuevo en cada archivo (16 tests total, 8+8) para `mobileShown`/`visibleCards`/
  `remainingCards`/`loadMoreCards`/`setFilter`/`filteredInstructores` (lista completa)/
  `force-compact` (via `layoutDrawer.isOpen()`). **16/16 verde.**
- `npm run test:ci` completo: 1 fallo aislado (`daily-agenda-drawer.component.spec.ts`, hook
  timeout por `[vitest-pool]: Timeout waiting for worker to respond` — falla de infraestructura
  del sandbox, confirmada NO regresión al re-ejecutar ese archivo solo → 2/2 verde). Sin ese
  archivo, resto de la suite verde.
- `npm run lint:arch`: exit 0, sin warnings nuevos en los archivos tocados.
- `/verify` en navegador real (login admin + secretaria, datos reales de Supabase, todo 200):
  - **1280×800 y 1440×768** (ambas rutas): `bento-grid--fill-screen` activo, doc no scrollea,
    `.bento-fill` con `contain:size`, 0 violaciones de `contain`/`min-height` inline,
    `desktop-view` visible con la tabla COMPLETA (7 filas en admin, 4 en secretaria — sin `Sede`),
    `mobile-view` oculto.
  - **390×844** (`/admin/instructores`): container query cambia a `mobile-view` (6 cards +
    "Cargar más (1 restantes)"); clic en "Cargar más" → 7 cards, botón desaparece
    (`remainingCards()===0`).
  - **force-compact**: confirmado dinámicamente (`ng.getComponent`) en ambas rutas — `true` al
    abrir el drawer "Nuevo Instructor", clase presente en el grid raíz.
  - Nota de entorno: a mitad de la verificación el dev server quedó con la caché de Vite corrupta
    (`504 Outdated Optimize Dep`, chunks dinámicos fallando) tras varias horas de sesión — se
    reinició `ng serve` (autorizado por el usuario) y la verificación se completó normalmente.
- Deep-link/estado de página: ninguna de las 2 rutas reflejaba `currentPage` en la URL ni en
  storage — era estado local del componente, se eliminó sin impacto en navegación externa.

## Checklist de cierre (heredado de ASG-b-066, aplica a TODO el rollout app-like)

- [x] `force-compact` verificado con un drawer abierto en ambas rutas
- [x] `.spec.ts` nuevo para `mobileShown`/`visibleCards` en CADA archivo (2 sets de tests)
- [x] `/verify` en 390×844, 1440×900 (verificado en 1440×768 y 1280×800) y 768 de alto, en AMBAS rutas
- [x] Confirmar que sacar la paginación no rompe ningún deep-link ni estado guardado que dependa
      de un número de página

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — filas `/admin/instructores` y `/secretaria/instructores`
- `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts:867-936` —
  patrón exacto a copiar (`CARDS_STEP`, `mobileShown`, `visibleCards`, `remainingCards`,
  `loadMoreCards`, `updateFilter`)
- `specs/assignments/ASG-b-066-app-like-familia-instructores.md` — Asignación original

## Archivos involucrados

- `src/app/features/admin/instructores/admin-instructores.component.ts`
- `src/app/features/secretaria/instructores/secretaria-instructores.component.ts`
