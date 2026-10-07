# Hotfix: `/app/admin/usuarios` es una página en blanco a la que se llega desde el dashboard
> id: hotfix-066-b-eliminar-pagina-usuarios
> refs: ASG-i-034 (sospecha S17, confirmada en fix-197-b) — decisión del owner 2026-10-07: eliminarla
> status: closed
> created: 2026-10-07

## Problema
`AdminUsuariosComponent` es un placeholder ("PLANO · Pendiente calcar desde mockup"). No está en el
menú, pero "Actividad reciente" del dashboard lleva ahí cada evento sobre la tabla `users`.

## Cambios
- **Archivo:** `src/app/features/admin/usuarios/admin-usuarios.component.ts` — eliminado.
- **Archivo:** `src/app/app.routes.ts` — sin la ruta `admin/usuarios` (cae en el 404 del rol).
- **Archivo:** `src/app/features/dashboard/recent-activity-drawer/recent-activity-drawer.component.ts`
  — los eventos de `users` dejan de ser clicables (no hay una página de usuarios a la que llevar).
- **Archivos:** `e2e/auth-sesion.spec.ts`, `e2e/barrido-rutas.spec.ts` — sin la ruta eliminada.

## Verificación
- `ng build`, `lint:arch`, `test:ci`; `/app/admin/usuarios` → 404 en el build de producción.

## Resultado (2026-10-07)
- `ng build` OK, `lint:arch` 0 errores, `test:ci` 3443 OK.
- Build de producción: admin en `/app/admin/usuarios` → "Página no encontrada". `auth-sesion.spec.ts` F01/F06 15/15.
- `npm run indices:sync`: la ruta y el componente salen de ROUTES/COMPONENTS/USAGE-MAP.
