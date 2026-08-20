# Hotfix: Flechas de navegación de semana sin feedback visual de hover
> id: hotfix-084-m-flechas-navegacion-hover-feedback
> refs: hotfix-083-m-boton-hoy-hover-feedback
> status: done
> closed: 2026-08-20
> created: 2026-08-20

## Problema
Igual que el botón "Hoy" (hotfix-083), las flechas "Semana anterior" / "Siguiente
semana" en `WeeklyScheduleGridComponent` tienen `cursor-pointer` y `transition-colors`
pero ningún `hover:bg-*` — no dan señal visual de que son clickeables.

## Cambios
- **Archivo:** `src/app/shared/components/weekly-schedule-grid/weekly-schedule-grid.component.ts`
  — botones "Semana anterior" y "Siguiente semana": agregar `hover:bg-subtle` (mismo
  token usado en hotfix-083 para "Hoy").
