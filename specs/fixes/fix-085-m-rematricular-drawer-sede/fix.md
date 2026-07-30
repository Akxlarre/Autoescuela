# Fix: Re-matricular en Ex-alumnos abre drawer (no redirige) y precarga sede
> id: fix-085-m-rematricular-drawer-sede
> refs: fix-020-m-rematricula-ex-alumnos
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause

El botón "Re-matricular" de las 4 vistas de Ex-alumnos (Clase B y Profesional, admin y
secretaria) hace `router.navigate(['/app/{rol}/matricula'], { queryParams: { rut } })`,
sacando al usuario de la vista de Ex-alumnos hacia una página completa. El wizard
("Nueva Matrícula") ya está disponible como drawer en otros puntos de entrada
(`LayoutDrawerFacadeService.open(SecretariaMatriculaComponent, ...)`, ej. dashboard y
`app-alumnos-list-content`), por lo que este flujo debería converger al mismo patrón en
vez de una navegación de página completa. Además, para el admin (que ve el wizard
scopeado por `BranchFacade.selectedBranchId()`), la sede del alumno a re-matricular no
se precarga — si el admin tiene "Todas las escuelas" seleccionado, el wizard cae en el
`branch-gate` obligando a re-elegir la sede manualmente aunque ya se sabe cuál es.

## ACs Afectados

- AC3 de fix-020-m (precarga de datos personales al Re-matricular) se mantiene intacto:
  se sigue usando el mismo mecanismo de query param `rut` leído por
  `SecretariaMatriculaComponent.ngOnInit()`, solo que ahora sin cambiar de ruta.
- Nuevo: el botón "Re-matricular" abre el wizard en drawer sobre la vista actual y, para
  admin, precarga `BranchFacade.selectedBranchId` con la sede del alumno.

## Cambio

- **Archivo:** `src/app/core/models/ui/egresado-table.model.ts` — agrega `branchId: number | null`.
- **Archivo:** `src/app/core/facades/ex-alumnos.facade.ts` — trae `branches.id` en el select y lo mapea a `branchId`.
- **Archivos:** `secretaria-ex-alumnos.component.ts`, `admin-ex-alumnos.component.ts`,
  `secretaria-ex-alumnos-profesional.component.ts`, `admin-ex-alumnos-profesional.component.ts`
  — `reEnroll()` deja de navegar a la página `/matricula`; en su lugar setea el
  queryParam `rut` sobre la ruta actual (`router.navigate([], { relativeTo: route, queryParams, queryParamsHandling: 'merge' })`),
  precarga la sede vía `BranchFacade.selectBranch(egresado.branchId)` cuando aplica
  (vistas de admin), y abre `SecretariaMatriculaComponent` con `LayoutDrawerFacadeService.open()`.

## Test de Regresión

- `src/app/core/facades/ex-alumnos.facade.spec.ts > mapRow incluye branchId` ✓
- `src/app/features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.spec.ts > reEnroll confirmado abre el drawer y precarga la sede del egresado` ✓
