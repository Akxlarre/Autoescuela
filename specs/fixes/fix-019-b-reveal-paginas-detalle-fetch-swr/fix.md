# Fix: Reveal en páginas detalle/fetch — disparo SWR en vez de one-shot
> id: fix-019-b-reveal-paginas-detalle-fetch-swr
> refs: fix-018-refactor-animaciones-entrada-bento-premium
> status: done
> created: 2026-06-15

## Root Cause
Las páginas de **detalle por `:id`** (patrón "solo fetch", sin caché) disparan
`animateBentoGrid` una sola vez en `ngAfterViewInit`. En ese instante `isLoading()` es
`true`, así que la animación de entrada se reproduce sobre las **celdas skeleton**. Cuando
llega la data, el `@if(isLoading)/@else` **reemplaza** esas celdas por las reales (DOM
nuevo) y nadie vuelve a disparar el reveal → **el contenido real aparece de golpe, sin
animación**. Las celdas de contenido tampoco tienen `appScrollReveal`/`appAnimateIn`
propios. Es la causa raíz #5 (triggers inconsistentes) que fix-018 sólo resolvió para las
páginas migradas/SWR; las páginas detalle quedaron con el trigger one-shot.

Verificado en vivo (Playwright sobre `/app/admin/alumnos/93`): la página renderiza bien
(0 celdas ocultas, clase retirada, 0 errores) — el bug es de animación, no de visibilidad.

## ACs Afectados
Ninguno — fix autónomo (continuación de fix-018, sin nueva funcionalidad de negocio).

## Cambio
Misma causa raíz (trigger one-shot) en los 4 componentes del inventario. Mismo cambio
mecánico en todos: reemplazar el `ngAfterViewInit` one-shot por un `effect()` que dispara
el reveal cuando `!isLoading()` (contenido presente) — patrón SWR de `DashboardComponent`.
Quita `AfterViewInit`, agrega `effect`.

- **`src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts`** (REFERENCIA) — `facade.isLoading()`.
- **`src/app/features/admin/profesional-evaluaciones/admin-profesional-evaluaciones.component.ts`** — `facade.isLoading()`.
- **`src/app/features/instructor/liquidacion/instructor-liquidacion.component.ts`** — `facade.isLoading()`.
- **`src/app/shared/components/dms-list-content/dms-list-content.component.ts`** — dumb: `isLoading()` (input signal); dispara hero + grid juntos.

## Inventario — páginas con el mismo patrón (TODAS corregidas)
Sólo 4 componentes tienen one-shot trigger + swap de **celdas bento** en la rama loading
(el resto usa celdas estables con `[loading]` interno, o ya usa `effect`):
1. `admin/alumno-detalle` — ✅ corregido (referencia)
2. `admin/profesional-evaluaciones` — ✅ corregido
3. `instructor/liquidacion` — ✅ corregido
4. `shared/dms-list-content` — ✅ corregido (dumb, hero + grid)

## Test de Regresión
- ✅ `npm run build` verde (chunk `admin-alumno-detalle-component` compila, sin errores).
- ✅ Verificación visual en vivo (Playwright sobre `/app/admin/alumnos/93`, sampler con
  throttle de fetch): tras resolver la data, las celdas de **contenido** arrancan en
  `opacity 0` y animan a `1` (`contentFirstOpacity: 0`, `contentAnimated: true`). Antes el
  contenido aparecía de golpe. Estado final: 8 celdas visibles, 0 errores de consola.
- Sin regresión de "página en blanco": screenshot durante la carga muestra el contenido
  completo y revelado correctamente.
- ✅ Rollout: `npm run build` verde con los 4 componentes migrados.
- ✅ `dms-list-content` verificado en vivo (`/app/admin/documentos`): capturado mid-reveal
  con `minOpacity: 0.12` subiendo → asienta en `0.9999`, todas las celdas visibles. El
  contenido anima de 0 a 1.

> status del track: rollout completo y verificado. Listo para `/fix-close`.
