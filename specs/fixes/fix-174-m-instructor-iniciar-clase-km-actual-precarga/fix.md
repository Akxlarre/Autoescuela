# Fix: Precarga de kilometraje actual del vehículo en Iniciar Clase (instructor)
> id: fix-174-m-instructor-iniciar-clase-km-actual-precarga
> refs: —
> status: done
> closed: 2026-08-13
> created: 2026-08-13

## Root Cause
`InstructorClasesFacade.loadClassDetail()` selecciona `vehicles(id, license_plate, brand, model)`
sin `current_km`, y `InstructorClaseComponent` inicializa `kmStart` en `null` sin nunca
sincronizarlo con el vehículo de la clase. El instructor ve el campo "Kilometraje Actual" vacío
en vez de precargado con `vehicles.current_km`, aunque el dato ya existe en BD (RF-087).

## ACs Afectados
Ninguno — fix autónomo.
- AC-1: Al abrir "Iniciar Clase" para una sesión con vehículo asignado, el campo de kilometraje
  viene precargado con `vehicles.current_km` (editable, no readonly).

## Cambio
- **Archivo:** `src/app/core/models/ui/instructor-portal.model.ts`
  **Qué cambia:** agrega `vehicleCurrentKm: number | null` a `InstructorClassRow`.
- **Archivo:** `src/app/core/facades/instructor-clases.facade.ts`
  **Qué cambia:** agrega `current_km` al select de `vehicles` en `loadClassDetail()` y lo mapea
  en `mapSessionToRow()`.
- **Archivo:** `src/app/features/instructor/clase/instructor-clase.component.ts`
  **Qué cambia:** al cargar `selectedClass()`, patchea `startForm.kmStart` con
  `vehicleCurrentKm` (solo si el control no fue tocado por el usuario).

## Test de Regresión
- `src/app/core/facades/instructor-clases.facade.spec.ts > loadClassDetail mapea vehicleCurrentKm desde vehicles.current_km` ✓
