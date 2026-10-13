# Fix: Testing — Flota, documentos de vehículo y mantenimientos
> id: fix-220-b-testing-flota-mantenimientos
> refs: ASG-i-032
> status: in_progress
> created: 2026-10-12

## Root Cause
[Heredado de ASG-i-032, a confirmar]: gestión de vehículos — ficha, documentos (SOAP, revisión
técnica, permiso), mantenimientos y kilometraje. Sus vencimientos alimentan las alertas del
dashboard, las notificaciones y la advertencia al agendar.

Track de **testing**: se ejecuta el checklist `specs/testing-piloto/032-flota-mantenimientos.md`
(sospechas S1–S20 + casos A–S). Regla de la tanda: **cada bug encontrado va a su propio
fix/hotfix**; acá solo se registra el resultado de cada caso (✅ / ❌ + evidencia).

## ACs Afectados
Ninguno de una spec previa — track de testing (origen ASG-i-032). Criterios propios:

- **T1:** las sospechas S1–S20 quedan confirmadas (con su track), descartadas o como decisión.
- **T2:** ninguna prueba deja cambios en vehículos reales: lo que escribe se hace en transacciones
  revertidas o sobre vehículos de prueba que se listan para limpiar.
- **T3:** los casos marcados para Playwright quedan en `e2e/`.

## Cambio
- `e2e/*.spec.ts`, `supabase/tests/` — tests nuevos (sin cambios de producción en este track).

## Test de Regresión
- Los tests nuevos de este track, contra `localhost:4200`.

## Sospechas — estado (2026-10-12, contrastadas con el código y la BD de hoy)

El checklist es del 2026-09-29; desde entonces entraron la spec 0024-m (fechas en hora de Chile) y
el testing de Asistencia B (ASG-i-027), que resolvieron o cambiaron varias.

