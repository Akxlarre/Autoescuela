# Fix: Finalizar clase no actualiza el kilometraje del vehículo
> id: fix-189-m-instructor-finalizar-clase-no-actualiza-km-vehiculo
> refs: —
> status: done
> closed: 2026-08-14
> created: 2026-08-14

## Root Cause
`InstructorClasesFacade.finishClass()` (`instructor-clases.facade.ts:272`) guarda `km_end`
en `class_b_sessions` pero nunca propaga ese valor a `vehicles.current_km`. Aunque se
agregara esa llamada, la policy `update_vehicles` (migración `20260730100000`) solo permite
`admin`/`secretary` — el rol `instructor` no puede escribir en `vehicles` bajo ninguna
circunstancia, así que el kilometraje del vehículo queda desactualizado tras cada clase.

## ACs Afectados
Ninguno — fix autónomo (bug reportado en QA manual del flujo de Finalizar Clase).

## Cambio
- **Archivo:** `supabase/migrations/20260814172847_fix189_instructor_update_vehicle_km.sql`
  - Agrega `instructor` a `update_vehicles` (USING + WITH CHECK), acotado a vehículos con
    una `class_b_sessions` donde `instructor_id = auth_instructor_id()` (via subquery
    directa, no el helper, mismo patrón que fix-188).
  - Trigger `BEFORE UPDATE` en `vehicles` que, cuando quien escribe es `instructor`,
    rechaza el UPDATE si cualquier columna distinta de `current_km` cambió — evita que el
    permiso nuevo se use para tocar patente/estado/sede/etc.
- **Archivo:** `src/app/core/facades/instructor-clases.facade.ts`
  - `finishClass()` selecciona `vehicle_id` de la sesión (ya se hace fetch de `session` en
    el paso 1) y, tras actualizar `class_b_sessions`, actualiza `vehicles.current_km = kmEnd`
    para ese vehículo.

## Test de Regresión
- Verificación manual en la app: instructor finaliza una clase con un km final mayor al
  actual → `vehicles.current_km` del vehículo usado queda igual al km final registrado.
