# Fix: vehicleId/vehicleCurrentKm/branchId faltantes en flujo dashboard rompen km e iniciar clase
> id: fix-133-m-vehicleid-faltante-dashboard-km
> refs: —
> status: done
> closed: 2026-08-06
> created: 2026-08-06

## Root Cause

`ClasePracticaActionRow` (`core/utils/live-class-action.utils.ts`) — la fila que
`dashboard.component.ts` pasa a `AsistenciaClaseBFacade.selectPractica()` cuando el
admin/secretaria inicia o finaliza una clase práctica desde el panel "Clases Actuales"
del Dashboard — es un subconjunto de `ClasePracticaRow` (el modelo completo que sí usan
las páginas dedicadas `admin-asistencia` / `secretaria-asistencia`). Le faltan
`vehicleId`, `vehicleCurrentKm` y `branchId`. La llamada a `selectPractica(plan.row as any)`
usa un cast que se salta el chequeo de tipos, así que TypeScript nunca marcó el defecto.

Como consecuencia, cuando el flujo se dispara desde el Dashboard (no desde Asistencia):

1. **`finishClass()`** (`asistencia-clase-b.facade.ts:443`) lee
   `this._selectedPractica()?.vehicleId` para propagar `km_end` a `vehicles.current_km`.
   Al ser `undefined`, el `if (vehicleId)` nunca entra y el update se salta en silencio
   — sin error, sin toast. La sesión guarda `km_start`/`km_end` correctamente, pero el
   vehículo se queda con su `current_km` desactualizado (visto en producción: sesión 611,
   `km_end: 6579`, vehículo XXYZ34 seguía en `0 km`).
2. **`admin-iniciar-clase-drawer.component.ts:232`** lee `cls?.vehicleCurrentKm` para
   precargar el odómetro — sin el dato, el campo arranca vacío en vez de mostrar el km
   actual real.
3. **`admin-iniciar-clase-drawer.component.ts:244`** solo llama
   `facade.loadVehiclesByBranch(cls.branchId)` si `cls.branchId` existe — sin el dato, el
   selector de vehículo nunca se puebla (`vehiclesPorSede()` queda vacío) y el `@if
   (facade.vehiclesPorSede().length > 0)` del template oculta el dropdown por completo,
   impidiendo reasignar vehículo desde este flujo.

La causa raíz única: el `SELECT` de Supabase en `DashboardFacade` (`PRACTICA_SELECT`) no
trae `vehicles.id` ni `vehicles.current_km`, y `mapPracticaRow()` no propaga
`enrollments.branch_id` — así que ni siquiera había de dónde sacar esos campos para
completar `ClasePracticaActionRow`.

## ACs Afectados
- AC-1: al finalizar una clase práctica desde el panel del Dashboard, `vehicles.current_km`
  se actualiza al `km_end` registrado (igual que ya ocurre desde Asistencia).
- AC-2: al iniciar una clase práctica desde el panel del Dashboard, el odómetro se
  precarga con el km actual real del vehículo.
- AC-3: al iniciar una clase práctica desde el panel del Dashboard, el selector de
  vehículo se puebla y preselecciona el vehículo de la sesión (paridad con Asistencia).

## Cambio
- **Archivo:** `src/app/core/facades/dashboard.facade.ts`
  **Qué cambia:** `PRACTICA_SELECT` agrega `vehicles(id, ..., current_km)`; `mapPracticaRow()`
  mapea `vehicleId`, `vehicleCurrentKm` y `branchId` (desde `enrollments.branch_id`) al
  `LiveClassModel`.
- **Archivo:** `src/app/core/models/ui/dashboard.model.ts`
  **Qué cambia:** `LiveClassModel` agrega `vehicleId?`, `vehicleCurrentKm?`, `branchId?`.
- **Archivo:** `src/app/core/utils/live-class-action.utils.ts`
  **Qué cambia:** `ClasePracticaActionRow` agrega los mismos 3 campos; `baseRow` en
  `resolveLiveClassActionPlan()` los propaga desde `cls`.

## Test de Regresión
- `src/app/core/utils/live-class-action.utils.spec.ts > propaga vehicleId, vehicleCurrentKm y branchId en el row de iniciar/finalizar` ✓
