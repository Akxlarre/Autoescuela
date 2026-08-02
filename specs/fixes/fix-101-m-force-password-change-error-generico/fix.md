# Fix: Error genérico "correo o contraseña incorrectos" en cambio de contraseña forzado
> id: fix-101-m
> refs: —
> status: done
> closed: 2026-08-02
> created: 2026-08-02

## Root Cause
`AuthFacade.updatePassword()` (`src/app/core/facades/auth.facade.ts`) devuelve el error
crudo de `supabase.auth.updateUser()` sin pasarlo por `mapAuthError()`, a diferencia de
`login()` y el resto de métodos del facade. El componente `force-password-change` sanitiza
ese error crudo con `ErrorSanitizerService.sanitize()`, cuya rama para `AuthApiError`
(`error-sanitizer.service.ts:88`) mapea **cualquier** `AuthApiError` no reconocido al
mensaje de "correo o contraseña incorrectos" — incluyendo el error real de Supabase
"New password should be different from the old password", que ya tenía su traducción
correcta en `auth-errors.utils.ts:51-53` pero nunca se invocaba en este flujo.

## ACs Afectados
Ninguno — fix autónomo (bug reportado directamente por el dueño en QA manual).

## Cambio
- **Archivo:** `src/app/core/facades/auth.facade.ts`
- **Qué cambia:** `updatePassword()` envuelve el error de `updateUser()` con
  `mapAuthError()` antes de devolverlo, igual que el resto de métodos del facade
  (`login()`, etc.), para que el mensaje específico de "misma contraseña" llegue
  correctamente a la UI.

## Test de Regresión
- `src/app/core/facades/auth.facade.spec.ts > updatePassword > retorna mensaje de error legible cuando la nueva contraseña es igual a la anterior` ✓
