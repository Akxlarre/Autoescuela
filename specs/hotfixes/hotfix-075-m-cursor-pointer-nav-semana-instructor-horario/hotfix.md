# Hotfix: cursor-pointer en botones de navegación de semana (Mi Horario instructor)
> id: hotfix-075-m-cursor-pointer-nav-semana-instructor-horario
> refs: —
> status: done
> closed: 2026-08-14
> created: 2026-08-14

## Problema
Los botones de navegación de semana (‹, Hoy, ›) en `app-weekly-schedule-grid` — usado en
"Mi Horario" del instructor — no muestran `cursor: pointer` al pasar el mouse, pese a ser
interactivos.

## Cambios
- **Archivo:** `src/app/shared/components/weekly-schedule-grid/weekly-schedule-grid.component.ts` — agregar clase `cursor-pointer` a los 3 botones de navegación (prev, Hoy, next)
