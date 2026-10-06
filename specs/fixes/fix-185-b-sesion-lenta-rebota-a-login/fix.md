# Fix: Con red lenta, un usuario con sesión válida rebota a /login
> id: fix-185-b-sesion-lenta-rebota-a-login
> refs: ASG-i-022 (hallazgo H1 de fix-183-b — sospecha S17 del checklist 022)
> status: in_progress
> created: 2026-10-06

## Root Cause
[Confirmado en fix-183-b: con 4 navegadores en paralelo, usuarios con sesión válida terminaron en
`/login` y el setup de la suite falló una vez con el login hecho en el servidor.] Dos relojes fijos
en `AuthFacade` deciden por el usuario cuando la red es lenta:

1. **`whenReady`** = `Promise.race([cargaInicial, timeout de 5 s])`. Si restaurar la sesión y
   leer el perfil tarda más de 5 s, los guards (`authGuard`, `hasRoleGuard`, `roleRedirectGuard`…)
   leen `currentUser() = null` y mandan a `/login`, aunque la sesión sea válida y el perfil llegue
   un instante después.
2. **`login()`** hace polling de `currentUser()` cada 100 ms durante 5 s y, si no llegó, devuelve
   éxito igual: el login navega a `/app` sin perfil → `roleRedirectGuard` cierra la sesión y vuelve
   a `/login` sin ningún mensaje.

## ACs Afectados
Ninguno de una spec previa — fix autónomo (origen ASG-i-022). ACs propios:

- **F1:** `whenReady` se resuelve cuando termina la carga inicial (sesión + perfil), aunque tarde
  más de 5 s. El timeout de seguridad sube a 15 s (solo para que la app no quede colgada si
  Supabase no responde).
- **F2:** `login()` espera la carga del perfil de la sesión que devuelve el login (no polling ni
  reloj). Si el perfil no se puede cargar, devuelve un error claro ("No se pudo cargar tu perfil…")
  y no navega.
- **F3:** cargas concurrentes del mismo usuario (evento `SIGNED_IN` + `login()`) comparten una sola
  consulta del perfil.

## Cambio
- `src/app/core/facades/auth.facade.ts` (+ spec) — F1, F2, F3.
- `src/app/core/services/infrastructure/supabase.service.ts` — sin cambios de firma (`signIn` ya
  devuelve `{ data, error }`).

## Test de Regresión
- `npx vitest run src/app/core/facades/auth.facade.spec.ts` (timers falsos: perfil que tarda 8 s).
- `e2e/auth-sesion.spec.ts` y su setup en **paralelo** (4 workers): antes daba 7 fallas por `/login`.
