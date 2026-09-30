# Testing — Flota, documentos de vehículo y mantenimientos

> **Asignación:** `ASG-i-032` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/app/admin/flota`, `/app/admin/flota/:id/mantenimientos`
> **Incluye:** listado de flota (tabla y tarjetas), KPIs, búsqueda y filtros, alta y edición de
> vehículo (patente, estado, sede, "Ambas", documentos al crear), drawer de Documentación
> (SOAP, Revisión Técnica, Permiso de Circulación, Seguro), estados vigente / por vencer /
> vencido, alerta en el listado, drawer "Agenda del vehículo", página de mantenimientos
> (historial, KPIs, registrar/editar servicio), Hoja de Ruta (PDF imprimible), columna
> "Combustible (Mes)". **Cruces:** alertas del dashboard, notificación diaria de vencimiento,
> advertencia al agendar (ver `026`), kilometraje al iniciar/finalizar clase desde Asistencia B
> (ver `027`), egreso de combustible desde Cuadratura (ver `029`).
> **No incluye:** el wizard de agendamiento por dentro (`026-agenda-triple-match.md`), la
> asignación de vehículo a instructor en Editar Instructor (`034`), la Cuadratura por dentro (`029`).
>
> **Nota sobre `fix-033-m`:** la asignación lo lista como "ficha técnica / imprimir informe" de
> flota, pero ese fix es de la **Ficha Técnica del alumno** (`/app/admin/alumnos/:id`), no de
> Flota. El "informe imprimible" de Flota es la **Hoja de Ruta** (spec `0011-m`, edge function
> `generate-route-sheet-pdf`) y se cubre en la sección P. La ficha técnica del alumno va en `024b`.
>
> **Código leído para armar esta lista:**
> `features/admin/flota/admin-flota.component.ts`,
> `features/admin/flota/{vehicle-form-drawer,vehicle-documents-drawer,vehicle-agenda-drawer,vehicle-maintenances,maintenance-form-drawer,route-sheet-drawer}/`,
> `shared/components/{flota-list-content,vehiculo-card,branch-scope-selector}/`,
> `core/facades/{flota,flota-detalle,dashboard-alerts,dashboard,agenda,asistencia-clase-b}.facade.ts`,
> `core/utils/{vehicle-document-status,vehicle-doc-types,vehicle-status,document-file-validation,search-intents}.ts`,
> `features/admin/asistencia/{admin-iniciar-clase-drawer,admin-finalizar-clase-drawer}.component.ts`,
> `features/admin/contabilidad-cuadratura/registrar-egreso-drawer.component.ts`,
> `supabase/functions/generate-route-sheet-pdf/`,
> migraciones `20260301000007` (tablas), `20260301000011` (RLS base), `20260310130000` y
> `20260413000001` (Storage), `20260710010000` (notificación de vencimiento),
> `20260730100000` (Ambas + RLS secretaria), `20260811120000` (UNIQUE documentos),
> `20260814172847` (KM instructor), `20260917110000` (vista de disponibilidad),
> `20260927120000` (dashboard ejecutivo).

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-032`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S20)** salen de leer el código, **no están confirmadas** en navegador.
  Confirmarlas o descartarlas es parte del trabajo.
- **Hora del día importa.** Varias sospechas dependen de ejecutar el caso **después de las 21:00
  hora de Chile** (en horario de verano, UTC-3; en invierno, después de las 20:00). Los casos que
  lo requieren lo dicen explícitamente.

---

