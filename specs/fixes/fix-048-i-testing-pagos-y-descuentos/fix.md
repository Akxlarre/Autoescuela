# Fix: Testing — Pagos, abonos y descuentos
> id: fix-048-i-testing-pagos-y-descuentos
> refs: ASG-i-028
> status: done
> closed: 2026-10-14
> created: 2026-10-13

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> **Checklist que se ejecuta:** `specs/testing-piloto/028-pagos-descuentos.md`.

## Root Cause

[Heredado de ASG-i-028, a confirmar]: Todo lo relacionado con dinero es P0: un saldo mal calculado
o un pago duplicado es un problema real con el cliente y con el alumno. Pagos se conecta con
matrícula (primer pago), ficha (saldo), cuadratura (caja del día), reportes, dashboard y
notificaciones financieras.

**Clasificación:** Integración/E2E · dificultad Alta · rutas: `/app/{admin,secretaria}/pagos` +
drawer "Registrar pago" desde la ficha.

### Alcance confirmado al reclamar (Ignacio, 2026-10-13)

Las 3 capas de la ASG entran en este track:

1. **Funcional** — ACs de `fix-058-b` (pago con múltiples matrículas), `fix-197-m` (descuentos
   predefinidos), guard `check_payment_within_pending_balance` (fix-h024), `ASG-m-003` (N° de
   boleta), `ASG-m-005` (filtros), spec `0025-b` (notificaciones financieras).
2. **E2E manual** — los casos A…Q del checklist, incluidas las sospechas abiertas.
3. **Playwright** — candidatos "Auto ✓" (abono → saldo de la ficha, sobrepago rechazado,
   concurrencia con 2 contextos).

**Supuestos confirmados por Ignacio al reclamar:**

1. **El checklist (2026-09-29) se actualiza antes de ejecutar.** Las sospechas ya resueltas por
   otros tracks se ejecutan como regresión, no como sospecha; y se agregan casos de lo que se
   construyó después: anulación de pagos (`0025-m`), desbloqueo de la clase 7 al pagar y
   "Registrar pago" desde Asistencia (`0010-i`), medio de pago de servicios especiales
   (`fix-047-i`).
2. **Pruebas en la BD compartida del piloto solo con alumnos `QA-TEST`.** Los pagos de prueba se
   revierten con "Anular" (`0025-m`). Lo que se pueda comprobar con SQL en sub-bloques que abortan
   (sin dejar datos), se comprueba así.
3. **Seguridad entre sedes (S5, O07, O08)** con SQL simulando el JWT de una secretaria, como en
   `supabase/tests/rls/0010-i-bloqueo-clase7.sql`.

**Sospechas ya resueltas por otros tracks** — se ejecutan como regresión (a confirmar):

| Sospecha | Track |
|---|---|
| S1 — guard anti-sobrepago sin `FOR UPDATE` (concurrencia) | `fix-045-i` (migración `20261010140000`) |
| S2 — doble envío con Enter en "Registrar pago" | `fix-045-i` (guard de doble envío) |
| S3 — eliminar un ingreso en Cuadratura descuadra el saldo | `fix-044-i` (trigger de saldo en DELETE, caja cerrada) + `0025-m` (anular en vez de borrar) |
| S4 — fecha UTC del pago de matrícula | Código ya usa `todayIso()` (`enrollment-payment.facade.ts`); origen a identificar |

**Siguen abiertas (a ejecutar):** S5–S20.

**Orden de ejecución por bloques (propuesto, se ajusta al actualizar el checklist):**

| Bloque | Secciones | Contenido |
|---|---|---|
| 0 | — | Actualizar el checklist (resueltas, casos nuevos de `0025-m` / `0010-i` / `fix-047-i`) |
| 1 | O, S5, S11 | Seguridad: RLS por sede de `payments`, reporte PDF |
| 2 | F–H, S1–S3 | Registrar pago: apertura, validaciones, resultado, sobrepago, concurrencia |
| 3 | A–E, I–K | Carga, KPIs, lista, filtros, paginación, Estado de Cuenta, Pagos Recientes, PDF |
| 4 | L–N | Descuentos (configuración y matrícula) y notificaciones |
| 5 | P–Q | Tiempo real, verificación cruzada con Cuadratura (`ASG-i-029`) y visual |

