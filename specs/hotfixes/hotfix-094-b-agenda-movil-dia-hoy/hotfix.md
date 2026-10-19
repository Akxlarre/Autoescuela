# Hotfix: en el celular la Agenda abre en el lunes, no en el día de hoy
> id: hotfix-094-b-agenda-movil-dia-hoy
> refs: ASG-i-026 (checklist 026, P03; decisión del owner 2026-10-19)
> status: closed
> created: 2026-10-19

## Problema
En móvil la Agenda muestra un día a la vez y siempre partía en el lunes (`mobileDayIndex = 0`),
aunque hoy fuera jueves. Decisión: abrir en el día de hoy.

## Cambios
- **Archivo:** `src/app/core/utils/agenda-week.utils.ts` (+ spec) — `initialMobileDayIndex(days)`:
  el índice del día de hoy si está en la semana; si no (otra semana, fin de semana), 0.
- **Archivo:** `src/app/shared/components/agenda-semanal/agenda-semanal.component.ts` — lo aplica
  al cambiar de semana (no en cada recarga de datos, para no pisar el día que eligió la persona).

## Verificación
- [x] vitest del util.
- [x] e2e: en 375 px la pestaña activa es la de hoy (en día hábil).
