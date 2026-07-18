# Hotfix: eliminar componente muerto app-branch-course-selector
> id: hotfix-018-b-eliminar-componente-muerto-branch-course-selector
> status: done
> closed: 2026-07-01
> created: 2026-07-01

## Problema
`BranchCourseSelectorComponent` (`shared/components/matricula-steps/branch-course-selector/`) no tiene ningún consumidor: grep por clase (`BranchCourseSelectorComponent`) solo encuentra su propio archivo de definición, y grep por selector (`<app-branch-course-selector`) da 0 en todo `src/app`. Tampoco aparece con consumidores en `indices/USAGE-MAP.md`. Es código muerto que además figura como "✅ Estable" en `indices/COMPONENTS.md`, induciendo a reutilizarlo.

## Cambios
- **Archivo:** `src/app/shared/components/matricula-steps/branch-course-selector/branch-course-selector.component.ts` — eliminar (carpeta completa; único archivo dentro)
- **Archivo:** `indices/COMPONENTS.md` — quitar las 2 entradas de `app-branch-course-selector` (líneas 72 y 357)
