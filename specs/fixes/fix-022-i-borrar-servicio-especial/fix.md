# Fix: Poder borrar un Servicio Especial (catálogo) + una venta de Servicio Especial
> id: fix-022-i-borrar-servicio-especial
> refs: ASG-b-050
> status: done
> closed: 2026-08-13
> created: 2026-08-10

## Root Cause
[Heredado de ASG-b-050, a confirmar]: No falta permiso — la policy `delete_special_service_sales`
ya existe y permite DELETE a `admin` y `secretary` (`indices/DATABASE.md`). Falta la acción en la
interfaz: no hay botón de borrar en la vista de Servicios Especiales.

### Decisión de negocio (resuelta en sesión, 2026-08-10 — no queda como pregunta abierta)
`special_service_sales` es una venta ligada a un `sale_date`. La cuadratura diaria
(`cash_closings`) guarda `total_income`/`total_expenses`/`balance` como **snapshot congelado**
al momento del cierre — no se recalcula sola. Borrar una venta cuyo día ya tiene una fila en
`cash_closings` para esa fecha dejaría el número de esa cuadratura pasada descuadrado en
silencio (mismo problema conceptual que `ASG-b-037`).

**Decisión:** borrado duro (`DELETE` real, sin estado "anulada") en el caso normal — venta de
un día cuya caja no se cerró todavía. **Bloqueado** si el `sale_date` de la venta cae en una
fecha con `cash_closings` ya registrado para esa sede (mismo candado conceptual que ya usan
otras partes del sistema para no tocar el pasado financiero cerrado).

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
1. Agregar botón de borrar en la fila del Historial de Ventas (`servicios-especiales-content`),
   solo visible para `admin`/`secretary` (ya lo son por RLS, pero ocultar el botón igual si
   corresponde según UX del resto de la vista).
2. Usar `ConfirmModalService` ya existente — no crear un modal nuevo.
3. En `ServiciosEspecialesFacade`: antes de emitir el DELETE, verificar si existe un
   `cash_closings` para `(branch_id, sale_date)` de esa venta. Si existe, bloquear con mensaje
   claro ("No se puede borrar: la caja del {fecha} ya está cerrada") — no intentar el DELETE.
4. Si no hay cierre para esa fecha, ejecutar el DELETE real y refrescar el historial
   (`refreshSilently()`, patrón SWR).

## Test de Regresión
- Golden path: venta de hoy (sin cierre) → borra correctamente, desaparece del historial.
- AC-E1: venta de un día con `cash_closings` ya registrado → botón bloquea con mensaje, no
  ejecuta DELETE.
- Secretaria puede borrar igual que admin (RLS ya lo permite a ambos).
- `/verify` — visual del nuevo botón + modal de confirmación, modo oscuro/claro.

## Referencias
- `indices/DATABASE.md` → `special_service_sales`, `cash_closings`
- `src/app/core/facades/servicios-especiales.facade.ts`
- ASG-b-037 (mismo criterio de "no tocar pasado financiero cerrado")

## Archivos involucrados
- `src/app/core/facades/servicios-especiales.facade.ts`
- `src/app/shared/components/servicios-especiales-content/servicios-especiales-content.component.ts`

## Ampliación de alcance (confusión detectada tras QA con el usuario, 2026-08-13)
El "Hallazgo" original de `ASG-b-050` apuntaba a `delete_special_service_sales` (borrar una
**venta**, tabla `special_service_sales`) — implementado y verificado (ver Parte 1 abajo). Pero
el pedido real del usuario era poder borrar un **servicio del catálogo** (la tarjeta "test" en
"Catálogo de Servicios", tabla `service_catalog`) — la ASG apuntó a la tabla equivocada. Ambas
funcionalidades son legítimas y quedan implementadas; se documentan por separado.

### Root Cause — Parte 2: borrar del Catálogo de Servicios
`delete_service_catalog` también existe ya (`admin`/`secretary`). Pero
`special_service_sales.service_id` tiene `NOT NULL REFERENCES service_catalog(id)` **sin
`ON DELETE CASCADE`** — un DELETE duro sobre un servicio con ventas asociadas falla con una
violación de FK (`23503`) cruda de Postgres. El catálogo ya tiene una columna `active` pensada
para este caso (el badge "Activo"/"Inactivo" ya la muestra), pero no había ninguna acción en la
UI que la tocara.