## 1. Sospechas de bug encontradas en el código

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🟠 Media-Alta | **Guardar un vehículo en Flota le cambia el estado a un valor que el dashboard ejecutivo no cuenta.** El formulario solo conoce `available`/`maintenance`/`out_of_service`, y al editar precarga el estado ya "traducido" (`operational`/`in_use` → `available`, `blocked` → `out_of_service`). El dashboard ejecutivo cuenta como disponibles solo `operational`/`in_use` (DG-003): todo vehículo creado o editado desde Flota desaparece del KPI "Vehículos disponibles". | `vehicle-form-drawer.component.ts:364-368,379,453`; `flota.facade.ts:223`; `vehicle-status.utils.ts:3-14`; `20260927120000_executive_dashboard_rpcs.sql:460` |
| S2 | 🟠 Media-Alta | **El KM no se actualiza cuando la secretaria finaliza una clase con un vehículo "Ambas" o de otra sede, y nadie se entera.** La RLS `update_vehicles` para secretaria exige `branch_id = su sede AND both_branches = false`; un UPDATE bloqueado por RLS devuelve 0 filas **sin error**, y además el facade ni siquiera revisa el `error` de ese update. Toast "Clase finalizada" igual. | `asistencia-clase-b.facade.ts:449-455`; `20260814172847_fix189…sql:56-60,70-74` |
| S3 | 🟠 Media | **El KM del vehículo puede retroceder.** "Iniciar clase" acepta cualquier km ≥ 0 (no exige ≥ `current_km`); "Finalizar" solo exige km final > km inicial, y luego sobrescribe `vehicles.current_km` con ese valor. Un km inicial mal tipeado (p. ej. 4500 en vez de 45000) deja el odómetro del vehículo 40.000 km atrás. El formulario de Editar Vehículo tampoco impide bajar el KM. | `admin-iniciar-clase-drawer.component.ts:234`; `admin-finalizar-clase-drawer.component.ts:226-229`; `asistencia-clase-b.facade.ts:452`; `vehicle-form-drawer.component.ts:378` |
| S4 | 🟠 Media | **La búsqueda del listado no hace nada.** El input emite el texto, pero la página solo hace `console.log('Buscando:', term)`; `filteredVehicles` no filtra por texto. | `admin-flota.component.ts:73-77`; `flota.facade.ts:64-71` |
| S5 | 🟠 Media | **Un vehículo en "Mantenimiento" o "Fuera de Servicio" sigue ofreciendo horarios para agendar.** La vista de disponibilidad une `vehicles` sin mirar `status`. Tampoco se filtra por estado en el selector de vehículo de "Iniciar clase" ni en el de egreso de combustible. | `20260917110000_hotfix003…sql:49-51`; `asistencia-clase-b.facade.ts:350-355`; `registrar-egreso-drawer.component.ts:398-405` |
| S6 | 🟠 Media | **Registrar un mantenimiento no actualiza el KM ni la "última mantención" del vehículo.** El insert solo escribe en `maintenance_records`; no hay trigger. El UAT (Paquete 5) marcó "KM actualizado" como verificado, pero solo comprobó historial y total. | `flota-detalle.facade.ts:247-253`; no existe trigger sobre `maintenance_records` en `supabase/migrations/` |
| S7 | 🟡 Baja-Media | **Tiempo real muerto.** El canal escucha `vehicles`, `vehicle_documents` y `vehicle_assignments`; ninguna de las tres está en la publicación `supabase_realtime` (mismo patrón de `fix-227-m` / `20260907120000`). | `flota.facade.ts:75-95`; `grep supabase_realtime supabase/migrations` |
| S8 | 🟡 Baja-Media | **El drawer de Documentos muestra "Vigente" (verde) para un documento por vencer**, mientras el listado muestra el triángulo ámbar. Solo distingue `expired` vs todo lo demás. | `vehicle-documents-drawer.component.ts:180-183` |
| S9 | 🟡 Baja-Media | **Cuatro umbrales distintos de "por vencer".** Listado y advertencia al agendar: 30 días fijos. Dashboard: `alert_config.advance_days`. Página de mantenimientos: 14 días. Notificación: solo el día exacto `advance_days`. Si `advance_days ≠ 30`, el mismo documento se ve distinto en cada pantalla. | `vehicle-document-status.utils.ts:4`; `dashboard-alerts.facade.ts:210-211`; `flota-detalle.facade.ts:55,294-302`; `20260710010000…sql:27-31` |
| S10 | 🟡 Baja-Media | **Fechas calculadas en UTC.** `resolveDocStatus` hace `new Date('AAAA-MM-DD')` (medianoche UTC = 21:00 del día anterior en Chile): después de las 21:00 un documento que vence hoy pasa a "vencido" y el borde de 30 días se corre un día. Lo mismo en el "hoy" del dashboard, en la fecha por defecto del mantenimiento (después de las 21:00 propone mañana) y en la agenda del vehículo. | `vehicle-document-status.utils.ts:9`; `dashboard-alerts.facade.ts:213-214,235-236`; `maintenance-form-drawer.component.ts:242,268`; `flota.facade.ts:319` |
| S11 | 🟡 Baja-Media | **"Vence hoy" significa cosas distintas.** Para la app, un documento con vencimiento = hoy está "por vencer" (y el dashboard lo cuenta como "por vencer"); la notificación diaria dice "venció hoy". | `vehicle-document-status.utils.ts:10`; `dashboard-alerts.facade.ts:219,240`; `20260710010000…sql:28,37` |
| S12 | 🟡 Baja-Media | **"Ambas sedes" se ignora en varios lados.** Con una sede elegida, un vehículo "Ambas" cuya sede principal es la otra: no cuenta en el KPI de flota del dashboard, sus documentos no cuentan en las alertas del dashboard, no aparece en el selector de "Iniciar clase", su combustible sale $0 en la columna del listado y la Agenda no le resuelve la patente. | `dashboard.facade.ts:174`; `dashboard-alerts.facade.ts:220,242`; `asistencia-clase-b.facade.ts:354`; `flota.facade.ts:190`; `agenda.facade.ts:425` |
| S13 | 🟡 Baja | **Agenda del vehículo incompleta.** Agrupa por hora en punto de 08 a 17: las clases de 11:50 y 15:50 pisan a las de 11:00 y 15:00, y las de 18:20, 19:10 y 20:00 no aparecen. No filtra canceladas (se muestran como clase). Consulta los mantenimientos del día pero nunca los muestra. Solo muestra "hoy". | `flota.facade.ts:320-357`; `vehicle-agenda-drawer.component.ts:189-198` |
| S14 | 🟡 Baja | **Página de mantenimientos: errores confundidos.** Si falla la consulta del historial, se ve "Historial vacío" (el `error` no se revisa). Si falla la Hoja de Ruta, aparece el banner "Hubo un problema al cargar los datos del vehículo" en la página. | `flota-detalle.facade.ts:125-134,179`; `flota-detalle.facade.ts:227` + `vehicle-maintenances.component.ts:312-322` |
| S15 | 🟡 Baja | **KPIs de mantenimiento mal calculados/rotulados.** "Costo p/Mes" = inversión total ÷ cantidad de servicios (es costo por servicio, no por mes). "KM Recorridos" = odómetro actual. Las "mantenciones programadas" son en realidad los vencimientos de documentos. | `flota-detalle.facade.ts:84-94,194-200`; `vehicle-maintenances.component.ts:397-411` |
| S16 | 🟡 Baja | **Notificación de vencimiento con el tipo en inglés crudo:** "soap del vehículo BBCD12 venció hoy." / "technical_inspection del vehículo…". | `20260710010000…sql:37,40` |
| S17 | 🟡 Baja | **Secretaria: la búsqueda global la manda a una ruta que no existe.** Buscar "soap", "patente" o "flota" ofrece "Flota Vehicular" → `/app/secretaria/flota` → no encontrado. | `search-intents.ts:161-182,252-259`; `app.routes.ts:233-250` (solo bajo admin) |
| S18 | 🟡 Baja | **Editar vehículo puede perder lo que escribiste.** El formulario se re-precarga cada vez que cambia la lista del facade (refresco, cambio de sede en el topbar), pisando lo tipeado. | `vehicle-form-drawer.component.ts:440-457`; `admin-flota.component.ts:67-70` |
| S19 | 🟡 Baja | **Validaciones del formulario de vehículo.** El placeholder de patente es "ABC-123" pero la regla rechaza guion y minúsculas (no convierte a mayúscula) y no limita largo; acepta "ABC123" (formato inexistente). Año sin máximo (la columna es SMALLINT: > 32767 revienta en BD). | `vehicle-form-drawer.component.ts:119,132,373,377`; `20260301000007…sql:15` |
| S20 | 🟡 Baja | **Filtro "Tipo" adivinado por marca/modelo:** "Profesional" = contiene atego/actros/accelo/camion/bus/volvo/iveco. Un Volvo XC40 cae como Profesional; un camión de otra marca como Clase B. | `flota.facade.ts:364-371` |

---

## 2. Datos de prueba necesarios

Preparar antes de ejecutar. Las fechas se expresan relativas a **hoy (H)**; anotar la fecha real
usada. Anotar también patente e id de cada vehículo.

| Dato | Cómo debe estar | Para qué | Vehículo / fecha usada |
|---|---|---|---|
| D1 | Vehículo sede A, `operational`, 4 documentos vigentes (> 60 días), instructor asignado, con clases hoy | Caso "todo OK" | |
| D2 | Vehículo sede A con SOAP vencido (H−10) | Alerta roja | |
| D3 | Vehículo sede A con Revisión Técnica por vencer (H+10) | Alerta ámbar, S8 | |
| D4 | Vehículo sede B, sin documentos cargados, sin instructor | "Sin cargar", "Sin asignar" | |
| D5 | Vehículo "Ambas" con sede principal A, con instructor, con 1 documento vencido | S12, Ambas | |
| D6 | Vehículo en `maintenance` y otro en `out_of_service` | KPIs, filtros, S5 | |
| D7 | Vehículo con `status` `in_use` y otro `blocked` (datos legacy, por SQL) | S1 | |
| D8 | Vehículo con 3+ mantenimientos con costo, km y taller, y 1 sin costo | Historial y KPIs | |
| D9 | Vehículo sin ningún mantenimiento | Historial vacío | |
| D10 | Documentos con vencimiento exacto H, H−1, H+1, H+30, H+31 (pueden ser 5 vehículos o combinar tipos) | Bordes de `resolveDocStatus` | |
| D11 | Documento con `status = 'expired'` en BD pero fecha futura (por SQL) | Rama `rawStatus` | |
| D12 | Vehículo tipo camión (marca/modelo con "Iveco" o "Actros") y un "Volvo XC40" | S20 | |
| D13 | Vehículo con `branch_id = NULL` (legacy) | Columna Sede, AC-E2 de 0004-m | |
| D14 | Clase B de hoy en estado "agendada" con el vehículo D1, y otra con D5 | Iniciar/finalizar desde Asistencia B | |
| D15 | Egresos de combustible del mes asociados a D1 y a D5 | Columna "Combustible (Mes)" | |
| D16 | Archivos: PDF de 1 MB, JPG, PNG, WEBP, PDF de 6 MB, un `.docx`, un `.png` renombrado de `.exe` | Validación de adjuntos | |
| D17 | > 10 vehículos | Paginación | |

