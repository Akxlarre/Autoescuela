# Fix: 3 gaps de UX en Servicios Especiales (encontrados en QA de fix-022-i)
> id: fix-023-i-ux-servicios-especiales
> refs: —
> status: done
> closed: 2026-08-13
> created: 2026-08-13

## Root Cause
Al usar el botón de borrar del catálogo agregado en `fix-022-i`, el usuario encontró 3 gaps
preexistentes, no relacionados con el borrado en sí:

1. **Servicios desactivados sin forma de verlos ni reactivarlos.** El catálogo solo consulta
   `.eq('active', true)` — un servicio desactivado (por el fallback de `fix-022-i` o por
   cualquier otro medio) queda invisible para siempre en la UI.
2. **"Estado" siempre queda en "Pendiente".** `registrarVenta()` graba `status: 'pending'`
   hardcodeado y ningún lugar del código lo cambia nunca a `'completed'` — es lógica que nunca
   se terminó de implementar. Distinto de "Cobro" (Cobrado/Cobrar), que sí funciona vía `paid`.
3. **La fecha de la venta se puede editar libremente.** El formulario tiene un `app-date-input`
   con default "hoy" pero sin restricción — permite fechar la venta a cualquier día pasado o
   futuro.

## Decisiones de negocio (confirmadas con el usuario, 2026-08-13)
1. **Estado = Cobrado.** No es un concepto distinto — se fusiona con `paid`. Si está cobrada,
   "Completado"; si no, "Pendiente". Sin campo/botón nuevo.
2. **Fecha fijada a hoy, sin poder editarla.** El formulario deja de tener un campo de fecha
   editable — se calcula automáticamente al enviar.
3. **Catálogo: toggle "Mostrar inactivos".** Un interruptor en el header. Con el toggle
   apagado (default), solo se ven los servicios activos (comportamiento actual). Encendido,
   también aparecen los inactivos (atenuados), cada uno con botón "Reactivar" en vez de
   "Vender".

## ACs Afectados
Ninguno — fix autónomo (hallazgo de QA, no de una spec).

## Cambio
1. `ServiciosEspecialesFacade.fetchData()`: deja de filtrar `.eq('active', true)` en
   `service_catalog` — trae todo el catálogo (activos e inactivos). El dropdown de "Vender"
   (`RegistrarVentaDrawerComponent.catalogoOptions`) filtra `.filter(s => s.activo)` para no
   ofrecer servicios inactivos en una venta nueva.
2. Nuevo método `ServiciosEspecialesFacade.reactivarServicio(id)`: `UPDATE active=true`.
3. `mapVentaDto()`: `estado` se deriva de `dto.paid` (no de `dto.status`) — `'completado'` si
   `paid=true`, `'pendiente'` si no. `registrarVenta()`/`registrarCobro()` también escriben
   `status` consistente con `paid` (`'completed'`/`'pending'`) para no dejar la columna
   desalineada con lo que se muestra.
4. `servicios-especiales-content.component.ts`: signal local `mostrarInactivos`, toggle en el
   header del Catálogo, computed que filtra qué tarjetas mostrar. Tarjeta inactiva: atenuada,
   botón "Reactivar" en vez de "Vender". Nuevo output `servicioReactivado`.
5. `registrar-venta-drawer.component.ts`: quita el campo de fecha editable (`app-date-input` +
   `FormControl('fecha')`); muestra la fecha de hoy como texto no editable; `submitVenta()`
   calcula `fecha` automáticamente al enviar.

## Test de Regresión
- `reactivarServicio(id)`: UPDATE exitoso, refresca catálogo.
- `mapVentaDto`: `paid=true` → `estado: 'completado'`; `paid=false` → `estado: 'pendiente'`
  (sin depender de `status`).
- Catálogo con toggle apagado: solo servicios activos. Encendido: activos + inactivos, cada
  inactivo con "Reactivar".
- Dropdown de "Vender" nunca ofrece un servicio inactivo.
- `/verify` — toggle, botón Reactivar, campo de fecha ya no editable, modo oscuro/claro.

## Archivos involucrados
- `src/app/core/facades/servicios-especiales.facade.ts`
- `src/app/shared/components/servicios-especiales-content/servicios-especiales-content.component.ts`
- `src/app/shared/components/servicios-especiales-content/drawers/registrar-venta-drawer.component.ts`
- `src/app/features/admin/servicios-especiales/admin-servicios-especiales.component.ts`
- `src/app/features/secretaria/servicios-especiales/secretaria-servicios-especiales.component.ts`

## Resultado
- `ServiciosEspecialesFacade.fetchData()`: `service_catalog` ya no filtra `.eq('active', true)`
  — trae el catálogo completo.
- `reactivarServicio(id)`: `UPDATE active=true` + `refreshSilently()`.
- `mapVentaDto()`: `estado` se deriva de `dto.paid`. `registrarVenta()`/`registrarCobro()`
  escriben `status` alineado con `paid` (columna ya no queda desincronizada).
- `servicios-especiales-content.component.ts`: signal `mostrarInactivos` + toggle en el header
  del catálogo; `serviciosVisibles` computed filtra según el toggle; tarjeta inactiva atenuada
  (`opacity-60`) con botón "Reactivar" en vez de "Vender"; nuevo output `servicioReactivado`.
- `registrar-venta-drawer.component.ts`: `catalogoOptions` filtra `.activo` (nunca ofrece
  inactivos en una venta nueva); campo de fecha reemplazado por texto no editable
  (`hoyLabel`); `submitVenta()` calcula la fecha automáticamente, sin `FormControl('fecha')`.
- Smart components: conectan `servicioReactivado` → `facade.reactivarServicio()` + toast.
- TDD: 5 tests nuevos (`estado` deriva de `paid`, `reactivarServicio` x2, ajuste de 2 tests
  existentes que asumían el comportamiento viejo de `status`). 19/19 tests del facade verdes.
- `npm run lint:arch` y `npx ng build --configuration=development` verdes.
- QA visual con Playwright MCP contra datos reales: toggle "Mostrar inactivos" confirmado
  (apagado → solo activos; encendido → activos + inactivos atenuados), botón "Reactivar"
  confirmado (`PATCH → 204`, `service_catalog` fetch ya sin filtro `active`), Estado="Completado"
  verde en una venta cobrada real, campo Fecha no editable mostrando la fecha de hoy, modo
  oscuro con buen contraste. Consola limpia.
