# Fix: KPIs incorrectos en vista de secretaria
> id: fix-002-b-kpis-incorrectos-vista-secretaria
> refs: 0001-sistema-de-tareas-multi-rol
> status: done
> closed: 2026-05-21
> created: 2026-05-21

## Root Cause
Los computeds `pendingMineCount` y `toInstructorTasks` en `SecretariaObservacionesComponent`
filtran sobre `sentTasks()` (lo que la secretaria envió), cuando deberían medir
la carga de trabajo propia (lo que tiene pendiente de resolver) y las tareas activas
a instructores respectivamente.

- `pendingMineCount` cuenta tareas enviadas por la secretaria que el receptor no completó.
  Debería contar tareas RECIBIDAS por la secretaria que ella no completó aún.
- `toInstructorTasks` incluye tareas completadas a instructores. Debería mostrar solo las activas.

## ACs Afectados
- Ninguno — fix autónomo (los ACs de la spec no especificaron estos computeds)

## Cambios
- **`src/app/features/secretaria/observaciones/secretaria-observaciones.component.ts`**
  → `pendingMineCount`: cambiar de `sentTasks().filter(pending)` a `receivedTasks().filter(status !== completed)`
  → `toInstructorTasks`: agregar filtro `status !== 'completed'` para mostrar solo activas

## Test de Regresión
- Verificación manual: KPI "Mis pendientes" en vista secretaria debe reflejar tareas
  recibidas no resueltas, no tareas enviadas. KPI "A instructores" debe decrementar
  cuando una tarea a instructor se completa.
