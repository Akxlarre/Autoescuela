# Hotfix: sesión expirada al guardar → "Ha ocurrido un error procesando la solicitud (PGRST303)"
> id: hotfix-093-b-sesion-expirada-mensaje
> refs: ASG-i-022 (checklist 022, B07)
> status: done
> created: 2026-10-19

## Problema
Si el token vence justo al guardar (p. ej. el equipo estuvo suspendido), PostgREST responde
`PGRST303` ("JWT expired") o `PGRST301`. `ErrorSanitizerService` no los conoce y muestra "Ha
ocurrido un error procesando la solicitud (PGRST303).", que no dice qué hacer.

## Cambios
- **Archivo:** `src/app/core/services/infrastructure/error-sanitizer.service.ts` (+ spec) —
  `PGRST301` y `PGRST303` → "Tu sesión expiró. Recarga la página o vuelve a iniciar sesión."

## Verificación
- [x] vitest del sanitizador.
- [x] e2e `auth-sesion-3.spec.ts` B07 (respuesta 401 simulada al guardar un vehículo).
