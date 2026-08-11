# Hotfix: Leyenda de estados del calendario alumno queda huérfana (3+1) en mobile

> id: hotfix-042-b-alumno-horario-leyenda-wrap-mobile
> status: done
> closed: 2026-08-09
> created: 2026-08-09

## Problema

Reportado por el usuario revisando `/alumno/horario` en 390px: la leyenda "Completada /
Agendada / Inasistencia / Cancelada" usa `flex flex-wrap gap-4`, que en desktop cabe en 1 sola
línea pero en el contenedor mobile (~276px de ancho medido en vivo) la suma de los 4 items
(~314px con el gap actual) no entra, así que envuelve a "3 arriba + 1 huérfana abajo"
(Cancelada sola en su propia línea) — se ve desbalanceado.

Reducir el `gap` no es una solución robusta: con `gap-2` el total baja a ~290px, todavía por
encima de los 276px disponibles — cualquier texto ligeramente más largo (o una fuente del
sistema distinta) lo volvería a romper.

## Cambios

- **Archivo:** `src/app/features/alumno/horario/alumno-horario.component.ts` — la leyenda gana
  la clase `horario-legend`. Dentro del `@container horarioCalendar (max-width: 480px)` ya
  existente, `.horario-legend` cambia de `flex flex-wrap` a `display: grid;
  grid-template-columns: repeat(2, 1fr)` — 2×2 balanceado en vez de 3+1. Desktop/tablet sin
  cambios (siguen en una sola línea).
