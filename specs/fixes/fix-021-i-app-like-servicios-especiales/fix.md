# Fix: App-like familia "servicios especiales" (`admin` + `secretaria`)
> id: fix-021-i-app-like-servicios-especiales
> refs: ASG-b-073
> status: done
> closed: 2026-08-10
> created: 2026-08-08

## Root Cause
[Heredado de ASG-b-073, a confirmar]: Paso 7 del rollout app-like
(`indices/APP-LIKE-ROLLOUT.md`). `servicios-especiales-content` (shared entre admin y
secretaria): hero + **2 `.bento-banner` apiladas de ancho completo** (Catálogo arriba,
Historial de Ventas abajo) — NO son 2 columnas lado a lado. Historial es una `<table>` hecha a
mano SIN paginación de ningún tipo (ni desktop ni fallback mobile `sm:hidden`).

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
1. Root → `bento-grid--fill-screen-2` (2 filas fill apiladas — no `--fill-screen` singular).
2. Catálogo: `bento-fill flex flex-col h-full` en el card; grid interno de servicios →
   `flex-1 min-h-0 overflow-y-auto`.
3. Historial: mismo tratamiento; tabla desktop `hidden sm:block overflow-x-auto` agrega
   `flex-1 min-h-0 overflow-y-auto`. Mobile (`sm:hidden` cards) sin cambios.

Sin decisión de paginación pendiente — nunca la tuvo, no hay que agregar `sliceByBudget`.

Archivo principal:
`src/app/shared/components/servicios-especiales-content/servicios-especiales-content.component.ts`

## Test de Regresión
- `force-compact` verificado con drawer abierto.
- Sin `.spec.ts` nuevo obligatorio (sin lógica de densidad nueva).
- `/verify` en **AMBAS rutas** (`/admin/servicios-especiales` y
  `/secretaria/servicios-especiales` — componente `shared`), 390×844, 1440×900 y 768 de alto.
- `app-empty-state` en el historial (si aplica) dentro de wrapper centrado.

### Ampliación de alcance (encontrada durante QA visual con Playwright, 2026-08-10)
Con el drawer abierto, tanto el grid del Catálogo (`grid sm:grid-cols-2 lg:grid-cols-3`) como
el switch tabla/mobile del Historial (`hidden sm:block` / `sm:hidden`) usan breakpoints de
**viewport** (`@media`), no de contenedor. El viewport no cambia cuando el drawer angosta la
columna — solo su ancho visual — así que el grid seguía forzando 3 columnas de ~90px
(texto solapado) y el Historial seguía mostrando la tabla desktop recortada en vez de pasar a
las cards mobile. Confirmado con Playwright (`grid-template-columns: 90px 90px 90px` con drawer
abierto a 1280px de viewport). Es la trampa "switch por contenedor, no por viewport" ya
documentada en `visual-system.md`. Reemplazado por `@container` local (`svc-catalogo`,
`svc-historial`), mismo patrón que ya usa `liquidaciones-content` (`liq-container`).

Segunda ampliación (mismo QA, feedback del usuario en 390×844): la fila de controles del
Historial (`p-select` + botón "Exportar") no tenía `flex-wrap`, así que a 390px el botón se
salía visualmente del card. Mismo patrón ya corregido en `fix-020-i` (nav de mes de
historial-cuadraturas): agregado `flex-wrap` al contenedor, `min-w-0` al `p-select` y
`shrink-0` al wrapper del botón — ahora apilan en 2 líneas en vez de desbordar.

## Resultado
- Root del componente → `bento-grid--fill-screen-2`.
- Catálogo y Historial → `bento-banner bento-fill flex flex-col h-full`; grid interno del
  catálogo y tabla desktop del historial → `flex-1 min-h-0 overflow-y-auto`.
- Ampliación de alcance: `@container` locales (`svc-catalogo`, `svc-historial`) reemplazando
  los breakpoints de viewport (`sm:grid-cols-2 lg:grid-cols-3`, `hidden sm:block`/`sm:hidden`)
  que rompían con el drawer abierto (mismo patrón que `liq-container` en `liquidaciones-content`).
- `npm run lint:arch` y `npx ng build --configuration=development` verdes.
- QA visual verificado con Playwright MCP (ambas rutas, 390×844, 1440×900, 768 de alto,
  force-compact con drawer abierto, modo oscuro) — sin errores de consola ni 4xx/5xx, datos
  reales de Supabase, contrato app-like cumplido, sin overflow horizontal en ningún ancho.
- Ronda 2 de QA (feedback del usuario): botón "Exportar" del Historial se salía del card en
  390px — corregido con `flex-wrap` + `min-w-0`/`shrink-0`. Re-verificado con Playwright:
  ahora apila en 2 líneas, sin overflow horizontal.
