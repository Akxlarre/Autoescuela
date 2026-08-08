# Hotfix: Cursor pointer en botones "Justificar" y cerrar del drawer de Inasistencias Registradas
> id: hotfix-062-m-cursor-pointer-justificar-inasistencias-drawer
> refs: —
> status: done
> closed: 2026-08-08
> created: 2026-08-08

## Problema
En el drawer de detalle de alumno B, los botones "Justificar" del bloque "Inasistencias Registradas" y el botón X de cerrar del modal "Justificar Inasistencia" no muestran `cursor: pointer` al pasar el mouse.

## Cambios
- **Archivo:** `src/app/features/admin/alumno-detalle/inasistencias-drawer/admin-inasistencias-drawer.component.ts` — agregar clase `cursor-pointer` a los botones "Justificar" y al botón de cerrar (X) del modal "Justificar Inasistencia".
