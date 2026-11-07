# Fix: Configuración web — cambiar de sede pierde lo editado y puede mezclar sedes
> id: fix-495-m-configuracion-web-cambio-de-sede
> refs: ASG-i-036
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

La pantalla recarga la configuración cada vez que cambia la sede, sin considerar lo que se está
editando ni el orden en que llegan las respuestas:

1. **I04 / P10.** Cambiar la sede en el topbar, o salir de la pantalla, descartaba los cambios sin
   publicar sin avisar.
2. **S19.** `WebsiteConfigFacade.loadConfig()` no tenía guard de respuesta vieja: con un cambio
   rápido A→B, la respuesta de A podía llegar después y dejar el formulario con datos de A mientras
   la sede vigente (la que usa "Publicar") era B.
3. **D4 (decisión de `fix-485-m`).** La secretaria con acceso a ambas sedes quedaba fija en su sede
   propia: `effectiveBranchId` ignoraba su selector. La RLS de `website_config` y la del bucket ya
   le permiten las dos.

S22 (secretaria sin sede) no requiere cambio: `branchAssignedGuard` (hotfix-099-b) la manda a
`/sin-sede` antes de llegar a esta pantalla.

## ACs Afectados

- `0003-b` AC3 (cada sede edita lo suyo): nunca se publica en una sede lo cargado de otra.

## Cambio

- **`core/facades/website-config.facade.ts`:** `createRequestGuard()` en `loadConfig()`.
- **`features/admin/configuracion-web/admin-configuracion-web.component.ts`:** la sede sale de
  `resolveBranchScope()` (la secretaria con acceso a ambas sigue su selector); al cambiar de sede
  con cambios sin publicar pide confirmación y, si se cancela, vuelve a la sede anterior;
  `hasUnsavedChanges()` para el guard.
- **`core/guards/configuracion-web-unsaved.guard.ts` (nuevo) + `app.routes.ts`:** confirmación al
  salir de la pantalla con cambios sin publicar (mismo patrón que `documentTemplateDraftGuard`).

## Test de Regresión

- `core/facades/website-config.facade.spec.ts > fix-495-m` (respuesta vieja descartada) ✓
- `core/guards/configuracion-web-unsaved.guard.spec.ts` ✓
- Navegador: editar el slogan y cambiar de sede → confirmación; "Quedarse" vuelve a la sede y
  conserva lo escrito. ✓ (2026-11-07: también "Salir sin publicar" al ir a Inicio; "Cambiar sin publicar" carga la otra sede; secretaria multi-sede elige Conductores y ve su config. En el camino apareció que el effect que llena el formulario también reaccionaba a la sede —leía effectiveBranchId()— y borraba lo escrito aunque se eligiera "Quedarse": se aisló con untracked)
