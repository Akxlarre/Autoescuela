# Fix: Recuperar contraseña no permite fijar una clave nueva
> id: fix-181-b-recuperar-contrasena-punta-a-punta
> refs: ASG-i-044 (parte 2 de 2: recuperar contraseña. La parte 1 fue fix-180-b-usuarios-desactivados-siguen-entrando)
> status: in_progress
> created: 2026-10-05

## Root Cause
[Heredado de ASG-i-044, confirmado leyendo el código el 2026-10-05.] El login ya tiene un modo
"recuperar" que llama `resetPasswordForEmail(email)`, pero el flujo se corta ahí:

1. **Sin `redirectTo`** (`supabase.service.ts`): el link del correo vuelve a la *Site URL* del
   proyecto, no a una pantalla de la app.
2. **Nadie escucha `PASSWORD_RECOVERY`** (`auth.facade.ts`): Supabase abre una sesión con el link y
   la app la trata como un login normal → el usuario entra **sin fijar una clave nueva**.
3. **`/recuperar-contrasena` es un stub** ("PLANO") y además tiene `guestGuard`, que manda a `/app` a
   cualquiera con sesión — justo lo que abre el link.

## ACs Afectados
Ninguno de una spec previa — fix autónomo (origen ASG-i-044). ACs propios:

- **F1 — Link con destino:** el correo de recuperación se pide con
  `redirectTo = <origen de la app>/recuperar-contrasena`.
- **F2 — Sesión de recuperación detectada:** cuando Supabase emite `PASSWORD_RECOVERY`, `AuthFacade`
  marca `passwordRecovery() = true` y navega a `/recuperar-contrasena`.
- **F3 — No se entra sin fijar clave:** mientras `passwordRecovery()` sea `true`, `authGuard` manda
  cualquier ruta de `/app` a `/recuperar-contrasena`.
- **F4 — Pantalla de nueva clave:** `/recuperar-contrasena` muestra el formulario de nueva contraseña
  (mismo componente que el primer login, con textos de recuperación). Guardar actualiza la clave,
  apaga `passwordRecovery()` y entra a `/app`.
- **F5 — Link vencido o acceso directo:** sin sesión de recuperación, `/recuperar-contrasena`
  redirige a `/login` (donde está el modo "recuperar" para pedir otro link).

## Cambio
- `core/services/infrastructure/supabase.service.ts` — `resetPasswordForEmail(email, redirectTo)`.
- `core/facades/auth.facade.ts` (+ spec) — signal `passwordRecovery`, manejo de
  `PASSWORD_RECOVERY`, `redirectTo`, `completePasswordRecovery()`.
- `core/guards/password-recovery.guard.ts` (+ spec) — F5. `core/guards/auth.guard.ts` (+ spec) — F3.
- `app.routes.ts` — `/recuperar-contrasena` carga `ForcePasswordChangeComponent` con
  `data: { mode: 'recovery' }` y `passwordRecoveryGuard` (sale `guestGuard`).
- `features/auth/force-password-change/force-password-change.component.ts` — modo `recovery`
  (textos + acción). Se elimina el stub `features/auth/recuperar-contrasena/`.
- **Config remota (owner):** agregar `<dominio de la app>/recuperar-contrasena` a *Auth → URL
  Configuration → Redirect URLs* en Supabase. Sin eso el link cae en la Site URL; F2 lo cubre igual
  (navega a la pantalla), pero conviene registrarla.

## Test de Regresión
- `npx vitest run src/app/core/facades/auth.facade.spec.ts src/app/core/guards` — F1, F2, F3, F5.
- Build (`ng build`) para el componente y la ruta (F4); verificación visual con `/verify` si hay
  servidor disponible.
