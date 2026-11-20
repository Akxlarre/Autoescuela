# Fix: ng serve y los e2e usan environment.development.ts
> id: fix-504-m-ng-serve-usa-environment-development
> refs: —
> status: done
> closed: 2026-11-20
> created: 2026-11-20

## Root Cause
`SupabaseService` importa `environments/environment.ts` y `angular.json` no tenía `fileReplacements`
en la configuración `development`: `environment.development.ts` existía pero nadie lo usaba. Mientras
los dos archivos apuntaban al mismo proyecto no se notaba; desde hotfix-176-m `environment.ts` es
producción (`vbbzcfrilnolrhcwjabr`), así que `ng serve` y los e2e iban a producción. El guard de e2e
leía también `environment.ts` y abortaba la suite (seguro, pero inútil).

## ACs Afectados
Ninguno — fix autónomo.

- **AC-1:** `ng serve` (configuración `development`) usa `environment.development.ts` (dev,
  `klcwwrwfdqdciffraozq`).
- **AC-2:** `ng build --configuration production` sigue usando `environment.ts` (prod).
- **AC-3:** los e2e (guard, cliente admin y specs) leen `environment.development.ts`.

## Cambio
- **Archivo:** `angular.json` — `fileReplacements` en `build.configurations.development`.
- **Archivo:** `e2e/global-setup.ts`, `e2e/support/supabase-admin.ts`, `e2e/auth-sesion-2.spec.ts`,
  `e2e/auth-sesion-9.spec.ts`, `e2e/comunicacion-comunicados.spec.ts` — importan
  `environment.development`.

## Test de Regresión
- Build `development` contiene solo el ref de dev; build `production` contiene solo el de prod ✓
- `e2e/support/env-guard.spec.ts` ✓
