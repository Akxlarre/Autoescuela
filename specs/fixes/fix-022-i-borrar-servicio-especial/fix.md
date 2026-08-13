# Fix: Poder borrar una venta de Servicio Especial
> id: fix-022-i-borrar-servicio-especial
> refs: ASG-b-050
> status: active
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

## Resultado
_Pendiente._
