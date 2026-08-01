# Plan — fix-013-i-precio-profesional-a2-incorrecto

> refs: ASG-b-016

## Root cause confirmada

`professional_a2` solo existe en la sede "Conductores Chillán" (branch 2), con
`base_price = 800000` (seed, sin overrides). El bug no está en la BD: está en
`EnrollmentFacade`, que tiene **4 puntos** resolviendo un curso por
`license_class` sin considerar `branch_id`:

- `enrollment.facade.ts:144` (`_requiredSlotCount`)
- `enrollment.facade.ts:250-251` (`studentSummary`)
- `enrollment.facade.ts:546` (verificación de re-matrícula)
- `enrollment.facade.ts:2074` (`resolveCourseId`, fallback — este SÍ filtra por
  `branch_id`, pero de forma duplicada/inconsistente con los otros 3)

Vector de contaminación de `_courses()`: `resumeDraft()` llama
`this.loadCourses()` **sin `branchId`** (línea 1563). Cuando `effectiveBranchId`
no resuelve (ej. usuario admin sin `branchId` propio), `loadCourses()` no aplica
`.eq('branch_id', ...)` y carga cursos de **todas las sedes mezclados** —
incluyendo el `class_b` de branch 2 sembrado en
`20260311100000_class_b_courses_branch2_and_enrollment_number_fix.sql` a
`$180.000`, el mismo monto exacto reportado en el bug.

## Cambio (Opción B + C)

**C — Cerrar el vector de contaminación:**
- `resumeDraft()`: pasar `enrollment.branch_id` a `loadCourses()` en vez de
  llamarlo sin argumento.

**B — Centralizar la resolución (Núcleo Funcional, `architecture.md`):**
- Nueva función pura en `core/utils/course-resolution.utils.ts`:
  `findCourseByLicenseClass(courses, licenseClass, options?: { branchId?: number; isSence?: boolean })`.
  Reemplaza la lógica repetida y ligeramente distinta en los 4 puntos.
- Reemplazar las 4 llamadas por esta función. Donde ya existe `branchId` en el
  scope (`savePersonalData`, `resolveCourseId`), pasarlo. Donde no existe
  (`_requiredSlotCount`, `studentSummary`, ambos computed que corren antes de
  crear el draft), no se agrega un filtro nuevo — se preserva el comportamiento
  actual para no romper el preview del wizard — pero quedan usando la MISMA
  función, lista para recibir `branchId` cuando estos computed lo tengan
  disponible a futuro.

## Archivos

- `src/app/core/utils/course-resolution.utils.ts` (nuevo)
- `src/app/core/utils/course-resolution.utils.spec.ts` (nuevo, TDD)
- `src/app/core/facades/enrollment.facade.ts` (edición)

## Test de Regresión

- `findCourseByLicenseClass`: dado un array con cursos de 2 sedes con el mismo
  `license_class` en ambas (ej. `class_b` en branch 1 a $350.000 y branch 2 a
  $180.000) y un `branchId` explícito, devuelve el curso de LA sede correcta.
- Sin `branchId`, devuelve el primer match (compat con comportamiento actual).
- Con `isSence: true`, filtra por código que contenga "sence"; sin él, excluye
  los que lo contengan.

## ACs

1. `resumeDraft()` pasa `branch_id` del enrollment a `loadCourses()`.
2. Los 4 lookups de curso por `license_class` en `enrollment.facade.ts` usan
   `findCourseByLicenseClass`.
3. `course-resolution.utils.spec.ts` cubre los 3 casos de arriba y pasa en
   `npm run test:ci`.
4. `enrollment.facade.spec.ts` sigue en verde (sin regresiones).
