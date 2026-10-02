# Fix: Una secretaria puede editar a cualquier usuario (incluido un admin)
> id: fix-179-b-edicion-usuarios-sin-validar-objetivo
> refs: ASG-i-043
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause
[Heredado de ASG-i-043, confirmado leyendo el código y `pg_policies` remoto el 2026-10-01.] Los
caminos para editar un usuario validan **quién llama**, pero nunca **a quién se edita**:

1. **`update-student-profile`** solo exige que el llamador sea admin o secretaria. Toma el `userId`
   del body y, con la clave de servicio, cambia el email en Auth y en `public.users`. No revisa que
   el objetivo sea un alumno ni que sea de la sede de la secretaria. Si se le cambia el email a un
   admin y se pide recuperar contraseña, se toma la cuenta.
2. **`update-instructor`**: mismo patrón y, además, no comprueba que `userId` sea el usuario de
   `instructorId`. Basta un `instructorId` propio junto con el `userId` de un admin. También deja a
   la secretaria escribir `users.branch_id` del instructor (moverlo de sede).
3. **RLS `update_users`** (secretaria): `branch_visible(branch_id) AND role_id <> admin`. Deja a una
   secretaria editar desde la consola filas de **otras secretarias e instructores** de su sede
   (email, `active`, `role_id` a cualquier rol que no sea admin), y no protege columnas sensibles
   (`can_access_both_branches`, `supabase_uid`) en ninguna fila. Encadenado con
   `activate-instructor-account` (que valida el email contra `users.email`), cambiar el email de un
   instructor no activado alcanza para recibir su link de acceso.

Los flujos legítimos de la secretaria sobre `users` (matrícula, cursos singulares, pre-inscritos)
solo escriben filas de **alumnos** o de usuarios **aún sin rol**, y como mucho les asignan el rol
alumno; nunca tocan `can_access_both_branches` ni `supabase_uid` (eso lo hacen Edge Functions con
service role).

## ACs Afectados
Ninguno de una spec previa — fix autónomo (origen ASG-i-043). ACs propios:

- **F1 — `update-student-profile` valida el objetivo:** el `userId` debe ser un usuario con rol
  alumno (si no → 403), y una secretaria sin grant solo puede editar alumnos de su sede
  (`users.branch_id` = su sede; si no → 403). El admin edita cualquier alumno.
- **F2 — `update-instructor` valida el objetivo:** `instructorId` debe existir y su `user_id` debe
  ser igual a `userId` (si no → 400); ese usuario debe tener rol instructor (si no → 403). Una
  secretaria sin grant solo edita instructores de su sede o "ambas sedes" (si no → 403) y no puede
  cambiarles la sede (si `branchId` difiere de la actual → 403).
- **F3 — RLS de `users`:** una secretaria solo puede actualizar filas de alumnos o sin rol, y el
  resultado debe seguir siendo alumno o sin rol (no puede tocar otra secretaria, un instructor ni
  un admin, ni promover a nadie). La sede sigue igual (`branch_visible`).
- **F4 — Columnas protegidas:** con sesión de secretaria, cualquier INSERT/UPDATE que fije o cambie
  `can_access_both_branches` (a `true`) o `supabase_uid` en `users` es rechazado. Admin y Edge
  Functions (service role) no cambian.
- **F5 — Sin regresión:** la matrícula (crear/actualizar usuario alumno), cursos singulares y
  pre-inscritos (`role_id` NULL → alumno, `active = true`) siguen funcionando para la secretaria.

## Cambio
- `supabase/functions/_shared/user-edit-authz.ts` (+ `.test.ts`): reglas puras de autorización
  sobre el objetivo (F1, F2) — sin I/O, testeables con `deno test`.
- `supabase/functions/update-student-profile/index.ts` y `update-instructor/index.ts`: cargan el
  objetivo y aplican esas reglas antes de tocar Auth o la BD.
- `supabase/migrations/20261001220000_users_rls_secretaria_solo_alumnos.sql`: reescribe
  `update_users` (F3) y agrega el trigger `users_guard_secretary_write` (F4).
- `update-secretary` ya exige admin — sin cambios. `activate-*` validan rol y email del objetivo —
  sin cambios (la cadena de toma de cuenta se corta con F3).

## Test de Regresión
- `deno test supabase/functions/_shared/user-edit-authz.test.ts` — F1, F2.
- `supabase/tests/rls/fix-179-b-users-secretaria.sql` — F3, F4, F5 impersonando secretaria sede 1,
  admin y service role; escrituras en un sub-bloque que siempre se deshace.

## Resultado (2026-10-01)

**`deno test supabase/functions/_shared/user-edit-authz.test.ts`:** 17 passed (objetivo admin /
secretaria / instructor rechazado, sede ajena rechazada, `userId` que no corresponde al
`instructorId` → 400, secretaria no cambia la sede del instructor, admin y multi-sede sin límite).

**RLS, rojo — BD remota actual, 6 fallos (confirmado en vivo):** con su sesión, la secretaria de la
sede 1 actualizó la fila de **otra secretaria**, **cambió el email de un instructor**, **ascendió
a un alumno a secretaria**, le dio `can_access_both_branches = true` a un alumno y lo insertó así.

**RLS, verde — migración + test en `BEGIN … ROLLBACK`: 0 fallos en 11 casos.** Los 6 anteriores
→ 0 filas o `42501`; admin y service role siguen escribiendo columnas de acceso; matrícula
(INSERT/UPDATE de alumno) y pre-inscritos (`role_id` NULL → alumno) siguen funcionando.

**Aplicado en producción el 2026-10-01** (ver Progreso).

## Progreso
- [x] Reglas puras + 17 tests deno en verde
- [x] Edge functions `update-student-profile` y `update-instructor` validan el objetivo
- [x] Migración RLS + trigger, ensayada en remoto dentro de `BEGIN … ROLLBACK` (0/11 fallos)
- [x] Aplicada la migración `20261001220000` (`supabase db push`) y desplegadas `update-student-profile` y `update-instructor` (visto bueno del owner, 2026-10-01). Smoke test: sin usuario → 401
- [x] Test de RLS re-corrido contra la BD real fuera de transacción: 0 fallos, sin filas residuales. Cerrado
