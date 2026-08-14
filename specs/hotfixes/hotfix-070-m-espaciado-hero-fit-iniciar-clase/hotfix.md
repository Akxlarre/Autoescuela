# Hotfix: Espaciado no canónico en "Iniciar Clase" (falta bento-grid--hero-fit)
> id: hotfix-070-m-espaciado-hero-fit-iniciar-clase
> refs: —
> status: done
> closed: 2026-08-13
> created: 2026-08-13

## Problema
En `InstructorClaseComponent` ("Iniciar Clase") el root `.bento-grid` no tiene el modificador `bento-grid--hero-fit`. La fila del hero slim (~60-90px de alto) hereda el piso `--bento-row-min` (120px) por el `align-items: stretch` por defecto del grid, dejando un espacio vacío visible debajo de la card del hero antes de la card de contenido. Es el mismo problema ya documentado y resuelto por `fix-081-m` con el modificador `bento-grid--hero-fit`.

## Cambios
- **Archivo:** `src/app/features/instructor/clase/instructor-clase.component.ts` — agregar la clase `bento-grid--hero-fit` al contenedor raíz `.bento-grid`.