**Cuentas:** admin; secretaria sede A; secretaria sede B; secretaria con grant multi-sede
(`can_access_both_branches = true`). **Acceso a SQL** (Supabase Studio) para sembrar D7, D10, D11,
D13 y para correr `notify_vehicle_document_expiry()` a mano.

---

## 3. Casos

### A. Carga y acceso

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Admin → menú lateral → Flota | Llega a `/app/admin/flota`; skeleton → tabla. Consola sin errores, red sin 4xx/5xx | ✓ | |
| A02 | Secretaria: el menú no muestra Flota | No hay entrada Flota | ✓ | |
| A03 | Secretaria escribe `/app/admin/flota` y `/app/admin/flota/1/mantenimientos` | Redirige a su inicio; no ve datos | ✓ | |
| A04 | Secretaria escribe `/app/secretaria/flota` | Página "no encontrado" (no hay ruta). Confirmar que es intencional para el piloto (§5) | ✓ | |
| A05 | Secretaria busca "soap" / "patente" en la búsqueda global **(§4)** | No debería ofrecer un resultado que lleva a 404 (S17) | — | |
| A06 | Salir de Flota y volver | Datos al instante, sin skeleton (refresco en segundo plano) | — | |
| A07 | F5 en `/app/admin/flota` y en `/app/admin/flota/<id>/mantenimientos` | Carga normal en ambas | ✓ | |
| A08 | Carga con la red cortada | Hoy el facade guarda "Error al cargar la flota vehicular." pero el listado no lo muestra: se ve "No se encontraron vehículos · Limpiar filtros" — anotar | — | |
| A09 | Botón "Actualizar" | Recarga los datos. Hoy no muestra spinner (el refresco es silencioso) y si falla no avisa — anotar | — | |
| A10 | Búsqueda global como admin: "yaris", "mantención", "revisión técnica" | Ofrece "Flota Vehicular" y lleva a `/app/admin/flota` | — | |

### B. Datos de cada fila (tabla desktop)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | Patente | En mayúsculas, monoespaciada | ✓ | |
| B02 | Vehículo | "Marca Modelo" + año debajo | ✓ | |
| B03 | Instructor con asignación activa (D1) | Inicial + nombre | ✓ | |
| B04 | Sin instructor (D4) | "?" + "Sin asignar" | ✓ | |
| B05 | Instructor cuya asignación terminó (`end_date` con fecha) | "Sin asignar" | — | |
| B06 | KM | Con separador de miles + " km" | ✓ | |
| B07 | Combustible (Mes) de D1 (D15) | Suma de egresos de combustible del mes en curso, formato CLP | ✓ | |
| B08 | Combustible de un egreso del mes anterior | No se suma | — | |
| B09 | Estado de D1, D6 (x2) | Disponible (verde) / Taller (ámbar) / Baja (rojo) | ✓ | |
| B10 | Estado de D7 (`in_use`, `blocked`) | `in_use` → Disponible; `blocked` → Baja | — | |
| B11 | Orden de las filas | Por id ascendente (el más antiguo primero) — confirmar que es lo deseado | — | |
| B12 | > 10 vehículos (D17) | 10 por página, "Mostrando 1 a 10 de N vehículos" | ✓ | |
| B13 | Tooltips de los 4 botones de acción | Agenda / Documentos / Editar / Mantenimientos | ✓ | |

### C. KPIs y hero

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | Chip "N vehículos" y KPI Total | Igual al total de la sede elegida | ✓ | |
| C02 | KPI Disponibles | Cuenta `available`/`operational`/`in_use` | ✓ | |
| C03 | KPI En Taller | Cuenta solo `maintenance` (no `out_of_service`) | ✓ | |
| C04 | Vehículos "Fuera de Servicio" | No aparecen en ningún KPI — ¿debería haber un KPI "De baja"? (§5) | — | |
| C05 | Aplicar filtros | Los KPIs NO cambian (cuentan el total) — confirmar | — | |
| C06 | KPI "Vehículos disponibles" del dashboard ejecutivo vs KPI Disponibles de Flota **(§4)** | Mismo número (S1) | — | |

### D. Búsqueda y filtros

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | Buscar por patente completa **(§4)** | Filtra (S4: hoy probablemente no filtra nada) | ✓ | |
| D02 | Buscar por patente parcial, en minúsculas | Filtra | ✓ | |
| D03 | Buscar por marca y por modelo | Filtra | ✓ | |
| D04 | Tipo = Clase B / Profesional | Solo esos | ✓ | |
| D05 | D12 con filtro Tipo | Camión en "Profesional", Volvo XC40 en "Clase B" (S20) | — | |
| D06 | Estado = Disponible / Mantenimiento / Fuera de Servicio | Solo esos | ✓ | |
| D07 | Tipo + Estado combinados | Intersección correcta | ✓ | |
| D08 | Volver un filtro a "todos" | Los select no tienen botón de limpiar: ¿se puede sin recargar? | — | |
| D09 | Combinación sin resultados → "Limpiar filtros" | Resetea búsqueda, tipo y estado; la tabla vuelve completa | ✓ | |
| D10 | Mismo caso en vista de tarjetas | El estado vacío dice "Sin resultados" y no tiene botón "Limpiar filtros" — anotar | — | |
| D11 | Filtros activos → salir → volver | Los filtros viven en el facade: la tabla sigue filtrada pero ¿los select muestran el filtro? (el valor visual vive en el componente) — anotar incoherencias | — | |

### E. Alta de vehículo

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | "Nuevo Vehículo" | Drawer "Nuevo Vehículo" con año actual, estado Disponible, sin sede | ✓ | |
| E02 | Crear vehículo completo con sede A **(§4)** | Toast "Vehículo creado"; aparece en la lista sin recargar | ✓ | |
| E03 | Patente `AB1234` (formato antiguo) y `BBCL12` (nuevo) | Aceptadas | ✓ | |
| E04 | Patente `bbcl12` (minúsculas) y `BB-CL12` / `ABC-123` (como el placeholder) | Hoy rechazadas con "Formato inválido" (S19) — ¿debería convertir a mayúsculas y quitar guion? | ✓ | |
| E05 | Patente `ABC123` y `ABCDEFGH12` | Hoy aceptadas (S19) — no son patentes chilenas válidas | — | |
| E06 | Patente duplicada (de un vehículo existente) | Error claro "patente ya registrada", sin crear | ✓ | |
| E07 | Marca o modelo vacíos | Botón "Crear Vehículo" deshabilitado | ✓ | |
| E08 | Año 1899 / 1900 / año siguiente / 3000 / 40000 | 1899 bloqueado; 3000 hoy se acepta; 40000 revienta en BD (S19) — anotar mensaje | — | |
| E09 | KM vacío / 0 / negativo / con decimales | 0 permitido (DG-032); negativo bloqueado; anotar qué pasa con vacío y decimales | — | |
| E10 | Sin elegir sede | Botón deshabilitado | ✓ | |
| E11 | Estado inicial "Mantenimiento" | Se crea en Taller | — | |
| E12 | Cancelar a medias y volver a abrir | Formulario limpio | — | |
| E13 | Doble clic en "Crear Vehículo" | Un solo vehículo creado | — | |
| E14 | Adjuntar documentos al crear: elegir SOAP + fecha + archivo → "Agregar"; repetir con Revisión Técnica sin archivo **(§4)** | Ambos quedan listados; al crear, se guardan con su fecha y el archivo del SOAP | ✓ | |
| E15 | Elegir tipo y fecha pero NO pulsar "Agregar" antes de crear | Hoy ese documento se pierde en silencio — anotar | — | |
| E16 | Tipo ya agregado | Desaparece del selector; al quitarlo (tacho) vuelve | — | |
| E17 | Adjuntar archivo inválido (D16: `.docx`, PDF de 6 MB) | "Solo se permiten archivos PDF, JPG, PNG o WEBP." / "…no puede superar los 5 MB." | ✓ | |
| E18 | Crear con 3 documentos | ¿Cuántos toasts aparecen? (uno de vehículo + uno "Documento actualizado" por documento) | — | |
| E19 | Falla la subida de un documento al crear | El vehículo queda creado, toast "No se pudo subir un documento… puedes reintentarlo desde Documentos del vehículo" | — | |

