# Fix: Testing — Flota, documentos de vehículo y mantenimientos
> id: fix-220-b-testing-flota-mantenimientos
> refs: ASG-i-032
> status: done
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
| S2 | ✅ Corregida (`fix-222-b`, PR #267) | fix-362-m ya **avisa** ("quedó sin guardar el kilometraje del vehículo") cuando la RLS filtra el UPDATE. Pero el KM **sigue sin actualizarse** cuando la secretaria finaliza una clase con un vehículo "Ambas": `update_vehicles` le exige `branch_id = su sede AND both_branches = false` | fix propio |
| S3 | ✅ Corregida (`fix-222-b` + `hotfix-075-b`) | fix-375-m agregó una **advertencia** en Iniciar clase si el km es menor al registrado; no bloquea, y Finalizar sobrescribe `current_km`. Editar Vehículo tampoco impide bajarlo | decisión F05/N05 |
| S4 | ✅ Corregida (`hotfix-073-b`, PR #262) | `admin-flota.component.ts:76` solo hace `console.log('Buscando:', term)`; `filteredVehicles` no filtra por texto | fix propio |
| S5 | ✅ Corregida (`fix-224-b`, PR #274) | `v_class_b_schedule_availability` une `vehicles` sin mirar `status`; `loadVehiclesByBranch` (Iniciar clase) tampoco | decisión F08 |
| S6 | ✅ Corregida (`fix-222-b`, PR #267) | `maintenance_records` solo tiene el trigger de auditoría: registrar un mantenimiento no toca `current_km` ni `last_maintenance` | decisión M03 |
| S7 | ✅ Resuelta | `vehicles`, `vehicle_documents` y `vehicle_assignments` ya están en la publicación `supabase_realtime` | — (se comprueba en Q01) |
| S8 | ✅ Corregida (`hotfix-074-b`, PR #263) | `vehicle-documents-drawer:183` solo distingue `expired`; un documento por vencer sale "Vigente" en verde | hotfix |
| S9 | ✅ Corregida (`hotfix-074-b`, PR #263) | Listado, advertencia al agendar y dashboard: 30 días (`alert_config` está vacía, el dashboard cae al 30 por defecto). Página de mantenimientos: 14 (`SOON_DAYS`) | decisión J04 |
| S10 | ✅ Resuelta | `resolveDocStatus` y `flota-detalle` usan `chileToday()` / `diffDaysIso` (spec 0024-m) | — (se comprueba en I08) |
| S11 | ✅ Corregida (`fix-223-b`, PR #273) | App: vencimiento = hoy → "por vencer". Notificación: "venció hoy" | decisión I02 |
| S12 | ✅ Corregida (dashboard ya en main; selector `fix-224-b` PR #274; Agenda `hotfix-077-b` PR #276; alertas y combustible ya incluían "Ambas") | Con una sede elegida, `dashboard.facade` filtra `vehicles` con `.eq('branch_id', …)` (sin "Ambas") y el selector de Iniciar clase también. Falta comprobar alertas del dashboard, combustible y Agenda | fix propio |
| S13 | ✅ Corregida (`fix-221-b`, PR #266) | `flota.facade:339-343`: `Map` por hora en punto (la clase de 11:50 pisa a la de 11:00) y bucle de 8 a 17 (las de 18:20, 19:10 y 20:00 no salen). No filtra canceladas; consulta mantenimientos y no los muestra | fix propio (K07 es decisión) |
| S14 | ✅ Corregida (`hotfix-074-b`, PR #263) | `flota-detalle.facade` solo revisa `vehicleResult.error`; si falla el historial se ve "vacío". El error de la Hoja de Ruta va al mismo `_error` de la página | hotfix |
| S15 | ✅ Corregida (`hotfix-074-b`, PR #263) | `avgMonthly = total ÷ cantidad de servicios`; `kmTraveled = currentKm` | decisión L08 |
| S16 | ✅ Corregida (`fix-223-b`, PR #273) | `notify_vehicle_document_expiry()` arma el texto con `v_doc.type` crudo ("soap del vehículo … venció hoy.") | hotfix (migración) |
| S17 | ✅ Corregida (spec `0051-b`, PR #265) | `getActionResults` no filtra por rol: a la secretaria le ofrece "Flota Vehicular" → `/app/secretaria/flota`, que no existe | hotfix |
| S18 | ✅ Corregida (`hotfix-075-b`, PR #264) | El `effect` del formulario hace `patchValue` cada vez que cambia `flotaFacade.vehicles()` (refresco, cambio de sede): pisa lo escrito | hotfix |
| S19 | ✅ Corregida (`hotfix-075-b`, PR #264) | Patente: placeholder "ABC-123" pero la regla `/^[A-Z]{2}[A-Z0-9]{2,}[0-9]{2}$/` rechaza guion y minúsculas, sin largo máximo. Año: solo `min(1900)`; la columna es SMALLINT | hotfix |
| S20 | ✅ Corregida (`hotfix-073-b`, PR #262) | `flota.facade:366`: "Profesional" si marca/modelo contiene atego/actros/accelo/camion/bus/volvo/iveco | decisión (¿hace falta el filtro?) |

**Resumen (2026-10-15):** las 20 sospechas quedan resueltas o corregidas.

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

## Casos A–S — resultado (2026-10-16)

Automatizados en `e2e/flota-{checklist,listado,documentos,formulario,agenda,secretaria}.spec.ts`
(**39/39 en verde** contra `main` del 2026-10-16, incluye las 4 sesiones del setup). Lo que escribe
toca solo ZZ4103 y se deshace; altas, mantenimientos y documentos se interceptan antes del servidor.
SQL: `supabase/tests/flota/fix-222-b-*.sql`, `fix-223-b-*.sql`, `fix-224-b-*.sql`,
`supabase/tests/rls/0051-b-flota-secretaria.sql` (todos en verde en producción).

| Sección | ✅ | ❌ → track | Sin ejecutar / queda como decisión |
|---|---|---|---|
| A. Carga y acceso | A01, A03, A07, A10 (e2e); A02/A04/A05 reemplazados por spec 0051-b (la secretaria **sí** tiene Flota: AC1/AC7) | — | A06, A08, A09 (manuales) |
| B. Filas | B01, B02, B03, B04, B06, B09, B12, B13 (e2e) | — | B05, B07, B08, B10 (sin datos legacy en la BD); **B11** decisión |
| C. KPIs | C01, C02, C03 (e2e); C06 ya resuelto (S1) | — | C05 manual; **C04** decisión |
| D. Filtros | D01–D03 (S4), D06, D09 (e2e); D04/D05/D07 sin objeto (filtro Tipo quitado, decisión 8) | — | D08, D10, D11 manuales |
| E. Alta | E01, E03, E04, E05, E07, E08, E10, E17 (e2e) | **E06** → `hotfix-078-b` (PR #278) | E02, E11–E16, E18, E19 (crean datos reales) |
| F. Edición | F01, F03, F05 (S3), F06 (S18), F08/F09 (S5) | **F10** → `hotfix-078-b` | F02, F04, F11 manuales; **F07** decisión |
| G. Sede y "Ambas" | G02, G03, G04, G08 (e2e); G12 ya resuelto (S12) | — | G01, G05–G07, G10, G11; **G09** decisión |
| H. Documentos | H01, H03, H04 (S8), H08, H09 (e2e) | — | H02, H05–H07, H10–H19 (suben archivos reales) |
| I. Estado por fecha | I01–I06, I10 (e2e, fechas en la respuesta); I08/I09/I12 resueltos (S10, S9) | — | I11; **I07** decisión |
| J. Cruces | J02 (S12), J04/J05 (S9/S11), J06, J07, J09, J10 (SQL `fix-223-b`, 9/9) | — | J01, J03, J12–J16 manuales; **J08** (correr 2 veces duplica) y **J11** decisiones |
| K. Agenda del vehículo | K01–K06, K09, K10 (`flota-agenda.spec.ts`, fix-221-b); K08 resuelto (S10) | — | **K07** decisión |
| L. Mantenimientos | L01, L03, L08 (S15), L11 (e2e) | **L12/L15** → `hotfix-079-b` (PR #279) | L02, L04–L07, L09, L10, L13 (S14 ya corregido), L14, L16 |
| M. Registrar servicio | M01, M02 (interceptado), M04, M15 (e2e); M03 (SQL `fix-222-b`) | — | M05–M07, M09–M13, M16, M17; **M08** y **M14** decisiones |
| N. Kilometraje | N01–N05, N07 (SQL `fix-222-b`, 14/14); N08, N09 (fix-224-b) | — | N06, N10, N11 manuales |
| O. Combustible | — | — | O01–O05 manuales (crean egresos); **O03** decisión |
| P. Hoja de Ruta | P01 (e2e: genera y previsualiza) | — | P02, P04–P08 manuales; **P03** decisión |
| Q. Tiempo real | Q01/Q02: tablas en `supabase_realtime` (S7) | — | Q01–Q04 en navegador (2 sesiones) |
| R. Seguridad | R01, R02, R04 (`0051-b-flota-secretaria.sql`, 66/66) | — | R05; **R03** decisión |
| S. Visual | S02 (e2e, 375 px sin scroll horizontal) | — | S01, S03–S06 (revisión visual) |

### Decisiones del owner sobre los casos (2026-10-16, "ok todas")

| Caso | Decisión | Track |
|---|---|---|
| B11 | Listado ordenado por patente | `hotfix-080-b` (#281) |
| C04 | KPI "De Baja" | `hotfix-080-b` (#281) |
| F07 | Sin "Eliminar": la baja es "Fuera de servicio" | — (queda así) |
| G09 | Quitar "Ambas" con instructor asignado pide confirmación | `hotfix-083-b` (#284) |
| I07 | Manda la fecha, no el estado guardado | `hotfix-081-b` (#282) |
| J08 | El aviso diario no se duplica | `fix-225-b` (#286, migración) |
| J11 | El instructor recibe el aviso aunque su portal esté bloqueado | — (queda así) |
| K07 | La agenda del vehículo solo muestra hoy | — (queda así por ahora) |
| M08 | Un servicio realizado no puede tener fecha futura | `hotfix-082-b` (#283) |
| M14 | Sin eliminar mantenimientos (se corrige editando) | — (queda así) |
| O03 | Combustible de un "Ambas" en la caja de quien registra | `hotfix-084-b` (#285) |
| P03 | Hoja de Ruta con el nombre de la sede del vehículo | `hotfix-085-b` (#287, deploy) |
| R03 | La secretaria puede leer por API los vehículos de la otra sede | — (queda así: no son datos sensibles) |

## Datos de prueba
- Vehículo `ZZ4103` (id 36, sede A), sembrado el 2026-10-12 para C03 de ASG-i-034: sigue en la BD
  (16/16 vehículos del seed estaban asignados). Sirve como vehículo de prueba de este track.

## Casos manuales (2026-10-16)

Ejecutados por el agente a pedido del owner. `e2e/flota-real.spec.ts` (solo con
`E2E_FLOTA_REAL=1`) **escribe de verdad** sobre el vehículo de prueba **ZZ4199 (id 87)** y no
borra nada; el resto (`flota-checklist.spec.ts`) corta las respuestas y no escribe. Suite de Flota
sin escrituras: **47/47 en verde** contra `main` del 2026-10-16.

| Casos | Resultado |
|---|---|
| E02, E14, G01, Q01 | ✅ Alta real "Ambas" con SOAP (PDF) + Revisión Técnica (sin archivo); una segunda sesión la ve sin recargar |
| E18 | Anotado: al crear con 2 documentos salen los toasts de "Vehículo creado" y uno por documento |
| H05, H06, H07, H12, H16, Q02 | ✅ Documento real: vencido → triángulo en el listado y en otra sesión sin recargar; cambiar solo la fecha conserva el archivo; reemplazarlo deja el nuevo; "Ver documento" abre el visor |
| H18 | Anotado: el toast dice "La fecha de vencimiento se guardó correctamente" aunque también se suba archivo (queda así) |
| H14, H15, H17 | ✅ (respuesta cortada) cambiar de fila cierra la anterior; Cancelar no guarda; un error queda en la fila sin toast de éxito |
| M02, M03, M11, M17, L04, L06 | ✅ Servicio real de $1.500.000 a 1.200 km sin descripción ni taller; el km del vehículo sube a 1.200 y queda la última mantención (trigger fix-222-b); editar agrega el taller |
| **M10 / L08 / L09** | ❌ → `hotfix-086-b` (#289): "$1,500,000 invertidos", KPIs "$1500000" y "1200 km", "1 servicios", fechas AAAA-MM-DD |
| **M01 / M06** | ❌ → `hotfix-088-b` (#291): el km del formulario se veía "1,200" |
| F02, F04, G10, G05 | ✅ Editar modelo no toca el estado; quitar "Ambas" y pasar a la sede B lo saca de la sede A |
| P02, P04, P06 | ✅ Hoja de Ruta de un vehículo sin instructor: patente, modelo, bloques 08:30–20:45, sin "undefined"/"null" |
| O01, O02 | ✅ (interceptado, no llega a la caja) la opción dice "Marca Modelo - PATENTE (…)"; con la sede B elegida el egreso de un vehículo "Ambas" va a la sede B (hotfix-084-b) |
| S01, S03, S05 | ✅ Modo oscuro legible (capturas); con un drawer abierto el listado pasa a tarjetas; el botón Documentos se alcanza con Tab |
| **A08** | ❌ → `hotfix-087-b` (#290): un error de carga se veía como "No se encontraron vehículos" |
| D10 | ✅ tras `hotfix-087-b` (tarjetas sin resultados con "Limpiar filtros") |
| A06, A09 | ✅ volver a Flota muestra los datos al instante; "Actualizar" vuelve a pedirlos |
| L13, L14, P07 | ✅ falla del historial → error (no "Historial vacío"); Reintentar recarga; falla de la Hoja de Ruta → aviso en el drawer sin ensuciar la página |
| E13, M16 | ✅ doble clic en guardar envía una sola vez |
| R05 | ✅ por código: la URL firmada dura 3.600 s (`flota.facade.ts` `createSignedUrl(path, 3600)`) |
| S04 | ✅ el triángulo tiene `aria-label` con el texto de la advertencia (casos I) |

**No ejecutados (bajo riesgo o de otra asignación):** J12–J16 (advertencia al agendar: ASG 026),
N06/N10/N11 (Asistencia B: ASG 027), E11, E12, E15, E16, E19, F11, G06, G07, G11, H02, H10, H13,
H19, I11, J01, J03, L02, L05, L07, L10, L16, M05–M07, M09, M12, M13, O03–O05, P05, P08, Q03, Q04,
S06.

### Limpieza de datos de prueba (para el owner)

```sql
-- Vehículo de prueba ZZ4199 (id 87) creado por e2e/flota-real.spec.ts el 2026-10-16.
-- Los archivos reemplazados en H07 quedaron huérfanos en Storage: se borran por carpeta.
DELETE FROM storage.objects WHERE bucket_id = 'documents' AND name LIKE 'vehicle-docs/87/%';
DELETE FROM public.maintenance_records WHERE vehicle_id = 87;
DELETE FROM public.vehicle_documents WHERE vehicle_id = 87;
DELETE FROM public.notifications WHERE reference_type = 'document_expiry' AND reference_id = 87;
DELETE FROM public.vehicles WHERE id = 87;
```
