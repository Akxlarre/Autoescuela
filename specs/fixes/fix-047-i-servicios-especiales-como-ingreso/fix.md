# Fix: Servicios especiales fuera de Reportes/Dashboard y contados como tarjeta en la Caja
> id: fix-047-i-servicios-especiales-como-ingreso
> refs: ASG-i-051
> status: done
> closed: 2026-10-12
> created: 2026-10-12

## Root Cause

[Heredado de ASG-i-051, revisado contra el código al reclamar]:

1. **Ingreso invisible fuera de la Caja**: solo `CuadraturaFacade` lee `special_service_sales`.
   `ReportesContablesFacade` (pagos + cursos singulares), la edge function
   `generate-financial-report`, el KPI de ingresos de `DashboardFacade` (secretaria) y las RPC
   `exec_dashboard_*` (dashboard ejecutivo del admin) no la consultan: Caja y Reportes no cuadran
   por el monto de los servicios vendidos.
2. **"Efectivo contado como tarjeta"**: `special_service_sales` no guarda medio de pago (no hay
   columna ni campo en el formulario). `fix-025-i` mandó la venta al bucket `otros` cuando las
   columnas de la Caja eran por tipo de clase; desde `fix-230-m` las columnas son por medio de pago
   y `otros` se muestra como **Tarjeta**. Una venta pagada en efectivo no entra al arqueo físico.
3. ~~Fecha UTC~~: **ya resuelto** por `0024-m` (`registrar-venta-drawer` usa `todayIso()` =
   `chileToday()`). Fuera de este fix.

## Decisiones (2026-10-12, con Ignacio)

- **Medio de pago en la venta:** campo nuevo en el formulario (Efectivo / Transferencia / Tarjeta),
  por defecto Efectivo; columna `payment_method` en `special_service_sales`. La Caja pone la venta en
  su columna real.
- **Ventas existentes:** se asumen `efectivo` (backfill). Los cierres de caja pasados no cambian
  (son una foto, DG-065).
- **Dónde se suma como ingreso:** Reportes Contables, reporte financiero (PDF/Excel) y Dashboard
  secretaria. El Dashboard ejecutivo admin queda **fuera del piloto**: mide solo Clase B (spec 0044-b),
  apartado igual que Clase Profesional. Solo ventas cobradas (`paid = true`), por sede.

## ACs Afectados

Ninguno — fix autónomo (originado de ASG-i-051).

- AC-1: una venta de servicio especial registra su medio de pago; la Caja la suma en esa columna
  (efectivo entra al arqueo).
- AC-2: Reportes Contables incluye los servicios especiales cobrados del período y sede.
- AC-3: el reporte financiero (PDF/Excel) los incluye.
- AC-4: el KPI de ingresos del Dashboard de secretaria los incluye.
- ~~AC-5: los KPIs/series de ingresos del Dashboard ejecutivo los incluyen.~~ Fuera del piloto: el
  dashboard ejecutivo mide solo Clase B (spec 0044-b).
- AC-6: Caja y Reportes cuadran para un mismo día y sede.

## Cambio

- Migración: `special_service_sales.payment_method` (CHECK efectivo/transferencia/tarjeta, default
  `efectivo`, backfill `efectivo`) SQL en el chat antes de
  crear el archivo; lo aplica Ignacio.
- `ServiciosEspecialesFacade.registrarVenta()` + `registrar-venta-drawer`: campo medio de pago.
- `CuadraturaFacade.mapSpecialServiceSaleToIngreso()`: bucket según medio de pago.
- `ReportesContablesFacade`, `DashboardFacade`: suman `special_service_sales`.
- Edge function `generate-financial-report`: suma `special_service_sales` (requiere deploy).

## Test de Regresión

- Specs de cada Facade tocado: la venta entra en la columna/total correcto.

## Evidencia de Verificación

### /verify — localhost:4200 contra el piloto, 2026-10-12 (secretaria, sede Autoescuela Chillán)

| Caso | Resultado |
|---|---|
| AC-1 Formulario de venta: campo "Medio de pago" | ✅ visible, **Efectivo por defecto**, opciones Efectivo / Transferencia / Tarjeta |
| AC-1 Guardar con Transferencia (POST interceptado y abortado, sin crear la venta) | ✅ payload con `payment_method: "transferencia"` |
| AC-2 Reportes Contables, "Año actual" | ✅ categoría **"Psicotécnico / Servicios: $20.000"** (venta del 22-09) sumada al total de ingresos ($9.920.000) |
| AC-2 Serie de Evolución | ✅ consulta `special_service_sales` del rango mayo–octubre (1 venta) |
| AC-3 Exportar Excel (edge function desplegada) | ✅ "Servicio Especial $20.000 · 1 · 0.2%" en el resumen y la fila "22-09-2026 · Cliente QA Test · Servicio: Psicotecnico · $20.000" en el detalle |

La Caja con medio de pago real se cubre con los tests del facade (no había ventas de servicios hoy en la
sede y no se crearon datos). AC-4 (KPI "Ingresos Mes" del dashboard de secretaria) se cubre con su test:
el mes actual no tiene ventas de servicios en la sede.

## Progreso

- [x] Revisar los 3 puntos contra el código (3 ya resuelto)
- [x] Decisiones de alcance (ver Decisiones)
- [x] Parte 1: medio de pago — código y tests (5 nuevos); migración `20261012120000` aplicada en el
  piloto por Ignacio el 2026-10-12
- [x] Parte 2: Reportes Contables (`fetchIngresos()` común a reporte y evolución) + KPI "Ingresos Mes"
  del Dashboard secretaria, con tests (4 nuevos; el mock de carrera del dashboard pasó de 8 a 10 queries)
- [x] Parte 3: reporte financiero — `mapSpecialServiceSaleRow`; desplegada el 2026-10-12 y verificada
  descargando el Excel (Deno no está instalado en el equipo: sin test local de la edge function)
- [x] Parte 4: dashboard ejecutivo — **fuera del piloto** (decisión de Ignacio, 2026-10-12): sigue
  midiendo solo Clase B, como define la spec 0044-b; se aparta igual que Clase Profesional. AC-5 no
  aplica en este fix
- [x] `npm run lint:arch` y `npm run test:ci` (3863 ✅, `tsc` limpio, ARCH-27/28 sin regresiones)
- [x] `/verify` (secretaria, sede 1; ver Evidencia)
- [x] Índices sincronizados (FACADES, COMPONENTS, UTILS, DATABASE)
- [x] `/fix-close` (2026-10-12, con visto bueno de Ignacio). Gotcha: DG-109. Dashboard ejecutivo → ASG-i-061.

## Notes

- **Fuera de alcance, observado en `generate-financial-report`:** filtra `payments.status = 'paid'`
  y la pantalla de Reportes no filtra por estado (ver ASG-i-060); la fecha de cursos singulares se corta
  con `.slice(0, 10)` sobre UTC (un cobro después de las 21:00 cae al día siguiente en el PDF).
- El KPI "Ingresos Mes" del Dashboard secretaria tampoco suma cursos singulares (ya era así).


- Originado de Asignación ASG-i-051 (`specs/assignments/ASG-i-051-servicios-especiales-fuera-de-reportes.md`).
- Toca `cuadratura.facade.ts`, ya corregido en `fix-044-i` (sin solape abierto).
