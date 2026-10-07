# Fix: Una venta de servicio especial registrada con "Todas las sedes" queda sin sede
> id: fix-194-b-venta-servicio-sin-sede
> refs: ASG-i-037 (caso D07/P22 del checklist 037, encontrado en fix-190-b) · DG-082
> status: done
> created: 2026-10-06

## Root Cause
`ServiciosEspecialesFacade.registrarVenta()` inserta `branch_id: getActiveBranchId(true)`. Con el
admin en "Todas las sedes" el scope es `null` y el fallback es `user.branchId`, que para el admin es
`null`: la venta se guarda **sin sede** (la RLS de INSERT deja pasar al admin). Es el mismo agujero
que DG-082 cerró para los egresos de Caja. En producción ya hay una (`special_service_sales` #3,
2026-08-13): no aparece en la Caja ni en los reportes de ninguna sede, solo en "Todas".

## ACs Afectados
Ninguno de una spec previa. ACs propios (patrón de DG-082 / `registrar-egreso-drawer`):

- **F1:** si la venta no tiene de dónde sacar la sede (admin o secretaria multi-sede con "Todas"),
  el formulario muestra un campo **Sede** obligatorio; con una sede elegida en el topbar, viene
  precargado con ella.
- **F2:** `registrarVenta()` nunca inserta `branch_id` null: sin sede devuelve `false` con el motivo
  en `error()`, sin tocar la BD (segunda barrera: el campo obligatorio ya impide enviar el form).
- **F3:** la secretaria de una sede sigue sin ver el campo: la venta va a su sede.

## Cambio
- `src/app/core/facades/servicios-especiales.facade.ts` (+ spec) — `requiereElegirSede`,
  `sedeOptions`, `sedePorDefecto`; `registrarVenta()` acepta `branchId` y rechaza null.
- `src/app/core/models/ui/servicios-especiales.model.ts` — `VentaFormData.branchId?`.
- `src/app/shared/components/servicios-especiales-content/drawers/registrar-venta-drawer.component.ts`
  — campo Sede condicional.

## Fuera de alcance
- La fila #3 ya existente: asignarle sede es decisión del owner (no se toca).
- La fecha de la venta en UTC (`toISOString`) es de ASG-i-054.

## Test de Regresión
- `npx vitest run src/app/core/facades/servicios-especiales.facade.spec.ts`

## Resultado (2026-10-06)
- `servicios-especiales.facade.spec.ts` 36/36 (6 nuevos: F1–F3; 5 en rojo antes del cambio).
- `npm run test:ci` 3375 ✓, `ng build` ✓, `lint:arch` 0 errores.
- Build de producción, admin en Servicios especiales (sin guardar nada):
  - "Todas" → campo **Sede** vacío y obligatorio, "Registrar Venta" deshabilitado.
  - "Conductores Chillán" en el topbar → el campo viene precargado con esa sede.
