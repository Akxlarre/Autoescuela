# Hotfix: Botón "Volver al inicio de sesión" en /modulo-no-disponible no funciona para usuarios ya autenticados
> id: hotfix-107-m
> refs: fix-255-m
> status: done
> closed: 2026-09-19
> created: 2026-09-19

## Problema

`ModuloNoDisponibleComponent` usa `routerLink="/login"`. Un usuario `instructor`/`alumno`
que llega ahí YA tiene sesión activa, así que `/login` dispara `guestGuard` (redirige a
`/app` si hay sesión) → `roleRedirectGuard` (lo manda a su portal) → `pilotPhaseGuard`
(lo bloquea de nuevo) → vuelve a `/modulo-no-disponible`. El botón parece no hacer nada.

## Cambios

- **Archivo:** `src/app/features/modulo-no-disponible/modulo-no-disponible.component.ts`
  — Inyecta `AuthFacade` y reemplaza el link `routerLink="/login"` por un botón que llama
  `auth.logout()` (mismo método que usa `TopbarComponent` para cerrar sesión — limpia el
  usuario y navega a `/`), en vez de solo navegar a una ruta que un usuario autenticado no
  puede usar.
