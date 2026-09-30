# Testing — Servicios Especiales

> **Asignación:** `ASG-i-031` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/app/admin/servicios-especiales`, `/app/secretaria/servicios-especiales`
> **Incluye:** catálogo (crear, editar, borrar/desactivar, reactivar, eliminar definitivamente,
> toggle "Mostrar inactivos"), drawer "Registrar Venta", KPIs del hero, drawer "Historial de
> Ventas" (filtros, período, borrar venta, exportar Excel/PDF), sede, y la verificación cruzada de
> la venta en Caja Diaria / Historial de Cuadraturas / Reportes Contables / Dashboard.
> **No incluye:** la Caja Diaria por dentro (arqueo, cierre, eliminar ingreso) ni Reportes
> Contables por dentro (ver `029-contabilidad.md`); aquí solo se verifica que la venta llegue (o
> no) a esas pantallas.
>
> **Código leído para armar esta lista:**
> `features/admin/servicios-especiales/{admin-servicios-especiales,editar-servicio-drawer,historial-ventas-drawer}.component.ts`,
> `features/secretaria/servicios-especiales/secretaria-servicios-especiales.component.ts`,
> `shared/components/servicios-especiales-content/` (content + `drawers/registrar-venta-drawer`,
> `drawers/agregar-servicio-drawer`), `shared/components/eliminar-servicio-modal/`,
> `core/facades/servicios-especiales.facade.ts`, `core/models/ui/servicios-especiales.model.ts`,
> `core/utils/{branch-scope,period-window,rut,excel,date}.utils.ts`,
> `core/facades/cuadratura.facade.ts` (rama `special_service`),
> `core/facades/reportes-contables.facade.ts`, `core/facades/dashboard.facade.ts`,
> `supabase/functions/export-special-services/`, `supabase/functions/generate-financial-report/`,
> migraciones `20260301000005`, `20260301000011_10_rls_policies.sql` (§ service_catalog /
> special_service_sales), `20260407100000`, `20260424000001`, `20260813060000`, `20260813070000`,
> fixes `fix-021-i` … `fix-026-i`, `fix-239-m`, `fix-240-m`, `hotfix-099-m`, `ASG-b-050`, y los 5
> `Historial_Ventas_*.xlsx` de la raíz del repo.

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-031`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S16)** salen de leer el código, **no están confirmadas** en navegador.
  Confirmarlas o descartarlas es parte del trabajo.
- Vocabulario: **"Borrar"** (tacho en un servicio activo) = intenta borrar y, si tiene ventas,
  lo **desactiva**. **"Eliminar definitivamente"** = solo en servicios inactivos, con la palabra
  `ELIMINAR`. **"Borrar venta"** = tacho en el Historial (borrado real, bloqueado si la caja de
  ese día está cerrada). **No existe "anular"**: una venta se borra o no.

---