### F. Edición, estado y baja

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | Editar (lápiz) | Drawer "Editar Vehículo" precargado con los datos correctos; sin sección Documentos | ✓ | |
| F02 | Cambiar marca/modelo/año y guardar | Toast "Vehículo actualizado"; la fila se actualiza | ✓ | |
| F03 | Cambiar estado a Mantenimiento → Fuera de Servicio → Disponible | KPIs y badge cambian cada vez | ✓ | |
| F04 | Editar D7 (`operational`/`in_use`/`blocked`) sin tocar el estado y guardar **(§4)** | El estado en BD no debería cambiar (S1) | — | |
| F05 | Bajar el KM (de 50.000 a 40.000) | Hoy se permite (S3) — ¿debería bloquearse o pedir confirmación? (§5) | — | |
| F06 | Escribir en el formulario y, sin guardar, cambiar la sede del topbar **(§4)** | No debería perderse lo escrito (S18) | — | |
| F07 | Dar de baja un vehículo | No existe "Eliminar": la baja es estado "Fuera de Servicio". Confirmar que es lo deseado (§5) | — | |
| F08 | Vehículo en "Fuera de Servicio" o "Mantenimiento" y la Agenda **(§4)** | No debería ofrecer horarios con ese vehículo (S5) | — | |
| F09 | Vehículo "Fuera de Servicio" en Iniciar clase (Asistencia B) y en egreso de combustible | Hoy aparece en ambos selectores (S5) | — | |
| F10 | Editar la patente a una ya existente | Error claro, sin guardar | — | |
| F11 | Editar un vehículo con patente legacy que no cumple el formato (sembrar `ab-123`) | El botón queda deshabilitado hasta corregir la patente — anotar si es aceptable | — | |

### G. Sede y "Ambas"

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | Admin crea vehículo "Ambas" (principal A) | `both_branches = true`, `branch_id = A` | ✓ | |
| G02 | Admin con sede A elegida | Ve vehículos de A + los "Ambas" de B | ✓ | |
| G03 | Admin con sede B elegida | Ve vehículos de B + D5 ("Ambas", principal A) | ✓ | |
| G04 | Admin con "Todas" | Columna "Sede" con nombre de sede o "Ambas"; D13 muestra "—" | ✓ | |
| G05 | Total de "Todas" vs A + B | Todas = A + B − (Ambas contados dos veces) | — | |
| G06 | Admin cambia de sede **(§4)** | Recarga sola; columna Sede solo en "Todas" | ✓ | |
| G07 | Cambio rápido A→B→A con red lenta | Termina en A sin mezclar | — | |
| G08 | Editar vehículo con instructor asignado (fix-119-m) | Selector de sede deshabilitado con "Este vehículo está asignado a …" | ✓ | |
| G09 | Mismo vehículo: ¿se puede apagar "Ambas"? | Hoy el toggle sigue activo para admin. Si el instructor opera en la otra sede, se le caen los horarios ahí — **decisión** (§5) | — | |
| G10 | Vehículo sin instructor: cambiar sede A → B | Se guarda; desaparece de A y aparece en B | ✓ | |
| G11 | Editar D13 (sin sede) | Obliga a elegir sede antes de guardar (AC-E2 de 0004-m: no se convierte en "Ambas" solo) | — | |
| G12 | Combustible de D5 viendo la sede B (S12) | Hoy $0 aunque tenga egresos (se registran en su sede principal) | — | |

### H. Documentos del vehículo (drawer)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | Abrir Documentos de D1 | 4 filas: SOAP, Revisión Técnica, Permiso de Circulación, Seguro, con fecha "Vence: dd MMM yyyy" | ✓ | |
| H02 | ¿Se sabe de qué vehículo es el drawer? | El drawer no muestra patente ni modelo — anotar (UX) | — | |
| H03 | Abrir Documentos de D4 | 4 filas "Sin cargar" (ámbar) | ✓ | |
| H04 | Badges de D2 y D3 | D2 "Vencido" rojo; D3 hoy "Vigente" verde (S8), debería decir "Por vencer" | ✓ | |
| H05 | Cargar SOAP con fecha y PDF **(§4)** | Toast; la fila muestra la fecha y el botón "Ver documento" | ✓ | |
| H06 | Solo cambiar la fecha, sin adjuntar | Conserva el archivo anterior | ✓ | |
| H07 | Reemplazar el archivo | Queda el nuevo; el anterior queda huérfano en Storage (anotar si importa) | — | |
| H08 | Guardar sin fecha | "La fecha de vencimiento es obligatoria." | ✓ | |
| H09 | Archivo inválido (D16) | Mensaje de error; no se guarda | ✓ | |
| H10 | Elegir un archivo inválido, luego el mismo archivo válido corregido con el mismo nombre | El input no se limpia tras el error: ¿vuelve a disparar? | — | |
| H11 | `.png` renombrado de `.exe` | Rechazado por tipo o por Storage (bucket solo acepta pdf/jpg/png/webp) | — | |
| H12 | "Ver documento" (PDF e imagen) | Abre el visor con el archivo correcto | ✓ | |
| H13 | "Ver documento" de un archivo borrado de Storage | Toast "No se pudo abrir el documento" | — | |
| H14 | Editar una fila, luego pulsar lápiz de otra sin guardar | Se abre la otra; la primera se descarta sin guardar | — | |
| H15 | Cancelar la edición | Se cierra sin cambios | — | |
| H16 | Tras guardar, la alerta del listado | Se actualiza sin recargar (D2 renovado → triángulo desaparece) | ✓ | |
| H17 | Falla al guardar (red cortada) | Mensaje de error dentro de la fila; sin toast de éxito | — | |
| H18 | Toast al subir archivo | Dice "La fecha de vencimiento se guardó correctamente" aunque también se subió archivo — anotar | — | |
| H19 | Fecha de vencimiento en el pasado lejano (2010) y futuro lejano (2099) | Se aceptan; estados Vencido / Vigente | — | |

### I. Estado de un documento según la fecha (`resolveDocStatus`)

Ejecutar **antes de las 21:00** hora de Chile salvo que el caso diga otra cosa. H = hoy.

