# Hotfix: "demasiados intentos" de Supabase se muestra como un error genérico
> id: hotfix-089-b-login-demasiados-intentos
> refs: ASG-i-022 (checklist 022, A15 / sospecha S13)
> status: done
> created: 2026-10-16

## Problema
`mapAuthError` solo reconocía el texto `Rate limit exceeded` (con mayúscula). Supabase Auth
responde `Request rate limit reached` (`over_request_rate_limit`) cuando hay demasiados intentos
de login, y `email rate limit exceeded` (`over_email_send_rate_limit`) al pedir muchos correos de
recuperación. Las dos caían en el genérico "Error de autenticación. Por favor, verifica tus
datos…", que invita a reintentar.

## Cambios
- **Archivo:** `src/app/core/utils/auth-errors.utils.ts` (+ spec) — reconoce los códigos
  `over_request_rate_limit` / `over_email_send_rate_limit` y cualquier "rate limit" sin distinguir
  mayúsculas → "Demasiados intentos. Por favor, intenta de nuevo más tarde.".

## Verificación
- [x] vitest del util.
- [x] e2e `auth-sesion-2.spec.ts` A15 (respuesta 429 simulada, las dos variantes).