## 1. Sospechas de bug encontradas en el código

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **Exportar historial sin ningún control de acceso.** La edge function usa la clave de servicio (salta RLS), **no valida ni siquiera que haya un usuario logueado** (no llama a `auth.getUser()`), y filtra por el `branch_id` que manda el navegador; con `branch_id: null` devuelve todas las sedes. No está en `config.toml`, así que queda con `verify_jwt` por defecto: la clave anon (pública en el bundle) basta para pasar la puerta. Expone nombre y RUT de clientes. | `supabase/functions/export-special-services/index.ts:20-25,32` |
| S2 | 🔴 Alta | **Las ventas no llegan a Reportes Contables, al PDF financiero ni al KPI de ingresos del Dashboard.** Esos tres leen solo `payments` (+ cursos singulares); `special_service_sales` nunca se consulta. Solo Caja Diaria las suma. Resultado: Caja y Reportes no cuadran por el monto exacto de los servicios vendidos. La categoría "Psicotécnico / Servicios" de Reportes existe pero depende de `payments.type = 'special_service'`, que ningún flujo crea. | `reportes-contables.facade.ts:348-353`; `generate-financial-report/index.ts:101-139`; `dashboard.facade.ts:160-166`; `reportes-contables.utils.ts:99`; vs `cuadratura.facade.ts:379-400` |
| S3 | 🟠 Media | **La venta se guarda con fecha UTC.** El drawer muestra "hoy" en hora local, pero guarda `new Date().toISOString()` (UTC). Una venta hecha después de las 21:00 (hora Chile, UTC-3) queda con la fecha de **mañana**: no aparece en la Caja de hoy (que usa fecha local), aparece en la de mañana, y el candado de borrado revisa la caja equivocada. El KPI "del mes" usa el mismo criterio UTC. | `registrar-venta-drawer.component.ts:180,249`; `servicios-especiales.facade.ts:124`; `cuadratura.facade.ts:339` |
| S4 | 🟠 Media | **El dinero de la venta cae en la columna de tarjeta de la caja.** Sin importar cómo pagó el cliente, la venta va al bucket `otros`, que al cerrar se graba como `card_amount` y **no suma al efectivo teórico**. Si el cliente pagó en efectivo, el arqueo muestra un sobrante igual al precio. El formulario no pregunta el medio de pago. | `cuadratura.facade.ts:103-116,201-214,789`; `registrar-venta-drawer.component.ts:28-131` (no hay campo de medio de pago) |
| S5 | 🟠 Media | **RLS solo por rol, nunca por sede.** Las 4 policies de `special_service_sales` y las de `service_catalog` son las originales de `20260301000011` y nunca se redefinieron: una secretaria de la sede A puede leer, crear, modificar y borrar ventas de la sede B desde la consola; el `branch_id` del INSERT lo pone el navegador. | `20260301000011_10_rls_policies.sql:790-813`; `servicios-especiales.facade.ts:192,280` |
| S6 | 🟠 Media | **Los errores no se muestran nunca.** Registrar venta, agregar/editar servicio y exportar guardan el error en `facade.error`, pero ninguna pantalla lo lee: el botón vuelve a su estado normal, el drawer sigue abierto y no aparece ningún toast. Si falla la carga inicial, se ve "Todavía no hay servicios en el catálogo · Agregar servicio" (invita a duplicar servicios). | `servicios-especiales.facade.ts:151-156,284-287,301-304,533-535`; `registrar-venta-drawer.component.ts:254-257`; ningún componente usa `error()` |
| S7 | 🟠 Media | **KPIs y lista limitados a las últimas 200 ventas.** "Ventas Totales" y "Recaudación Total" se calculan en el navegador sobre la consulta con `.limit(200)`: pasada la venta 200 se quedan congelados sin aviso. La exportación no tiene límite, así que el archivo y la pantalla divergen. | `servicios-especiales.facade.ts:122-138,190` vs `export-special-services/index.ts:27-30` |
| S8 | 🟠 Media | **"Venta a alumno" no vincula al alumno.** `student_id` se inserta siempre `null`; "Tipo de cliente" es solo una marca y solo aparece si el servicio se llama "psicot…" o "informe". Consecuencias: la venta no aparece en la ficha del alumno, y la notificación "Pago registrado" (spec 0025) nunca se envía. Además, si eliges "Alumno" y luego cambias a otro servicio, el select se oculta pero la marca queda en `true`. | `servicios-especiales.facade.ts:268-269,352-354`; `registrar-venta-drawer.component.ts:75-87,201-205,220-223` |
| S9 | 🟠 Media | **Una venta "revertida" desde Caja queda huérfana.** Eliminar el ingreso en Caja Diaria pone `paid = false`, pero desde fix-025-i no existe forma de volver a cobrarla (`registrarCobro()` no está conectado a ningún botón). La venta queda "pendiente" para siempre: sigue contando en "Ventas Totales"/"Ventas del mes", sale de "Recaudación" y en el Excel dice "Pendiente / No". | `cuadratura.facade.ts:523-533`; `servicios-especiales.facade.ts:329` (sin usos) |
| S10 | 🟡 Baja-Media | **El archivo exportado no coincide con la pantalla.** Ignora el filtro de servicio y el período; usa el nombre **actual** del catálogo (`service_catalog.name`) en vez del nombre guardado en la venta, así que una venta de un servicio eliminado sale con Servicio vacío y una de un servicio renombrado sale con el nombre nuevo; no trae N° de boleta; el PDF conserva las columnas "Estado"/"Cobro" que la UI eliminó y no tiene columna Sede ni totales. **Los 5 `Historial_Ventas_*.xlsx` de la raíz están completamente vacíos** (hoja sin filas, ni siquiera encabezados): confirmar si es un bug del export. | `export-special-services/index.ts:38-48,86-107`; `historial-ventas-drawer.component.ts:246-249`; `Historial_Ventas_2026-09-17…24.xlsx` (`<sheetData/>`) |
| S11 | 🟡 Baja-Media | **El RUT sin DV se corrompe en silencio.** Al salir del campo, el último dígito se toma como DV y se **reemplaza** por el calculado: si escribes solo el cuerpo (`12345678`), queda `1.234.567-4`. Tampoco hay validación de RUT real. | `rut.utils.ts:78-86`; `registrar-venta-drawer.component.ts:233-236` |
| S12 | 🟡 Baja | **Borrado definitivo sin estado "Eliminando…".** El modal se cierra antes de que termine la operación (`isEliminandoDefinitivo` nunca pasa a `true`) y el Smart component no bloquea un segundo intento. Además, el desvincular ventas y el DELETE son 2 pasos sin transacción: si el segundo falla, las ventas ya quedaron desvinculadas. | `servicios-especiales-content.component.ts:373,459-464`; `servicios-especiales.facade.ts:478-501` |
| S13 | 🟡 Baja | **Secretaria con grant multi-sede no recarga al cambiar de sede** (solo admin tiene el `effect`), y en "Todas" la venta se inserta en su sede propia sin avisar. Lo mismo para admin en "Todas": la venta queda en `users.branch_id` del admin (o `null` si no tiene sede, y entonces no aparece en la Caja de ninguna sede). Sin `createRequestGuard`: un cambio rápido de sede puede dejar datos de la sede anterior. | `secretaria-servicios-especiales.component.ts:34-35` vs `admin-servicios-especiales.component.ts:37-40`; `servicios-especiales.facade.ts:159-171,181-218` |
| S14 | 🟡 Baja | **Sin tiempo real en el módulo**, y `special_service_sales` no está en `supabase_realtime`: el binding de Caja Diaria a esa tabla puede dejar mudo todo el canal de Caja (mismo mecanismo de fix-227-m). | `servicios-especiales.facade.ts` (no hay canal); `cuadratura.facade.ts:282`; ninguna migración `ADD TABLE special_service_sales` |
| S15 | 🟡 Baja | **Catálogo global compartido entre sedes.** `service_catalog` no tiene `branch_id`: si la secretaria de la sede A cambia un precio, desactiva o elimina un servicio, afecta a la sede B. | `20260301000005_05_payments_and_finances.sql:189-196` |
| S16 | 🟡 Baja | **Detalles de formulario:** monto con decimales (`1500.5`) falla contra la columna `INTEGER` (y por S6 no se ve el error); nombre/descripción de solo espacios pasan `required`; cambiar de servicio pisa el monto que ya habías escrito; el drawer de editar no permite cambiar la descripción; en la vista de tarjetas un servicio inactivo no tiene botón de editar (en la tabla sí); el candado de borrado solo se revisa en el navegador (no hay trigger). | `registrar-venta-drawer.component.ts:187,203`; `agregar-servicio-drawer.component.ts:101-105`; `editar-servicio-drawer.component.ts:119-126`; `servicios-especiales-content.component.ts:153-161,280-299`; `servicios-especiales.facade.ts:375-402` |

---

## 2. Datos de prueba necesarios

