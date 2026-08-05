# Fix: App-like `/admin/secretarias`
> id: fix-017-i-app-like-admin-secretarias
> refs: ASG-b-068
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Root Cause
[Heredado de ASG-b-068, a confirmar]: Cuarta pieza del rollout app-like
(`indices/APP-LIKE-ROLLOUT.md`). `AdminSecretariasComponent` tiene hero + **1 sola fila** con 2
celdas lado a lado: `bento-wide` (9 cols, lista de secretarias con paginación Anterior/Siguiente
hand-rolled) + `bento-tall` (3 cols, sidebar estático: descripción de rol + permisos + link a
auditoría). No aplica todavía el patrón fill-screen/densidad adaptativa del canon app-like.

**Modificador correcto (ya verificado en la Asignación, no repetir el análisis):**
`bento-grid--fill-screen` (singular — 1 fila que se reparte en columnas), **NO**
`--fill-screen-2` (que es para 2 filas apiladas verticalmente, como `/admin/dashboard`).
Confirmado leyendo `_bento-grid.scss`: `--fill-screen` = `grid-template-rows: auto minmax(0,1fr)`
(hero + 1 fila fill que reparte en columnas); `--fill-screen-2` = `auto minmax(0,1fr)
minmax(0,1fr)` (hero + 2 filas fill apiladas).

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
1. Root: agregar `bento-grid--fill-screen` (evaluar si el `style="--bento-row-min: 125px"` inline
   ya es redundante con las filas explícitas del modificador).
2. Card lista (`bento-wide`, ya `flex flex-col h-full`) → agregar `bento-fill`.
3. Su `<div class="flex-1">` interno (~línea 148) → agregar `min-h-0 overflow-y-auto`.
4. Sidebar (`bento-tall`, ya `h-full flex flex-col`) → agregar `bento-fill` también — comparte la
   misma fila `minmax(0,1fr)` que la lista, necesita `contain:size` igual para no estirar la fila
   con su propio contenido.
5. Paginación Anterior/Siguiente (hand-rolled) → mismo tratamiento que instructores (ASG-b-066):
   `LayoutService` + `mobileShown` + `sliceByBudget` + "Cargar más", con reset en cada cambio de
   búsqueda/filtro.

Archivo principal: `src/app/features/admin/secretarias/admin-secretarias.component.ts`

Patrón de densidad a copiar:
`src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts:867-936`

## Test de Regresión
- `.spec.ts` nuevo para `mobileShown`/densidad — obligatorio por `testing-tdd.md`.
- `/verify` en 390×844, 1440×900 y 768 de alto — atención especial a cómo se ve el sidebar
  `bento-tall` en 768px de alto.
- `force-compact` verificado con un drawer abierto.

## Resultado
- Los 5 cambios del plan aplicados en `admin-secretarias.component.ts`: root `bento-grid--fill-screen`
  (sin el `style` inline redundante), `bento-fill` en lista y sidebar, `min-h-0 overflow-y-auto` en
  el contenedor interno de la lista, y paginación Anterior/Siguiente reemplazada por densidad
  adaptativa (`LayoutService.tier()` + `mobileShown` + `sliceByBudget` + "Cargar más").
- Reset de densidad implementado con métodos explícitos (`updateSearchTerm`/`updateFiltroSede`/
  `updateFiltroEstado`) en vez de un `effect()`, siguiendo el patrón real de
  `alumnos-list-content.updateFilter()` citado en el fix — más testeable sin depender de CD/render.
- `admin-secretarias.component.spec.ts` nuevo: 11 tests cubriendo `maxVisible`, `visibleSecretarias`,
  `remainingSecretarias`, `loadMoreSecretarias` y el reset de densidad en los 3 filtros — todos en
  verde.
- `npm run lint:arch` y `npx ng build --configuration=development` limpios.
- `/verify` visual (390×844, 1440×900, 768px de alto, force-compact con drawer) confirmado
  manualmente por el usuario — sin acceso a Playwright MCP en esta sesión para hacerlo vía agente.
