# Fix: "Último acceso" de la secretaria muestra la fecha de creación de la cuenta
> id: fix-212-b-secretaria-ultimo-acceso-real
> refs: ASG-i-034 (sospecha S14, confirmada en fix-197-b) — decisión del owner 2026-10-07: mostrar el login real
> status: in_progress
> created: 2026-10-07

## Root Cause
[Confirmado contra producción el 2026-10-07.] La ficha de la secretaria muestra como "Último acceso"
`users.updated_at`. `users` no tiene trigger que actualice `updated_at`, así que en las 8
secretarias es igual a `created_at`: la fecha de creación de la cuenta, no un acceso. El último
inicio de sesión real está en `auth.users.last_sign_in_at`, que el cliente no puede leer.

## ACs Afectados
Ninguno de una spec previa. ACs propios:
- **F1:** función `public.secretary_last_sign_in(p_user_ids int[])` (SECURITY DEFINER,
  `search_path=''`): devuelve `user_id` + `last_sign_in_at` **solo** si quien llama es admin y
  **solo** de usuarios con rol `secretary`. EXECUTE revocado a PUBLIC/anon.
- **F2:** la ficha muestra el último inicio de sesión real; sin ingresos, "Nunca ha ingresado".
- **F3:** se deja de leer `users.updated_at` como "último acceso".
- **F4:** si la consulta falla, la ficha dice "No disponible" (no inventa una fecha).

## Cambio
- `supabase/migrations/20261007170000_fix212_secretary_last_sign_in.sql` (+ test
  `supabase/tests/rls/fix-212-b-secretary-last-sign-in.sql`).
- `src/app/core/facades/secretarias.facade.ts` (+ spec) — `cargarUltimoAcceso(userId)` + signal;
  sin `updated_at`.
- `src/app/core/models/ui/secretaria-table.model.ts` — sin `ultimoAcceso`.
- `src/app/features/admin/secretarias/admin-secretarias-ver-drawer.component.ts` — lo carga y muestra.

## Test de Regresión
- `npx vitest run src/app/core/facades/secretarias.facade.spec.ts`
- `supabase/tests/rls/fix-212-b-secretary-last-sign-in.sql` contra producción (solo lectura).

## Progreso
- [x] Migración + test SQL escritos; doc en `indices/DATABASE.md`.
- [x] `secretarias.facade.spec.ts` +4 (login real, nunca ingresó, error, respuesta vieja), rojo → verde; 13/13. Ficha: cargando / fecha / "Nunca ha ingresado" / "No disponible". `ng build` ✓, `lint:arch` 0 errores (182).
- [ ] Aplicar la migración en producción — **esperando aprobación del owner**.
- [ ] Test SQL después de aplicar + verificación en vivo de la ficha; abrir el PR.