### Fuera de alcance

- Webpay / pago online del alumno (bloqueado en el piloto).
- El wizard de matrícula por dentro (`ASG-i-023`); acá solo el paso de pago y sus descuentos.
- La cuadratura/cierre de caja por dentro (`ASG-i-029`); acá solo la verificación cruzada.

## ACs Afectados

Ninguno — track de testing. Cada ❌ abre su propio fix/hotfix con sus ACs.

## Cambio

- **Archivo:** `specs/testing-piloto/028-pagos-descuentos.md` (actualización del checklist) y este
  `fix.md` (resultados). Sin cambios de código de producción en este track.

## Test de Regresión

- La ejecución del checklist es la evidencia: cada caso con ✅ / ❌ y su evidencia en "Resultados".

## Resultados

### Progreso

- [x] Bloque 0 — checklist actualizado (2026-10-14): S1–S4 como regresión, secciones R
      (anulación vista desde Pagos) y T (Pagos y el bloqueo de la clase 7); `fix-047-i` fuera.
      Hallazgo al preparar: **S5 ya cerrada** por `0047-b` (`20261001150000_rls_aislamiento_por_sede`)
      → se ejecuta como regresión.
- [x] Bloque 1 — seguridad (2026-10-14): 8/8 ✅ + 2 preguntas → **1 bug** (B1-1).
- [x] Bloque 2 — Partes A, B y C (2026-10-14) → **4 bugs** (B2-1, B2-2, B2-3, B2-4).
- [x] Bloque 3 (2026-10-14) → **B3-1 (alta)**, B3-2, B3-3, B3-4, B3-5 (bajas).
- [x] Bloque 4 (2026-10-14) → **B4-3 (alta)**, B4-1, B4-2, B4-4.
- [x] Bloque 5 (2026-10-14) → B5-1 (baja). **Testing completo: 16 bugs.**

### Bloque 1 — Seguridad de pagos entre sedes (2026-10-14)

Test `supabase/tests/rls/fix-048-i-b1-seguridad-pagos.sql`, corrido por Ignacio en el piloto con
el JWT simulado de `secretaria@test.com` (sede A) y `secretaria2@test.com` (sede B); no deja datos.

| Caso | Resultado | Evidencia |
|---|---|---|
| Secretaria A sin permiso de ambas sedes (control) | ✅ | `auth_can_access_both_branches()` = false |
| O07 / S5 — A lee pagos de la sede B | ✅ | 0 filas (RLS de `0047-b`) |
| O07 control — A lee un pago de su sede | ✅ | 1 fila |
| O08 / S5 — A inserta un pago en una matrícula de B | ✅ | rechazado |
| O08 control — A inserta en su sede | ✅ | insertó |
| O09 — A modifica un pago de la sede B | ✅ | 0 filas |
| O09 — A sube en $1.000.000 el monto de un pago **de su sede** | ❌ **B1-1** | permitido |
| O09 — A pasa un pago de su sede a `pending` | ❌ **B1-1** | permitido |
| Regresión `0025-m` — A intenta anular | ✅ | `ANULAR_SOLO_ADMIN` |
| Regresión — A intenta borrar un pago de su sede | ✅ | no borra |

**S5: cerrada** (regresión ✅). **S11** (reporte PDF): `requireStaff` + el cliente de la función
viaja con el JWT del usuario, así que la RLS por sede acota lo que ve una secretaria; se confirma
en navegador en el Bloque 3 (K).

