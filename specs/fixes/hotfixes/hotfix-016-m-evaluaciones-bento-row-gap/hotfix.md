# Hotfix: espacio vacío excesivo alrededor de "Volver al panorama" en Evaluaciones

## Problema
En `admin-profesional-evaluaciones.component.ts` (y su equivalente
`secretaria-profesional-notas.component.ts`), el `.bento-grid` usa el default
`--bento-row-min: 120px` (`grid-auto-rows: minmax(120px, auto)`). El banner con
el botón "Volver al panorama" es un `.bento-banner` de una sola fila cuyo
contenido real mide ~40px, pero el grid fuerza esa fila a un mínimo de 120px,
dejando ~80px de espacio vacío repartido arriba/abajo del botón.

## Fix
Aplicar el mismo patrón ya usado en `admin-profesional-archivo.component.ts:515-518`:
overridear `--bento-row-min: auto;` en el `.bento-grid` del componente vía
`styles:`, para que cada fila del grid mida según su contenido real en vez de
imponer un piso de 120px.

## AC
- El banner "Volver al panorama" en Evaluaciones (admin y secretaria) ya no tiene espacio vacío forzado arriba/abajo.
- El resto de secciones (hero, KPIs, tabla de notas) no sufren regresión visual (siguen viéndose con espaciado adecuado, ya que su contenido natural supera holgadamente los 120px).

## Cierre
- `--bento-row-min: auto;` agregado al `.bento-grid` de `admin-profesional-evaluaciones.component.ts` y `secretaria-profesional-notas.component.ts`, siguiendo el mismo patrón ya validado en `admin-profesional-archivo.component.ts`.
- `tsc --noEmit` limpio.
