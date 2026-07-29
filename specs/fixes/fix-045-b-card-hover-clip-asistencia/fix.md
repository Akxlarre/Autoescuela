# Fix: Card hover recortado en Asistencia B (wrappers .bento-fill con overflow-hidden)
> id: fix-045-b-card-hover-clip-asistencia
> refs: 0030-asistencia-b-layout-dual, 0031-ciclos-teoricos-fill-screen
> status: done
> closed: 2026-07-16
> created: 2026-07-16

## Root Cause
Las cards con `appCardHover` de la vista Asistencia B (el `<aside>` de alertas y el
`<section>` de la tabla en la pestaña Prácticas; las columnas `card` en la pestaña
Ciclos) **no son hijas directas del `.bento-grid`**: están anidadas dentro de un wrapper
intermedio marcado como `.bento-fill` que además lleva `overflow-hidden`.

El hover (`GsapAnimationsService.addCardHover`) aplica `y: -2` + la sombra glow
`--card-shadow-hover-glow` (que se proyecta ~10px hacia arriba y un anillo de 1px
alrededor). Como las cards están pegadas al borde del wrapper (`flex-1`/`stretch`), ese
levantamiento + glow cae fuera de la caja del wrapper y el `overflow-hidden` del wrapper
lo **recorta**.

En Inicio y Base de Alumnos NO ocurre porque ahí `appCardHover` está sobre el propio
hijo directo del grid: el único ancestro que podría recortar es el `.bento-grid`, que
tiene `padding`/`gap` y **sin** `overflow-hidden`. (El `overflow` de un elemento nunca
recorta su propia `box-shadow`; solo la recorta un ancestro.)

## ACs Afectados
Ninguno funcional — es un defecto visual introducido por la estructura de layout de las
specs 0030/0031. No altera contratos ni ACs; solo restaura el feedback hover correcto.

## Cambio
- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
- **Qué cambia:** Quitar `overflow-hidden` del wrapper `.bento-fill` de la pestaña
  Prácticas (línea 158) y del host `.bento-fill` de `<app-ciclos-teoricos-content>`
  (línea 564). El alto ya lo fija `contain: size` de `.bento-fill`; el scroll interno ya
  lo dueñan los contenedores hijos (`overflow-y-auto` de la lista de alertas y
  `overflow-x/y-auto` de la tabla; en Ciclos cada columna scrollea sola). El
  `overflow-hidden` del wrapper es redundante para el layout y solo estorbaba al hover.

## Test de Regresión
Sin lógica testeable (cambio puramente de clases CSS en el template). Verificación:
- `ng build` compila sin error.
- `/verify` (Playwright): hover sobre la card de tabla y el rail de alertas muestra el
  glow + levantamiento completos, sin recorte en el borde superior, en ambas pestañas
  (Prácticas y Ciclos), light y dark.