**Decisión (confirmada con el usuario):** intentar el DELETE duro primero. Si Postgres rechaza
por la FK (`error.code === '23503'`), hacer fallback automático a `UPDATE active = false`
(desactivar) en vez de mostrar el error crudo — deja de ofrecerse para nuevas ventas sin romper
el historial de ventas ya existente. Avisar al usuario cuál de los dos pasó (toast distinto).

### Cambio — Parte 2
1. Botón de borrar en la tarjeta de cada servicio del Catálogo.
2. `ServiciosEspecialesFacade.borrarServicio(id)`: intenta DELETE; si falla por FK, hace UPDATE
   `active=false`; devuelve `{ success, deactivated }` para que el Smart component elija el
   toast correcto.
3. `ConfirmModalService` para la confirmación (mismo patrón que la Parte 1).

### Test de Regresión — Parte 2
- Servicio sin ventas asociadas → DELETE duro exitoso, desaparece del catálogo.
- Servicio con ventas asociadas → DELETE falla con `23503` → fallback a `active=false`
  automático, sin mostrar error crudo; el servicio pasa a "Inactivo" pero sigue en el catálogo.
- `/verify` visual del botón + confirmación en el catálogo.

## Resultado

### Parte 1 — Borrar venta (Historial de Ventas)
- `ServiciosEspecialesFacade.borrarVenta(id)`: verifica `cash_closings` (por `date` + `branch_id`
  de la venta, `closed=true`) antes de intentar el DELETE. Bloquea con `blockedReason` legible
  si el día ya cerró caja; si no, ejecuta el DELETE real y hace `refreshSilently()` (SWR).
- `VentaServicio` (UI model) y `SpecialServiceSale` (DTO) ganan `branchId`/`branch_id` — necesario
  para el candado (la venta puede pertenecer a una sede distinta a la del usuario si es admin con
  "todas las sedes").
- `servicios-especiales-content.component.ts`: botón de borrar (ícono `trash-2`) en la fila del
  Historial (desktop y mobile), usando `ConfirmModalService` (severity `danger`) — sin modal
  custom, sin gating de rol client-side (ya lo resuelve RLS).
- Smart components (`admin-` y `secretaria-servicios-especiales.component.ts`): conectan el nuevo
  output `ventaBorrada`, llaman al facade y muestran toast (`ToastService`) de éxito/bloqueo/error.
- TDD: `.spec.ts` escrito primero — 3 tests nuevos (golden path, AC-E1 bloqueo, venta inexistente),
  12/12 tests del facade verdes.
- QA visual con Playwright MCP contra datos reales: golden path (venta sin cierre → borra,
  KPIs se recalculan), AC-E1 confirmado con una venta real fechada en un día con
  `cash_closings.closed=true` (bloqueado, sin DELETE en la red), mismo flujo verificado también
  como secretaria (branch_id distinto, RLS + candado funcionan igual), modo oscuro con buen
  contraste. Consola limpia en todo el recorrido.

### Parte 2 — Borrar del Catálogo
- `ServiciosEspecialesFacade.borrarServicio(id)`: intenta `DELETE` duro; si Postgres rechaza con
  `error.code === '23503'` (FK de `special_service_sales.service_id`), hace fallback a
  `UPDATE active=false` y devuelve `{ success: true, deactivated: true }`. Sin ventas asociadas,
  el DELETE duro pasa directo (`deactivated: false`).
- Botón de borrar (ícono `trash-2`) junto al badge Activo/Inactivo en cada tarjeta del catálogo,
  mismo `ConfirmModalService` (severity `danger`), mensaje que explicita el fallback de
  antemano.
- Smart components: nuevo output `servicioBorrado`, toast distinto según `deactivated`
  (warning "se desactivó" vs success "se borró").
- TDD: 4 tests nuevos (`borrarServicio`) — DELETE directo, fallback por FK, error genérico,
  fallback de UPDATE que también falla. 16/16 tests del facade verdes. El mock de Supabase del
  spec se extendió para soportar respuestas distintas por operación (`tabla:delete`,
  `tabla:update`) sobre la misma tabla, necesario para simular el fallback.
- QA visual con Playwright MCP contra datos reales: camino con ventas asociadas confirmado
  (`DELETE→409→PATCH→204`, la venta histórica queda intacta en el Historial, el servicio
  desaparece del catálogo activo pero no se borró), camino sin ventas confirmado (`DELETE→204`
  directo), modo oscuro con buen contraste. El único "error" de consola es el 409 esperado del
  DELETE rechazado por FK — capturado y manejado, no una excepción sin atrapar.
