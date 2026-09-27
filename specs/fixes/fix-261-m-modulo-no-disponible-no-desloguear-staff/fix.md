# Fix: "Módulo no disponible" cierra la sesión de admin/secretaria
> id: fix-261-m-modulo-no-disponible-no-desloguear-staff
> refs: hotfix-107-m, fix-255-m, fix-260-m
> status: done
> closed: 2026-09-27
> created: 2026-09-27

## Root Cause

`hotfix-107-m` hizo que el único botón de `/modulo-no-disponible` ("Volver al inicio de sesión")
llame a `auth.logout()` **incondicionalmente**, pensando solo en instructor/alumno (portal entero
bloqueado por la fase piloto). La pantalla no distingue el rol de quien llega: un admin/secretaria
que cae ahí (ruta del recorte de Clase Profesional por URL/marcador, notificación de
pre-inscripción, o las rutas bloqueadas por error en `fix-041-i`) y presiona el botón pierde la
sesión.

## ACs Afectados

Ninguno — fix autónomo.

- AC-1: admin/secretaria → botón "Volver al inicio" navega a `/app` (→ su dashboard) **sin** logout.
- AC-2: instructor/alumno → comportamiento actual: `logout()` + vuelta al login.
- AC-3: sin sesión (matrícula pública bloqueada) → navega a `/login` sin llamar `logout()`.

## Cambio

- **Archivo:** `src/app/features/modulo-no-disponible/modulo-no-disponible.component.ts`
- **Qué cambia:** función pura `resolveModuloNoDisponibleAction(role)` decide la acción del botón
  según el rol; el label del botón se deriva de ella.

## Test de Regresión

- `src/app/features/modulo-no-disponible/modulo-no-disponible.component.spec.ts` (nuevo) ✓
- Manual: admin en `/app/admin/clase-profesional/relatores` → botón vuelve al dashboard con sesión viva.

## Progreso

- [x] Spec (6 casos) + implementación
- [x] test:ci verde: 2774 passed / 5 skipped; tsc limpio
- [x] Verificación en navegador (Playwright, 2026-09-27): admin en `clase-profesional/relatores` → botón "Volver al inicio" → `/app/admin/dashboard` con sesión viva; instructor → "Volver al inicio de sesión" → `/login` (logout); sin sesión en `/inscripcion` → `/login`.
