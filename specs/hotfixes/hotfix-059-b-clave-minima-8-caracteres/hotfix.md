# Hotfix: El front acepta claves de 6 caracteres y Supabase exige 8
> id: hotfix-059-b-clave-minima-8-caracteres
> refs: ASG-i-022 (hallazgo H2 de fix-183-b — sospecha S11 del checklist 022)
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Problema
Supabase Auth del piloto tiene `password_min_length = 8`, pero la app valida 6: la pantalla de
cambio de clave (`Validators.minLength(6)`, con placeholder "Mínimo 8") y el drawer de Ajustes
("Min. 6", `length < 6`). Con una clave de 6 o 7 caracteres el botón se habilita, Supabase la
rechaza ("Password should be at least 8 characters") y `mapAuthError` —que solo reconoce "at least
**6**"— muestra el genérico "Error de autenticación. Por favor, verifica tus datos".

## Cambios
- **Archivo:** `src/app/core/utils/auth-errors.utils.ts` (+ spec) — constante `PASSWORD_MIN_LENGTH = 8`
  y mapeo de "at least N characters" para cualquier N.
- **Archivo:** `src/app/features/auth/force-password-change/force-password-change.component.ts` — el
  validador usa la constante.
- **Archivo:** `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts` — placeholder y
  chequeo usan la constante.

## Verificación
- `vitest` auth-errors + auth.facade: 29 passed (2 casos nuevos: `PASSWORD_MIN_LENGTH = 8` y mapeo de "at least 8 characters").
- `ng build` OK, `lint:arch` exit 0.
