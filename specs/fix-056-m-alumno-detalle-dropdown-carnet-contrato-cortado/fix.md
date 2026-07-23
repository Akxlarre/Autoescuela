# Fix: Dropdowns "Carnet" y "Contrato" se cortan detrás de la card de Perfil
> id: fix-056-m-alumno-detalle-dropdown-carnet-contrato-cortado
> refs: —
> status: in_progress
> created: 2026-07-23

## Root Cause

En `admin-alumno-detalle.component.ts`, el dropdown de acciones secundarias (Carnet, Contrato,
etc.) es `.card-action-menu` con `position: absolute` (línea ~926), anidado dentro de la card
"Info Personal" (`.bento-card.bento-tall`, `appCardHover`).

`.bento-card` tiene `overflow: hidden` por diseño (`_bento-grid.scss:380`, necesario para los
bordes redondeados). Cuando el menú desplegado excede el alto restante de la card, el navegador
lo recorta en el borde inferior de la card — exactamente lo que se ve en las capturas.

Cambiar `position: absolute` por `position: fixed` (el patrón que ya usa `hero-menu-panel` en
`SectionHeroComponent`, con posición calculada vía `getBoundingClientRect()`) **no alcanza por sí
solo**: la card tiene `appCardHover` (`CardHoverDirective`), que anima `transform` vía GSAP al
hacer hover con el mouse. Como el usuario tiene el mouse sobre la card cuando hace click en el
botón del dropdown, ese `transform` inline está activo en ese momento — y un ancestro con
`transform` se convierte en el *containing block* de sus descendientes `position: fixed`,
neutralizando el "escape" del `overflow: hidden` (el fixed queda contenido y recortado igual que
si fuera `absolute`).

`SectionHeroComponent.hero-menu-panel` no sufre este problema porque su panel vive fuera de
cualquier ancestro con `appCardHover`/transform-on-hover.

## ACs Afectados

- Ninguno — fix autónomo (bug de layout detectado en QA manual, sin spec previa).

## Cambio

- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts`
- **Qué cambia:**
  1. Mover el bloque `@if (action.menu && openCardMenuId() === action.id)` (el `<div
     class="card-action-menu">`) fuera de la card "Info Personal" — pasa a ser hermano directo
     dentro de `.bento-grid`, ya no anidado en ningún ancestro con `overflow: hidden` ni
     `transform`-on-hover. Se resuelve contra un nuevo `computed()` `openCardMenuItems()` (deriva
     de `secondaryActions()` + `openCardMenuId()`) en vez de la variable `item` del `@for` original.
  2. `.card-action-menu` pasa de `position: absolute; top: calc(100% + 4px); left: 0;` a
     `position: fixed;` con `[style.top.px]`/`[style.left.px]` calculados en TS —mismo patrón que
     `menuPos`/`updateMenuPos()` de `SectionHeroComponent`.
  3. `toggleCardMenu()` captura el `triggerEl` (`event.currentTarget`) y calcula la posición con
     `getBoundingClientRect()`; se agregan listeners de `scroll`/`resize` mientras el menú está
     abierto (se remueven en `closeCardMenu()`), igual que `SectionHeroComponent`.
  4. Como el `position: fixed` no participa del layout del grid (out-of-flow), no se necesita
     ningún `col-span`/`grid-row` especial ni afecta la disposición de las demás cards.

## Test de Regresión

- Verificación visual manual: abrir la ficha de un alumno, hacer click en "Carnet" o "Contrato" y
  confirmar que el dropdown se ve completo (sin recorte), tanto con el mouse quieto sobre el botón
  como recién llegado desde fuera de la card (para cubrir el caso con `transform` de hover activo).
