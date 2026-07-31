# Fix: Columna "Combustible (Mes)" en Gestión de Flota + persistencia de vehicle_id en egresos
> id: fix-007-i-flota-columna-combustible-mes
> refs: ASG-b-037 (bloqueada — se adelanta la parte de persistencia de vehicle_id por decisión explícita del usuario)
> status: in_progress
> created: 2026-07-30

## Root Cause
No existía forma de saber cuánto gasta cada vehículo en combustible por mes, porque `expenses` no tenía columna `vehicle_id` — el selector de vehículo agregado en `fix-006-i` era solo visual (el valor nunca se guardaba, a propósito, porque esa persistencia estaba reservada para ASG-b-037, bloqueada esperando respuesta del cliente). El usuario pidió explícitamente adelantar esa parte para poder mostrar el gasto de combustible por vehículo en `/app/admin/flota`.

## ACs Afectados
Ninguno — fix autónomo (pedido directo del usuario, no de una spec).

## Cambio
- **Migración nueva** (`supabase/migrations/`): agregar columna `vehicle_id INTEGER REFERENCES vehicles(id)` (nullable) a `expenses`, idempotente.
- **`src/app/core/models/dto/expense.model.ts`**: agregar `vehicle_id: number | null`.
- **`src/app/core/models/ui/cuadratura.model.ts`**: `EgresoFormData` agrega `vehiculoId?: number | null`.
- **`src/app/core/facades/cuadratura.facade.ts`**: `registrarEgreso()` ahora inserta `vehicle_id: datos.vehiculoId ?? null` en `expenses` (rama `gasto`/`combustible`).
- **`src/app/features/admin/contabilidad-cuadratura/registrar-egreso-drawer.component.ts`**: `onSubmit()` ahora incluye `vehiculoId` del form en el `EgresoFormData` enviado al facade (el selector ya existía desde fix-006-i, solo faltaba conectarlo).
- **`src/app/core/models/ui/vehicle-table.model.ts`**: `VehicleTableRow` agrega `combustibleMes: number`.
- **`src/app/core/facades/flota.facade.ts`**: nueva query que suma `expenses.amount` por `vehicle_id` donde `category='combustible'` y `date` cae en el mes en curso (branch-scoped), mergeada a cada `VehicleTableRow`.
- **`src/app/shared/components/flota-list-content/flota-list-content.component.ts`**: nueva columna "Combustible (Mes)" entre KM y ESTADO, formateada en CLP (`$0` si no registra gastos).

## Test de Regresión
- `src/app/core/facades/flota.facade.spec.ts` — nuevo `describe('FlotaFacade.initialize — combustibleMes (fix-007-i)', ...)`: mockea `vehicles`/`expenses` (con canal Realtime mockeado también), corre `initialize()` y verifica que el vehículo con 2 egresos de combustible ($15.000 + $10.000) queda con `combustibleMes: 25000`, y el vehículo sin egresos con `combustibleMes: 0`.
- `src/app/core/facades/cuadratura.facade.spec.ts` (extendido de fix-006-i) — sigue verde; no hizo falta un test nuevo ahí porque `registrarEgreso()` ya tenía cobertura de `expenses.insert()` y `vehicle_id` se agrega al mismo payload objeto ya verificado con `expect.objectContaining(...)` (no exhaustivo, no rompe).
- `src/app/features/admin/contabilidad-cuadratura/registrar-egreso-drawer.component.spec.ts` (fix-006-i) — sigue verde, cubre el form/preset; no requería cambio porque `vehiculoId` ya era parte del `FormGroup` desde fix-006-i (solo se conectó al submit, sin nueva lógica de decisión que testear ahí).
- Verificación empírica: `npx tsc -p tsconfig.app.json --noEmit` limpio, `ng build --configuration=development` exitoso, `npm run lint:arch` → 0 errores, `npx vitest run` sobre los 4 archivos relacionados (`flota.facade`, `flota-detalle.facade`, `cuadratura.facade`, `registrar-egreso-drawer.component`) → **35/35 verde**.
- Verificación visual pendiente: (a) aplicar la migración (`npx supabase migration up` o el flujo que uses localmente) y confirmar que `expenses.vehicle_id` existe; (b) registrar un egreso de combustible desde el dashboard eligiendo un vehículo y confirmar que en `/app/admin/flota` la columna "Combustible (Mes)" de ese vehículo refleja el monto; (c) confirmar que un vehículo sin egresos muestra "$0" limpio (sin errores de formato).
