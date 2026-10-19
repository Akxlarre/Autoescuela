# Hotfix: cerrar sesión sin red deja la sesión abierta
> id: hotfix-091-b-salir-sin-red
> refs: ASG-i-022 (checklist 022, E10)
> status: closed
> created: 2026-10-19

## Problema
"Sí, salir" sin red (o con la llamada de logout fallando) deja a la persona en su dashboard:
1. `AuthFacade.logout()` no espera a `signOut()` y navega a `/` de inmediato; el guard vuelve a
   leer la sesión, que todavía está guardada, y la deja entrar.
2. Si la llamada a `/auth/v1/logout` falla por red, supabase-js **no borra** la sesión guardada en
   el navegador (solo ignora 401/403/404). En el mostrador, la próxima persona encuentra la sesión
   anterior abierta.

## Cambios
- **Archivo:** `src/app/core/services/infrastructure/supabase.service.ts` (+ spec) — `signOut()`:
  si el servidor no responde, borra igual la sesión local (la clave de almacenamiento del cliente).
- **Archivo:** `src/app/core/facades/auth.facade.ts` (+ spec) — `logout()` limpia el estado al
  tiro (como antes) y navega a `/` **después** de cerrar la sesión; devuelve la promesa.

## Verificación
- [x] vitest de `SupabaseService` y `AuthFacade`.
- [x] e2e `auth-sesion-3.spec.ts` E10 (logout con la red cortada).
