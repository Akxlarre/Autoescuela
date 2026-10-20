# Hotfix: /notificaciones de admin y secretaria mostraban una maqueta
> id: hotfix-103-b-notificaciones-maqueta-al-inicio
> refs: ASG-i-035 (checklist 035, S16 · G07)
> status: done
> created: 2026-10-20

## Problema
`/app/admin/notificaciones` y `/app/secretaria/notificaciones` no están en el menú, pero por URL
mostraban una maqueta: "Notificaciones · Mockup: /admin/notificaciones · PLANO · Pendiente calcar
desde mockup" (verificado en e2e). El historial real de notificaciones ya existe en la campana
("Ver todas").

Decisión del owner (2026-10-20): redirigir esas URLs al inicio del rol.

## Cambios
- **Archivo:** `src/app/app.routes.ts`: las dos rutas pasan a `redirectTo: 'dashboard'`.
- Se eliminan las maquetas `features/admin/notificaciones/` y `features/secretaria/notificaciones/`
  (sin otros usos).
- e2e que las daban por existentes: `auth-sesion-3.spec.ts` (I07), `barrido-rutas.spec.ts` (B29).

## Verificación
- [x] `ng build`; `lint:arch` sin errores.
- [x] e2e G07 (`comunicacion-tareas.spec.ts`): ambas URLs terminan en el dashboard del rol.
- [x] e2e afectados en verde: auth-sesion-3 I01\/I07 y auth-sesion F01 (`/app/admin/notificaciones` para secretaria).
