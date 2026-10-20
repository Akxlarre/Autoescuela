# Hotfix: la fecha límite de una tarea queda un día antes y "Vencida" cuenta las completadas
> id: hotfix-100-b-tareas-fecha-limite-vencida
> refs: ASG-i-035 (checklist 035, S9 / S10 · B12, C03, D17)
> status: done
> created: 2026-10-20

## Problema
- **S9:** el selector entrega `AAAA-MM-DD` y se guardaba tal cual en `tasks.due_date`
  (`timestamptz`): medianoche UTC, que en Chile es las 21:00/20:00 del día anterior. Una tarea con
  fecha límite "hoy" mostraba "Vence <ayer>" y salía "Vencida" desde que se creaba (verificado en
  e2e: "hoy" 20-oct → `2026-10-20T00:00:00+00:00` → "Vence 19 oct · Vencida").
- **S10:** `isOverdue` solo miraba la fecha: una tarea completada con fecha pasada seguía
  "Vencida" y contaba en el KPI Vencidas.

## Cambios
- **Archivo:** `src/app/core/utils/task.utils.ts` (+ spec): `dueDateToInstant(dia)` = 23:59 hora de
  Chile de ese día (`chileWallTimeToInstant`); `isOverdue(due, now, status)` → `false` si está
  completada.
- **Archivo:** `src/app/core/facades/tasks.facade.ts`: guarda `due_date` con `dueDateToInstant`.

No hay tareas con fecha límite en la BD (verificado), así que no hace falta corregir datos.

## Verificación
- [x] vitest de `task.utils` (90 con el facade) y `test-tz` en 3 zonas.
- [x] e2e `comunicacion-tareas.spec.ts` B12 ("hoy" → `02:59Z` del día siguiente, "Vence 20 oct", sin "Vencida") y C03.