| ID | Vencimiento | Resultado esperado (listado, advertencia al agendar) | Auto | Res. |
|---|---|---|---|---|
| I01 | H−1 | Vencido (triángulo rojo) | ✓ | |
| I02 | H (vence hoy) | Por vencer (ámbar) — ver S11 y §5 | ✓ | |
| I03 | H+1 | Por vencer | ✓ | |
| I04 | H+30 | Por vencer (borde incluido) | ✓ | |
| I05 | H+31 | Vigente (sin triángulo) | ✓ | |
| I06 | Sin fecha (fila sin cargar) | Sin triángulo | ✓ | |
| I07 | D11: `status='expired'` en BD con fecha H+200 | Vencido (el estado guardado manda) — confirmar si es lo deseado | — | |
| I08 | Vencimiento H, **después de las 21:00** **(§4)** | Debería seguir "por vencer" hasta medianoche (S10) | — | |
| I09 | Vencimiento H+31, **después de las 21:00** | Debería seguir "vigente" (S10: probablemente pasa a "por vencer") | — | |
| I10 | Vehículo con SOAP vencido + Seguro por vencer | Triángulo rojo; tooltip "Vehículo XX: SOAP vencido; Seguro por vencer" | ✓ | |
| I11 | Vehículo con 2 vencidos | "SOAP y Revisión Técnica vencidos" (plural) | — | |
| I12 | Página de mantenimientos del vehículo de I04 (H+30) | Tarjeta del documento dice "Vigente" (umbral 14 días) mientras el listado dice "por vencer" (S9) | — | |

### J. Alertas y avisos fuera de Flota (cruces)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | Dashboard admin con D2 y D3 | "N Documento(s) vencido(s)" y "N por vencer" coinciden con los triángulos del listado | ✓ | |
| J02 | Dashboard con sede B y D5 (Ambas, principal A, doc vencido) **(§4)** | Debería contar D5 (S12) | — | |
| J03 | Dashboard secretaria sede A | Solo documentos de vehículos de A (+ Ambas) | ✓ | |
| J04 | Cambiar `alert_config.advance_days` a 15 (SQL) y comparar dashboard vs listado **(§4)** | Mismo documento, mismo estado (S9) | — | |
| J05 | Documento vence hoy: dashboard | Cuenta como "por vencer" (no vencido) — coherente con I02 | — | |
| J06 | Notificación diaria: correr `notify_vehicle_document_expiry()` a mano **(§4)** | Admins activos reciben 1 notificación por documento que vence hoy o en exactamente `advance_days` días | — | |
| J07 | Texto de la notificación | Nombre legible del documento ("SOAP", "Revisión Técnica"), no `soap`/`technical_inspection` (S16) | — | |
| J08 | Correr la función dos veces el mismo día | Hoy genera duplicados (no hay control por corrida) — anotar | — | |
| J09 | Documento vencido hace 10 días | No genera notificación retroactiva (AC-E1 de 0027-b) | — | |
| J10 | ¿La secretaria recibe la notificación? | Hoy no (solo admin + instructor asignado) — **decisión** (§5) | — | |
| J11 | Instructor asignado recibe notificación con el portal Instructor bloqueado en el piloto | Se inserta igual — ¿es aceptable? (§5) | — | |
| J12 | Clic en la notificación | Ícono de documento; anotar a dónde navega (idealmente a Flota) | — | |
| J13 | Agendar clase (matrícula) con un instructor cuyo vehículo es D2 **(§4)** | Badge de advertencia en el slot con "SOAP vencido"; no bloquea (fix-164/165-m) | — | |
| J14 | Mismo caso en reprogramar clase (ficha del alumno) | Misma advertencia | — | |
| J15 | Agenda semanal con clases de D2 | Advertencia visible en el slot | — | |
| J16 | Renovar el SOAP de D2 y volver a agendar | Advertencia desaparece | — | |

### K. Agenda del vehículo (drawer)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | Abrir Agenda de D1 | "Agenda del Día" con la fecha de hoy y slots 08:00–17:00 | ✓ | |
| K02 | Clase a las 08:30 | Aparece en el slot 08:00 con nombre del alumno y "Clase B #n" | — | |
| K03 | Clases a las 11:00 y a las 11:50 del mismo vehículo **(§4)** | Deberían verse ambas (S13: una tapa a la otra) | — | |
| K04 | Clase a las 18:20, 19:10 o 20:00 | Debería verse (S13: no aparece) | — | |
| K05 | Clase cancelada hoy | No debería mostrarse como clase (S13) | — | |
| K06 | Mantenimiento con `scheduled_date` = hoy | Debería mostrarse (S13: se consulta pero no se pinta) | — | |
| K07 | Ver otro día | No hay selector de fecha — ¿hace falta? (§5) | — | |
| K08 | Abrir la agenda después de las 21:00 | Debería mostrar las clases de hoy, no las de mañana (S10) | — | |
| K09 | Vehículo sin clases | Todos los slots "Disponible" (el estado "Sin datos" nunca se ve) | — | |
| K10 | "Cerrar Agenda" | Cierra el drawer | ✓ | |

### L. Página de mantenimientos

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| L01 | Llave inglesa en la fila de D8 | Abre `/app/admin/flota/<id>/mantenimientos`; título = patente; subtítulo "Marca Modelo · año · N km actuales" | ✓ | |
| L02 | Mismo botón en la vista de tarjetas | Lleva a la misma ruta | ✓ | |
| L03 | "← Flota" | Vuelve al listado | ✓ | |
| L04 | Historial de D8 | Orden: del registrado más reciente al más antiguo; fecha, tipo, km, costo, taller, estado | ✓ | |
| L05 | Descripción larga | Truncada con tooltip | — | |
| L06 | Mantenimiento sin costo / sin km / sin taller | "—" en cada columna | — | |
| L07 | D9 (sin mantenimientos) | "Historial vacío" con botón "Registrar Mantenimiento" | ✓ | |
| L08 | Chips y KPIs de D8 **(§4)** | "N servicios", "$X invertidos" = suma de costos; "Costo p/Mes" y "KM Recorridos" según S15 | ✓ | |
| L09 | Tarjetas de documentos (arriba de la tabla) | Una por documento cargado, con fecha cruda AAAA-MM-DD y Vigente/Próximo/Vencido (umbral 14 días, S9) | — | |
| L10 | Vehículo sin documentos | Sin tarjetas; la tabla ocupa el alto (sin colapsar a 0 px) | — | |
| L11 | URL con id inexistente (`/flota/99999/mantenimientos`) **(§4)** | Mensaje de error + "Reintentar"; no debería poder registrar mantenimiento | — | |
| L12 | URL con id no numérico (`/flota/abc/mantenimientos`) | Anotar qué se ve (hoy no carga nada y no muestra error) | — | |
| L13 | Falla solo el historial (bloquear `maintenance_records` en DevTools) | Debería avisar error, no "Historial vacío" (S14) | — | |
| L14 | "Reintentar" tras un error | Recarga | — | |
| L15 | Navegar directo de un vehículo a otro por URL | No se ven datos del vehículo anterior | — | |
| L16 | Desktop | La tabla scrollea por dentro; el documento no (app-like) | ✓ | |