Preparar antes de ejecutar. Anotar acá el dato real usado para cada uno.

| Dato | Cómo debe estar | Para qué | Dato usado |
|---|---|---|---|
| D1 | Servicio activo "Examen Psicotécnico" (nombre con "psicot"), sin ventas | Tipo de cliente visible; borrar sin ventas | |
| D2 | Servicio activo de otro nombre (ej. "Uso de Simulador"), con ≥ 1 venta | Borrar → se desactiva; sin "Tipo de cliente" | |
| D3 | Servicio inactivo con ventas | Reactivar; eliminar definitivamente | |
| D4 | Servicio inactivo sin ventas | Eliminar definitivamente simple | |
| D5 | Venta de hoy, sede A, caja de hoy **abierta** | Borrar venta OK | |
| D6 | Venta de un día con caja **cerrada** en sede A | Borrar bloqueado | |
| D7 | Venta de un día con caja en **borrador** (sin cerrar) | ¿Se puede borrar? | |
| D8 | Ventas en sede A y en sede B, mismo día | Aislamiento por sede | |
| D9 | Venta de hace > 12 meses y ventas de 2 años distintos | Filtro de período | |
| D10 | Venta cuyo servicio fue eliminado definitivamente | Nombre guardado, filtro, export | |
| D11 | Servicio renombrado después de tener ventas | Nombre en historial vs export | |
| D12 | Venta con N° de boleta y otra sin | Boleta en historial, Caja, export | |
| D13 | Alumno real matriculado (nombre + RUT) | Venta "a alumno" (S8) | |
| D14 | > 200 ventas en una sede (script o seed) | Límite de KPIs (S7) | |
| D15 | Cliente con tildes/ñ y nombre muy largo | Diseño, PDF | |

**Cuentas:** admin (anotar si su usuario tiene `branch_id` o no); secretaria sede A; secretaria
sede B; secretaria con grant multi-sede (`can_access_both_branches = true`); secretaria sin sede
asignada; un alumno (para verificar notificaciones/ficha, S8).

---

## 3. Casos

### A. Carga y acceso

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Admin entra por el menú "Venta Servicios Especiales" | Skeleton en el hero → catálogo. Consola sin errores, red sin 4xx/5xx | ✓ | |
| A02 | Secretaria entra a `/app/secretaria/servicios-especiales` | Igual; KPIs solo de su sede | ✓ | |
| A03 | Secretaria escribe `/app/admin/servicios-especiales` | Acceso denegado | ✓ | |
| A04 | Instructor o alumno escribe cualquiera de las 2 URLs | Acceso denegado | ✓ | |
| A05 | Salir y volver | Datos al instante, sin skeleton (SWR) | — | |
| A06 | F5 | Carga normal | ✓ | |
| A07 | Carga con red cortada **(§4)** | Mensaje de error claro, no "Todavía no hay servicios" (S6) | — | |
| A08 | Desktop 1440 px | Página fill-screen: el catálogo scrollea por dentro, el documento no (fix-021-i) | ✓ | |

### B. Hero y KPIs

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | 4 KPIs visibles | Ventas del mes · Ventas Totales · Recaudación del mes · Recaudación Total ("N cobradas"), en ese orden (hotfix-099-m) | ✓ | |
| B02 | Registrar una venta de $X **(§4)** | Ventas del mes +1, Ventas Totales +1, ambas Recaudaciones +$X, sin recargar | ✓ | |
| B03 | Borrar una venta de $X | Los 4 KPIs bajan en lo que corresponde | ✓ | |
| B04 | Etiqueta del mes | "septiembre de 2026" (mes actual en español) | — | |
| B05 | Venta registrada después de las 21:00 el último día del mes **(§4)** | Cuenta en el mes correcto (S3) | — | |
| B06 | Venta revertida desde Caja (paid = false) | ¿Cómo se ve en los KPIs? (S9) — anotar | — | |
| B07 | Sede con > 200 ventas (D14) **(§4)** | Ventas Totales = total real (S7) | — | |
| B08 | Admin cambia de sede | KPIs recalculados para esa sede | ✓ | |
| B09 | Formato de montos | `$ 1.234.567` con punto de miles | — | |

### C. Catálogo: lista y toggle

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | Lista inicial | Solo servicios activos, orden de creación | ✓ | |
| C02 | Íconos por nombre | "psicot…" cerebro · "maquinaria/camión" camión · "informe/certificado" documento · otro recibo | — | |
| C03 | Encender "Mostrar inactivos" | Aparecen los inactivos atenuados, badge "Inactivo", botones "Eliminar definitivamente" y "Reactivar" | ✓ | |
| C04 | Apagar el toggle | Vuelven a ocultarse | ✓ | |
| C05 | Todos los servicios inactivos y toggle apagado | Hoy dice "Todavía no hay servicios en el catálogo" — texto engañoso, anotar | — | |
| C06 | Catálogo vacío de verdad | Estado vacío con "Agregar servicio" que abre el drawer | ✓ | |
| C07 | > 10 servicios | Paginación de 10, "Mostrando 1 a 10 de N servicios" | ✓ | |
| C08 | Nombre/descripción muy largos | Truncados sin romper la fila | — | |
| C09 | Salir y volver con el toggle encendido | ¿Se conserva? (vive en el componente: se resetea) — anotar | — | |

### D. Agregar servicio

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | "Agregar servicio" → completar nombre, descripción, precio → "Agregar al Catálogo" | Drawer se cierra, servicio aparece activo al final | ✓ | |
| D02 | Botón deshabilitado con campos vacíos o precio 0 / negativo | Deshabilitado | ✓ | |
| D03 | Nombre o descripción con solo espacios | Hoy lo acepta (S16) — anotar | — | |
| D04 | Precio con decimales (ej. 1500,5) | Error visible o redondeo; hoy probablemente falla sin aviso (S6/S16) | — | |
| D05 | Nombre duplicado de un servicio existente | Hoy lo acepta — ¿debe impedirse? | — | |
| D06 | Doble clic rápido en "Agregar al Catálogo" | Se crea 1 solo servicio | ✓ | |
| D07 | Cancelar o cerrar con X | No crea nada | ✓ | |
| D08 | Falla de red al guardar | Mensaje de error; hoy no aparece nada (S6) | — | |
| D09 | Servicio creado por secretaria de sede A | ¿Aparece también en sede B? (S15) | — | |

