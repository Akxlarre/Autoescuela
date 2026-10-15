# Fix: el detalle de una clase abierta desde el dashboard llega incompleto
> id: fix-406-m-detalle-de-clase-desde-dashboard-incompleto
> refs: fix-395-m-testing-dashboards (casos M15, N03; sospecha S20) · fix-377-m
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Dashboard de secretaria → clic en una clase "Finalizada" o "No Asistió":

- Desde el panel "Clases Actuales", el detalle no muestra "Clase N".
- Desde el drawer "Agenda de Hoy" tampoco, y además el detalle de una clase "No Asistió" no ofrece
  "Deshacer" la inasistencia (sí lo ofrece desde el panel).
- La hora de término se calcula siempre con 45 minutos, aunque la clase dure otra cosa.

## Root Cause

`SecretariaDashboardComponent.handleLiveClassAction()` y
`DailyAgendaDrawerComponent.handleClassAction()` arman a mano, cada uno por su lado, el `slot` que
recibe `AgendaSlotDetailDrawerComponent`: los dos escriben `classNumber: 0` aunque la clase trae su
número, y cuando `fix-377-m` agregó `sessionId` (lo que habilita deshacer la falta) lo hizo solo en
una de las dos copias.

## Fix

Una función pura `liveClassToAgendaSlot()` en `core/utils/live-class-action.utils.ts` arma el slot
con número de clase, sesión, vehículo y duración real; los dos componentes la usan.

## Acceptance Criteria

- [x] AC1 — El detalle de una clase finalizada o "No asistió" abierta desde "Clases Actuales"
      muestra "Clase N".
- [x] AC2 — Lo mismo desde "Agenda de Hoy", y ahí una clase "No asistió" ofrece deshacer la falta.
- [x] AC3 — La hora de término usa la duración de la clase.

## Regression Test

- `live-class-action.utils.spec.ts` → `liveClassToAgendaSlot (fix-406-m)`

## Verificación (2026-10-13)

- Unit: `live-class-action.utils.spec.ts`, 5 tests nuevos de `liveClassToAgendaSlot()` (número de
  clase, sesión, hora de Chile, duración real, 45 min por defecto). `tsc` sin errores.
- E2E `e2e/dashboards.spec.ts` → "K04 · K10 · M01 · M03 · M15 · N01", en verde: con una clase
  finalizada (clase 4) y una "No asistió" (clase 5) sembradas hoy, el detalle abierto desde "Clases
  Actuales" dice "Clase 4"; el abierto desde "Agenda de Hoy" dice "Clase 5" y ofrece "Deshacer".
