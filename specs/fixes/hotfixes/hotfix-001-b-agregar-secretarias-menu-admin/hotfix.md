# Hotfix: Agregar Secretarias al menú de admin
> id: hotfix-001-b-agregar-secretarias-menu-admin
> status: done
> closed: 2026-06-01
> created: 2026-06-01

## Problema
El módulo `/app/admin/secretarias` existe y está enrutado pero no aparece en `ADMIN_NAV` del menú lateral.

## Cambios
- **Archivo:** `src/app/core/services/auth/menu-config.service.ts` — agregar item `Secretarias` con ícono `user-cog` en el grupo "Recursos y Logística" de `ADMIN_NAV`