### E. Editar servicio (fix-240-m)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | Lápiz → drawer precargado con nombre, precio y estado | Valores correctos | ✓ | |
| E02 | Cambiar precio → Guardar | Nuevo precio en la tabla y en el select de "Vender" | ✓ | |
| E03 | Ventas anteriores tras cambiar el precio | Conservan su monto original | ✓ | |
| E04 | Renombrar un servicio con ventas (D11) **(§4)** | Historial muestra el nombre guardado; el filtro sigue funcionando; comparar con el export (S10) | — | |
| E05 | Estado → Inactivo desde el drawer | Desaparece de la lista (toggle apagado) y del select de venta | ✓ | |
| E06 | Editar un servicio inactivo (toggle encendido): en tabla y en tarjeta | En tabla hay lápiz; en tarjeta no (S16) | — | |
| E07 | Cambiar la descripción | No hay campo — confirmar si es aceptable | — | |
| E08 | Precio 0 o vacío | Botón deshabilitado | ✓ | |
| E09 | Abrir editar de A, cerrar, abrir editar de B | El drawer muestra los datos de B | ✓ | |
| E10 | Cambio de precio hecho por secretaria sede A | ¿Afecta a la sede B? (S15) | — | |

### F. Borrar / desactivar / reactivar / eliminar definitivamente (fix-022-i, fix-023-i, fix-024-i)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | Tacho en D1 (sin ventas) → "Sí, borrar" | Toast "Servicio borrado", desaparece del todo | ✓ | |
| F02 | Tacho en D2 (con ventas) → "Sí, borrar" **(§4)** | Toast de advertencia "Servicio desactivado…", pasa a inactivo, ventas intactas | ✓ | |
| F03 | Tacho → Cancelar | No pasa nada | ✓ | |
| F04 | "Reactivar" en D3 | Toast "Servicio reactivado", vuelve a la lista y al select de venta | ✓ | |
| F05 | "Eliminar definitivamente" en D3 **(§4)** | Modal con `ELIMINAR`; ventas conservadas con su nombre | ✓ | |
| F06 | Escribir `eliminar`, `ELIMINA`, `ELIMINAR ` | Minúsculas y texto incompleto: botón deshabilitado + mensaje; `ELIMINAR ` con espacio: lo acepta (trim) | ✓ | |
| F07 | Cerrar el modal con Escape, clic afuera y Cancelar | Se cierra sin eliminar; al reabrir el campo está vacío y con foco | ✓ | |
| F08 | Confirmar con la red lenta (Slow 3G) | ¿Se ve "Eliminando…"? Hoy el modal se cierra al instante (S12) | — | |
| F09 | Doble eliminación rápida del mismo servicio | Un solo toast de éxito, sin error crudo | — | |
| F10 | Ventas de D3 en Historial y en Caja después de eliminar | Siguen con el nombre del servicio | ✓ | |
| F11 | Filtrar el Historial por el servicio eliminado | Ya no está en el filtro; esas ventas solo se ven con "Todos" — ¿aceptable? | — | |
| F12 | Borrar un servicio mientras otra persona tiene el drawer de venta abierto con él **(§4)** | La venta falla con mensaje claro o se registra con nombre; nunca silencio | — | |

### G. Registrar venta — apertura y formulario

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | Hero "Registrar Venta" | Drawer vacío, "Seleccionar servicio..." | ✓ | |
| G02 | "Vender" en la fila de D2 | Drawer con el servicio seleccionado (etiqueta visible, fix-026-i) y el monto precargado | ✓ | |
| G03 | "Vender" en D2, cerrar, hero "Registrar Venta" | Drawer vacío (no arrastra el servicio anterior) | ✓ | |
| G04 | Select de servicio | Solo activos, formato "$20.000 — Nombre" | ✓ | |
| G05 | Elegir un servicio | Monto se autocompleta con el precio base | ✓ | |
| G06 | Escribir un monto y luego cambiar de servicio | Hoy pisa el monto escrito (S16) — anotar | — | |
| G07 | Servicio "psicot…" o "informe" | Aparece "Tipo de cliente" (Cliente externo / Alumno) | ✓ | |
| G08 | Otro servicio | No aparece "Tipo de cliente" | ✓ | |
| G09 | Elegir psicotécnico → "Alumno" → cambiar a otro servicio → registrar **(§4)** | La venta NO debería quedar marcada como alumno (S8) | — | |
| G10 | Fecha | Texto fijo con la fecha de hoy, no editable (fix-023-i) | ✓ | |
| G11 | RUT: escribir `123456785` | Se formatea `12.345.678-5` mientras escribes | ✓ | |
| G12 | RUT: escribir solo el cuerpo `12345678` y salir **(§4)** | No debe inventar un RUT distinto (S11) | ✓ | |
| G13 | RUT con DV equivocado | Hoy lo corrige solo — ¿aceptable o debe avisar? | — | |
| G14 | RUT con K | Queda en mayúscula | — | |
| G15 | Campos obligatorios vacíos o monto 0 | "Registrar Venta" deshabilitado | ✓ | |
| G16 | Monto distinto al precio base (descuento) | Se permite y se guarda el monto escrito | ✓ | |
| G17 | Monto con decimales / monto enorme (99.999.999) | Error visible o aceptado sin romper; nunca silencio (S16) | — | |
| G18 | N° de boleta con espacios alrededor | Se guarda sin espacios; vacío → sin boleta | — | |
| G19 | Medio de pago | No existe el campo — **decisión** (S4) | — | |

