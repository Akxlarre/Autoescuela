# Hotfix: "Guardar Cambios" de Editar Perfil guarda una sola vez con doble clic
> id: hotfix-137-m-editar-perfil-guarda-una-vez-con-doble-clic
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Problema
Dos clics seguidos en "Guardar Cambios" envían dos veces `update-student-profile`: el botón se
deshabilita recién cuando la vista se vuelve a pintar, y `onSubmit()` no revisa si ya hay un
guardado en curso. Encontrado en la 3ª pasada de `fix-264-m` (`024b` M14); es B39.

## Cambios
- **Archivo:** `src/app/features/admin/alumno-detalle/editar-perfil-drawer/admin-editar-perfil-drawer.component.ts`
  — `onSubmit()` no hace nada si ya está guardando.
- **Archivo:** `e2e/alumnos-b-ficha.spec.ts` — test `M14 · M16` de la tercera pasada.
