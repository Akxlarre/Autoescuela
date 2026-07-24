# Fix: RLS de students usa branch_visible() por fila (mismo patrón de performance de fix-060)
> id: fix-061-m-students-rls-branch-visible-performance
> refs: fix-060-m-h027-alertas-asistencia-profesional-sede
> status: done
> closed: 2026-07-23
> created: 2026-07-23

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
La política `select_students` llama `branch_visible((SELECT u.branch_id FROM users u WHERE u.id = students.user_id))` para el rol `secretary`. Igual que en `enrollments` (fix-060), `branch_visible()` es `SECURITY DEFINER` y no se puede inlinear en el plan de la consulta externa — se ejecuta como llamada a función opaca por cada fila de `students` escaneada, y además aquí suma una subconsulta correlacionada contra `users` por fila (no cacheada). Confirmado en `EXPLAIN (VERBOSE, COSTS OFF)` de `v_professional_attendance` (que hace JOIN a `students`) durante la verificación de fix-060: el nodo `Index Scan ... on public.students s` sigue mostrando `branch_visible((SubPlan 4))` sin optimizar, mientras que `enrollments` ya usa InitPlan cacheado tras ese fix. A volumen de producción esto puede seguir generando el mismo `SQLSTATE 57014` (statement timeout) que motivó H-027/ASG-015, incluso con fix-060 aplicado.

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
- Ninguno — fix autónomo (hallazgo colateral durante la verificación de fix-060, no forma parte de ningún AC de spec)

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `supabase/migrations/20260723030000_fix_students_rls_branch_visible_performance.sql` — reescribe `select_students` reemplazando `branch_visible(...)` por `(SELECT auth_can_access_both_branches())` cacheado + `EXISTS (SELECT 1 FROM users u WHERE u.id = students.user_id AND u.branch_id = (SELECT auth_user_branch_id()))`, con el mismo resultado lógico pero evaluable como InitPlan. Se confirmó que `insert_students`/`update_students`/`delete_students` no aplican branch scope (solo chequeo de rol) — no requirieron cambios.

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- **Verificado en local (2026-07-23):** `EXPLAIN (VERBOSE, COSTS OFF)` de `v_professional_attendance` como `secretary` (misma query usada en fix-060) muestra ahora `Index Scan ... on public.students s` con `Filter: (... OR ((auth_user_role() = 'secretary') AND ((InitPlan 4).col1 OR EXISTS(SubPlan 6))) ...)` — `InitPlan 4` (`auth_can_access_both_branches()`) cacheado, y el `EXISTS(SubPlan 6)` (lookup a `users` vía `users_pkey`, índice) solo se evalúa si el InitPlan da `false`, por corto-circuito del `OR`. Ya no aparece `branch_visible(...)` sin optimizar en ese nodo.
