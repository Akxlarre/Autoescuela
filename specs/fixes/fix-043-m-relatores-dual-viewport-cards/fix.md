# fix-043-m — Relatores: tabla se convierte en tarjetas al abrir un drawer

## Contexto

El dueño pidió que, igual que en "Base Alumnos B"
(`AlumnosListContentComponent`) e "Instructores"
(`AdminInstructoresComponent`), al abrir un drawer en la vista de
Relatores (`AdminProfesionalRelatoresComponent`) la lista se transforme de
tabla a tarjetas apiladas, porque el espacio disponible se reduce.

### Causa raíz

`AdminProfesionalRelatoresComponent` (fix-040/041) reemplazó el listado
manual por un único `<p-table>` sin vista alterna de tarjetas. Los otros
dos listados (`AlumnosListContentComponent`,
`AdminInstructoresComponent`) usan el patrón **Dual-Viewport** ya
establecido en el Design System:

- Un contenedor con `container-type: inline-size` (`.dual-viewport-container`).
- Dos vistas hermanas: `.desktop-view.hide-on-squeeze` (tabla) y
  `.mobile-view.show-on-squeeze` (tarjetas), alternadas por
  `@container (max-width: Npx)`.
- Cuando el `LayoutDrawerComponent` empuja `<main>` (layout-shift), el
  `.bento-grid` y su `.dual-viewport-container` se angostan por debajo del
  umbral y la media query de contenedor activa las tarjetas
  automáticamente — sin necesidad de leer `layoutDrawer.isOpen()`
  directamente (así lo hace `AdminInstructoresComponent`).

Relatores no tiene esa segunda vista, así que la tabla simplemente se
comprime/scrollea horizontalmente en vez de convertirse en tarjetas.

## Alcance

Único archivo: `admin-profesional-relatores.component.ts`.

1. Envolver el card que contiene el `<p-table>` con
   `dual-viewport-container` (igual patrón que instructores/alumnos).
2. Envolver el `<p-table>` existente en un `.desktop-view.hide-on-squeeze`.
3. Agregar una vista `.mobile-view.show-on-squeeze` con tarjetas por
   relator (avatar+iniciales, nombre, rut, badges de especialidad, estado,
   WhatsApp, botones Ver/Editar) reusando `filteredRelatores()` — mismo
   dataset ya filtrado, sin paginación adicional (el volumen típico de
   relatores es bajo, igual criterio ya usado en Instructores/Alumnos para
   listas cortas).
4. Reflejar la misma partición en el skeleton de carga (`facade.isLoading()`)
   para mantener paridad visual entre tabla y tarjetas (criterio ya exigido
   en fix-038/fix-039 de este proyecto).
5. Agregar el CSS de container query (`dual-viewport-container`,
   `show-on-squeeze`/`hide-on-squeeze`) igual al de
   `admin-instructores.component.ts`.
6. No se toca el facade, el modelo `RelatorTableRow`, ni los drawers Ver/
   Crear/Editar.

## Acceptance Criteria

- AC1: `admin-profesional-relatores.component.ts` tiene un contenedor con
  `container-type: inline-size` envolviendo la tabla.
- AC2: Existe una vista `.mobile-view.show-on-squeeze` con tarjetas por
  relator, visible solo cuando el contenedor se angosta (drawer abierto).
- AC3: La vista de tabla (`.desktop-view.hide-on-squeeze`) se oculta
  cuando el contenedor se angosta, igual que en Instructores/Alumnos.
- AC4: El skeleton de carga también tiene ambas vistas (desktop/mobile)
  para no romperse visualmente al angostar.
- AC5: No se modifica lógica de negocio ni facades; `npm run test:ci`
  sigue en verde.
