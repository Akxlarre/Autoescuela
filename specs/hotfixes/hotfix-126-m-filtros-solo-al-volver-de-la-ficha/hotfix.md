# Hotfix: Los filtros de la Base de Alumnos se conservan siempre, no solo al volver de una ficha
> id: hotfix-126-m-filtros-solo-al-volver-de-la-ficha
> refs: fix-275-m, fix-264-m (caso F10 de `024a`), ASG-i-024
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
`fix-275-m` guardó los filtros de la lista en el facade, que vive mientras dure la pestaña: quedaban puestos al entrar a la lista por cualquier camino (desde el menú, después de pasar por otras pantallas) e incluso para la siguiente persona que iniciara sesión en la misma pestaña.

**Decisión del owner (Matías, 2026-10-01), que precisa la de F10:** los filtros se mantienen **solo al devolverse** desde la ficha de un alumno a la lista. Por cualquier otro camino la lista aparece sin filtros.

## Cambios
- **Archivo:** `src/app/core/utils/alumnos-list-navigation.utils.ts` — función pura `isReturningFromFicha(previousUrl)`: `true` si la pantalla anterior era la ficha de un alumno (`…/alumnos/<id>`).
- **Archivo:** `src/app/core/facades/admin-alumnos.facade.ts` — `resetListFilters()`.
- **Archivos:** `src/app/features/{admin,secretaria}/alumnos/*.component.ts` — al crearse, miran de qué pantalla viene la navegación; si no es la ficha, limpian los filtros antes de que la lista los lea.

Con esto también se limpian al cerrar sesión: tras iniciar sesión nunca se llega a la lista desde una ficha.

## Verificación
Verificado el 2026-10-01: `alumnos-list-navigation.utils.spec.ts` (13 casos) y `admin-alumnos.facade.spec.ts` en verde, `tsc` de la app sin errores, y el test E2E `F10` pasa en navegador con los tres caminos: "Volver" de la ficha conserva la búsqueda, el botón "atrás" del navegador también, y entrar por el menú después de pasar por la Agenda deja la lista sin filtros. `e2e/alumnos-b-lista.spec.ts` completo: 26/26 esperados.

El cierre de sesión no se probó aparte: usa la misma regla (tras iniciar sesión la pantalla anterior nunca es una ficha).
