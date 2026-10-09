# Plan 0049-b — Lectura de `users` acotada por sede para la secretaria

> **Status:** aprobado (opción A elegida por el owner el 2026-10-08)

## Diseño

Hoy (`select_users`): `auth_user_role() = 'secretary'` ve **todas** las filas.

Nueva rama de la secretaria en `select_users`:

```sql
auth_user_role() = 'secretary' AND (
     public.auth_can_access_both_branches()          -- grant multisede: como hoy
  OR branch_id IS NULL                               -- igual que branch_visible(NULL)
  OR branch_id = public.auth_user_branch_id()        -- su sede
  OR id = public.auth_user_id()                      -- su propia fila (secretaria sin sede, D14)
  OR id IN (SELECT public.secretary_extra_visible_user_ids())
)
```

`secretary_extra_visible_user_ids()` — `SETOF integer`, `STABLE SECURITY DEFINER`, `search_path=''`,
EXECUTE solo `authenticated`/`service_role`. Devuelve los usuarios de **otra** sede que la secretaria
necesita ver para trabajar en la suya:
1. personal (rol `admin` o `secretary`) — "registrado por", autores de tareas/comunicados;
2. instructores `both_branches = true` (spec 0004-m);
3. instructores con clases (`class_b_sessions`) de matrículas de su sede;
4. alumnos con una matrícula (`enrollments`) o inscripción a curso singular
   (`standalone_course_enrollments` → `standalone_courses.branch_id`) en su sede;
5. pre-inscritos profesionales (`professional_pre_registrations.temp_user_id`) de su sede.

**Por qué `id IN (subconsulta)` y no una función por fila:** la subconsulta no depende de la fila,
así que Postgres la resuelve una vez (hashed subplan) en vez de por cada usuario. Con una función
correlacionada por fila pasaría lo de fix-196-b (5 s por pantalla). Se mide en AC6.

Admin, instructor y alumno: sin cambios. `select_users_via_class_relationship`: sin cambios.

## Validación (sin efectos antes de aplicar)

1. `supabase/tests/rls/0049-b-users-lectura-por-sede.sql`: crea la función y la política **dentro
   de un sub-bloque que aborta** (ZZ001), impersona y mide; nada queda aplicado.
   - AC1: secretaria2 (sede 2) no ve a un alumno solo de la sede 1 ni a un instructor de la sede 1 sin
     relación con la sede 2.
   - AC2: ve su sede, el personal, un instructor "Ambas" (se marca uno dentro del bloque) y el alumno
     cuya matrícula es de su sede aunque su usuario sea de otra.
   - AC3: secretaria multisede y admin ven el mismo total que hoy.
   - AC6: EXPLAIN ANALYZE de las consultas de Base Alumnos y Agenda impersonando, antes y después.
2. Con la migración aplicada (aprobación del owner): el mismo test + e2e de las pantallas de la
   secretaria (Base Alumnos, Agenda, Instructores, Pagos, Asistencia) → AC5.

## Archivos

- `supabase/migrations/20261008100000_spec0049_users_lectura_por_sede.sql`
- `supabase/tests/rls/0049-b-users-lectura-por-sede.sql`
- `indices/DATABASE.md` (política y función)
- `e2e/secretaria-users-sede.spec.ts` (AC5)
