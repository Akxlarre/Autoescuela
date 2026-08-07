# Hotfix: Footer Volver/Siguiente inalcanzable en Paso 2 del wizard de matrícula
> id: hotfix-055-m-assignment-step-footer-sin-scroll
> refs: —
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Problema
En el Paso 2 "Asignación y Horarios" del wizard de Nueva Matrícula (drawer secretaria), al
navegar a una semana del `schedule-grid` con muchos días/slots, el contenido de la card crece
(grilla + resumen "Tu horario") y el footer con los botones "Volver"/"Siguiente" —que vive
dentro del flujo normal de `assignment.component.html`, no como footer fijo tipo
`app-drawer-form`— queda fuera del área visible del scroll, dando la sensación de que la
matrícula no se puede continuar.

## Cambios
- **Archivo:** `src/app/shared/components/matricula-steps/assignment/assignment.component.html` — hacer el footer de acciones (Volver/Siguiente) `sticky bottom-0` dentro del contenedor de scroll del wizard, para que quede siempre visible sin importar cuánto crezca el contenido superior.
