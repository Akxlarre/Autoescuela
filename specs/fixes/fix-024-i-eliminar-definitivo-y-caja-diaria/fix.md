# Fix: Eliminar definitivo de Servicio Especial + integración con Caja Diaria
> id: fix-024-i-eliminar-definitivo-y-caja-diaria
> refs: —
> status: done
> created: 2026-08-13

## Root Cause
Pedido directo del usuario tras QA de fix-022-i/fix-023-i:
1. Un servicio Inactivo no tiene forma de borrarse de manera permanente (solo Reactivar).
2. `special_service_sales` (ventas de Servicios Especiales) nunca se suman a los ingresos de
   Caja Diaria (`CuadraturaFacade`) — grep confirmó cero referencias.

## Decisiones de negocio (confirmadas con el usuario, 2026-08-13)
1. **Eliminar definitivo** solo disponible en servicios Inactivos, con confirmación por texto
   ("escribe ELIMINAR"), mismo patrón que `app-eliminar-alumno-modal`.
2. Al eliminar definitivo, las ventas asociadas **se mantienen en el Historial** — se
   desvinculan (`service_id = NULL`) en vez de borrarse, y conservan el nombre del servicio vía
   una columna denormalizada (`service_name`, snapshot al momento de la venta).
3. Una venta de Servicio Especial cobrada (`paid=true`) el día de hoy debe aparecer
   automáticamente en los ingresos de Caja Diaria — igual que ya pasa con cursos singulares.
   Ese ingreso ya reflejado en una cuadratura cerrada debe sobrevivir aunque el servicio se
   elimine definitivamente después (la cuadratura es un snapshot — DG-065).

## ACs Afectados
Ninguno — fix autónomo.

## Migración SQL
Dada en chat primero (usuario la corrió manualmente en Supabase); persistida luego a pedido
explícito del usuario en `supabase/migrations/20260813060000_fix024_special_service_sales_service_name.sql`
para no romper la convención del repo (157+ migraciones numeradas versionadas).
```sql
ALTER TABLE special_service_sales ALTER COLUMN service_id DROP NOT NULL;
ALTER TABLE special_service_sales ADD COLUMN IF NOT EXISTS service_name TEXT;
UPDATE special_service_sales sss
SET service_name = sc.name
FROM service_catalog sc
WHERE sss.service_id = sc.id AND sss.service_name IS NULL;
```

## Cambio
1. `ServiciosEspecialesFacade`:
   - `registrarVenta()` guarda `service_name` (snapshot del nombre elegido) en el INSERT.
   - `mapVentaDto()` prioriza `dto.service_name` sobre el join `service_catalog.name`.
   - Nuevo `borrarServicioDefinitivo(id)`: `UPDATE special_service_sales SET service_id=null
     WHERE service_id=id` (desvincula, no borra) → luego `DELETE service_catalog WHERE id=id`.
2. Nuevo componente `app-eliminar-servicio-modal` (Dumb, mismo patrón que
   `eliminar-alumno-modal`): confirmación por texto "ELIMINAR".
3. `servicios-especiales-content.component.ts`: botón "Eliminar definitivamente" en tarjetas
   inactivas, abre el nuevo modal. Nuevo output `servicioEliminadoDefinitivo`.
4. `CuadraturaFacade`: nuevo `mapSpecialServiceSaleToIngreso()` (bucket "efectivo" — sin método
   de pago en la tabla), `fetchSpecialServiceSales(today, branchId)` (`sale_date=today`,
   `paid=true`), integrado a `fetchPayments()`. Realtime en `special_service_sales`.
   `eliminarIngreso()` gana rama `source==='special_service'` (revierte `paid=false`, análogo
   a `singular`).

## Test de Regresión
- `registrarVenta` guarda `service_name`; `mapVentaDto` usa `service_name` si existe.
- `borrarServicioDefinitivo`: desvincula ventas, borra catálogo, ventas sobreviven con nombre.
- `mapSpecialServiceSaleToIngreso`: bucket correcto, `source: 'special_service'`.
- `fetchPayments` incluye ventas de servicios especiales cobradas hoy.
- `/verify` — modal "Eliminar definitivamente" (texto ELIMINAR requerido), ingreso visible en
  Caja Diaria, modo oscuro/claro.

## Archivos involucrados
- `src/app/core/facades/servicios-especiales.facade.ts`
- `src/app/core/facades/cuadratura.facade.ts`
- `src/app/core/models/ui/cuadratura.model.ts`
- `src/app/shared/components/servicios-especiales-content/servicios-especiales-content.component.ts`
- `src/app/shared/components/eliminar-servicio-modal/eliminar-servicio-modal.component.ts` (nuevo)

## Resultado
`npm run test:ci`: 26/26 en `cuadratura.facade.spec.ts`, 49/49 en `servicios-especiales.facade.spec.ts`.
`npm run lint:arch` y `npx ng build` limpios.

`/verify` (Playwright, admin, `/app/admin/servicios-especiales` + `/app/admin/contabilidad/cuadratura`):
- Modal "Eliminar definitivamente" en tarjeta Inactiva de un servicio de prueba: texto
  "eliminar" (minúscula) rechazado con borde rojo + mensaje inline; botón deshabilitado hasta
  escribir "ELIMINAR" exacto.
- Confirmar disparó exactamente `PATCH special_service_sales?service_id=eq.<id>` (unlink) →
  `DELETE service_catalog?id=eq.<id>` — nunca un DELETE en cascada directo.
- El servicio desapareció del catálogo incluso con "Mostrar inactivos" activo.
- Las 2 ventas históricas asociadas (`El Pepe` $20.000, `Prueba AC-E1` $5.000) sobrevivieron en
  el Historial con `servicio` = nombre original vía el snapshot `service_name`, pese a
  `service_id = null`.
- Caja Diaria (`/app/admin/contabilidad/cuadratura`, fecha de hoy): la venta cobrada
  ("El Pepe") apareció como ingreso con glosa `Servicio especial: test — El Pepe`, $20.000 en
  bucket Clase B, sumando correctamente a "Ingresos de Sistema" y "Total Día".
- "Eliminar ingreso" sobre esa fila disparó `PATCH special_service_sales?id=eq.5` (revierte
  `paid=false, status='pending'`) — no un DELETE. El ingreso desapareció de Caja Diaria, y la
  venta volvió a "Pendiente"/"Cobrar" en el Historial de Ventas de Servicios Especiales sin
  perder su registro.
