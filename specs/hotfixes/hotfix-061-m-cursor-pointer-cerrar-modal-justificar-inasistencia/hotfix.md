# Hotfix: Cursor pointer en botón cerrar modal "Justificar Inasistencia"
> id: hotfix-061-m-cursor-pointer-cerrar-modal-justificar-inasistencia
> refs: —
> status: done
> closed: 2026-08-08
> created: 2026-08-08

## Problema
El botón X para cerrar el modal "Justificar Inasistencia" no muestra `cursor: pointer` al pasar el mouse.

## Cambios
- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts` — agregar clase `cursor-pointer` al botón de cerrar (X) del modal.
