# Asignación ASG-i-047 — RPC `SECURITY DEFINER` y registro de auditoría abiertos a cualquier usuario logueado

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

**Sospecha no confirmada en vivo** (tanda de testing 2026-09-29). Existe un
`GRANT EXECUTE ON ALL FUNCTIONS … TO authenticated` (`20260513000002…:56,69-70`), y varias
funciones `SECURITY DEFINER` no revisan quién las llama:

1. **`confirm_enrollment_with_payment`**: cualquier usuario logueado (incluido un alumno) puede
   confirmar cualquier borrador de matrícula de cualquier sede, con el monto que quiera
   (verificada en código: `20260618130000…:20-47`, sin chequeo de rol/sede ni REVOKE).
2. **`mark_end_of_day_class_b_absences()` y `apply_class_b_absence_penalty()`**: el cierre
   nocturno y la penalización se pueden ejecutar a mano (`20260817120000…:109-165`).
3. **`audit_log`**: `log_change()` toma primero el header `x-audit-user-id` antes que
   `auth.uid()` (autoría falsificable: `20260809100000…:509-523`), y la policy `insert_audit_log`
   deja a cualquier logueado insertar filas (`20260306120000…:15-17`). El log deja de ser
   confiable.

## Alcance sugerido

- **Paso 1, confirmar** leyendo en la BD remota los permisos reales y las policies de
  `audit_log`. **No ejecutar** las funciones sobre datos compartidos para probarlas.

  ```sql
  select p.proname, p.prosecdef as security_definer,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_puede,
         has_function_privilege('anon', p.oid, 'EXECUTE') as anon_puede
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('confirm_enrollment_with_payment',
                      'mark_end_of_day_class_b_absences',
                      'apply_class_b_absence_penalty');

  select policyname, cmd, roles, qual, with_check
  from pg_policies where schemaname = 'public' and tablename = 'audit_log';
  ```

  Si `authenticated_puede` es `true` en las tres, la sospecha queda confirmada.
- (1): dentro de la función, validar `auth.uid()` → rol admin/secretaria y sede visible de la
  matrícula. No basta con REVOKE: el cliente la llama legítimamente desde `EnrollmentFacade`.
- (2): `REVOKE EXECUTE … FROM authenticated, anon` (las llama pg_cron, no el cliente); verificar
  que ningún facade las invoque.
- (3): usar el header solo cuando la petición viene con la service key; quitar INSERT directo a
  `authenticated` en `audit_log`.
- Revisar el resto de funciones del inventario de `037` §1 (22 funciones y 9 cron).

## Referencias

- `specs/testing-piloto/037-transversal-multisede-shell.md` S1 y §1 · `027-asistencia-clase-b.md` S2
- `specs/testing-piloto/036-auditoria-configuracion-web.md` S2, S3

## Archivos involucrados (opcional, para detectar solapes)

- Nuevas migraciones (funciones y policies)

## Notas para quien la reclame

- El `GRANT … ON ALL FUNCTIONS` global es la causa de fondo: evaluar revocarlo y otorgar solo las
  funciones que el cliente realmente usa.

## Nota de Benjamín (2026-10-06) — puntos 1 y 2 ya resueltos en `fix-191-b`

Testeando `ASG-i-037` (`fix-190-b`) confirmé en vivo, contra la BD del piloto, que el problema era
peor de lo que dice arriba: las funciones no solo las ejecutaba cualquier **logueado**, sino
cualquiera **sin sesión** (con la anon key pública). `confirm_enrollment_with_payment` llamada como
`anon` activó un borrador con un "pago" de $1 (prueba deshecha). Como era P0, lo arreglé en
**`fix-191-b`**, ya aplicado en la BD del piloto (migración `20261006150000`):

- **Punto 1 (`confirm_enrollment_with_payment`) — resuelto:** fuera `anon`; adentro valida que
  quien llama sea admin o secretaria de la sede de la matrícula (o con grant). `search_path` fijo.
- **Punto 2 (`mark_end_of_day_class_b_absences`, `apply_class_b_absence_penalty`) — resuelto:** el
  cierre nocturno solo lo ejecutan el cron (`postgres`) y `service_role`; la penalización valida
  rol y sede (desde el cron sigue andando).
- **Además:** las otras 9 funciones de cron/internas del inventario (`cleanup_*`,
  `auto_transition_*`, `ensure_theory_cycle`, `notify_vehicle_document_expiry`,
  `recalc_instructor_monthly_hours`) quedaron solo para `postgres`/`service_role`, y
  `get_next_enrollment_number` sin `anon`.
- **Queda pendiente para esta asignación — punto 3 (`audit_log`):** no lo toqué. `log_change()`
  sigue tomando el header `x-audit-user-id` antes que `auth.uid()` y la policy `insert_audit_log`
  sigue dejando insertar a cualquier logueado.
- **No hecho:** revocar el `GRANT … ON ALL FUNCTIONS` global (la causa de fondo). Ojo si se evalúa:
  varias policies `TO public` llaman helpers (`auth_user_role()`, `branch_visible()`…), que `anon`
  y `authenticated` necesitan poder ejecutar.

Prueba reutilizable: `supabase/tests/rls/fix-191-b-rpc-sin-sesion.sql` (22 casos, se deshace sola).
