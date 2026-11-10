# Hotfix: orden de pestañas de canal en comunicación
> id: hotfix-178-b-comunicacion-orden-tabs-canal
> refs: —
> status: done
> created: 2026-11-09
> closed: 2026-11-09

## Problema
En la pantalla de Comunicación (`/admin/tareas`):
Se requiere cambiar el orden de las pestañas principales de canal para priorizar "Comunicados a alumnos" antes de "Tareas del equipo".

## Cambios
- `src/app/features/admin/tareas/admin-tareas.component.ts`:
  Invertir el orden en `canalTabs` para que `comunicados` sea el primer tab y `tareas` el segundo.