### H. Registrar venta — guardar

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | Venta a cliente externo **(§4)** | Drawer se cierra, KPIs suben, venta encabeza el Historial | ✓ | |
| H02 | Venta a alumno (D13) **(§4)** | ¿Aparece en la ficha del alumno? ¿Le llega notificación? (S8) | — | |
| H03 | Doble clic en "Registrar Venta" | Una sola venta | ✓ | |
| H04 | Falla de red al guardar **(§4)** | Mensaje de error y el drawer sigue abierto con los datos (S6) | — | |
| H05 | Toast de éxito | Hoy no hay toast al registrar — ¿debería haber? | — | |
| H06 | Venta después de las 21:00 **(§4)** | Fecha de hoy en Historial y en Caja (S3) | — | |
| H07 | Secretaria sin sede asignada intenta vender | Error claro; nunca queda una venta sin sede | — | |
| H08 | Admin en "Todas las sedes" vende **(§4)** | ¿En qué sede queda? Debe avisar o pedir sede (S13) | — | |
| H09 | Auditoría | Registro de la venta con usuario y fecha en Auditoría | — | |
| H10 | Cliente con tildes/ñ (D15) | Se guarda y muestra bien | — | |

### I. Historial de ventas (drawer)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| I01 | Hero "Ver Historial" | Drawer con filtros y lista, más recientes primero | ✓ | |
| I02 | Datos de cada fila | Cliente, monto, RUT, "Servicio · fecha", badge de boleta si tiene | ✓ | |
| I03 | Fecha | Hoy se muestra `2026-09-29` (formato ISO) — ¿se prefiere `29-09-2026`? | — | |
| I04 | Filtro por servicio | Solo ventas de ese servicio; con la X vuelve a "Todos" | ✓ | |
| I05 | Filtro incluye servicios inactivos | Sí, aparecen (el catálogo completo) | — | |
| I06 | Período "Últimos 12 meses" (default) con D9 | La venta vieja no aparece | ✓ | |
| I07 | "Todo el historial" y un año específico | Muestra lo que corresponde | ✓ | |
| I08 | Filtro + período sin resultados | "No se encontraron ventas con los filtros seleccionados." | ✓ | |
| I09 | Contador al pie | "N de M ventas" (M = total cargado, máximo 200 — S7) | — | |
| I10 | Búsqueda por cliente o RUT | **No existe buscador** — confirmar si es aceptable | — | |
| I11 | Registrar una venta con el Historial abierto en otra pestaña del drawer | Al reabrir, la venta está | ✓ | |
| I12 | Venta revertida desde Caja (S9) | ¿Se distingue en el Historial? Hoy no hay indicador | — | |
| I13 | Tamaño 375 px | Filtros apilados, sin scroll horizontal | ✓ | |

### J. Borrar venta (fix-022-i / ASG-b-050)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | Tacho en D5 → "Sí, borrar" **(§4)** | Toast "Venta borrada", sale del Historial, KPIs y Caja de hoy | ✓ | |
| J02 | Tacho en D6 (caja cerrada) **(§4)** | Aviso "No se puede borrar: la caja del AAAA-MM-DD ya está cerrada." y la venta sigue | ✓ | |
| J03 | Tacho en D7 (caja en borrador) | Se borra (el candado solo mira cajas cerradas) — confirmar que es lo deseado | — | |
| J04 | Cancelar el modal | No borra | ✓ | |
| J05 | Venta de sede A, caja de sede B cerrada ese día | Se puede borrar (el candado es por sede) | — | |
| J06 | Venta hecha tarde (S3) con la caja de hoy ya cerrada | ¿El candado protege? Anotar | — | |
| J07 | Doble clic en "Sí, borrar" | Un solo borrado, sin error | — | |
| J08 | Falla de red al borrar | Toast "No se pudo borrar la venta" | — | |
| J09 | **Seguridad:** borrar una venta de un día cerrado desde la consola **(§4)** | Rechazado por la BD; hoy el candado es solo del navegador (S16) | ✓ | |
| J10 | Auditoría del borrado | Queda registro con el detalle de la venta borrada | — | |

### K. Exportar historial

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | Abrir el menú y cerrarlo con clic afuera | Se cierra | — | |
| K02 | Excel **(§4)** | `Historial_Ventas_<fecha>.xlsx` con encabezados y filas (S10: los 5 de la raíz están vacíos) | ✓ | |
| K03 | PDF | `Historial_Ventas_<fecha>.pdf` con todas las ventas y varias páginas si hace falta | ✓ | |
| K04 | Cantidad del archivo = pantalla, con filtro de servicio y período **(§4)** | Iguales (S7/S10) | ✓ | |
| K05 | Venta de servicio eliminado (D10) y renombrado (D11) | Mismo nombre que en pantalla (S10) | ✓ | |
| K06 | N° de boleta | Debería estar en el archivo; hoy no (S10) | ✓ | |
| K07 | Columnas "Estado"/"Pagado" | La UI ya no las tiene — ¿se quitan del archivo? | — | |
| K08 | Admin "Todas" / una sede / secretaria | Solo la sede que corresponde | ✓ | |
| K09 | **Seguridad (S1)** **(§4)** | Nadie fuera de su sede ni sin sesión obtiene ventas | ✓ | |
| K10 | Tildes/ñ y nombres largos en el PDF | Legibles y cortados prolijamente | — | |
| K11 | Botón mientras exporta | Deshabilitado con spinner, sin cambiar de ancho | — | |
| K12 | La función falla | Toast de error; hoy solo `console.error` (S6) | — | |
| K13 | Fecha del nombre del archivo exportando después de las 21:00 | Fecha de Chile, no la de mañana (UTC) | — | |

