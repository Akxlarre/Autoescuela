# Hotfix: Limpieza de UI en "Evaluación Práctica" (instructor)
> id: hotfix-072-m-limpieza-ui-evaluacion-practica
> refs: —
> status: done
> closed: 2026-08-22 — cierre tardío (el auto-cierre de hotfix no corrió). Verificado en `instructor-evaluacion.component.ts`: sin `max-w-4xl`, back-button dice "Ficha Técnica" (`:47`) y la barra inferior usa `bg-surface ... justify-end gap-3` (`:248`).
> created: 2026-08-13

## Problema
`InstructorEvaluacionComponent` tiene varios problemas de UI: contenido centrado con `max-w-4xl` dejando espacio libre excesivo a los lados; el back-button superior dice "Mis Alumnos" cuando en realidad navega a la Ficha Técnica del alumno, y le falta `cursor-pointer`; hay un botón "Volver" redundante arriba a la derecha que duplica al back-button; y la barra de acciones inferior (`bg-subtle`, `justify-between`) se ve como una caja cuadrada desconectada del resto de la card, con un botón "Cancelar" que también duplica al back-button.

## Cambios
- **Archivo:** `src/app/features/instructor/evaluacion/instructor-evaluacion.component.ts` —
  1. Quitar `max-w-4xl mx-auto` del contenedor raíz.
  2. Cambiar el texto del back-button de "Mis Alumnos" a "Ficha Técnica" y agregar `cursor-pointer`.
  3. Eliminar el botón "Volver" redundante de arriba a la derecha y el wrapper `flex items-center justify-between` que ya no hace falta.
  4. Cambiar la barra de acciones inferior de `bg-subtle`/`justify-between` a `bg-surface`/`justify-end gap-3` (patrón canónico de `DrawerFormComponent`), y eliminar el botón "Cancelar" del paso 1 (queda solo "Siguiente" a la derecha; "Atrás" se mantiene en pasos 2-3).
