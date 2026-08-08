# Fix: Actividad Reciente — cursor-pointer en eventos cuyo alumno ya fue eliminado
> id: fix-144-m-actividad-reciente-cursor-pointer-alumno-eliminado
> refs: fix-142-m-actividad-reciente-entity-id-no-es-student-id
> status: done
> closed: 2026-08-08
> created: 2026-08-08

## Root Cause
`isClickable(item)` (introducido en `fix-141-m`/`fix-142-m`) decide si un item lleva
`cursor-pointer` mirando solo si `item.entity` es de tipo alumno y `item.entityId` está
presente — nunca verifica si la fila referenciada (`enrollments`/`class_b_sessions`) sigue
existiendo. Cuando el alumno fue eliminado, el cascade delete borra sus `enrollments` y
`class_b_sessions`, así que `resolveStudentIdForActivity()` (llamado recién en el click,
de forma async) resuelve `null` — `handleItemClick` no navega a ningún lado, pero el item
ya se renderizó con `cursor-pointer` y hover, dando una afordancia de link falsa.

## ACs Afectados
- Ninguno — fix autónomo (no hay spec activa; corrección de bug reportado por el owner).

## Cambio
- **Archivo:** `src/app/features/dashboard/recent-activity-drawer/recent-activity-drawer.component.ts`
  **Qué cambia:** al cargar `activities()` en `ngOnInit`, se resuelven en paralelo (antes de
  quitar el skeleton) los `students.id` de todos los items de entidad alumno vía
  `dashboardFacade.resolveStudentIdForActivity()`, cacheando el resultado en un signal
  `Map<string, number | null>` (`resolvedStudentIds`). `isClickable()` pasa a consultar ese
  cache (en vez de solo comprobar `entityId`), así que un item cuyo alumno fue eliminado ya
  no muestra `cursor-pointer`/hover. `handleItemClick()` reutiliza el mismo cache en lugar
  de re-resolver.

## Test de Regresión
- Verificación manual: un evento "Nueva clase práctica"/"Matrícula actualizada" de un
  alumno eliminado ya no muestra `cursor-pointer` ni responde al click; un evento del mismo
  tipo de un alumno vigente sigue navegando correctamente.
- **Verificado en sesión (2026-08-08) contra BD real vía Playwright/REST autenticado,**
  ejecutando la misma query que usa `resolveStudentIdForActivity` para `class_b_sessions`:
  - Fila existente (`id=133`, caso ya probado en fix-142-m) → resuelve `student_id=37`
    correctamente → `isClickable` = true.
  - Fila inexistente (`id=999999999`, simula el cascade delete que deja huérfano el
    `entity_id` de un alumno eliminado) → la query devuelve `[]` → `resolveStudentIdForActivity`
    resuelve `null` → con el cache nuevo, `isClickable` = false (antes del fix habría sido
    `true` porque solo miraba `entityId`).
  - No se encontró en la ventana de datos actual (últimos 50 audit_log) ningún evento real
    de `class_b_sessions`/`enrollments` de un alumno ya eliminado para reproducir el
    `cursor-pointer` visualmente en vivo; la cobertura queda a nivel del mecanismo de
    resolución, que es la pieza que decide la clase CSS.