### L. Cruce con Caja, Cuadratura, Reportes y Dashboard (ver 029)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| L01 | Venta de hoy → Caja Diaria **(§4)** | Fila "Servicio especial: <servicio> — <cliente>", con N° de boleta, total del día +$X | ✓ | |
| L02 | Columna en que cae el monto **(§4)** | Hoy en "otros" (tarjeta); con pago en efectivo el arqueo descuadra (S4) | — | |
| L03 | Cerrar la caja con una venta → Historial de Cuadraturas | El cierre incluye el monto en `total_income` | — | |
| L04 | Reportes Contables del mes **(§4)** | Incluye la venta (categoría "Psicotécnico / Servicios") — hoy no (S2) | ✓ | |
| L05 | PDF/Excel de Reportes Contables | Incluye la venta (S2) | — | |
| L06 | Dashboard "Ingresos mes" | Incluye la venta (S2) — o decisión explícita de excluirla | — | |
| L07 | Dashboard "Actividad reciente" | Aparece "Servicio Especial" con la venta | — | |
| L08 | Eliminar el ingreso de la venta desde Caja **(§4)** | ¿Qué pasa en Servicios Especiales? (S9) | — | |
| L09 | Venta de sede B no aparece en la Caja de sede A | Correcto | ✓ | |
| L10 | Caja abierta en otra sesión mientras vendes | ¿Aparece sin recargar? (S14) | — | |

### M. Sedes y roles

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | Admin "Todas" | KPIs e Historial suman ambas sedes | ✓ | |
| M02 | Admin cambia A → B **(§4)** | Recarga sola, solo esa sede | ✓ | |
| M03 | Cambio rápido A→B→A con Slow 3G | Termina en A sin datos de B (S13) | — | |
| M04 | Secretaria sin grant | Solo su sede | ✓ | |
| M05 | Secretaria con grant cambia de sede **(§4)** | Recarga sin salir de la pantalla (S13) | — | |
| M06 | Secretaria sin sede asignada | KPIs en 0 e Historial vacío, nunca todas las sedes | — | |
| M07 | **RLS** **(§4)** | La secretaria A no lee, crea ni borra ventas de B desde la consola (S5) | ✓ | |
| M08 | Catálogo por sede | ¿El catálogo es el mismo en ambas sedes? (S15) — decisión | — | |

### N. Tiempo real y 2 sesiones

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| N01 | 2 sesiones en la misma sede: vender en A **(§4)** | ¿Aparece en B sin recargar? Hoy no hay canal (S14) — anotar | — | |
| N02 | Admin desactiva un servicio mientras la secretaria vende | La secretaria ve error claro o la venta se guarda con nombre (ver F12) | — | |
| N03 | 2 personas borran la misma venta | La segunda recibe un mensaje claro, no un falso éxito | — | |

### O. Visual y accesibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| O01 | Modo oscuro y claro | Todo legible: badges, íconos de colores, modal rojo, menú de exportar | ✓ | |
| O02 | 375 / 768 / 1440 px | Sin scroll horizontal; en angosto pasa a tarjetas | ✓ | |
| O03 | Desktop con drawer abierto (contenedor < 850 px) | Cambia a tarjetas (switch por contenedor) | — | |
| O04 | Solo teclado | Se llega al toggle, botones y selects; foco visible | — | |
| O05 | Botones de solo ícono (lápiz, tacho) | Tienen `aria-label`; ¿tooltip? | — | |
| O06 | Animación de entrada | Sin parpadeos ni saltos | — | |

---

## 4. Casos con pasos numerados

### A07 — Error de carga visible

**Precondición:** sesión admin, primera visita de la sesión (recargar con F5 en otra pantalla).
1. DevTools → Network → "Offline".
2. Navegar a Servicios Especiales.
3. Ver qué muestra al terminar el skeleton.
4. Volver a "No throttling", salir y volver a entrar.

**Esperado:** en el paso 3 un mensaje de error (no "Todavía no hay servicios en el catálogo"). En
el paso 4 el catálogo carga. Si en el paso 4 sigue vacío hasta recargar, anotarlo (el facade ya se
marcó como inicializado). **Evidencia:** captura del paso 3.

### B02 — La venta mueve los 4 KPIs

**Precondición:** sede A elegida; anotar los 4 KPIs.
1. "Registrar Venta" → D1 → cliente externo → monto $15.000 → Registrar.
2. Sin recargar, comparar los 4 KPIs.

**Esperado:** Ventas del mes +1, Ventas Totales +1, Recaudación del mes +$15.000, Recaudación
Total +$15.000 y "N cobradas" +1. **Candidato Playwright** (ASG-i-031 §3).

### B05 / H06 — Venta después de las 21:00

**Precondición:** reloj del equipo en hora Chile; ejecutar después de las 21:00 (o cambiar la hora
del equipo a 21:30). Caja de hoy abierta.
1. Registrar una venta de $7.000. Anotar la fecha que muestra el drawer.
2. Abrir el Historial: anotar la fecha de la venta.
3. Abrir Caja Diaria: buscar la venta.
4. Si es el último día del mes, mirar "Ventas del mes".

**Esperado:** en los pasos 2 y 3 la fecha es la de hoy y la venta está en la Caja de hoy. Si
aparece con fecha de mañana y no está en la Caja, S3 confirmada.

### B07 — Más de 200 ventas

**Precondición:** D14 (> 200 ventas en la sede).
1. Anotar "Ventas Totales" y "Recaudación Total".
2. Contar las ventas reales (exportar Excel o preguntar al equipo de datos).
3. Registrar una venta nueva y volver a mirar "Ventas Totales".

**Esperado:** los KPIs coinciden con el total real y suben en 1. Si se quedan en 200, S7
confirmada.

### E04 — Renombrar un servicio con ventas

**Precondición:** D2 con al menos 1 venta.
1. Editar D2: cambiar el nombre a "Simulador (nuevo)".
2. Abrir el Historial: ver el nombre en las ventas antiguas.
3. Filtrar por "Simulador (nuevo)".
4. Exportar Excel y PDF y buscar esas ventas.

