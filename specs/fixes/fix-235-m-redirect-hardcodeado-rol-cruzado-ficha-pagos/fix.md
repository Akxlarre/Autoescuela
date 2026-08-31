# Fix: "Ver todo el historial" de la ficha de alumno lleva a una vista /admin cuando la abre la secretaria

> id: fix-235-m-redirect-hardcodeado-rol-cruzado-ficha-pagos
> status: done
> closed: 2026-08-31
> created: 2026-08-31

## Root Cause
`AdminHistorialPagosComponent` (columna 3 de la ficha de alumno — "Estado Financiero") tiene
en su template un `routerLink="/app/admin/pagos"` **literal**. Ese componente es hijo de
`AdminAlumnoDetalleComponent`, que está ruteado en DOS portales:

- `/app/admin/alumnos/:id`      (`hasRoleGuard(['admin'])`)
- `/app/secretaria/alumnos/:id` (`hasRoleGuard(['secretaria'])`)

Cuando la secretaria abre la ficha y pulsa "Ver todo el historial", el link la manda a
`/app/admin/pagos`, ruta bloqueada por `hasRoleGuard(['admin'])` → acceso denegado / portal
equivocado. El padre ya resuelve su propio "volver" de forma role-aware
(`resolveListadoRoute(isAdmin, …)`), pero el componente hijo se quedó con la ruta fija.

### Auditoría del resto de la app (parte 2 del pedido)
Se revisaron todos los `routerLink` / `router.navigate` / `redirectTo` a `/app/admin/*` y
`/app/secretaria/*` en `src/app/`. Único caso cross-rol defectuoso: el de arriba. El resto es
correcto:

- `core/services/auth/menu-config.service.ts` — builders `adminMenu` / `secretariaMenu`
  separados; cada uno emite su propio prefijo. OK.
- `layout/topbar.component.ts` (`resolveNotificationLink`) — `switch (referenceType)` con rama
  por `role`. OK.
- `shared/components/ajustes-drawer/ajustes-drawer.component.ts` — `navigateToAuditoria()`
  (`/app/admin/auditoria`) sólo se renderiza dentro de `@if (isAdmin())`; el link a
  configuración-web ya usa `` `/app/${role}/configuracion-web` ``. OK.
- `features/admin/secretarias/admin-secretarias.component.ts:584` — `/app/admin/auditoria`,
  pero el componente sólo está ruteado bajo `/app/admin`. OK.
- `features/admin/alumno-detalle/admin-alumno-detalle.component.ts` — `resolveListadoRoute`
  ya bifurca admin/secretaria. OK.
- Componentes `features/admin/*` reusados en rutas de secretaria
  (`LibroDeClasesComponent`, `AdminContabilidadCursosComponent`,
  `AdminConfiguracionWebComponent`) — no contienen links hardcodeados a `/app/<rol>/`. OK.

## ACs Afectados
Ninguno — fix autónomo (bug de navegación reportado por el dueño en el demo 2026-08-31).

- AC-1: Con sesión de **secretaria**, abrir la ficha de un alumno (`/app/secretaria/alumnos/:id`)
  y pulsar "Ver todo el historial" en la card "Estado Financiero" navega a
  `/app/secretaria/pagos` (no a `/app/admin/pagos`).
- AC-2: Con sesión de **admin**, el mismo botón sigue navegando a `/app/admin/pagos`.
- AC-3: Ningún otro componente reusado entre portales conserva un redirect hardcodeado a
  `/app/admin/*` o `/app/secretaria/*` que dependa del rol del usuario (ver auditoría arriba).

## Cambio
- **`src/app/features/admin/alumno-detalle/components/historial-pagos/admin-historial-pagos.component.ts`**
  - Nuevo `historialPagosRoute = input.required<string>()`.
  - `routerLink="/app/admin/pagos"` → `[routerLink]="historialPagosRoute()"`.
- **`src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts`**
  - Nueva función pura exportada `resolvePagosRoute(isAdmin)` (Functional Core, junto a
    `resolveListadoRoute`).
  - `computed` `pagosRoute = resolvePagosRoute(this.isAdmin())`.
  - Bind `[historialPagosRoute]="pagosRoute()"` en `<app-admin-historial-pagos>`.

## Test de Regresión
- `admin-alumno-detalle.component.spec.ts`: `resolvePagosRoute(true) === '/app/admin/pagos'` y
  `resolvePagosRoute(false) === '/app/secretaria/pagos'`.
- Verificación visual (`/verify`): sesión secretaria → ficha de alumno → "Ver todo el historial"
  aterriza en el listado de Pagos de secretaria.
