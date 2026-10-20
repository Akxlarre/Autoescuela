# Hotfix: un doble clic en "Iniciar Sesión" manda dos logins
> id: hotfix-090-b-login-doble-envio
> refs: ASG-i-022 (checklist 022, A12)
> status: done
> created: 2026-10-16

## Problema
El botón se deshabilita con `loading()`, pero eso recién se pinta en el siguiente ciclo: el
segundo clic de un doble clic ya entró y `LoginComponent.onSubmit` lo procesa igual → dos
peticiones de login (o dos correos de recuperación en el modo "recuperar").

## Cambios
- **Archivo:** `src/app/features/auth/login/login.component.ts` (+ spec) — `onSubmit` ignora un
  envío mientras hay otro en curso.

## Verificación
- [x] vitest: el test nuevo falla antes ("2 times") y pasa después.
- [x] e2e `auth-sesion-2.spec.ts` A11 + A12.