**Esperado:** en el paso 2 se ve el nombre que tenía al vender; en el paso 3 aparecen esas ventas;
en el paso 4 el nombre coincide con la pantalla (hoy sale el nombre nuevo, S10).

### F02 — Borrar un servicio con ventas lo desactiva

**Precondición:** D2 con ventas; anotar sus ventas en el Historial.
1. Tacho en D2 → leer el mensaje del modal → "Sí, borrar".
2. Verificar el toast "Servicio desactivado — Tenía ventas asociadas…".
3. Verificar que D2 desapareció de la lista y del select de "Registrar Venta".
4. Encender "Mostrar inactivos" → D2 atenuado con "Inactivo".
5. Abrir el Historial → las ventas de D2 siguen iguales.

### F05 — Eliminar definitivamente

**Precondición:** D3 (inactivo con ventas); toggle encendido.
1. "Eliminar definitivamente" en D3.
2. Verificar el modal: nombre del servicio, advertencia, botón deshabilitado, cursor en el campo.
3. Escribir `eliminar` → mensaje "Escribe exactamente…", botón deshabilitado.
4. Escribir `ELIMINAR` → clic en "Eliminar definitivamente".
5. Verificar toast "Servicio eliminado definitivamente" y que D3 ya no está ni con el toggle.
6. Abrir el Historial y la Caja del día de alguna de sus ventas.

**Esperado:** en el paso 6 las ventas siguen con el nombre de D3.

### F12 — Servicio eliminado con el drawer de venta abierto

**Precondición:** 2 navegadores (admin y secretaria de la misma sede); D4 activo.
1. Secretaria: "Vender" en D4, completar todo sin guardar.
2. Admin: borrar D4 (sin ventas → borrado real).
3. Secretaria: "Registrar Venta".

**Esperado:** error claro ("el servicio ya no existe") o venta guardada con nombre. Si el drawer
queda abierto sin mensaje, S6 confirmada.

### G09 — La marca "Alumno" queda pegada

1. "Registrar Venta" → elegir D1 (psicotécnico) → "Tipo de cliente" = Alumno.
2. Cambiar el servicio a D2 (desaparece "Tipo de cliente").
3. Completar y registrar.
4. Revisar la venta (Supabase / export: no hay columna; pedir a quien tenga acceso a la BD el
   valor de `is_student`).

**Esperado:** `is_student = false`. Si es `true`, S8 confirmada.

### G12 — RUT sin dígito verificador

1. En "RUT" escribir `12345678` (8 dígitos, sin DV).
2. Salir del campo (Tab).
3. Anotar el valor final.

**Esperado:** avisa que falta el DV o calcula `12.345.678-5`. Si queda `1.234.567-4`, S11
confirmada (el RUT del cliente queda mal en la boleta y en el export).

### H01 — Venta a cliente externo, punta a punta

**Precondición:** sesión secretaria sede A; Caja de hoy abierta.
1. "Vender" en D1 → cliente "María Núñez", RUT válido, Cliente externo, monto por defecto,
   boleta `4582`.
2. "Registrar Venta" → verificar "Registrando…" y que el drawer se cierra.
3. Verificar KPIs (como B02).
4. "Ver Historial" → la venta encabeza la lista con la boleta `4582`.
5. Caja Diaria → fila "Servicio especial: … — María Núñez" con N° boleta 4582.

**Evidencia:** captura de los pasos 4 y 5.

### H02 — Venta a un alumno

**Precondición:** D13; sesión del alumno disponible en otro navegador.
1. Registrar una venta de D1 con nombre y RUT de D13 y "Alumno de la escuela".
2. Abrir la ficha del alumno (pagos / historial).
3. Revisar las notificaciones del alumno.

**Esperado:** definir (§5). Hoy la venta no se vincula al alumno ni le notifica (S8).

### H04 — Error al guardar la venta

1. Abrir "Registrar Venta" y completar todo.
2. DevTools → "Offline".
3. "Registrar Venta".

**Esperado:** mensaje de error visible, drawer abierto con los datos. Si solo vuelve el botón a la
normalidad sin mensaje, S6 confirmada.

### H08 — Admin vende en "Todas las sedes"

**Precondición:** admin; anotar si su usuario tiene sede asignada.
1. Selector de sede → "Todas".
2. Registrar una venta de $3.000.
3. Elegir la sede A y luego la B: ¿dónde está la venta?
4. Abrir la Caja de cada sede.

**Esperado:** la pantalla avisa en qué sede queda o pide elegirla. Anotar dónde terminó; si no está
en ninguna sede (sede `null`), no aparece en ninguna Caja (S13).

### J01 — Borrar una venta de hoy

**Precondición:** D5; Caja de hoy abierta en otra pestaña.
1. Anotar KPIs y total de la Caja.
2. Historial → tacho en D5 → verificar el texto "¿Borrar la venta de "<servicio>" a <cliente>?…".
3. "Sí, borrar" → toast "Venta borrada".
4. Verificar que salió del Historial y que los KPIs bajaron.
5. Recargar la Caja → la fila ya no está y el total bajó.

### J02 — Venta de un día con caja cerrada

**Precondición:** D6.
1. Historial → período "Todo el historial" → tacho en D6 → "Sí, borrar".
2. Verificar toast de advertencia "No se pudo borrar — la caja del … ya está cerrada."
3. Verificar que la venta sigue y los KPIs no cambiaron.

### J09 — Seguridad: borrado directo por consola

**Precondición:** sesión secretaria sede A; id de D6.
1. Borrar una venta cualquiera no bloqueada y copiar desde Network la petición `DELETE
   /rest/v1/special_service_sales?id=eq.…` ("Copy as fetch").
2. En Console, pegarla cambiando el id por el de D6 y ejecutarla.
3. Repetir con el id de una venta de la sede B.

**Esperado:** ambas rechazadas. Si borra D6, el cierre de ese día queda descuadrado en silencio
(DG-065); si borra la de la sede B, S5 confirmada → **P0**.

