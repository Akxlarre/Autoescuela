# Fix: No existe forma de editar un servicio del catálogo (Servicios Especiales)

> id: fix-240-m-editar-servicio-especial
> status: done
> closed: 2026-09-04
> created: 2026-09-04

## Root Cause

El catálogo de Servicios Especiales solo tenía altas (`app-agregar-servicio-drawer`) y bajas
(`borrarServicio`/`borrarServicioDefinitivo`/`reactivarServicio`) — ninguna acción permitía
corregir un nombre mal escrito, ajustar el precio o cambiar el estado sin pasar por
borrar+reactivar. El dueño lo confirmó viendo la UI: no hay ninguna forma de editar un servicio
existente.

## ACs Afectados

Ninguno — agrega una acción nueva (editar), no modifica el comportamiento de altas/bajas
existente.

## Cambio

- **`core/facades/servicios-especiales.facade.ts`**: agrega `_servicioAEditar` (signal privado +
  readonly `servicioAEditar`, separado de `_selectedServicio` que ya usa `RegistrarVentaDrawer`
  para su propio prefill — evitar acoplar ambos flujos), `openEditarServicioDrawer(servicio)`
  (mismo patrón lazy-import que `openRegistrarVentaDrawer`/`openAgregarServicioDrawer`) y
  `editarServicio(id, { nombre, precio, activo })` (UPDATE `service_catalog.name/base_price/active`
  + `refreshSilently()`).
- **`features/admin/servicios-especiales/editar-servicio-drawer.component.ts`** (nuevo): Smart/Drawer
  self-sufficient, mismo motivo que `historial-ventas-drawer.component.ts` para vivir en
  `features/admin/` y no en `shared/drawers/` (Architect Guard bloquea `inject(...Facade)` en
  `shared/`). Formulario `app-drawer-form`: nombre (texto, req), precio base (número, req, min 1),
  estado (`p-select` Activo/Inactivo, mismo patrón que `esAlumnoOptions` de
  `registrar-venta-drawer`). Precarga desde `facade.servicioAEditar()`.
- **`servicios-especiales-content.component.ts`**: agrega botón/ícono "Editar" (ícono `edit`) junto
  a "Vender"/borrar en la tabla y en la vista mobile, con output `requestEditarServicio`.
- **`admin-servicios-especiales.component.ts`** / **`secretaria-servicios-especiales.component.ts`**:
  conectan `(requestEditarServicio)="facade.openEditarServicioDrawer($event)"`.

## Test de Regresión

`servicios-especiales.facade.spec.ts` gana casos para `editarServicio()` (UPDATE exitoso, error
saneado). Verificado con `/verify`: editar nombre/precio/estado de "Psicotecnico" y confirmar que
el catálogo refleja el cambio sin recargar la página.

## Nota post-implementación

El `p-select` de Estado, dentro del scroll interno del drawer, recortaba la lista de opciones a
una sola fila y cualquier intento de hacer scroll cerraba el overlay (mismo síntoma que otros
selects dentro de drawers — `vehicle-form-drawer.component.ts` ya lo resolvía). Se agregó
`appendTo="body"` al `p-select`, igual que ese precedente, para que el panel se renderice fuera
del contenedor con overflow del drawer.