### M. Registrar y editar mantenimiento

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | "Registrar Servicio" | Drawer con km precargado = KM actual, fecha = hoy, costo 0 | ✓ | |
| M02 | Registrar servicio completo **(§4)** | Aparece primero en el historial como "Completado"; chips y KPIs se actualizan | ✓ | |
| M03 | ¿Se actualiza el KM del vehículo con el km del servicio? **(§4)** | Hoy no (S6) — **decisión** (§5) | — | |
| M04 | Sin tipo | Botón deshabilitado | ✓ | |
| M05 | Borrar el costo (campo vacío) | Botón deshabilitado sin mensaje que explique por qué — anotar | — | |
| M06 | Km con decimales ("45000,5") | Anotar: la columna es entera | — | |
| M07 | Km menor al KM actual del vehículo | Hoy se acepta — ¿advertir? | — | |
| M08 | Fecha futura | Se acepta como "Completado" — ¿tiene sentido? (§5) | — | |
| M09 | Fecha por defecto después de las 21:00 | Debería proponer hoy, no mañana (S10) | — | |
| M10 | Costo grande ($1.500.000) | Formato CLP correcto en form, tabla y chips | — | |
| M11 | Editar un servicio (lápiz) | Drawer "Editar Servicio" precargado; guardar actualiza la fila | ✓ | |
| M12 | Editar un servicio cuyo tipo no está en la lista (dato legacy, p. ej. "Servicio general") | El select aparece vacío pero se puede guardar — anotar | — | |
| M13 | Editar un servicio "Programado" (sembrado por SQL) | Queda con fecha de realización pero sigue "Programado" — anotar | — | |
| M14 | Eliminar un servicio | No existe — confirmar (§5) | — | |
| M15 | Falla al guardar | Mensaje de error en el drawer; no se cierra | — | |
| M16 | Doble clic en "Registrar Mantenimiento" | Un solo registro | — | |
| M17 | Descripción vacía | Se guarda (la columna es obligatoria en BD; hoy se manda texto vacío) | — | |

### N. Kilometraje (cruce con Asistencia B)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| N01 | Admin inicia y finaliza una clase con D1 **(§4)** | KM de D1 en Flota = km final | ✓ | |
| N02 | Secretaria sede A finaliza una clase con D1 (sede A) | KM actualizado | ✓ | |
| N03 | Secretaria sede B finaliza una clase con D5 (Ambas, principal A) **(§4)** | Debería actualizarse (S2: probablemente no, y sin aviso) | — | |
| N04 | Secretaria con grant multi-sede finaliza clase de un vehículo de la otra sede | Igual que N03 (S2) | — | |
| N05 | Iniciar clase con km menor al actual del vehículo **(§4)** | Debería bloquear o advertir (S3) | — | |
| N06 | Finalizar con km final ≤ km inicial | "Debe ser mayor al inicial"; botón deshabilitado | ✓ | |
| N07 | Cambiar el vehículo al iniciar la clase | El KM se actualiza en el vehículo nuevo, no en el original | — | |
| N08 | Selector de vehículo al iniciar, sede B | ¿Aparece D5 (Ambas de A)? (S12: no) | — | |
| N09 | Selector con D6 (Mantenimiento / Fuera de Servicio) | ¿Aparecen? (S5: sí) | — | |
| N10 | Precarga del km inicial | Igual al KM actual del vehículo | ✓ | |
| N11 | Página de mantenimientos después de N01 | Subtítulo y KPI "KM Recorridos" muestran el km nuevo | — | |

### O. Combustible por vehículo (cruce con Cuadratura)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| O01 | Registrar egreso "Combustible" $20.000 con D1 desde Caja Diaria **(§4)** | Columna "Combustible (Mes)" de D1 sube $20.000 | ✓ | |
| O02 | Selector de vehículo del egreso | "Marca Modelo - PATENTE (Asignado a: …)" | — | |
| O03 | Egreso de combustible con D5 (Ambas) registrado por secretaria de sede B | ¿En qué caja queda? Hoy toma la sede principal (A) — **decisión** (§5) | — | |
| O04 | Egreso de "Gastos varios" | No suma en la columna de ningún vehículo | — | |
| O05 | Egreso de combustible de otro mes | No suma | — | |

### P. Hoja de Ruta (informe imprimible)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| P01 | "Hoja de Ruta" en la página de mantenimientos | Drawer con spinner → PDF en vista previa | ✓ | |
| P02 | Contenido | Patente, vehículo, instructor asignado, sede (o "Ambas"), 13 bloques de 45 min 08:30–20:45, espacios para km y firma | — | |
| P03 | Encabezado del PDF de un vehículo de la otra sociedad/sede | Hoy dice siempre "AUTOESCUELA CHILLÁN" (`generate-route-sheet-pdf/index.ts:192`) — ¿correcto para ambas sedes? (§5) | — | |
| P04 | Tildes y ñ ("Muñoz", "Chillán") | Se ven bien | — | |
| P05 | "Imprimir" | Abre el diálogo de impresión solo con la hoja (sin la app) | — | |
| P06 | Vehículo sin instructor | Campo instructor en blanco, sin "undefined" | — | |
| P07 | Falla la función (red cortada) | "No se pudo generar la Hoja de Ruta…" en el drawer; la página **no** debería mostrar el banner de error de carga (S14) | — | |
| P08 | Cerrar y reabrir el drawer | Se regenera sin errores ni fugas | — | |

### Q. Tiempo real y 2 sesiones

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| Q01 | 2 sesiones admin: crear vehículo en A **(§4)** | Aparece en B sin recargar (S7) | — | |
| Q02 | 2 sesiones: cargar un documento vencido en A | El triángulo aparece en B sin recargar (S7) | — | |
| Q03 | Salir de Flota | Se cierra el canal (DevTools → WS) | — | |
| Q04 | Dos admins editan el mismo vehículo a la vez | Gana el último; ¿alguno se entera? — anotar | — | |

### R. Seguridad y permisos

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| R01 | Secretaria intenta crear un vehículo por consola **(§4)** | RLS lo permite solo en su sede y sin "Ambas" (AC9 de 0004-m). Anotar: la UI no existe para ella | — | |
| R02 | Secretaria intenta subir/editar un documento de vehículo por consola | Rechazado (policies admin-only) | — | |
| R03 | Secretaria lee `vehicles` y `maintenance_records` de la otra sede por consola | Hoy permitido (policies solo por rol, sin sede) — **decisión** (§5) | — | |
| R04 | Secretaria borra un vehículo por consola | Rechazado (`delete_vehicles` admin-only) | — | |
| R05 | Documento de vehículo: URL firmada copiada, abierta 1 h y 5 min después | Expira | — | |

### S. Visual y accesibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| S01 | Modo oscuro y claro en listado, drawers y página de mantenimientos | Todo legible; patente visible en oscuro | ✓ | |
| S02 | 375 / 768 / 1440 px | Tarjetas bajo ~1050 px de contenedor; sin scroll horizontal | ✓ | |
| S03 | Desktop con un drawer abierto | El listado pasa a tarjetas; mantenimientos pasa a modo compacto | — | |
| S04 | Triángulo de alerta con teclado / lector de pantalla | Tiene `aria-label` con el texto de la advertencia | — | |
| S05 | Solo teclado (Tab) en el listado y drawers | Se llega a todo; el foco se ve | — | |
| S06 | Animación de entrada | Sin parpadeos | — | |

---

## 4. Casos con pasos numerados

### A05 — Búsqueda global de la secretaria

**Precondición:** sesión de secretaria.
1. Abrir la búsqueda global del topbar.
2. Escribir `soap`.
3. Si aparece "Flota Vehicular", hacer clic.

**Esperado:** no aparece la opción, o si aparece, no lleva a una página de "no encontrado". Si
termina en `/app/secretaria/flota` con 404, S17 confirmada. **Evidencia:** captura de la URL.

### C06 — KPI de disponibles: Flota vs dashboard ejecutivo

**Precondición:** sesión admin, sede A, al menos 2 vehículos `operational` creados por seed.
1. En Flota, anotar el KPI "Disponibles".
2. Abrir el dashboard ejecutivo y anotar "Vehículos disponibles" (sección operación de hoy).
3. En Flota, editar uno de esos vehículos (cambiar solo el año) y guardar.
4. En Supabase Studio, ver `vehicles.status` de ese vehículo.
5. Volver al dashboard ejecutivo y recargar.