### K02 / K04 — El Excel tiene datos y coincide con la pantalla

**Precondición:** sede A con ≥ 5 ventas de 2 servicios distintos, una con boleta.
1. Historial sin filtros, período "Todo el historial": anotar "N de M ventas".
2. Exportar Excel. Abrirlo.
3. Verificar que tiene encabezados (Cliente, RUT, Servicio, Monto, Estado, Pagado, Fecha, Sede) y
   M filas.
4. Filtrar por un servicio y "Últimos 12 meses"; anotar N; exportar de nuevo.

**Esperado:** paso 3 con datos (si sale vacío como los de la raíz, S10 confirmada → prioridad alta);
en el paso 4 el archivo respeta el filtro (hoy trae todo).

### K09 — Seguridad: exportar sin permiso (S1)

**Precondición:** sesión secretaria sede A.
1. Exportar Excel y copiar la petición `export-special-services` desde Network ("Copy as fetch").
2. En Console, ejecutarla con `branch_id: null` en el body.
3. Repetir con el id de la sede B.
4. Repetir quitando el header `Authorization` (o poniendo solo la clave anon).

**Esperado:** error 401/403 en todos, o como mínimo solo ventas de la sede A. Si trae otras sedes,
o si el paso 4 devuelve datos, S1 confirmada → **P0 inmediato** (nombres y RUT de clientes).

### L01 / L02 — La venta en Caja Diaria

**Precondición:** Caja de hoy abierta, arqueo activado, fondo inicial conocido.
1. Anotar total de ingresos, efectivo teórico y "otros".
2. Registrar una venta de $10.000 pagada en efectivo (pon los $10.000 en la caja física).
3. Recargar la Caja: verificar la fila y en qué columna quedó el monto.
4. Hacer el arqueo contando el efectivo real.

**Esperado:** la fila aparece con total +$10.000. Si el efectivo teórico no subió y el arqueo
muestra +$10.000 de diferencia, S4 confirmada.

### L04 — Reportes Contables incluye la venta

**Precondición:** mes con al menos una venta de servicio especial de monto conocido, en sede A.
1. Anotar la suma de ventas del mes en Servicios Especiales ("Recaudación del mes").
2. Abrir Reportes Contables del mes, sede A.
3. Buscar la categoría "Psicotécnico / Servicios" y el total de ingresos.
4. Comparar el total de ingresos con la suma de las Cajas del mes.

**Esperado:** la categoría existe con el monto del paso 1 y ambos totales cuadran. Si no aparece,
S2 confirmada.

### L08 — Revertir la venta desde Caja

1. Registrar una venta de $4.000.
2. Caja Diaria → eliminar ese ingreso → toast "Cobro revertido…".
3. Volver a Servicios Especiales: revisar KPIs e Historial.
4. Buscar una forma de volver a cobrarla.

**Esperado:** definir (§5). Hoy la venta queda "pendiente" sin forma de cobrarla ni de verlo en
pantalla (S9).

### M02 — Admin cambia de sede

**Precondición:** D8.
1. "Todas" → anotar KPIs y contador del Historial.
2. Sede A → anotar; sede B → anotar.

**Esperado:** recarga sola cada vez; Todas = A + B.

### M05 — Secretaria con grant multi-sede

1. Entrar a Servicios Especiales.
2. Cambiar la sede en el selector.
3. Registrar una venta con "Todas" seleccionado.

**Esperado:** los KPIs cambian en el paso 2 sin salir de la pantalla; en el paso 3 queda claro en
qué sede se registra (S13).

### M07 — RLS por sede

**Precondición:** sesión secretaria sede A; id de una venta de la sede B.
1. Copiar desde Network la petición `GET /rest/v1/special_service_sales…`.
2. En Console, ejecutarla cambiando `branch_id=eq.<A>` por `<B>` (o quitándolo).
3. Intentar un `PATCH` con `price` sobre la venta de B.

**Esperado:** 0 filas y el PATCH rechazado. Si no, S5 confirmada → **P0**.

### N01 — Dos sesiones

**Precondición:** 2 navegadores distintos en la misma sede, ambos en Servicios Especiales.
1. En A, registrar una venta.
2. En B, esperar 5 s sin tocar nada; luego salir y volver a la pantalla.

**Esperado:** anotar si aparece sin recargar (hoy no hay tiempo real, S14) y si aparece al volver
(SWR).

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| G19 / L02 | ¿La venta debe registrar medio de pago (efectivo, transferencia, tarjeta) para que la Caja cuadre? ¿En qué columna debe caer? |
| L04 / L06 | ¿Las ventas de servicios especiales deben sumar en Reportes Contables y en "Ingresos mes" del Dashboard? |
| H02 / G09 | ¿"Venta a alumno" debe elegir un alumno real (vínculo a su ficha y notificación) o basta con la marca? ¿Solo para psicotécnico/informe? |
| L08 / B06 | Si se revierte una venta desde Caja, ¿se borra, queda "pendiente" con botón para cobrarla, o no se debería poder revertir desde ahí? |
| M08 / D09 / E10 | ¿El catálogo y sus precios son comunes a las dos sedes o por sede? ¿La secretaria puede editarlos o solo admin? |
| H08 | ¿Admin puede vender en "Todas las sedes"? ¿A qué sede va la venta? |
| J03 | ¿Se puede borrar una venta de un día con la caja en borrador? |
| I10 | ¿Hace falta buscar por cliente o RUT en el Historial? |
| K04 / K07 | ¿El export debe respetar filtros y período? ¿Llevar boleta y quitar "Estado/Pagado"? |
| G13 | Si el RUT tiene un DV equivocado, ¿se corrige solo o se avisa? |
| D05 | ¿Se permiten 2 servicios con el mismo nombre? |
| H05 | ¿Debe haber toast de confirmación al registrar la venta? |
| E07 | ¿Hace falta editar la descripción de un servicio? |
