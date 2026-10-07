# Hotfix: El selector de sede de Ajustes se salta los bloqueos del topbar
> id: hotfix-063-b-ajustes-selector-sede-respeta-bloqueos
> refs: ASG-i-037 (sospecha S15, caso A10 del checklist 037; confirmada en fix-190-b)
> status: closed
> created: 2026-10-06

## Problema
El selector de sede del topbar deshabilita "Todas las escuelas" cuando la vista exige una sede
(Nueva Matrícula, Caja) y las sedes bloqueadas (ficha del alumno, vistas Profesional). El bloque
"Sede activa" de Ajustes llama `branchFacade.selectBranch()` sin mirar nada: el admin puede quedar
en "Todas" a mitad del wizard de matrícula (cruza con `023 · S21`) o en una sede sin Profesional.

## Cambios
- **Archivo:** `src/app/core/facades/branch.facade.ts` (+ spec) — `trySelectBranch(id)`: elige la sede
  solo si no está bloqueada ("Todas" con `requiresSpecificBranch`, o un id de `disabledBranchIds`).
  Devuelve si cambió. `selectBranch()` no cambia (lo usan cambios internos, p. ej. volver a la sede
  previa tras re-matricular).
- **Archivo:** `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts` — usa
  `trySelectBranch`; las opciones bloqueadas se ven deshabilitadas con el motivo (`lockReason`), como
  en el topbar.

## Verificación
- `vitest` de `BranchFacade`; `ng build`, `lint:arch`, `test:ci`.

## Resultado (2026-10-06)
- `branch.facade.spec.ts` 49/49 (3 nuevos para `trySelectBranch`); `test:ci` 3365 ✓; `ng build` ✓;
  `lint:arch` 0 errores.
- Playwright sobre build de prod: admin en `/app/admin/matricula` → Ajustes → "Todas las escuelas"
  queda `disabled` con title "Se requiere una sede para esta vista"; las sedes siguen elegibles.
