# Fix: Precio Profesional A2 muestra $180.000 en vez de $800.000 (error de cobro)
> id: fix-013-i-precio-profesional-a2-incorrecto
> refs: ASG-b-016
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause
Confirmado: `professional_a2` solo existe en la sede "Conductores Chillán" (branch 2), con `base_price = 800000` en el seed — sin overrides posteriores en BD. El bug está en `EnrollmentFacade` (`src/app/core/facades/enrollment.facade.ts`), que resuelve curso por `license_class` **sin filtrar por `branch_id`** en 3 puntos (líneas 144, 250-251, 546), más un 4to punto (`resolveCourseId`, línea ~2074) que sí filtra pero de forma duplicada. El vector que contamina `_courses()` con cursos de ambas sedes mezclados es `resumeDraft()` (línea 1563), que llama `loadCourses()` **sin `branchId`** — cuando `effectiveBranchId` no resuelve (ej. admin sin `branchId` propio), `loadCourses()` no aplica `.eq('branch_id', ...)` y carga TODOS los cursos, incluyendo el `class_b` de branch 2 sembrado en `20260311100000_class_b_courses_branch2_and_enrollment_number_fix.sql` a `$180.000` — el mismo monto exacto del bug reportado.

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
- Cerrar el vector de contaminación: `resumeDraft()` pasa `enrollment.branch_id` a `loadCourses()` en vez de llamarlo sin argumento.
- Centralizar la resolución de curso por `license_class` en una función pura nueva (`core/utils/course-resolution.utils.ts`: `findCourseByLicenseClass`), y reemplazar los 4 puntos duplicados en `enrollment.facade.ts` por esta función.
- Fuera de scope del código: identificar si hay matrículas Profesional ya creadas en producción con el precio incorrecto, para corrección manual — mencionarlo al cerrar, no corregirlas automáticamente desde este fix.

## Test de Regresión
- `course-resolution.utils.spec.ts`: con `branchId` explícito y dos cursos de la misma `license_class` en sedes distintas, devuelve el de la sede correcta; sin `branchId`, compat con el comportamiento previo (primer match); con `isSence`, filtra correctamente.
- `enrollment.facade.spec.ts` sigue en verde tras el reemplazo (sin regresiones).
