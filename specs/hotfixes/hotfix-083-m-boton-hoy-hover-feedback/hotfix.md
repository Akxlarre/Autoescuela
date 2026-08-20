# Hotfix: Botón "Hoy" del horario semanal sin feedback visual de hover
> id: hotfix-083-m-boton-hoy-hover-feedback
> refs: —
> status: done
> closed: 2026-08-20
> created: 2026-08-20

## Problema
El botón "Hoy" en `WeeklyScheduleGridComponent` ya tiene `cursor-pointer`, pero no
cambia de color al pasar el mouse — no da ninguna señal visual de que es clickeable.

## Cambios
- **Archivo:** `src/app/shared/components/weekly-schedule-grid/weekly-schedule-grid.component.ts`
  — botón "Hoy": agregar `hover:bg-subtle` (ya tiene `transition-colors`, solo falta el
  estado hover).
