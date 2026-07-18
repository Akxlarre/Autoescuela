# Hotfix: "Inasistencia justificada" se pinta en verde en la Ficha Técnica

## Problema
En `admin-ficha-tecnica.component.ts` (vista desktop y mobile), el badge de
estado de una clase ausente aplicaba `badge-estado-clase--ok` (verde) cuando
`clase.justificada` era true, junto al texto "Inasistencia justificada".
Semánticamente esto es incorrecto: que una inasistencia esté justificada NO
cambia el hecho de que el alumno faltó y debe reagendar esa clase — solo
documenta el motivo. Debe seguir mostrándose en rojo, igual que una
inasistencia sin justificar.

## Fix
Eliminado el binding `[class.badge-estado-clase--ok]="clase.justificada"` en
ambas vistas (desktop línea ~100, mobile línea ~225). El badge conserva el
color rojo por defecto (`badge-estado-clase`) en todos los casos de
`clase.ausente`; el texto sigue diferenciando "Inasistencia justificada" vs
"Inasistencia" para dar contexto sin implicar que ya no requiere acción.

## AC
- Una clase con `ausente = true` y `justificada = true` se muestra con badge
  rojo y texto "Inasistencia justificada" (no verde).

## Cierre
- Eliminado `[class.badge-estado-clase--ok]="clase.justificada"` en las vistas desktop y mobile de `admin-ficha-tecnica.component.ts`.
- Eliminada la clase CSS `.badge-estado-clase--ok` (quedó sin consumidores tras el cambio).
- `tsc --noEmit` limpio.
