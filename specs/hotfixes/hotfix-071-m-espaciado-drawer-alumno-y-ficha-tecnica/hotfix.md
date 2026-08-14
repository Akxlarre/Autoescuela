# Hotfix: Espaciado no canónico en drawer de alumno (instructor) y en Ficha Técnica
> id: hotfix-071-m-espaciado-drawer-alumno-y-ficha-tecnica
> refs: —
> status: done
> closed: 2026-08-13
> created: 2026-08-13

## Problema
Dos casos de espaciado incorrecto en el portal instructor:
1. En `StudentDrawerDetailComponent`, las secciones del `#content` (avatar, Contacto, Progreso, Próxima Clase) quedan pegadas entre sí porque `DrawerContentLoaderComponent` solo envuelve el contenido real en `class="h-full flex flex-col w-full"` (sin gap), mientras que el `#skeletons` sí usa `flex flex-col gap-5 p-6`.
2. En `InstructorFichaComponent` hay demasiado espacio vertical: falta `bento-grid--hero-fit` en el `.bento-grid` raíz (mismo problema que fix-081-m/hotfix-070-m), y además hay un `.bento-grid` anidado dentro de otro `.bento-grid` (único caso en el proyecto) envolviendo las cards de "Información del Alumno" y "Clases Prácticas", duplicando padding/gap pensados solo para el contenedor raíz.

## Cambios
- **Archivo:** `src/app/features/instructor/alumnos/components/student-drawer-detail.component.ts` — envolver las secciones del `#content` en `<div class="flex flex-col gap-5">` (sin `p-6`, porque `DrawerFormComponent` ya aplica `px-6 py-6`).
- **Archivo:** `src/app/features/instructor/ficha/instructor-ficha.component.ts` — agregar `bento-grid--hero-fit` al `.bento-grid` raíz; reemplazar el `.bento-grid` anidado (línea ~111) por `grid grid-cols-1 md:grid-cols-2 gap-6` y quitar los `data-col-span="4"` que ya no aplican.
