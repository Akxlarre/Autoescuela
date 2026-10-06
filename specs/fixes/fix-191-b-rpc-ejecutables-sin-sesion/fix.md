# Fix: Funciones de la BD que escriben se pueden ejecutar sin iniciar sesión
> id: fix-191-b-rpc-ejecutables-sin-sesion
> refs: ASG-i-037 (sospecha S1 + caso P16 del checklist 037; hallazgo de fix-190-b)
> status: done
> created: 2026-10-06
> priority: P0

## Root Cause
[Confirmado en fix-190-b contra la BD del piloto.] Postgres da `EXECUTE` a `PUBLIC` sobre toda
función nueva, y `20260513000002_grant_data_api_access.sql` lo extiende a `anon` y `authenticated`.
Resultado: **12 funciones `SECURITY DEFINER` que escriben en la BD se pueden llamar por
`/rest/v1/rpc` solo con la anon key pública (sin sesión)** y ninguna valida quién llama:

- `confirm_enrollment_with_payment` — **probado como `anon`**: activó un borrador, le asignó número
  de matrícula y registró un "pago" de $1 (prueba deshecha). Cualquiera puede descuadrar la caja.
- `apply_class_b_absence_penalty` — cancela la agenda de cualquier matrícula (hoy desactivada por
  0048-b, pero la función sigue abierta).
- `mark_end_of_day_class_b_absences` — corre el cierre nocturno a cualquier hora: marca "No asistió"
  todas las clases de hoy.
- `cleanup_expired_drafts`, `cleanup_expired_public_enrollment`, `cleanup_public_enrollment_throttle`,
  `auto_transition_promotion_status`, `auto_transition_standalone_course_status`,
  `auto_transition_theory_cycle_status`, `ensure_theory_cycle`, `notify_vehicle_document_expiry`,
  `recalc_instructor_monthly_hours` — trabajos de cron o internos.
- Además `get_next_enrollment_number` (lectura) también es invocable sin sesión.

Quién las llama de verdad: el cron corre como `postgres` (dueño); las edge functions con
`service_role`; la app solo llama `confirm_enrollment_with_payment`,
`apply_class_b_absence_penalty` y `get_next_enrollment_number` (admin/secretaria).

## ACs Afectados
Ninguno de una spec previa. ACs propios:

- **F1:** ninguna de las 13 funciones se puede ejecutar como `anon` (sin sesión).
- **F2:** las 10 de cron/internas tampoco como `authenticated`; siguen funcionando para el cron
  (`postgres`) y las edge functions (`service_role`).
- **F3:** `confirm_enrollment_with_payment` solo la ejecuta un admin, o una secretaria sobre una
  matrícula de su sede (o con grant multi-sede). Otro rol u otra sede → rechazo `42501`.
- **F4:** `apply_class_b_absence_penalty` igual que F3 cuando la llama un usuario; desde el cron
  (sin sesión, como dueño) sigue funcionando.
- **F5:** `get_next_enrollment_number` la siguen ejecutando `authenticated` y `service_role`.
- **F6:** `confirm_enrollment_with_payment` fija su `search_path` (DG-063).
- **F7:** el flujo real sigue andando: una secretaria confirma una matrícula de su sede.

## Cambio
- `supabase/migrations/20261006150000_fix191_revoke_rpc_sin_sesion.sql`
- `supabase/tests/rls/fix-191-b-rpc-sin-sesion.sql` (prueba)

## Test de Regresión
- `supabase/tests/rls/fix-191-b-rpc-sin-sesion.sql` (transacciones que se deshacen).
- `supabase/tests/agenda/spec-0048-b-penalizacion-configurable.sql` (la penalización sigue igual).

## Progreso
- [x] Migración y prueba escritas
- [x] Validada en un envío que se deshizo entero: 22/22 ok (privilegios de las 13 funciones; anon rechazado; secretaria de otra sede rechazada; secretaria de su sede y admin confirman; cron corre). Verificado después que no quedó nada aplicado
- [x] Aplicada en la BD del piloto con aprobación del owner ("aplico") y registrada en `schema_migrations` (`20261006150000`)
- [x] Regresión con la migración aplicada: fix-191-b 22/22 ok · spec-0048-b 8/8 ok
- [x] Commit, PR y cierre

## Superposición con ASG-i-047 (owner: m)
`ASG-i-047` ("RPC SECURITY DEFINER y registro de auditoría abiertos", de Matías, pendiente) cubre
este mismo problema. Este fix resuelve sus **puntos 1 y 2** (`confirm_enrollment_with_payment`,
`mark_end_of_day_class_b_absences`, `apply_class_b_absence_penalty`) y además las otras 10
funciones de cron/internas. **Queda pendiente su punto 3** (`audit_log`: `log_change()` toma el
header `x-audit-user-id` antes que `auth.uid()` y cualquier logueado puede insertar filas — S5 de
`037`). No se tocó la asignación de Matías; coordinar con él.
