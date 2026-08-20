# Hotfix: Leyenda del horario semanal no coincide con el color real de las tarjetas y le falta un estado
> id: hotfix-079-m-leyenda-horario-semanal-colores-y-estado-faltante
> refs: —
> status: done
> closed: 2026-08-20
> created: 2026-08-20

## Problema
En `WeeklyScheduleGridComponent`, la leyenda ("Programada / En curso / Completada /
Cancelada") arma el color de cada punto con `getDotStyle()` (`dotBg`/`dotBorder`), pero
la tarjeta real pinta su borde izquierdo con un campo distinto de
`getStatusVisual()` (`borderColor`). Para "Completada" y "Cancelada" ambos valores no
coinciden, así que el punto de la leyenda no refleja el color visible en la tarjeta.
Además, el estado `no_show` ("No asistió", rojo con ícono `x`) sí aparece en las
tarjetas pero no está listado en la leyenda.

Confirmado con el usuario: la leyenda debe usar el mismo color que el borde de la
tarjeta (`borderColor`), y debe incluir los 5 estados, no 4.

Sobre el color de `no_show`: se evaluó ponerlo rojo (igual que `cancelled`), pero se
optó por ámbar para mantener consistencia con hotfix-077-m, donde `no_show` ya se fijó
como ámbar ("Ausente") en el badge de "Mis Clases de Hoy" — mismo estado, mismo color
en toda la app. `cancelled` queda en su gris/neutro actual (es administrativo, no una
falta real del alumno).

## Cambios
- **Archivo:** `src/app/core/utils/schedule-status.utils.ts` — `getStatusVisual('no_show')`:
  `borderColor: 'var(--state-error)'` → `'var(--state-warning)'` (ámbar, consistente con
  hotfix-077-m).
- **Archivo:** `src/app/shared/components/weekly-schedule-grid/weekly-schedule-grid.component.ts`
  — `legendItems`: agregar `'no_show'` a la lista de estados; `dotStyle` se arma con
  `getStatusVisual(s).borderColor` (mismo campo que usa la tarjeta) en vez de
  `getDotStyle()`.
