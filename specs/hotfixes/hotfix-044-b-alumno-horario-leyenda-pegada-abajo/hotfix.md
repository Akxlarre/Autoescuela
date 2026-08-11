# Hotfix: Revertir centrado vertical de hotfix-043-b — la leyenda debe quedar pegada abajo, no todo el bloque centrado

> id: hotfix-044-b-alumno-horario-leyenda-pegada-abajo
> status: done
> closed: 2026-08-09
> created: 2026-08-09

## Problema

hotfix-043-b interpretó mal el pedido del usuario: agregó `justify-center` a la card completa
del calendario, centrando el bloque entero (nav + grilla + leyenda) como grupo dentro del alto
disponible. Lo que el usuario pidió es más simple: que la leyenda "Completada / Agendada /
Inasistencia / Cancelada" quede pegada abajo de la card — nav y grilla se quedan arriba, el
hueco vacío queda ENTRE la grilla y la leyenda (empujando la leyenda al fondo), no repartido
arriba y abajo del bloque completo.

## Cambios

- **Archivo:** `src/app/features/alumno/horario/alumno-horario.component.ts`
  - Card del calendario: se quita `justify-center` (agregado por error en hotfix-043-b). Queda
    `class="horario-calendar-card bento-banner bento-fill card flex flex-col gap-4 h-full
    overflow-y-auto"`.
  - La leyenda (`.horario-legend`) gana `mt-auto`: en un contenedor `flex flex-col`, un margen
    superior `auto` absorbe todo el espacio sobrante encima de ese elemento, empujándolo al
    fondo de la card sin afectar la posición de la grilla/nav arriba.
