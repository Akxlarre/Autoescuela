# Hotfix: el aviso de "Deshacer inasistencia" no se entiende y "No asistió" se ve igual que "Concluida"
> id: hotfix-152-m-texto-deshacer-inasistencia-y-color-no-asistio
> refs: ASG-i-027 (observaciones de Matías tras el cierre) · fix-377-m · fix-379-m · fix-193
> status: done
> closed: 2026-10-13
> created: 2026-10-13

> Reemplazado por `fix-392-m-deshacer-inasistencia-borra-la-falta`: al revisar el texto, Matías decidió
> que deshacer debe borrar la falta, lo que deja de ser un cambio obvio. Este hotfix se cerró **sin
> cambios de código**; todo lo listado abajo se hizo en ese fix.

## Problema
1. La confirmación de "Deshacer inasistencia" usa jerga interna ("la falta pasa al historial",
   "canceló clases por penalización", "no vuelven solas"): quien la lee no entiende qué va a pasar.
   Los avisos posteriores a deshacer o justificar una falta repiten la misma jerga.
2. En "Clases Actuales" del dashboard, una clase "No asistió" se pinta con el mismo gris que una
   "Concluida", aunque son resultados opuestos.

## Cambios
- **Archivo:** `src/app/core/facades/asistencia-clase-b.facade.ts` — texto de la confirmación de deshacer y de los dos avisos de clases que siguen canceladas
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts` — mismo aviso al justificar desde la ficha
- **Archivo:** `src/app/shared/components/live-classes-panel/live-classes-panel.component.ts` — la falta sin justificar va en color de error; la justificada y la concluida siguen en gris
- **Archivo:** specs de los tres archivos — textos esperados y la decisión de color
