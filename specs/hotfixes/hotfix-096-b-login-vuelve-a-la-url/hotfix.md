# Hotfix: después del login se vuelve a la pantalla que se intentó abrir
> id: hotfix-096-b-login-vuelve-a-la-url
> refs: ASG-i-022 (checklist 022, A18; decisión del owner 2026-10-19)
> status: closed
> created: 2026-10-19

## Problema
Abrir un link guardado (p. ej. `/app/admin/pagos`) sin sesión manda a `/login` y, después de
entrar, siempre al dashboard: la persona tiene que volver a buscar la pantalla. Decisión: volver a
esa URL si su rol puede verla; si no, a su dashboard (eso ya lo hace el guard de rol, con aviso).

## Cambios
- **Archivo:** `src/app/core/utils/return-url.utils.ts` (+ spec) — `safeReturnUrl()` (solo rutas
  internas `/app/...`, nada que pueda llevar a otro sitio) y `loginQueryParams()`.
- **Archivo:** `src/app/core/guards/auth.guard.ts`, `src/app/core/guards/role.guard.ts` (+ spec) —
  sin sesión mandan a `/login?returnUrl=<ruta pedida>`.
- **Archivo:** `src/app/features/auth/login/login.component.ts` — tras entrar navega a `returnUrl`
  (si es segura) o a `/app`.

## Verificación
- [x] vitest del util y de `hasRoleGuard`.
- [x] e2e: sin sesión abrir `/app/admin/pagos` → login → termina en `/app/admin/pagos`; con una
      URL externa en `returnUrl` termina en el dashboard.