**Esperado:** el estado en BD sigue `operational` y los dos KPIs coinciden. Si pasó a
`available` y el dashboard bajó en 1, S1 confirmada.

### D01 — Búsqueda del listado

1. En Flota, escribir la patente completa de D1.
2. Escribir solo "nissan" (o la marca de algún vehículo).
3. Borrar el texto.

**Esperado:** en 1 solo D1; en 2 solo esa marca; en 3 la lista completa. Si la lista no cambia en
ningún paso, S4 confirmada (abrir consola: se verá `Buscando: …`).

### E02 — Crear vehículo

**Precondición:** sesión admin, sede A elegida.
1. "Nuevo Vehículo".
2. Patente `TEST12`, marca `Kia`, modelo `Morning`, año actual, KM `0`, estado Disponible, sede A.
3. "Crear Vehículo".
4. Verificar toast y que el drawer se cierra.
5. Buscar la fila `TEST12` en la tabla (sin recargar).
6. En Studio: `status`, `branch_id`, `both_branches`, `current_km`.

**Esperado:** fila visible con "Sin asignar", 0 km, Disponible, $0 combustible. En BD
`branch_id = A`, `both_branches = false`. Anotar el `status` guardado (S1).

### E14 — Documentos al crear

1. "Nuevo Vehículo", completar datos válidos.
2. En "Documentos (opcional)": tipo SOAP, fecha H+200, "Adjuntar archivo" (PDF de D16) → "Agregar".
3. Tipo Revisión Técnica, fecha H+10, sin archivo → "Agregar".
4. Verificar que el selector ya no ofrece SOAP ni Revisión Técnica.
5. "Crear Vehículo".
6. Abrir "Documentos" del vehículo nuevo.

**Esperado:** SOAP con fecha y botón "Ver documento"; Revisión Técnica con fecha y estado por
vencer (hoy dirá "Vigente", S8); los otros dos "Sin cargar". En el listado, triángulo ámbar.

### F04 — Editar sin tocar el estado no debe cambiarlo

**Precondición:** D7 (un vehículo `in_use` y uno `blocked`, sembrados por SQL).
1. Editar el `in_use`: cambiar solo el modelo y guardar.
2. Editar el `blocked`: cambiar solo el año y guardar.
3. En Studio, ver `status` de ambos.

**Esperado:** `in_use` y `blocked` sin cambios. Si quedaron `available` y `out_of_service`, S1
confirmada (anotar además el efecto en el dashboard ejecutivo, C06).

### F06 — No perder lo escrito al editar

1. Editar D1; cambiar el modelo a "PRUEBA" sin guardar.
2. Con el drawer abierto, cambiar la sede del topbar a la otra y volver.
3. Mirar el campo modelo.

**Esperado:** sigue "PRUEBA". Si volvió al valor original, S18 confirmada.

### F08 — Vehículo en taller no debe ofrecer horarios

**Precondición:** instructor X con vehículo D1 asignado, con horarios libres esta semana.
1. En Agenda o en una matrícula nueva, anotar un horario libre de X.
2. En Flota, poner D1 en "Mantenimiento".
3. Volver a buscar horarios de X.
4. Repetir con "Fuera de Servicio".
5. Dejar D1 en "Disponible".

**Esperado:** en 3 y 4, X no ofrece horarios (o se advierte claramente). Si los ofrece igual, S5
confirmada → llevar a §5 si el negocio lo acepta.

### G06 — Admin cambia de sede

**Precondición:** D1 (A), D4 (B), D5 (Ambas, principal A).
1. Topbar → "Todas": anotar total y verificar columna Sede (D5 dice "Ambas").
2. Sede A: anotar total; sin columna Sede; D1 y D5 presentes, D4 no.
3. Sede B: D4 y D5 presentes, D1 no.

**Esperado:** recarga sola cada vez; los KPIs cambian con la sede.

### H05 — Cargar un documento

1. Abrir Documentos de D4.
2. Lápiz en SOAP → fecha H+100 → "Elegir archivo" (PDF de D16) → "Guardar".
3. Verificar toast, fecha "Vence: …", badge "Vigente" y botón de ver.
4. "Ver documento".
5. Cerrar el panel y revisar la fila de D4 en el listado.

**Esperado:** el visor abre el PDF correcto; el listado no muestra triángulo. En Studio,
`vehicle_documents` tiene una sola fila (D4, soap) con `file_url` = `vehicle-docs/<id>/…`.

### I08 — Documento que vence hoy, de noche

**Precondición:** documento con vencimiento = H. Ejecutar entre 21:00 y 23:59 hora de Chile.
1. A las 20:50, abrir Flota y anotar el color del triángulo del vehículo.
2. A las 21:05, pulsar "Actualizar" y volver a mirar.
3. Revisar el dashboard (alertas de documentos) a las 21:05.

**Esperado:** ámbar ("por vencer") en ambos momentos hasta medianoche. Si pasa a rojo a las 21:00,
S10 confirmada. **Evidencia:** 2 capturas con la hora visible.

### J02 — Dashboard y vehículo "Ambas"

**Precondición:** D5 (Ambas, principal A) con un documento vencido; ningún otro vencido.
1. Dashboard admin con sede A: anotar alerta de documentos vencidos.
2. Cambiar a sede B.

**Esperado:** en ambas sedes aparece "1 Documento vencido" (D5 opera en las dos). Si en B no
aparece, S12 confirmada.

### J04 — Umbral configurable vs umbral fijo

1. En Studio: `alert_config` → `document_expiry` → `advance_days = 15`.
2. Documento con vencimiento H+20.
3. Mirar el listado de Flota, el dashboard, y la página de mantenimientos de ese vehículo.
4. Restaurar `advance_days = 30`.

**Esperado:** los tres dicen lo mismo. Hoy: listado "por vencer", dashboard nada, mantenimientos
"Vigente" (S9).

### J06 — Notificación diaria de vencimiento

**Precondición:** un documento con vencimiento H (vehículo con instructor asignado) y otro con
vencimiento H + `advance_days` (vehículo sin instructor).
1. En Studio (SQL): `SELECT notify_vehicle_document_expiry();`
2. Como admin, abrir la campana de notificaciones.
3. Revisar `notifications` en Studio (recipient, subject, message, reference_type).
4. Ejecutar el paso 1 de nuevo.

**Esperado:** en 2, un aviso "Documento vencido" y uno "Documento por vencer" por admin; el
instructor del primer vehículo también tiene el suyo; el segundo vehículo notifica solo a admins
(AC4). Texto con el nombre legible del documento (S16). En 4, anotar si se duplican (J08).
**Limpieza:** borrar las notificaciones de prueba.

### J13 — Advertencia al agendar con documento vencido

**Precondición:** instructor X con D2 (SOAP vencido) asignado.
1. Nueva matrícula Clase B (o reprogramar una clase existente) hasta el paso de horarios.
2. Elegir al instructor X.
3. Pasar el mouse sobre el badge de advertencia de un slot.
4. Agendar igual.

**Esperado:** badge visible con "SOAP vencido"; el agendamiento no se bloquea (advertencia, no
bloqueo — confirmar que es la regla deseada, §5). Detalle completo del flujo en `026`.

### K03 — Dos clases en la misma hora "en punto"