**B1-1 — La secretaria puede modificar monto y estado de los pagos de su sede (por consola).**
La policy `update_payments` (`0047-b`) deja a la secretaria hacer UPDATE de cualquier columna de
los pagos de su sede, y el guard anti-sobrepago es solo `BEFORE INSERT`. Consecuencias:
(a) subir el monto de un pago ya registrado salta el tope de sobrepago y deja el saldo negativo;
(b) pasar un pago a `pending` lo saca del saldo sin dejar rastro de anulación (esquiva el control
"solo el admin anula, con motivo" de `0025-m`). **La app nunca hace UPDATE de pagos salvo la
anulación del admin** (`cuadratura.facade.ts:620`), así que el permiso de la secretaria no lo usa
ninguna pantalla. → Va a su propio fix (propuesto: `fix-049-i`).

### Bloque 2 · Parte A — "Registrar pago": apertura y validaciones (2026-10-14)

Playwright como `secretaria@test.com` en `/app/secretaria/pagos` y la Caja, con **todo
POST/PATCH/DELETE a `payments` interceptado** (no se escribió nada en la BD).

| Caso | Resultado | Evidencia |
|---|---|---|
| F01 — "Registrar pago" de una fila | ✅ | Alumno fijo + "Saldo pendiente $180.000", sin selector |
| F02 — botón del encabezado | ✅ | Selector de alumno con buscador |
| F04 — "Agregar Ingreso" desde la Caja, abierto apenas aparece el botón (S8) | ✅ | Primero esqueleto, luego selector; sin alumno "Guardar Pago" queda deshabilitado → **S8 (2ª parte) no se reproduce** |
| F05 — acción rápida del Dashboard | — | Mismo componente y modo global que F04; no se ejecutó aparte |
| F06 — hero después de una fila | ✅ | No arrastra al alumno anterior |
| F07 — fila X y luego fila Y | ✅ | Muestra a Y, sin datos de X |
| F08 — buscar con tilde, sin tilde, por RUT | ✅ | Encuentra en los 3 casos |
| F09 — alumno con 2 matrículas con deuda (S7) | ❌ **B2-1** | "Matricula Completa Prueba Wizard — 99.123.457-8" aparece **2 veces idéntica** en el selector |
| F10 — tarjeta "Seleccionado" | ✅ | Nombre, RUT, saldo y pagado |
| F13 — Cancelar y reabrir | ✅ | Cierra; al reabrir, monto/desglose/documento vacíos |
| G01 — guardar vacío | ✅ | "Guardar Pago" deshabilitado al abrir |
| G02 — fecha por defecto | ✅ | 14/10/2026 (hoy en Chile) |
| G03 — fecha futura | pregunta | `app-date-input` sin límite: se permite — decisión de negocio |
| G06 / G07 — monto 0 / negativo | ✅ | "Ingresa un monto válido mayor a 0.", deshabilitado |
| G08 — monto con decimales (S14) | ❌ **B2-2** | $1.000,5 habilita "Guardar" y se envía `total_amount: 1000.5` a una columna INTEGER; la secretaria ve el genérico "Error al guardar. Intenta de nuevo." |
| G09 — letras / "e" | ✅ | Letras no entran; "1e3" = 1000 |
| G10 — monto > saldo | ✅ | "El monto excede el saldo pendiente ($180.000).", deshabilitado |
| G11 — saldo + $0,4 | ❌ **B2-2** | Mismo caso que G08 (decimales aceptados en el formulario) |
| G12 — monto = saldo | ✅ | Habilitado |
| G13 — desglose que no suma / excede | ✅ | "Faltan $5.000 por asignar…" / "El desglose excede el total en $5.000", deshabilitado |
| G14 — desglose que cuadra | ✅ | "Los montos cuadran correctamente" |
| G15 — medio negativo que compensa | ✅ (con detalle) | No deja guardar, **pero muestra "Los montos cuadran correctamente"** — mensaje contradictorio (menor, va con B2-2) |
| G16 — solo total, sin desglose | ✅ | "Faltan $10.000 por asignar a un método" |
| G17 — sin N° documento | ✅ | Se puede guardar |
| G19 — documento largo/raro (319 caracteres, `<b>`, comillas) | ✅ | No rompe el formulario |
| G20 — campo "WebPay" para la secretaria | pregunta | Visible en el pago presencial — decisión de negocio |

Quedan para las Partes B/C: F03, G04, G05, G18 y H01–H17.

