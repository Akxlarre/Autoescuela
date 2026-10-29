# Fix: la grilla de la Agenda no tiene filas para los lectores de pantalla
> id: fix-237-b-agenda-grid-aria
> refs: spec 0054-b
> status: done
> created: 2026-10-28

## Root Cause
`app-agenda-semanal` declara `role="grid"` en un contenedor CSS grid cuyos hijos directos son las
celdas (`columnheader`, `rowheader`, `gridcell`). ARIA exige que esas celdas vivan dentro de un
`role="row"`: sin filas, un lector de pantalla no puede recorrer la grilla por hora ni anunciar a qué
hora/día corresponde cada celda. axe lo marca como `aria-required-children` (en el grid) y
`aria-required-parent` (196 celdas en la Agenda de admin y secretaria).

## ACs Afectados
- **T1:** la cabecera (esquina + días) y cada fila de hora quedan envueltas en un `role="row"`.
- **T2:** el layout no cambia: las filas usan `display: contents`, así sus celdas siguen siendo items
  del CSS grid (mismas columnas, mismo sticky, mismo scroll).
- **T3:** axe sin `aria-required-children` ni `aria-required-parent` en la Agenda (B08); se regenera
  la línea base.

## Cambio
- `agenda-semanal.component.ts`: la cabecera (esquina + días) y cada bloque horario van envueltos en
  `<div class="agenda-row" role="row">`, con `.agenda-row { display: contents }`. Ningún estilo ni
  script dependía de que las celdas fueran hijos directos del grid (sin `> `, `nth-child` ni
  `querySelectorAll` sobre él).

## Verificación
- `e2e/agenda.spec.ts` **B17** (nuevo): fallaba con 84 hijos fuera de una fila; ahora pasa (14 filas).
  Suite completa: 28 ✅, 2 saltados por la hora (no quedan horarios libres hoy; preexistente).
- axe en la Agenda (375 claro / 1440 claro / 1440 oscuro): **0 violaciones**. Línea base B08 sin
  `aria-required-children`/`aria-required-parent` (admin y secretaria).
- `ng build` ✅ · `lint:arch` ✅

## Test de regresión
- `agenda-semanal.component.spec.ts`: todas las celdas del grid tienen un `role="row"` como padre y el
  grid solo tiene filas como hijos.
- Análisis axe de B08 + barrido.
