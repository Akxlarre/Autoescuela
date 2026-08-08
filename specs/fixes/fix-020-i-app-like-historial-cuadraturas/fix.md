# Fix: App-like `/admin/contabilidad/historial-cuadraturas` + `/secretaria/...`
> id: fix-020-i-app-like-historial-cuadraturas
> refs: ASG-b-075
> status: done
> closed: 2026-08-08
> created: 2026-08-08

## Root Cause
[Heredado de ASG-b-075, a confirmar]: Paso 8 del rollout app-like
(`indices/APP-LIKE-ROLLOUT.md`), junto con liquidaciones (ASG-b-074, ya cerrado en fix-019-i).
`historial-cuadraturas-content` (shared admin+secretaria): hero + toolbar de mes + calendario
mensual acotado (máx 42 celdas, `hidden lg:grid` + fallback mobile aparte). 3 filas
conceptuales = `--fill-screen-kpi`.

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
1. Root → `bento-grid--fill-screen-kpi`.
2. Calendario → `bento-fill flex flex-col h-full`, el grid `hidden lg:grid...flex-1` → agregar
   `min-h-0 overflow-y-auto` (por si un mes tiene muchos eventos por celda).
3. Fallback mobile sin cambios.

### Ampliación de alcance (encontrada durante QA visual, 2026-08-08)
El botón "Mes siguiente" de la barra de navegación no es presionable a 390px de ancho — el
grupo de navegación (chevron-izq + label + chevron-der) más el botón "Exportar" no caben en el
`flex` sin wrap del contenedor `bento-banner card px-4 py-2.5 flex items-center justify-between`,
empujando/recortando el chevron derecho fuera del área táctil. Confirmado que **no** lo causó el
cambio de este fix: `.bento-fill`/`bento-grid--fill-screen-kpi` solo aplican dentro de
`@container layoutmain (min-width: 1024px)` — a 390px ese CSS no se activa. El usuario decidió
resolverlo en este mismo track en vez de abrir uno aparte.

Segunda ampliación (mismo QA, mismo día): el indicador "Sesión en curso" de la vista mobile
(celda de hoy sin cierre aún) usaba `loader-circle` + `animate-spin` — el spinner de carga
reservado por `visual-system.md` para estados de *fetching* real, no para un estado estático
"hoy, sin cerrar todavía". Reemplazado por `clock` sin animación.

Archivo principal:
`src/app/shared/components/historial-cuadraturas-content/historial-cuadraturas-content.component.ts`

## Test de Regresión
- `force-compact` verificado con drawer abierto.
- Sin `.spec.ts` nuevo obligatorio.
- `/verify` en **AMBAS rutas** (admin y secretaria — componente `shared`), 390×844, 1440×900 y
  768 de alto.

## Resultado
- Root del componente → `bento-grid--fill-screen-kpi`.
- Celda de calendario → `bento-banner bento-fill overflow-hidden flex flex-col h-full`; grid
  desktop (`hidden lg:grid...flex-1`) → agregado `min-h-0 overflow-y-auto`.
- Vista mobile/feed sin cambios estructurales.
- Ampliación 1: barra de navegación de mes → `flex-wrap gap-2` en el contenedor + `shrink-0` en
  el grupo de navegación, para que "Mes siguiente" no quede recortado por `overflow-hidden` a
  390px (el botón "Exportar" pasa a segunda línea si no entra).
- Ampliación 2: indicador "Sesión en curso" (vista mobile, celda de hoy) → `clock` estático en
  vez de `loader-circle` + `animate-spin` (el spinner es solo para estados de fetching real).
- `npm run lint:arch` y `npx ng build --configuration=development` verdes.
- QA visual confirmado manualmente por el usuario (ambas rutas, 390×844, 1440×900, 768 de alto,
  drawer abierto) — sin acceso a Playwright MCP en esta sesión para hacerlo vía agente.
