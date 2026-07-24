# Fix: 500 real en alertas de asistencia Profesional al filtrar por sede

> id: fix-060-m-h027-alertas-asistencia-profesional-sede
> refs: ASG-015
> status: done
> closed: 2026-07-23
> created: 2026-07-23

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
**Confirmado vía Postgres Logs de producción.** El 500 es en realidad `SQLSTATE 57014` — *"canceling statement due to statement timeout"* — no un error de sintaxis/JOIN. Contexto del log: `SQL function "auth_can_access_both_branches" during startup` / `SQL function "branch_visible" statement 1`.

Las políticas RLS de `enrollments` para `secretary` llaman `branch_visible(branch_id)` por cada fila candidata de `enrollments`. `branch_visible()` internamente invoca `auth_user_branch_id()` y `auth_can_access_both_branches()` — ambas `SECURITY DEFINER`, cada una con su propia subconsulta contra `users`. Por ser `SECURITY DEFINER`, Postgres no puede inlinearlas en el plan de la consulta externa: se ejecutan como llamadas a función opacas **una vez por fila escaneada de `enrollments`**, no una vez por consulta.

`v_professional_attendance` parte de `enrollments` sin ningún filtro de sede en la query del facade (`dashboard-alerts.facade.ts` la deja sin filtrar a propósito, confiando en RLS). Para `secretary`, esto dispara 2 subconsultas contra `users` por cada fila de `enrollments` en todo el sistema — a volumen real de producción, excede el `statement_timeout`. Para `admin`, la rama `auth_user_role() = 'admin'` hace corto-circuito antes de necesitar `branch_visible()`, por eso nunca falla ahí. Esto explica por qué no se pudo reproducir en local con datos sintéticos (~15 filas): el timeout es un problema de **escala**, no de lógica — con pocas filas la consulta simplemente termina antes de acercarse al límite.

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
- Ninguno — fix autónomo (hallazgo de QA manual, H-027 en `indices/FLOWS-QA-AUDIT.md`)

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `supabase/migrations/20260723020000_fix_h027_enrollments_rls_branch_visible_performance.sql` — reescribe las 4 políticas RLS de `enrollments` (SELECT/INSERT/UPDATE/DELETE) para envolver `auth_user_branch_id()` y `auth_can_access_both_branches()` en `(select ...)`, en vez de llamarlas indirectamente vía `branch_visible(branch_id)`. Esto permite que Postgres las trate como InitPlan (evaluadas una sola vez por consulta, resultado cacheado) en vez de una vez por fila de `enrollments` — patrón de performance de RLS documentado por Supabase. `branch_visible()` se mantiene intacta para el resto de tablas que la usan (fuera del alcance de este fix puntual).

## Progreso de la sesión (2026-07-23)

**No reproducido localmente todavía.** Se levantó Supabase local desde cero (`npx supabase start`) para poder testear la vista bajo RLS real, lo que reveló y corrigió 5 problemas de infraestructura no relacionados con ASG-015, encadenados uno tras otro (cada uno bloqueaba el replay completo de migraciones):

- `hotfix-041-m`: orden invertido `DROP COLUMN` antes de `DROP VIEW` en `20260308120000_schedule_from_courses_not_instructors.sql`.
- `hotfix-042-m`: ninguna migración habilitaba `pg_cron` (se hace vía Dashboard en producción) — se agregó `CREATE EXTENSION IF NOT EXISTS pg_cron;` idempotente.
- `hotfix-043-m`: `20260406000000_fix_exam_scores_relationship.sql` intentaba agregar FK sobre `class_b_exam_scores.student_id`, columna ya eliminada por una migración anterior.
- `hotfix-044-m`: **bug real de producción** — `verify_class_b_dropout_rule()` (trigger `trg_class_b_dropout` en `class_b_practice_attendance`) se auto-invoca infinitamente (`UPDATE ... WHERE id = NEW.id` dispara su propio trigger AFTER). Corregido con guarda `pg_trigger_depth() > 1` en migración nueva `20260412000000_fix_class_b_dropout_trigger_recursion.sql` (con timestamp de abril para que el replay no se caiga ahí).
- `hotfix-045-m`: `COMMENT ON COLUMN users.gender` apuntaba a tabla equivocada (es `students.gender`).

Con el entorno local ya arriba, se probó `v_professional_attendance` vía PostgREST real (HEAD + `count=exact`, igual que `dashboard-alerts.facade.ts`) con datos realistas (14 matrículas Profesional A2/A4 con mezcla de asistencia) contra:
- Admin (sin filtro) → 200 OK
- Secretaria de la sede con los datos → 200 OK
- Secretaria de OTRA sede (0 filas tras RLS) → 200 OK
- Secretaria con `branch_id = NULL` → 200 OK

**Ninguno reprodujo el 500.** El usuario después reprodujo el error en vivo contra el proyecto real de Supabase (`skvekggejikzxhzsjmkz.supabase.co`), confirmando que el bug SÍ existe en producción pero no se logró replicar con los datos sintéticos locales — probablemente depende de un estado de datos específico de producción que no se ha reconstruido localmente. Pendiente: el usuario va a revisar Postgres/API Logs del Dashboard de Supabase para conseguir el mensaje de error real (SQLSTATE + detalle), que es el siguiente paso antes de seguir adivinando.

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- **Verificado en local (2026-07-23):** tras aplicar la migración, `EXPLAIN (VERBOSE, COSTS OFF)` de la consulta de `v_professional_attendance` como `secretary` muestra que el `Seq Scan on public.enrollments m` ahora filtra usando `(InitPlan 1).col1` / `(InitPlan 2).col1` (`auth_user_branch_id()` y `auth_can_access_both_branches()` evaluadas UNA vez, cacheadas) en vez de llamar `branch_visible(m.branch_id)` por fila — confirma que el fix corta exactamente el patrón que generaba el timeout en el log real de producción, en la tabla base de la vista.
- El timeout en sí (`SQLSTATE 57014`) no se pudo reproducir en local por falta de volumen de datos comparable a producción — la verificación de que el problema real desaparece queda pendiente de confirmar en producción/staging tras desplegar la migración.
- **Hallazgo adicional fuera de alcance:** `students` (también JOINeada por esta vista) tiene el mismo patrón caro de RLS (`branch_visible()` + subconsulta correlacionada a `users`, actualizado por una migración posterior a la que originó `enrollments`). No se tocó aquí — abre un fix/hotfix separado, ya que es una causa raíz distinta aunque relacionada (podría seguir causando timeouts incluso con este fix aplicado, si el volumen de `students` es suficiente).
