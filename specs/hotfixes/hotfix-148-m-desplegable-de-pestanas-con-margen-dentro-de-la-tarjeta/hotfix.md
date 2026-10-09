# Hotfix: el desplegable de pestañas queda pegado a los bordes de la tarjeta de tareas
> id: hotfix-148-m-desplegable-de-pestanas-con-margen-dentro-de-la-tarjeta
> refs: ASG-i-025, fix-319-m, fix-355-m
> status: done
> closed: 2026-10-07
> created: 2026-10-07

## Problema
En la lista de Comunicación, las pestañas ("Asignadas por mí / Dirigidas a mí / Observaciones")
van a ras de la tarjeta, que es lo correcto para pestañas de línea. Pero cuando no caben y pasan a
un desplegable (móvil; desde `fix-355-m` ese es el modo que se usa), el desplegable también queda a
ras: su borde tapa las esquinas redondeadas de la tarjeta.

## Cambios
- `tabs.component.ts`: el componente marca su elemento con la clase `tabs-as-select` cuando está en
  modo desplegable (no cambia su apariencia propia).
- `task-list-content.component.ts`: con esa clase, las pestañas de la tarjeta llevan margen
  (16 px a los lados y 12 px arriba, el mismo de la lista de abajo).

## Verificación
- Navegador a 375 px: el desplegable queda dentro de la tarjeta, con margen; a 1440 px las pestañas
  de línea siguen a ras.
- Hecho (2026-10-07, admin, `/app/admin/tareas`): a 375 px el desplegable de la tarjeta queda a
  17 px de los lados y 13 px del borde superior (antes 1 px), captura revisada; a 1440 px las
  pestañas de línea siguen a ras (1 px). La barra de canales, que no está en una tarjeta, no
  cambia. `tsc` sin errores, `lint:arch` 0 errores, unitarios 3473 en verde.