**B2-1 — Alumno con 2 matrículas con deuda: dos opciones idénticas en el selector (S7).** Es
fácil imputar el abono a la matrícula equivocada. → su propio fix.

**B2-2 — El formulario de pago acepta montos con decimales (S14).** Se envían a una columna
INTEGER y el error que ve la secretaria es genérico. Incluye el mensaje contradictorio de G15.
→ su propio fix.

### Bloque 2 · Parte B — reglas de la BD al registrar un pago (2026-10-14)

Test `supabase/tests/rls/fix-048-i-b2-registrar-pago-bd.sql`, corrido por Ignacio en el piloto
como `secretaria@test.com` (JWT simulado); no deja datos.

| Caso | Resultado | Evidencia |
|---|---|---|
| H03 — sobrepago (saldo + $1) por consola | ✅ | rechazado |
| G12 / H02 — pago exacto al saldo | ✅ | insertó, saldo 0 |
| G04 — pago con fecha de un día con caja cerrada (2026-08-27) | ❌ **B2-3** | permitido |
| B2-2 — monto 1000.5 como llega por la API | confirma B2-2 | `invalid input syntax for type integer: "1000.5"` → la UI lo muestra como "Error al guardar" |
| H11 — un pago `pending` no baja el saldo | ✅ | saldo 180.000 = base − descuento − pagos `paid` |
| H14 — auditoría del INSERT con la secretaria como autora | ✅ | 1 fila en `audit_log` con su `user_id` |
| H15 — `payments.registered_by` | pregunta | vacío: el autor queda solo en la auditoría — decisión de negocio |

**B2-3 — Se puede registrar un pago con fecha de un día cuya caja ya está cerrada.** El cierre
guarda totales congelados (DG-065), así que ese pago nunca entra a ningún cierre y la Caja no
cuadra con Pagos ni con Reportes. `fix-044-i` bloqueó **borrar** movimientos de días cerrados y
`0025-m` bloqueó **anularlos**, pero no **agregarlos**. En la UI, "Fecha de pago" no tiene límite
(G03), así que basta elegir una fecha vieja. → su propio fix (mismo criterio y token
`CAJA_CERRADA` que `guard_movimiento_caja_cerrada`).

### Bloque 2 · Parte C — pagos reales y su reflejo (2026-10-14)

