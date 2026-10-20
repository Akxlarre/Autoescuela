# Hotfix: la secretaria no ve las tareas ni las consultas que le manda al admin
> id: hotfix-102-b-secretaria-pestana-enviadas
> refs: ASG-i-035 (checklist 035, S23 · C02, D05, D06)
> status: done
> created: 2026-10-20

## Problema
Las pestañas de la secretaria en Comunicación eran "Mis observaciones" (solo observaciones),
"Tareas recibidas" y "A instructores" (solo lo enviado a instructores, sin completadas). Una tarea o
consulta que ella le mandaba al admin no aparecía en ninguna: no podía ver la respuesta del admin ni
cerrar la consulta (D06 imposible). Encontrado en el e2e de fix-230-b.

Decisión del owner (2026-10-20): "A instructores" pasa a ser "Enviadas" — todo lo que ella envió
(tareas y consultas, al admin y a instructores), como "Asignadas por mí" del admin. Las
observaciones siguen en su pestaña.

## Cambios
- **Archivo:** `src/app/core/utils/task.utils.ts` (+ spec): `sentNonObservations(tareas)`.
- **Archivo:** `src/app/features/secretaria/observaciones/secretaria-observaciones.component.ts`:
  pestaña y KPI "Enviadas" (contador = no completadas).

## Verificación
- [x] vitest de `task.utils` (48).
- [x] e2e `comunicacion-tareas.spec.ts` D05/D06 (la secretaria abre su consulta en "Enviadas" y la cierra).
