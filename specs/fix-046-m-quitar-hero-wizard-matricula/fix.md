# fix-046-m — Quitar el header azul del wizard de matrícula; mover el badge de paso al header del drawer

## Contexto

El dueño pidió eliminar el header azul ("Nueva matrícula" + subtítulo +
badge "Paso N de 6" + tracker de pasos) que encabeza el wizard de
matrícula, tanto en:

- La vista routeada (`/app/secretaria/matricula`, `/app/admin/matricula`).
- Los drawers que abren el mismo wizard desde Base Alumnos B
  (`AlumnosListContentComponent.openNuevaMatriculaDrawer()`) y desde el
  Dashboard (`DashboardComponent` → `AdminMatriculaComponent`).

Todos estos puntos de entrada renderizan el mismo componente
(`SecretariaMatriculaComponent`), así que un solo cambio en su template
cubre los 3 casos.

El dueño pidió específicamente: el badge "Paso N de 6" debe reubicarse en
la barra superior del drawer (donde ya están "Nueva Matrícula", "Ayuda",
"Reiniciar", cerrar) — o, si en la vista routeada hay un buen lugar para
reponerlo, hacerlo ahí también; si no, eliminarlo junto con el resto del
hero en ese contexto (la vista routeada no tiene barra superior propia,
así que el badge simplemente desaparece ahí).

## Alcance

1. **`secretaria-matricula.component.html`** — eliminar por completo el
   `<header class="surface-hero ...">` (banda azul con título, subtítulo,
   badge de paso y tracker de pasos) tanto en la vista `loading` (su
   skeleton equivalente) como en la vista `wizard`. Se mantiene todo lo
   demás (lightbox, `<main>` con el `p-stepper`).
2. **`layout-drawer.service.ts`** — agregar estado `badge?: string | null`
   junto a `actions`, con un método `setBadge(badge: string | null)` y su
   `computed` de lectura, siguiendo el mismo patrón ya usado para
   `actions`/`setActions`.
3. **`layout-drawer.facade.service.ts`** — exponer `badge` (readonly) y
   `setBadge()` como passthrough, igual que ya hace con `actions`.
4. **`layout-drawer.component.ts`** — renderizar el badge (si existe)
   en el header del drawer, junto al título ("Nueva Matrícula"), antes de
   las acciones (Ayuda/Reiniciar) y el botón cerrar.
5. **`secretaria-matricula.component.ts`** — agregar un `effect()` que
   llame `layoutDrawer.setBadge('Paso N de 6')` mientras `viewMode() ===
   'wizard'`, y `setBadge(null)` en cualquier otro `viewMode` y en
   `ngOnDestroy` (mismo patrón ya usado para `setActions`). Eliminar los
   computeds `wizardSteps` y `progressLabel` (y `stepLabels` si queda sin
   otros usos) por quedar sin consumidores tras remover el tracker del
   header.

No se toca ningún facade de negocio (`EnrollmentFacade`, etc.) ni la
lógica de los pasos del wizard.

## Acceptance Criteria

- AC1: `secretaria-matricula.component.html` ya no tiene el `<header
  class="surface-hero ...">` en ninguna de sus vistas (`loading`,
  `wizard`).
- AC2: `LayoutDrawerService`/`LayoutDrawerFacadeService` exponen
  `badge`/`setBadge()`.
- AC3: `LayoutDrawerComponent` renderiza el badge en su header cuando
  está definido.
- AC4: Al abrir el wizard como drawer (desde Base Alumnos B o Dashboard),
  el header del drawer muestra "Paso N de 6" actualizado según el paso
  activo.
- AC5: En la vista routeada (`/app/secretaria/matricula`,
  `/app/admin/matricula`) no queda ningún resto visual del hero azul ni
  del badge (no hay barra superior de drawer ahí, por lo tanto no hay
  dónde reubicarlo).
- AC6: No se modifica lógica de negocio de los facades de matrícula;
  `npm run test:ci` sigue en verde.