| # | Estado | Qué se encontró | Destino |
|---|---|---|---|
| S1 | ✅ Resuelta | El dashboard ya cuenta con `resolveVehicleStatus(status) === 'available'`, igual que Flota. En `src/app` no queda ningún uso del estado crudo `operational`/`in_use`. BD hoy: 6 `operational`, 11 `available` | — |
| S2 | 🟠 Parcial | fix-362-m ya **avisa** ("quedó sin guardar el kilometraje del vehículo") cuando la RLS filtra el UPDATE. Pero el KM **sigue sin actualizarse** cuando la secretaria finaliza una clase con un vehículo "Ambas": `update_vehicles` le exige `branch_id = su sede AND both_branches = false` | fix propio |
| S3 | 🟠 Parcial | fix-375-m agregó una **advertencia** en Iniciar clase si el km es menor al registrado; no bloquea, y Finalizar sobrescribe `current_km`. Editar Vehículo tampoco impide bajarlo | decisión F05/N05 |
| S4 | ✅ Corregida (`hotfix-073-b`, PR #262) | `admin-flota.component.ts:76` solo hace `console.log('Buscando:', term)`; `filteredVehicles` no filtra por texto | fix propio |
| S5 | ❌ Confirmada | `v_class_b_schedule_availability` une `vehicles` sin mirar `status`; `loadVehiclesByBranch` (Iniciar clase) tampoco | decisión F08 |
| S6 | ❌ Confirmada | `maintenance_records` solo tiene el trigger de auditoría: registrar un mantenimiento no toca `current_km` ni `last_maintenance` | decisión M03 |
| S7 | ✅ Resuelta | `vehicles`, `vehicle_documents` y `vehicle_assignments` ya están en la publicación `supabase_realtime` | — (se comprueba en Q01) |
| S8 | ✅ Corregida (`hotfix-074-b`, PR #263) | `vehicle-documents-drawer:183` solo distingue `expired`; un documento por vencer sale "Vigente" en verde | hotfix |
| S9 | ✅ Corregida (`hotfix-074-b`, PR #263) | Listado, advertencia al agendar y dashboard: 30 días (`alert_config` está vacía, el dashboard cae al 30 por defecto). Página de mantenimientos: 14 (`SOON_DAYS`) | decisión J04 |
| S10 | ✅ Resuelta | `resolveDocStatus` y `flota-detalle` usan `chileToday()` / `diffDaysIso` (spec 0024-m) | — (se comprueba en I08) |
| S11 | ❓ Decisión | App: vencimiento = hoy → "por vencer". Notificación: "venció hoy" | decisión I02 |
| S12 | ❌ Confirmada | Con una sede elegida, `dashboard.facade` filtra `vehicles` con `.eq('branch_id', …)` (sin "Ambas") y el selector de Iniciar clase también. Falta comprobar alertas del dashboard, combustible y Agenda | fix propio |
| S13 | ❌ Confirmada | `flota.facade:339-343`: `Map` por hora en punto (la clase de 11:50 pisa a la de 11:00) y bucle de 8 a 17 (las de 18:20, 19:10 y 20:00 no salen). No filtra canceladas; consulta mantenimientos y no los muestra | fix propio (K07 es decisión) |
| S14 | ✅ Corregida (`hotfix-074-b`, PR #263) | `flota-detalle.facade` solo revisa `vehicleResult.error`; si falla el historial se ve "vacío". El error de la Hoja de Ruta va al mismo `_error` de la página | hotfix |
| S15 | ✅ Corregida (`hotfix-074-b`, PR #263) | `avgMonthly = total ÷ cantidad de servicios`; `kmTraveled = currentKm` | decisión L08 |
| S16 | ❌ Confirmada | `notify_vehicle_document_expiry()` arma el texto con `v_doc.type` crudo ("soap del vehículo … venció hoy.") | hotfix (migración) |
| S17 | ❌ Confirmada | `getActionResults` no filtra por rol: a la secretaria le ofrece "Flota Vehicular" → `/app/secretaria/flota`, que no existe | hotfix |
| S18 | ✅ Corregida (`hotfix-075-b`, PR #264) | El `effect` del formulario hace `patchValue` cada vez que cambia `flotaFacade.vehicles()` (refresco, cambio de sede): pisa lo escrito | hotfix |
| S19 | ✅ Corregida (`hotfix-075-b`, PR #264) | Patente: placeholder "ABC-123" pero la regla `/^[A-Z]{2}[A-Z0-9]{2,}[0-9]{2}$/` rechaza guion y minúsculas, sin largo máximo. Año: solo `min(1900)`; la columna es SMALLINT | hotfix |
| S20 | ✅ Corregida (`hotfix-073-b`, PR #262) | `flota.facade:366`: "Profesional" si marca/modelo contiene atego/actros/accelo/camion/bus/volvo/iveco | decisión (¿hace falta el filtro?) |

**Resumen:** 3 resueltas, 3 parciales, 13 confirmadas, 1 decisión pura.

## Decisiones del owner (2026-10-12)

| # | Casos | Decisión |
|---|---|---|
| 1 | F08 / S5 | Un vehículo en Mantenimiento o Fuera de Servicio **deja de ofrecer horarios** y sale de los selectores |
| 2 | F05 / N05 / S3 | El kilometraje **no baja** en el uso normal (iniciar y finalizar clase lo bloquean); solo el admin puede corregirlo desde Editar, con confirmación |
| 3 | M03 / S6 | Registrar un mantenimiento **actualiza** el kilometraje y la "última mantención", solo si el km informado es mayor al actual |
| 4 | I02 / J05 / S11 | Un documento que vence hoy está **vigente hoy** y vencido desde mañana; la notificación dice "vence hoy" |
| 5 | J04 / S9 | **Un solo umbral** de "por vencer": 30 días en todas las pantallas |
| 6 | J13 | Documento vencido al agendar: **solo advierte**, como hoy |
| 7 | L08 / S15 | KPIs renombrados: "Costo promedio por servicio" y "Kilometraje actual" |
| 8 | S20 | Se **quita** el filtro "Tipo" (Clase B / Profesional): lo adivinaba por la marca |
| 9 | A04 / R01 / S17 | ~~La secretaria no tiene Flota en el piloto~~ → **cambiada el mismo día:** la secretaria **sí** tiene Flota, limitada a su sede. Va como spec `0051-b` (borrador con 3 preguntas) |

Quedan para cuando se llegue a esos casos: C04, F07, G09, I07, J10, J11, K07, M08, M14, O03, P03, R03, B11.

## Casos A–S — resultado
Pendiente de ejecutar.

## Datos de prueba
- Vehículo `ZZ4103` (id 36, sede A), sembrado el 2026-10-12 para C03 de ASG-i-034: sigue en la BD
  (16/16 vehículos del seed estaban asignados). Sirve como vehículo de prueba de este track.
