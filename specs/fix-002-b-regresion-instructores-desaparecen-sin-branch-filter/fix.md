# Fix: Regresión instructores desaparecen sin branch filter en loadRecipients
> id: fix-002-b-regresion-instructores-desaparecen-sin-branch-filter
> refs: fix-001-admin-no-aparece-en-selector-de-secretaria
> status: done
> created: 2026-05-22
> closed: 2026-05-22

## Root Cause

fix-001 quitó el branch filter de PostgREST para la secretaria y delegó todo el scope
a RLS (migration 004). Sin embargo, migration 004 introdujo `branch_visible(branch_id)`
como condición para usuarios no-admin, lo que devuelve NULL (no FALSE) cuando
`auth_user_branch_id()` retorna NULL o hay un edge case en la función helper — haciendo
invisibles a los instructores. El error original no estaba en la política sino en
combinar un PostgREST filter con una policy que usa `branch_visible`.

## ACs Afectados

- AC6 (spec 0002): el selector debe mostrar admin Y instructores. Actualmente solo
  muestra ninguno (regresión de fix-001).

## Cambio

- **Archivo:** `supabase/migrations/20260522000001_fix_select_users_rls_secretary_simple.sql`
- **Qué cambia:** Reemplaza la policy `select_users` con una versión que permite a
  secretary ver TODOS los usuarios (sin restricción de branch en RLS). El scope de
  branch se maneja en la query de PostgREST solo para admin; la RLS es el último
  guardia de seguridad.

## Test de Regresión

- QA manual: loguearse como secretaria → abrir "Nueva comunicación" → verificar que
  aparecen tanto instructores (misma sede) como admin en el selector de destinatarios.
