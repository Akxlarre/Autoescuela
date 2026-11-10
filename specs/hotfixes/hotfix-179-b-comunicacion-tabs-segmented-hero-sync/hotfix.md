# Hotfix: rediseño visual de tabs de canal en comunicación y sincronización de hero
> id: hotfix-179-b-comunicacion-tabs-segmented-hero-sync
> refs: —
> status: done
> created: 2026-11-09
> closed: 2026-11-09

## Problema
1. En `/admin/tareas`, los tabs de canal (`Comunicados a alumnos` / `Tareas del equipo`) flotaban sobre el fondo gris usando la variante `line`, con la misma línea azul de 3px que las pestañas internas de la tarjeta de tareas ("muñeca rusa"), generando ruido visual y falta de jerarquía.
2. Los botones de acción y los KPIs del Hero estaban desalineados cuando el canal activo era "comunicados": mostraban "Nueva comunicación" como primario y métricas de tareas de equipo.

## Cambios
1. `src/app/features/admin/tareas/admin-tareas.component.ts`:
   - Cambiar los tabs de canal a `variant="segmented"` con soporte de íconos (`megaphone` y `clipboard-list`).
   - Sincronizar dinámicamente el botón principal del Hero según el canal activo (`canal()`): "Nuevo comunicado" primario en `comunicados`, "Nueva tarea" primario en `tareas`.
   - Renombrar "Nueva comunicación" a "Nueva tarea" con ícono `clipboard-list` para eliminar la ambigüedad con "Nuevo comunicado".
   - Adaptar KPIs y `contextLine` del Hero al canal activo (mostrar métricas de comunicados cuando `canal() === 'comunicados'`).
2. `src/app/shared/components/tabs/tabs.component.ts`:
   - Asegurar que `.tabs-segmented-row` tenga clase `w-fit` para que adopte el ancho intrínseco de sus opciones en lugar de estirarse al 100% como bloque huérfano.
