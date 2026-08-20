# Hotfix: Eliminar botón "Exportar PDF" muerto en liquidación de instructor
> id: hotfix-081-m-eliminar-boton-exportar-pdf-liquidacion
> refs: —
> status: done
> closed: 2026-08-20
> created: 2026-08-20

## Problema
En "Registro Diario (Mes Actual)" (liquidación instructor) hay un botón "Exportar PDF"
sin `(click)` ni handler — no hace nada al presionarlo.

## Cambios
- **Archivo:** `src/app/features/instructor/liquidacion/instructor-liquidacion.component.ts`
  — eliminar el botón "Exportar PDF" del header de la tabla "Registro Diario (Mes Actual)".
