# Registro de Guards

> Guards de ruta en `core/guards/` — controlan acceso a rutas según rol, estado de auth o condiciones de negocio.
> La sección Auto-Index es regenerada por `npm run indices:sync`. No editar entre los marcadores.

## Guards Activos

| Guard | Tipo | Propósito | Rutas protegidas |
|-------|------|-----------|-----------------|
| `authGuard` | `CanActivateFn` | Redirige a `/login` si no hay sesión activa, o si el perfil está desactivado (`isActive === false`: cierra la sesión — fix-180-b). Si la sesión viene de un link de recuperación sin clave nueva, manda a `/recuperar-contrasena` (fix-181-b) | Todas las rutas bajo `/app` |
| `guestGuard` | `CanActivateFn` | Redirige a `/app` si ya hay sesión (evita volver al login) | `/login` |
| `passwordRecoveryGuard` | `CanActivateFn` | Deja pasar solo si la sesión viene de un link de "recuperar contraseña" (`AuthFacade.passwordRecovery()`); si no, `/login` (fix-181-b) | `/recuperar-contrasena` |
| `roleRedirectGuard` | `CanActivateFn` | Redirige al portal correcto según el rol del usuario autenticado | `/app` (raíz) |
| `roleGuard` | `CanActivateFn` | Bloquea acceso a portales de rol incorrecto | `/app/admin`, `/app/secretaria`, `/app/instructor`, `/app/alumno` |
| `firstLoginGuard` | `CanActivateFn` | Fuerza cambio de contraseña en primer login (`first_login=true`) | Rutas de portal tras autenticar |
| `enrollmentDraftGuard` | `CanDeactivateFn` | Confirma salida si hay un draft de matrícula activo (no guardado) | `SecretariaMatriculaComponent` |
| `professionalBranchGuard` | `CanActivateFn` | Bloquea rutas profesionales de secretaría si la sede no ofrece Clase Profesional (fix-028-m/029) | 11 rutas profesionales de secretaría |
| `pilotPhaseGuard(module)` | `CanActivateFn` (factory) | Bloquea un módulo mientras esté en `core/config/pilot-phase.config.ts` (`isBlockedInPilot`), redirige a `/modulo-no-disponible`. Sin dependencia de `AuthFacade` — aplica igual a rutas públicas. Fuente única de verdad del flag en `pilot-phase.config.ts`, no repetida en el guard (fix-255-m) | `/inscripcion`, `/inscripcion/retorno`, `/app/instructor/**`, `/app/alumno/**` |

## Auto-Index — Guards detectados por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
| Guard | Tipo | Dependencias | Archivo |
|-------|------|-------------|---------|
| `authGuard` | `CanActivateFn` | `AuthFacade`, `Router` | `src/app/core/guards/auth.guard.ts` |
| `enrollmentDraftGuard` | `CanDeactivateFn` | `EnrollmentFacade`, `ConfirmModalService` | `src/app/core/guards/enrollment-draft.guard.ts` |
| `firstLoginGuard` | `CanActivateFn` | `AuthFacade`, `Router` | `src/app/core/guards/first-login.guard.ts` |
| `guestGuard` | `CanActivateFn` | `AuthFacade`, `Router` | `src/app/core/guards/guest.guard.ts` |
| `passwordRecoveryGuard` | `CanActivateFn` | `AuthFacade`, `Router` | `src/app/core/guards/password-recovery.guard.ts` |
| `pilotPhaseGuard` | `CanActivateFn` | `Router` | `src/app/core/guards/pilot-phase.guard.ts` |
| `professionalBranchGuard` | `CanActivateFn` | `AuthFacade`, `BranchFacade`, `Router` | `src/app/core/guards/professional-branch.guard.ts` |
| `roleRedirectGuard` | `CanActivateFn` | `AuthFacade`, `Router` | `src/app/core/guards/role-redirect.guard.ts` |
| `hasRoleGuard` | `CanActivateFn` | `AuthFacade`, `Router` | `src/app/core/guards/role.guard.ts` |

<!-- AUTO-GENERATED:END -->
