# Fix: Drawers muestran datos de todas las sedes en vez de una

> id: fix-090-m-drawers-scope-sede
> refs: ASG-b-043
> status: done
> closed: 2026-07-30
> created: 2026-07-30

## Root Cause

Auditoría completa (2026-07-30) de los ~57 componentes drawer de la app y sus Facades:
24 Facades ya aplican `resolveBranchScope()`/`getActiveBranchId()` (fix-027/fix-063), y
el resto o son de detalle de una sola entidad ya resuelta (no listan cruzando sedes) o
tienen scope propio legítimo (`instructor_id`, `recipient_id`, relatores/`lecturers` sin
`branch_id`). Se detectaron exactamente **2 Facades con la fuga real**, ambas del dominio
Clase Profesional / Promociones, que nunca adoptaron el patrón de fix-027 pese a que
`professional_promotions.branch_id` existe y la RLS (`select_professional_promotions`)
solo valida rol, no sede:

1. `core/facades/promociones.facade.ts:76-92` (`fetchData()`) — consulta
   `professional_promotions` sin filtro de `branch_id` ni `BranchFacade` inyectado. Alimenta
   los drawers `admin-promocion-crear/editar/ver-drawer`
   (`features/admin/profesional-promociones/`). Admin/secretaria ven y pueden editar
   promociones de todas las sedes sin importar la sede seleccionada.
   Además, `crearPromocion()` (línea 256) graba `branch_id: 2` **hardcodeado** ("Conductores
   Chillán") en vez de la sede activa — toda promoción nueva queda mal asignada salvo que
   la sede activa sea justo la 2.
2. `core/facades/asistencia-profesional.facade.ts:206-211` (`loadPromociones()`) — misma
   consulta sin filtro. Alimenta `admin-sesion-drawer` vía
   `admin-profesional-asistencia.component.ts`, que inyecta `BranchFacade` pero solo para
   `setProfessionalOnly()` — nunca lee `selectedBranchId()`.

Referencia correcta ya existente en el mismo dominio:
`CertificacionProfesionalFacade.getActiveBranchId()` (`certificacion-profesional.facade.ts:445-457`)
aplica `resolveBranchScope()` sobre datos adyacentes a estas mismas promociones — es el
patrón a copiar, reusando `resolveBranchScope()`/`branch-scope.utils.ts` (fix-027), sin
escribir un helper nuevo.

Ambas vistas (`AdminProfesionalPromocionesComponent`,
`AdminProfesionalAsistenciaComponent`) ya llaman `branchFacade.setProfessionalOnly(true)`
en `ngOnInit`, lo que fuerza `requiresSpecificBranch=true` y deshabilita "Todas las
escuelas" — `selectedBranchId()` nunca es `null` mientras estas vistas están activas, así
que no hay ambigüedad de a qué sede asignar una promoción nueva.

Ningún otro drawer mostró la fuga (evidencia completa del barrido en el reporte de
auditoría de esta sesión — no se repite acá para no duplicarla).

## ACs Afectados

- AC1: Con una sede seleccionada (admin) o la sede propia (secretaria), el listado de
  Promociones (`admin-promocion-ver-drawer` y la tabla que lo alimenta) solo muestra
  promociones de esa sede.
- AC2: `admin-sesion-drawer` (Asistencia Profesional) solo ofrece promociones/cursos de la
  sede activa para tomar asistencia.
- AC3: Crear una promoción nueva la asigna a la sede activa (`BranchFacade.selectedBranchId()`
  resuelta vía `resolveBranchScope()`), nunca a un `branch_id` hardcodeado.
- AC4 (no-regresión, fix-002-b): ningún otro drawer/lista pierde datos que sí correspondía
  mostrar — el barrido confirmó que el resto de facades branch-scoped ya filtran
  correctamente y las que no filtran no deben hacerlo (scope propio o recurso nacional).

## Cambio

- **Archivo:** `src/app/core/facades/promociones.facade.ts` — inyectar `AuthFacade` +
  `BranchFacade`, agregar `getActiveBranchId()` (mismo wrapper que el resto de facades),
  aplicar `.eq('branch_id', branchId)` en `fetchData()` cuando `branchId !== null`, y usar
  `getActiveBranchId()` en vez de `branch_id: 2` en `crearPromocion()`.
- **Archivo:** `src/app/core/facades/asistencia-profesional.facade.ts` — agregar
  `BranchFacade` (ya tiene `AuthFacade` inyectado) + `getActiveBranchId()`, aplicar el mismo
  filtro en `loadPromociones()`.
- **Archivo:** `src/app/features/admin/profesional-promociones/admin-profesional-promociones.component.ts`
  y `src/app/features/admin/profesional-asistencia/admin-profesional-asistencia.component.ts`
  — agregar `effect()` en el constructor que trackee `branchFacade.selectedBranchId()` y
  dispare `facade.initialize()`, igual que `AdminAlumnosComponent` (reactividad vive en el
  Smart Component, no en el Facade, por regla de `facades.md`).

## Test de Regresión

- `promociones.facade.spec.ts > PromocionesFacade — scope de sede (fix-090)` — 3 tests ✓
  (`fetchData()` filtra/no filtra según sede activa; `crearPromocion()` usa la sede activa).
- `asistencia-profesional.facade.spec.ts > AsistenciaProfesionalFacade — scope de sede (fix-090)`
  — 2 tests ✓ (`loadPromociones()` filtra/no filtra según sede activa).
- Suite completa: `npm run test:ci` → 1565 passed, 3 skipped (2026-07-30).
