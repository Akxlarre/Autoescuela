# Fix: Un usuario desactivado sigue entrando y operando
> id: fix-180-b-usuarios-desactivados-siguen-entrando
> refs: ASG-i-044 (parte 1 de 2: cuentas desactivadas. La parte 2 — recuperar contraseña y clave inicial — va en un track aparte)
> status: in_progress
> created: 2026-10-01

## Root Cause
[Heredado de ASG-i-044, confirmado leyendo el código y la BD remota el 2026-10-01.] "Desactivar"
solo escribe `users.active = false` (`update-secretary`, `update-instructor`). Nada más lo mira:

- **Auth:** la cuenta no se banea → el usuario sigue pudiendo hacer login y renovar su token.
- **BD:** los helpers de RLS (`auth_user_role()`, de los que dependen casi todas las policies) no
  miran `active` → con su token sigue leyendo y escribiendo todo lo que su rol permite.
- **Front:** ni `login()` ni `authGuard` revisan `isActive`.

Hoy hay 0 usuarios desactivados en la BD (no hay nadie afectado todavía), pero la primera vez que el
admin desactive a una secretaria o instructor que se va, esa persona conserva el acceso.

## ACs Afectados
Ninguno de una spec previa — fix autónomo (origen ASG-i-044). ACs propios:

- **F1 — Corte en el servidor, inmediato:** Given un usuario con `active = false`, When hace
  cualquier consulta con su token (aunque siga vigente), Then `auth_user_role()` es NULL y las
  policies por rol le devuelven 0 filas / rechazan escrituras. Con `active = true` (o NULL) nada cambia.
- **F2 — Ban en Auth al desactivar:** When el admin desactiva a una secretaria o instructor, Then su
  cuenta de Auth queda baneada (no puede iniciar sesión ni renovar el token); When la reactiva, Then
  se quita el ban.
- **F3 — Mensaje claro en el login:** When un usuario baneado intenta entrar, Then ve "Tu cuenta está
  desactivada. Contacta al administrador." (no un error genérico).
- **F4 — Guard:** si el perfil cargado tiene `isActive === false`, `authGuard` cierra la sesión y
  redirige a `/login`.

## Cambio
- `supabase/migrations/20261001230000_auth_user_role_excluye_inactivos.sql` — `auth_user_role()`
  devuelve NULL si `users.active IS FALSE` (F1).
- `supabase/functions/update-secretary/index.ts`, `update-instructor/index.ts` — ban/unban en Auth
  según `active` (F2).
- `src/app/core/utils/auth-errors.utils.ts` (+ spec) — mapea "User is banned" (F3).
- `src/app/core/guards/auth.guard.ts` (+ spec) — rechaza `isActive === false` (F4).

## Test de Regresión
- `supabase/tests/rls/fix-180-b-usuario-inactivo.sql` — F1: desactiva a una secretaria de prueba
  dentro de un sub-bloque que siempre se deshace y verifica que con su sesión no lee ni escribe nada,
  y que activa sí.
- `npm run test:ci -- auth-errors auth.guard` — F3, F4.