Playwright con escrituras **reales** en el piloto. Matrícula de prueba 6363 ("Matricula Completa
Prueba Wizard", sede Autoescuela Chillán, saldo $180.000). Pagos de prueba con N° documento
`QA-048-*`; **los 3 quedaron anulados** al final por `admin@test.com` desde la Caja del día
(motivo "Prueba fix-048-i (ASG-i-028): pago de testing").

| Caso | Resultado | Evidencia |
|---|---|---|
| H01 — abono parcial $10.000 efectivo (secretaria, desde la fila) | ✅ | Drawer cerrado; 6363 pagado $10.000 / saldo $170.000; "Ingresos Hoy" $10K; en Pagos Recientes "Abono · Efectivo · QA-048-H01" |
| H10 — alumno con 2 matrículas, pago desde la fila de una | ✅ | Solo cambió la 6363; la 6248 (mismo alumno) siguió en $180.000 |
| H05 — doble clic en "Guardar Pago" ($2.000 transferencia) | ✅ | 1 solo POST (201) |
| H06 — Enter dos veces en N° documento ($3.000 tarjeta) | ✅ | 0 POST: Enter no envía el formulario → sin duplicado. **S2 cerrada** |
| H12 — mixto $3.000 (1.000 efectivo + 1.000 transf. + 1.000 tarjeta) | ✅ | Caja del día: total $15.000, **efectivo $11.000** (10.000 + 1.000): solo el efectivo entra al arqueo |
| H13 — método en Pagos Recientes | ✅ | "Efectivo", "Transferencia", "Mixto" |
| Saldo acumulado | ✅ | 6363: pagado $15.000 / saldo $165.000 |
| R01 — anular los 3 (admin, Caja) y abrir Pagos | ✅ | "Ingresos Hoy/Mes" $0; 6363 vuelve a $180.000 / pagado $0; Caja "0 ingresos · 3 anulados", tachados con motivo, autor y hora |
| R02 — Pagos Recientes / Estado de Cuenta con anulados | ✅ (PDF pendiente, Bloque 3) | Los 3 aparecen "anulado" con el motivo |
| Estado de Cuenta — pie del historial | ❌ **B2-4** | "4 pago(s) registrado(s) · Total: $180.000" mientras arriba dice "Pagado $0" |

No ejecutados aquí: F03 (Estado de Cuenta → Registrar Pago), G05 (concepto en todas las vistas,
S18), H09, H16 (falla de red), H17 (clase 7, va con la sección T).

**B2-4 — El pie del historial del Estado de Cuenta suma lo que no está pagado.** "Total: $180.000"
incluye el pago `pending` de "Cobrar después" (sin fecha) y el conteo "4 pago(s) registrado(s)"
incluye los 3 anulados, mientras el encabezado dice "Pagado $0". Se puede leer como que el alumno
pagó $180.000. Menor, pero de dinero. → su propio fix (o junto a B2-1, misma pantalla de Pagos).

### Bloque 3 — lista, KPIs, Estado de Cuenta, Pagos Recientes, PDF (2026-10-14, en curso)

Playwright como `admin@test.com` (sede Autoescuela Chillán), **sin escrituras** (los guardados se
interceptan).

| Caso | Resultado | Evidencia |
|---|---|---|
| A01 — carga admin | ✅ | Sin 4xx/5xx contra Supabase |
| A08 — app-like en desktop | ✅ | El documento no scrollea |
| B04 — "Pagos Pendientes" | ✅ | $3,6M = suma de los 26 saldos |
| B07 — formato compacto | ✅ | "$3.6M", "$10K", "$0" |
| C05 — orden de mayor a menor saldo | ✅ | |
| C06 — columnas | ✅ | Alumno, RUT, Fecha matrícula, Total a pagar, Pagado, Saldo, Acciones |
| C08 — pagado + saldo = total en cada fila | ✅ | 26/26 |
| C09 — las 2 matrículas de un alumno (S7) | ❌ **B2-1** | Mismo nombre, RUT y fecha de matrícula: filas indistinguibles |
| C15 — saldos negativos en BD | ✅ | Ninguno |
| E01 / E02 — paginación | ✅ | 10 por página; 1-10, 11-20, 21-26; "Siguiente" deshabilitado al final |
| I01 / I03 / I05 — Estado de Cuenta | ✅ | Nombre, RUT, curso, email, teléfono, badge; Total/Pagado/Saldo; historial con estado |
| I07 — total del historial = "Pagado" | ❌ **B2-4** | (ya registrado) |
| I08 — abrir el detalle de X y luego el de Y | ❌ **B3-1 (ALTA)** | ver abajo |
| D01 / D02 / D07 — filtros desde, hasta y combinados | ✅ | Desde 01-10 → 2; hasta 07-09 → 24; Clase B + 05-10 → 2 |
| D05 — curso | ✅ | "Profesional" → 0 (no hay deudores Profesional en la sede) |
| D08 — "Limpiar filtros" | ✅ | Visible solo con filtros; resetea los 3 y vuelve a la página 1 |
| D09 — filtro con 0 resultados | ❌ **B3-2** | La lista queda con los encabezados y sin mensaje |
| D10 — filtrar estando en la página 3 (con clics) | ✅ | Vuelve a la página 1 |
| J01 / J03 — Pagos Recientes | ✅ | Lista de 50; "Sin pagos registrados este mes." cuando el mes solo tiene anulados |
| J04 — búsqueda por alumno y N° boleta | ❌ **B3-3** | N° boleta y nombre ✅, pero **no ignora tildes ni ñ**: "munoz" no encuentra "Muñoz" (el selector de "Registrar pago" sí las ignora) |
| J05 — filtro de estado | ✅ | Completado / Pendiente / Anulado |
| J06 — filtro por método | ✅ | "Mixto" → solo el pago mixto |
| K01 / K02 — modal y descarga del PDF | ✅ | 01-10 a hoy, sede del topbar; `Reporte_Pagos_2026-10-01_2026-10-14.pdf`; toast "Reporte generado" |
| K03 — contenido del PDF | ✅ con detalle | Totales = pantalla ($0 recaudado, 26 alumnos, $3.600.000); anulados marcados "ANULADO" y sin sumar (R02 ✅). Pero **"0 completados" siempre** → **B3-5** |
| K08 — caracteres especiales en el PDF | ❌ **B3-4** | "N° Doc" sale "N? Doc"; "Chillán", "Método" salen sin tilde |
| K11 / S11 — secretaria pide el reporte de otra sede / de todas | ✅ | Otra sede → vacío (0 pagos, aunque la sede tiene pagos: lo bloquea la RLS); "todas" → solo su sede. **S11 cerrada.** (Detalle: el encabezado dice "Todas las escuelas" igual.) |
| A03 — secretaria escribe la URL de admin | ✅ | Redirige a su dashboard |

No ejecutados: A02 completo, A04, A07 (red cortada), B01/B03 cruzado con la Caja (sin pagos
vigentes en el mes), I02 (no hay deudores con descuento), I04 (exige saldar una deuda real),
I09, J02 (sin pagos en el mes), K04–K07, K09, K10, E03–E06 (responsive/oscuro van al Bloque 5).

**B3-2 — Filtro sin resultados: lista en blanco, sin mensaje.** Baja.
**B3-3 — La búsqueda de Pagos Recientes no ignora tildes ni ñ.** Baja.
**B3-4 — El PDF pierde caracteres especiales** ("N? Doc", sin tildes). Baja. Revisar cómo sale
un nombre con ñ.
**B3-5 — El PDF dice siempre "0 completados".** `generate-payment-report` cuenta
`estado === 'completado'`, pero los pagos se guardan `status = 'paid'`. Baja.

**B3-1 — ALTA: con el Estado de Cuenta abierto, "Ver detalle" de otro alumno deja la pantalla
con el alumno anterior y un pago se imputa al alumno equivocado.** Reproducido con clics reales
(la lista sigue visible y clickeable con el drawer abierto): detalle de "Alumno87" abierto →
"Ver detalle" de "Alumno79" → la pantalla **sigue mostrando a Alumno87**, pero el facade queda
con la matrícula de Alumno79 seleccionada. "Registrar Pago" desde ese detalle muestra
"ALUMNO Alumno87", y al guardar **el POST va a la matrícula 2749 = Alumno79** (interceptado, no se
escribió). Pasó en 3 de 3 intentos. Causa probable: `layoutDrawer.open()` con el mismo componente
no re-crea el drawer, así que `AdminPagoDetalleDrawerComponent.ngOnInit()` (que carga el Estado de
Cuenta) no vuelve a correr, mientras `seleccionarEnrollment()` sí cambia la selección. El mismo
drawer se usa desde Pagos de la secretaria. → **su propio fix, prioridad alta** (no requiere
consola: es un flujo normal de la pantalla).

### Bloque 4 — descuentos y avisos (2026-10-14, en curso)

**Navegador** (admin y secretaria; todo PATCH/POST a `discounts` interceptado):

| Caso | Resultado | Evidencia |
|---|---|---|
| L01 — admin: Ajustes → Administrar Descuentos | ✅ | Lista con "Descuento Padre Hurtado" y "Promoción fin de agosto" |
| L02 — secretaria | ✅ | Su pestaña "Ajustes" no tiene la tarjeta de Descuentos |
| L06 — formato del monto fijo | ✅ | "$30.000 · Clase B · Todas las sedes" |
| L09 — nombre vacío / valor 0 / negativo | ✅ | "Guardar" deshabilitado |
| L10 — 101 % | ✅ | "Un porcentaje no puede superar 100%." |
| L11 — 12,5 % | ❌ **B2-2** | "Guardar" habilitado (mismo problema de decimales que en Pagos) |
| L13 — "hasta" (01-11) antes de "desde" (01-12) | ❌ **B4-1** | "Guardar" habilitado; se enviaría `valid_from 2026-12-01, valid_until 2026-11-01` |
| L14 — "Vigente desde" por defecto | ✅ | 14-10-2026 (probado antes de las 21:00; el caso nocturno de S17 no se pudo probar) |
| L15 — editar | ✅ | Precarga nombre, valor y fechas |
| L16 — desactivar | ✅ | PATCH `{status: inactive}`; si falla, sigue "Activo" y toast de error |
| L19 — sin botón Eliminar | ✅ | Solo "Editar" / "Desactivar" |

**Código** (`enrollment-payment.facade.ts`, paso de pago de la matrícula):

| Caso | Resultado | Evidencia |
|---|---|---|
| M06 — % con "Pago parcial 50%" (S12) | pregunta | `applyPredefinedDiscount`: el % se calcula sobre `amountDue` (la mitad), no sobre el precio: 10 % de $180.000 en abono = $9.000 — decisión de negocio |
| M05 — descuento que deja $0 (S12) | ver SQL fila 4 | `totalToPay = max(0, …)` → se inserta un pago de $0 |
| N04 — "Cobrar después" (S9) | ❌ **B4-2** | `recordPayment()` llama `notifyPaymentRegistered(enrollmentId, total)` también con método `pendiente`: el alumno recibe "Se registró un pago de $X" sin haber pagado |
| N02 — formato del monto (S9) | ❌ **B4-2** | Mensaje `Se registró un pago de $${amount}` sin separador de miles (igual en `pagos.facade.ts`) |
| M12 — reintentar el paso de pago como secretaria (S13) | ver SQL filas 5–7 | `recordPayment()` borra el pago anterior y **solo revisa `error`**: si la RLS filtra el DELETE sin error, inserta un segundo pago |

**B4-1 — Un descuento puede quedar vigente "hasta" antes de "desde".** Baja (el descuento nunca
aparece, pero no avisa). Confirmado: ni el formulario ni la BD lo frenan.
**B4-2 — Aviso "Pago registrado" falso con "Cobrar después" y monto sin formato (S9).** Media.

**SQL** — `supabase/tests/rls/fix-048-i-b4-descuentos-y-avisos.sql`, corrido por Ignacio en el
piloto (no deja datos; las filas 7–9 solo leen):

| Caso | Resultado | Evidencia |
|---|---|---|
| L03 — secretaria crea un descuento por consola | ✅ | rechazado |
| L13 — "hasta" antes de "desde" | ❌ **B4-1** | La BD también lo permite |
| L11 — 12,5 % por la API | confirma B2-2 | `invalid input syntax for type integer: "12.5"` → error genérico |
| M05 — pago de matrícula de $0 (descuento 100 %) | ❌ **B4-4** | `violates check constraint "chk_positive_amount"`: una matrícula becada al 100 % no se puede confirmar y el error que ve la secretaria es genérico |
| S13 — secretaria borra el pago de matrícula anterior | ❌ **B4-3** | "sin error, 0 filas borradas" |
| S13 — secretaria borra los descuentos aplicados | ❌ **B4-3** | "sin error, 0 filas borradas" |
| S13 — matrículas con más de un pago de matrícula vigente | ❌ **B4-3** | 1: la **7003** (los 2 pagos `pending` vistos al inicio de la sesión) |
| N01 / N02 / N04 — avisos del alumno de la 6363 | ❌ **B4-2** | "Se registró un pago de $180000" (es el "Cobrar después", no pagó nada) + $10000 / $2000 / $3000 de los pagos de prueba; **sin separador de miles** |
| N03 — avisos de pago a admin/secretaria | ✅ | 0 |

Observación (no bug de este checklist): el alumno recibió "Pago registrado" por los 3 pagos de
prueba que después se anularon, y la anulación no le avisa nada — revisar en `0025-m` si se quiere
avisar la anulación.

**B4-3 — ALTA: reintentar el paso de pago de la matrícula como secretaria duplica el pago (S13
confirmada).** `recordPayment()` borra el pago y los descuentos anteriores antes de reinsertar y
solo revisa `error`; la RLS deja a la secretaria sin DELETE en `payments` y `discount_applications`,
y PostgREST responde **sin error y con 0 filas**, así que el código sigue e inserta otro pago (y
otro descuento aplicado). Evidencia real: matrícula 7003 con 2 pagos de matrícula. Con un abono
`paid` el saldo bajaría dos veces por un solo cobro (el tope de sobrepago solo lo frena si el
segundo excede el saldo). `fix-362-m` agregó el chequeo de `error`, no el de filas
(`assertWriteOk({ requireRows: true })` o RPC). → su propio fix, prioridad alta. (Además: limpiar
la 7003.)

**B4-4 — Una matrícula con descuento del 100 % no se puede confirmar (S12).** El pago de $0 choca
con `chk_positive_amount` y la secretaria ve un error genérico. Decisión de negocio pendiente:
¿se permiten matrículas becadas al 100 %? Si sí, no hay que insertar pago; si no, bloquear el
descuento con un mensaje claro. Media.

### Bloque 5 — tiempo real, cruces y visual (2026-10-14)

| Caso | Resultado | Evidencia |
|---|---|---|
| P01 — 2 pestañas: pago de $1.000 en A (QA-048-P01) | ✅ | B se actualizó sola en ~1 s: "Ingresos Hoy" $1.000, saldo 6363 $179.000 → **S10 cerrada** |
| P08 — Reportes Contables con ese pago | ✅ | "Total Ingresos $1.000" = Pagos |
| P07 — Dashboard | — | El dashboard del admin es el ejecutivo (gráfico mensual), sin KPI comparable; no se comparó |
| Limpieza | ✅ | QA-048-P01 anulado por admin desde la Caja ("0 ingresos · 4 anulados", efectivo $0) |
| Q01 — modo oscuro (lista y "Registrar pago") | ✅ | Todo legible |
| Q02 — 375 px | ✅ | Sin scroll horizontal; tarjetas y "Cargar más (21 restantes)" |
| E05 — lista con el drawer abierto | ✅ con detalle | Lista compacta (Alumno, Saldo, botones) → ver B5-1 |
| Q01 — desktop 1280 | ❌ **B5-1** | El RUT ("99.123.457-" / "8") y la fecha de matrícula se parten en 2 líneas |

No ejecutados: P02/P03 (cierre del canal), P04/P05 (reemplazados por la anulación, sección R),
P06, Q03–Q05 (teclado, lectores de pantalla, animaciones).

**B5-1 — Detalles visuales de la lista de Pagos.** RUT y fecha partidos en 2 líneas en 1280 px;
con el drawer abierto los filtros de fecha quedan como cajas vacías sin su texto. Baja.

## Resumen del testing (2026-10-14)

**Sospechas cerradas por regresión:** S1, S2, S3, S4, S5, S10, S11 (y S8 2ª parte no se reproduce).

| Prioridad | Bugs |
|---|---|
| **Alta** | B3-1 (pago al alumno equivocado por el Estado de Cuenta que no recarga), B4-3 (reintentar el paso de pago duplica el pago de matrícula), B1-1 (secretaria modifica monto/estado de pagos por consola), B2-3 (pago con fecha de un día con caja cerrada) |
| Media | B2-1 (2 matrículas indistinguibles), B4-2 (aviso de pago falso con "Cobrar después" + monto sin formato), B4-4 (matrícula con 100 % de descuento no confirma — decisión de negocio) |
| Baja | B2-2 (decimales en montos y descuentos), B2-4 (pie del Estado de Cuenta), B3-2 (filtro sin resultados en blanco), B3-3 (búsqueda sin tildes), B3-4 (PDF sin caracteres especiales), B3-5 (PDF "0 completados"), B4-1 (descuento con "hasta" < "desde"), B5-1 (detalles visuales) |

**Preguntas de negocio:** G03 fecha de pago futura, G20 WebPay en pago presencial, H15
"registrado por", M06 % sobre el abono o sobre el total, B4-4 matrículas becadas al 100 %.