**Precondición:** D1 con clase hoy a las 11:00 y otra a las 11:50 (y, si se puede, una a las 19:10).
1. Abrir Agenda de D1.

**Esperado:** se ven las 3 clases. Si en el slot 11:00 solo se ve una y la de 19:10 no aparece,
S13 confirmada.

### L08 — KPIs de mantenimiento

**Precondición:** D8 con servicios de $50.000, $30.000 y uno sin costo, registrados en 2 meses
distintos; KM actual del vehículo 60.000.
1. Abrir mantenimientos de D8.
2. Anotar: "3 servicios", "$80.000 invertidos", Inversión Total, Costo p/Mes, KM Recorridos.

**Esperado:** Inversión Total $80.000. Hoy "Costo p/Mes" = $26.667 (80.000 ÷ 3) y "KM
Recorridos" = 60.000 (S15) — anotar y llevar a §5 qué deberían mostrar.

### L11 — Vehículo inexistente

1. Navegar a `/app/admin/flota/99999/mantenimientos`.
2. Mirar qué se muestra.
3. Si hay botón "Registrar Mantenimiento" visible, intentar registrar uno.

**Esperado:** mensaje de error con "Reintentar"; no se puede registrar. Si el paso 3 permite
enviar, anotar el error que devuelve la BD.

### M02 — Registrar un servicio

**Precondición:** D8; anotar chips y KPIs actuales.
1. "Registrar Servicio".
2. Tipo "Cambio de Aceite", km = KM actual + 500, taller "Taller Prueba", fecha hoy, costo $45.000,
   observación "Prueba piloto".
3. "Registrar Mantenimiento".

**Esperado:** drawer se cierra; primera fila del historial con esos datos y "Completado"; chips
+1 servicio y +$45.000.

### M03 — ¿El mantenimiento actualiza el KM?

**Precondición:** M02 recién hecho.
1. Mirar el subtítulo de la página ("… N km actuales").
2. Volver a Flota y mirar la columna KM del vehículo.
3. En Studio, `vehicles.current_km` y `last_maintenance`.

**Esperado (según el UAT):** KM = el del servicio. Hoy probablemente no cambia (S6); llevar a §5.

### N01 — KM al finalizar clase (admin)

**Precondición:** D14 (clase de hoy con D1); anotar KM de D1 en Flota.
1. Asistencia B → la clase → "Iniciar": verificar km precargado = KM de D1; confirmar.
2. "Finalizar": km final = inicial + 25; confirmar.
3. Ir a Flota y buscar D1.

**Esperado:** KM de D1 = km final.

### N03 — KM al finalizar clase (secretaria, vehículo "Ambas")

**Precondición:** sesión secretaria de sede B; clase de hoy de sede B con D5 (Ambas, principal A).
1. Anotar KM de D5 (desde la sesión admin).
2. Con la secretaria: iniciar y finalizar la clase con km final = actual + 30.
3. Verificar el toast.
4. Con admin, recargar Flota y mirar KM de D5.

**Esperado:** KM actualizado. Si el toast dice "Clase finalizada" pero el KM no cambió, S2
confirmada → prioridad alta (el odómetro queda desfasado sin que nadie lo sepa).

### N05 — KM inicial menor al actual

**Precondición:** D1 con KM 45.000.
1. Iniciar clase con D1 escribiendo km inicial 4.500.
2. Finalizar con 4.520.
3. Mirar KM de D1 en Flota.

**Esperado:** el paso 1 se bloquea o advierte. Si D1 queda en 4.520 km, S3 confirmada.
**Limpieza:** restaurar el KM de D1 editando el vehículo.

### O01 — Egreso de combustible por vehículo

**Precondición:** anotar la columna "Combustible (Mes)" de D1.
1. Caja Diaria → Registrar egreso → Tipo Combustible → vehículo D1 → $20.000 → guardar.
2. Volver a Flota → "Actualizar".

**Esperado:** la columna de D1 subió exactamente $20.000. Repetir con D5 viendo la otra sede (G12).

### Q01 — Tiempo real entre 2 sesiones

**Precondición:** 2 navegadores o perfiles distintos (no 2 pestañas: comparten sesión), ambos
admin en Flota con la misma sede.
1. En A, crear un vehículo.
2. Sin tocar B, esperar 5 segundos.
3. En A, cargar un documento vencido a D1 → mirar B.

**Esperado:** B refleja ambos cambios sin recargar. Si no, recargar B para confirmar que el dato
existe (separa "no llegó el evento" de "no se guardó") → S7.

### R01 — Secretaria y vehículos por consola

**Precondición:** sesión de secretaria de sede A. Como no tiene pantalla de Flota, copiar desde
Network cualquier petición autenticada a `/rest/v1/...` ("Copy as fetch") para reutilizar headers.
1. POST a `/rest/v1/vehicles` con `branch_id` = A, `both_branches: false`, patente `SEC001`.
2. Repetir con `branch_id` = B.
3. Repetir con `branch_id` = A y `both_branches: true`.
4. POST a `/rest/v1/vehicle_documents` para el vehículo del paso 1.

**Esperado:** 1 permitido (RLS de 0004-m AC9); 2, 3 y 4 rechazados. Anotar resultado y borrar
`SEC001` con admin. **Decisión:** si la secretaria no tendrá Flota en el piloto, ¿se revierte el
permiso de RLS? (§5).

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| A04 / R01 | ¿La secretaria tiene Flota en el piloto? La RLS (spec 0004-m AC9) le permite crear/editar vehículos de su sede, pero no hay ruta ni menú. |
| C04 | ¿Hace falta un KPI de vehículos de baja? |
| F05 / N05 | ¿Se puede bajar el KM de un vehículo? ¿Con qué control? |
| F07 | ¿La baja es solo "Fuera de Servicio" o debe existir eliminar/archivar? |
| F08 | ¿Un vehículo en Mantenimiento/Fuera de Servicio debe dejar de ofrecer horarios y salir de los selectores? |
| G09 | ¿Se puede quitar "Ambas" a un vehículo con instructor que opera en la otra sede? |
| I02 / J05 / S11 | Un documento con vencimiento = hoy: ¿vigente hasta el final del día o vencido? (la app dice "por vencer", la notificación dice "venció hoy"). |
| I07 | ¿El estado guardado en BD debe mandar sobre la fecha? |
| J04 / S9 | ¿Un solo umbral de "por vencer" (el de `alert_config`) para todas las pantallas? |
| J10 | ¿La secretaria debe recibir la notificación de vencimiento? |
| J11 | ¿Notificar al instructor mientras su portal está bloqueado en el piloto? |
| J13 | ¿Documento vencido solo advierte o debe bloquear el agendamiento? |
| K07 | ¿La agenda del vehículo necesita ver otros días? |
| L08 / S15 | ¿Qué deben medir "Costo p/Mes" y "KM Recorridos"? |
| M03 / S6 | ¿Registrar un mantenimiento actualiza el KM y la fecha de última mantención del vehículo? |
| M08 | ¿Se pueden registrar mantenimientos con fecha futura como "Completado"? |
| M14 | ¿Hace falta eliminar un mantenimiento cargado por error? |
| O03 | Combustible de un vehículo "Ambas" cargado en la sede B: ¿a qué caja va? |
| P03 | ¿El encabezado de la Hoja de Ruta debe depender de la sede? |
| R03 | ¿La secretaria puede leer vehículos y mantenimientos de la otra sede? |
| B11 | ¿Orden del listado por id, por patente o por estado? |
