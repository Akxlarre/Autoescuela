# Fix: Cerrar sesión cierra todos los equipos y las rutas de otro rol redirigen sin aviso
> id: fix-184-b-logout-local-y-aviso-acceso
> refs: ASG-i-022 (hallazgos E11, S9 y S18 de fix-183-b; decisiones del owner 2026-10-05)
> status: in_progress
> created: 2026-10-05

## Root Cause
[Hallazgos de fix-183-b, decisiones del owner del 2026-10-05.]
1. **E11:** `SupabaseService.signOut()` llama `auth.signOut()` sin `scope`, que por defecto es
   `global`: cerrar sesión en el mostrador también saca a la secretaria de su celular.
   **Decisión:** cerrar solo el equipo actual (`scope: 'local'`). Para sacar a alguien de todos
   los equipos ya está desactivar el usuario (fix-180-b).
2. **S9:** `hasRoleGuard` manda a `/app` (→ su dashboard) a quien abre una ruta de otro rol, sin
   decir nada; parece un error. `/acceso-denegado` es un stub "PLANO" que ningún código usa.
   **Decisión:** mantener la redirección con un aviso ("No tienes acceso a esa sección") y
   eliminar `/acceso-denegado`.
3. **S18:** `/app/admin` y `/app/secretaria` sin sub-ruta dan 404 (los grupos no tienen hija vacía).

## ACs Afectados
Ninguno de una spec previa — fix autónomo (origen ASG-i-022). ACs propios:

- **F1 — Logout local:** `signOut` se pide con `scope: 'local'`.
- **F2 — Aviso:** cuando `hasRoleGuard` rechaza por rol (usuario con sesión, rol no permitido),
  muestra un toast "No tienes acceso a esa sección" y redirige a `/app`. Sin sesión → `/login` sin
  toast; primer login → `/force-password-change` sin toast.
- **F3 — Sin stub:** la ruta `/acceso-denegado` y su componente se eliminan (cae en 404).
- **F4 — Sin 404 en la raíz del portal:** `/app/admin` y `/app/secretaria` redirigen a su dashboard.

## Cambio
- `src/app/core/services/infrastructure/supabase.service.ts` — `signOut({ scope: 'local' })`.
- `src/app/core/guards/role.guard.ts` (+ spec nuevo) — toast al rechazar por rol.
- `src/app/app.routes.ts` — redirect `'' → dashboard` en los grupos admin y secretaria; sale la
  ruta `acceso-denegado`.
- `src/app/features/acceso-denegado/` — eliminado.
- `e2e/auth-sesion.spec.ts` — F07 y J06 dejan de ser `knownBug`; F01 verifica el aviso.

## Test de Regresión
- `npx vitest run src/app/core/guards src/app/core/facades/auth.facade.spec.ts`
- `npx playwright test e2e/auth-sesion.spec.ts` contra build de producción.
