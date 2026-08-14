# Fix: `activate-instructor-account` no soporta instructores sin cuenta Auth (creados vía seed/SQL directo)

> id: fix-169-m
> refs: fix-168-m
> status: done
> closed: 2026-08-13
> created: 2026-08-13

## Root Cause

`fix-168-m` asumió que un instructor SIEMPRE tiene `public.users.supabase_uid` seteado,
porque `create-instructor` (única vía "oficial" de alta) crea la cuenta de Auth antes de
insertar la fila y hace rollback en cascada si algo falla — esa garantía es cierta para
instructores dados de alta por la UI, pero no para filas insertadas directo por SQL/seed
(caso real: instructor "Roberto Soto", insertado vía seed con un correo inexistente,
`supabase_uid IS NULL`, sin cuenta en `auth.users`).

Con esa fila, `activate-instructor-account` falla de dos formas distintas:

1. **Guard incorrecto (línea 214):** `if (!targetUser.first_login) return 409 'Este
   instructor ya activó su cuenta.'` — evalúa `first_login` solo, sin considerar
   `supabase_uid`. Si el seed dejó `first_login = false` (dato inconsistente de un
   instructor que nunca tuvo cuenta, no de uno que ya la activó), la función devuelve un
   409 con un mensaje que no corresponde a la realidad — bloquea el único camino para
   arreglarlo desde la UI.
2. **Aunque pasara el guard, nunca vincula el `supabase_uid`:** `generateLink({ type:
   'magiclink' })` sobre un email sin usuario de Auth previo SÍ crea la cuenta (Supabase
   Admin API: `magiclink` crea el usuario si no existe, a diferencia de `invite` que
   falla si ya existe), pero la función nunca hace `UPDATE public.users SET
   supabase_uid = ...` con el `id` devuelto. El instructor recibiría el correo, haría
   clic, se autenticaría en Supabase Auth — pero `AuthFacade.buildUserFromDb()` no
   encontraría fila en `public.users` con ese `supabase_uid`, resolvería `role: 'unknown'`,
   y `roleRedirectGuard` (línea 31-34) fuerza logout + redirige a `/login` — el usuario
   ve la pantalla de login sin entender por qué.

## ACs Afectados

Ninguno — fix autónomo (mismo backlog que fix-168-m, sin spec previa).

- AC-1: El guard de "ya activó su cuenta" solo rechaza cuando el instructor **realmente**
  ya tiene cuenta y ya cambió su contraseña (`supabase_uid` seteado Y `first_login =
  false`). Si `supabase_uid` es `NULL`, la función continúa (es una primera activación,
  no un reenvío).
- AC-2: Tras generar el link exitosamente, la función sincroniza `public.users` con el
  `id` de Auth devuelto (`supabase_uid`) y fuerza `first_login = true`, sin importar si
  la fila ya tenía esos valores — así el flujo de "primera activación" y "reenvío" quedan
  unificados en una sola función, igual que `activate-student-account`.
- AC-3: El botón "Reenviar invitación" del drawer de instructor se muestra tanto cuando
  `first_login = true` como cuando no tiene cuenta Auth (`!hasAuthAccount`), no solo
  `first_login`.

## Cambio

- **Archivo:** `supabase/functions/activate-instructor-account/index.ts`
  — Selecciona `supabase_uid` junto al resto de campos del instructor. Cambia el guard a
  `if (targetUser.supabase_uid && !targetUser.first_login) return 409`. Después de
  `generateLink()`, agrega un `UPDATE public.users SET supabase_uid = linkData.user.id,
  first_login = true WHERE id = userId` (idempotente: si ya coincidía, no cambia nada).
- **Archivo:** `src/app/core/models/ui/instructor-table.model.ts`
  — Agrega `hasAuthAccount: boolean`.
- **Archivo:** `src/app/core/facades/instructores.facade.ts`
  — Selecciona `supabase_uid` en `INSTRUCTOR_SELECT` y lo mapea a `hasAuthAccount` en
  `mapRow()`.
- **Archivo:** `src/app/features/admin/instructores/admin-instructor-editar-drawer.component.ts`
  — Condición del aviso pasa de `inst.firstLogin` a `!inst.hasAuthAccount ||
  inst.firstLogin`.

## Test de Regresión

- No hay test automatizado para Edge Functions Deno en este repo. Verificación manual:
  con un instructor `supabase_uid IS NULL, first_login = false` (estado real de Roberto
  Soto tras corregir su email), abrir su ficha → confirmar que aparece el aviso +
  botón "Reenviar invitación" (ya no requiere `first_login = true`) → clic → confirmar
  que NO devuelve 409 → confirmar que llega el correo → clic en el link → confirmar que
  autentica correctamente y redirige a `/force-password-change` (no a `/login`) →
  confirmar en BD que `public.users.supabase_uid` quedó seteado con el `id` de
  `auth.users` correspondiente.
- `src/app/core/facades/instructores.facade.spec.ts > enviarInvitacion` — sigue verde
  (comportamiento del facade no cambia, solo el body ya no depende de `firstLogin` para
  decidir si mostrar el botón — eso vive en el componente).
