# Hotfix: Card del wizard se ensancha y corta contenido cuando el schedule-grid tiene semana completa
> id: hotfix-056-m-stepper-flex-min-width-overflow
> refs: reemplaza el diagnóstico incorrecto de hotfix-055-m (sticky footer no era la causa real)
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Problema
En el Paso 2 del wizard de matrícula, al mostrar una semana del `schedule-grid` con los 5 días
hábiles completos, la tabla de horarios tiene `min-width: max-content`
(`schedule-grid.component.ts:119`) y ese ancho intrínseco se propaga hacia arriba por el flex
chain del stepper: `.stepper-premium.p-stepper` y `.p-stepper-panels`
(`_primeng-overrides.scss:1101-1113`) son flex containers en columna con `min-height: 0` pero
**sin `min-width: 0`**, así que no pueden encogerse por debajo del ancho de su contenido. Toda la
card se ensancha más allá del drawer, y como el `<main>` del wizard tiene `overflow-x-hidden`
(`secretaria-matricula.component.html:142`), el excedente queda cortado y **literalmente
inaccesible** (no hay scroll horizontal que lo revele) — incluyendo el footer con
"Volver"/"Siguiente" y parte de la grilla y del resumen "Tu horario".

## Cambios
- **Archivo:** `src/styles/vendors/_primeng-overrides.scss` — agregar `min-width: 0` a
  `.stepper-premium.p-stepper` y a `.p-stepper-panels` para que el flex chain se contenga al
  ancho del drawer y el `overflow-x-auto` interno del `schedule-grid` (que ya existe) sea el que
  efectivamente scrollee la grilla ancha, en vez de que el ancho se filtre hacia los ancestros.
- Revertir el `sticky bottom-0` de `assignment.component.html` (hotfix-055) si no aporta una vez
  resuelto el ancho — el footer sigue viviendo dentro del scroll vertical normal, que es
  aceptable una vez que el ancho está contenido.
