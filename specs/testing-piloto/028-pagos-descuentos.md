# Testing — Pagos, abonos y descuentos

> **Asignación:** `ASG-i-028` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/app/admin/pagos`, `/app/secretaria/pagos`
> **Incluye:** lista "Alumnos con saldo pendiente" (filtros, paginación, KPIs del hero), drawer
> "Registrar Pago" (desde la lista, desde "Estado de Cuenta", desde Cuadratura → "Registrar
> Ingreso" y desde el dashboard de secretaria → acción rápida), drawer "Estado de Cuenta", drawer
> "Pagos Recientes" (métodos de pago del mes), modal "Generar Reporte" (PDF), CRUD de Descuentos
> Predefinidos (Ajustes → Descuentos, solo admin), aplicación de descuentos en el paso de pago de
> la matrícula, triggers/RLS de `payments` y `enrollments`, notificación "Pago registrado".
> **No incluye:** el wizard de matrícula por dentro (ver `023-matricula-presencial.md`; acá solo
> el paso de pago y sus descuentos), la cuadratura/cierre de caja por dentro (ver
> `029-contabilidad.md`; acá solo la verificación cruzada), pago online del alumno / Webpay
> (bloqueado en el piloto).
>
> **Código leído para armar esta lista:**
> `features/admin/pagos/{admin-pagos,registrar-pago-drawer,admin-pago-detalle-drawer,pagos-recientes-drawer}.component.ts`,
> `features/secretaria/pagos/secretaria-pagos.component.ts`,
> `features/admin/configuracion-descuentos/descuentos-drawer.component.ts`,
> `shared/components/ajustes-drawer/` (acceso a Descuentos), `shared/components/matricula-steps/payment/payment.component.ts`,
> `features/admin/alumno-detalle/components/historial-pagos/`,
> `features/{admin,secretaria}/contabilidad-cuadratura/*.component.ts` (apertura del drawer y
> eliminar ingreso), `features/secretaria/dashboard/secretaria-dashboard.component.ts` (acción rápida),
> `core/facades/{pagos,discounts,enrollment-payment,cuadratura,admin-alumno-detalle}.facade.ts`,
> `core/models/ui/{pagos,discount}.model.ts`, `core/utils/{date,payment-concept}.utils.ts`,
> `supabase/functions/generate-payment-report/`,
> migraciones `20260301000005` (tabla `payments`), `20260301000008` (trigger `trg_update_balance`),
> `20260301000011` + `20260303120000` (RLS), `20260723010000_fix_h024_*` (guard de saldo),
> `20260723020000_fix_h027_*` (RLS enrollments), `20260821150000_fix197_*` (descuentos),
> `20260618130000_rpc_confirm_enrollment_with_payment.sql`, `20260827160000_enable_realtime_students_payments.sql`.
> Tracks de referencia: `fix-058-b`, `fix-114-m` (ASG-b-063), `fix-135-m`, `fix-197-m`, `fix-248-m`
> (ASG-m-005), `fix-036-i` (ASG-m-003), spec `0025-b`, `docs/UAT-PLAN.md` Paquete 4.

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-028`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S20)** salen de leer el código, **no están confirmadas** en navegador.
  Confirmarlas o descartarlas es parte del trabajo.
- **Todo pago que registres acá, verifícalo también en la Cuadratura del día** (coordinar con
  `ASG-i-029`). Anota monto, medio y hora de cada pago de prueba para poder cuadrar.
- Trabaja siempre con alumnos de prueba (prefijo `QA-TEST`), nunca con alumnos reales: los pagos
  no se pueden anular desde Pagos y el borrado desde Cuadratura tiene problemas (S3).

---

## 1. Sospechas de bug encontradas en el código

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **El guard anti-sobrepago no es seguro ante concurrencia.** El trigger `BEFORE INSERT` lee `pending_balance` con un `SELECT` simple (sin `FOR UPDATE`). Dos pagos simultáneos que individualmente caben en el saldo (ej. saldo $100.000, dos abonos de $60.000 desde 2 sesiones) pueden pasar ambos el chequeo → saldo negativo. `fix-114-m` resolvió el *lost update*, no este caso; la UAT solo probó "pagar el saldo completo y luego un segundo pago" (secuencial). | `supabase/migrations/20260723010000_fix_h024_payments_exceed_pending_balance_guard.sql` (función `check_payment_within_pending_balance`: `SELECT pending_balance INTO …` sin lock) |
| S2 | 🔴 Alta | **Doble envío con Enter.** El `<form>` tiene `(ngSubmit)="onSubmit()"` y `onSubmit()` no revisa `isSaving()` al entrar; el botón se deshabilita, pero Enter dos veces rápido en un campo puede insertar 2 veces el mismo abono (si ambos caben en el saldo, el trigger no lo impide). | `registrar-pago-drawer.component.ts:124,702-716` |
| S3 | 🔴 Alta | **Eliminar un ingreso en Cuadratura descuadra el saldo del alumno.** Primero suma el monto de vuelta a `pending_balance` con cuentas en el cliente y *después* borra el pago, sin revisar el `error` de ninguna de las dos llamadas. La RLS solo deja borrar pagos al admin: **para la secretaria el borrado falla en silencio, pero el saldo ya se infló** y ve el toast "Movimiento eliminado y saldos revertidos". Además no existe trigger `AFTER DELETE` en `payments` y `payment_status` nunca se actualiza. | `cuadratura.facade.ts:536-553`; `20260303120000_update_rls_security_fixes.sql:61-64`; `20260301000008_08_misc_and_triggers.sql:200-202` (trigger solo `INSERT OR UPDATE`); botón visible para secretaria en `secretaria-contabilidad-cuadratura.component.ts:76-87` |
| S4 | 🟠 Media-Alta | **Pagos de matrícula presencial con fecha UTC.** El paso de pago del wizard guarda `payment_date = new Date().toISOString()` → una matrícula pagada después de las 21:00 (hora Chile, UTC-3) queda con fecha de **mañana**: no aparece en "Ingresos Hoy" ni en la Cuadratura de hoy, y sí en la de mañana. | `enrollment-payment.facade.ts:254` |
| S5 | 🟠 Media-Alta | **RLS de `payments` sin sede.** Select/insert/update se permiten a cualquier `secretary` sin mirar la sede. Una secretaria de la sede A puede, desde la consola, leer pagos de la sede B (montos, N° de documento, `enrollment_id`) e **insertar pagos en matrículas de la sede B**; en ese caso el trigger de saldo corre con sus permisos, no ve la matrícula (RLS de `enrollments` sí filtra por sede) y el guard de sobrepago tampoco → pago sin límite y saldo que no se actualiza. | `20260301000011_10_rls_policies.sql:696-705`; `20260723020000_fix_h027_…sql:35-74` (enrollments sí filtra); trigger sin `SECURITY DEFINER` en `20260301000008…:170-198` |
| S6 | 🟠 Media | **Un error de carga se ve como "¡Sin saldos pendientes!".** Ninguna query del facade revisa `error`: si falla la red o una RLS, los KPIs quedan en $0, la lista dice "Todos los alumnos están al día" y el banner de error nunca aparece. | `pagos.facade.ts:212,229,246,257,277,313,350` (`const { data } = await q`) y `:173-174` |
| S7 | 🟠 Media | **Alumno con 2 matrículas con deuda: filas y opciones indistinguibles.** La lista no tiene columna Curso ni N° de matrícula, y el selector del drawer (modo global) muestra `Nombre — RUT` para ambas matrículas. Es fácil imputar el abono a la matrícula equivocada. | `admin-pagos.component.ts:193-202`; `registrar-pago-drawer.component.ts:586-591` |
| S8 | 🟠 Media | **"Pago sin matrícula asociada" es imposible.** Si no hay deudores (o la lista aún no cargó), el drawer dice "El pago se registrará sin matrícula asociada" y quita la validación del alumno, pero `payments.enrollment_id` es `NOT NULL` → error al guardar. Además el validador se decide en el constructor: si abres el drawer desde Cuadratura/Dashboard antes de que `initialize()` termine, el selector aparece pero **sin validación obligatoria** y puedes enviar sin alumno. | `registrar-pago-drawer.component.ts:131-137,751-761`; `20260301000005_05_payments_and_finances.sql:40`; `admin-contabilidad-cuadratura.component.ts:108-114` |
| S9 | 🟠 Media | **Notificación de pago falsa en matrícula "pendiente de pago".** `recordPayment()` notifica "Se registró un pago de $X" también cuando el medio es `pendiente` (no se pagó nada) — contradice AC1/AC-E1 de spec 0025. Y el monto sale sin formato ("$180000"). | `enrollment-payment.facade.ts:229,322,347`; `pagos.facade.ts:417` |
| S10 | 🟠 Media | **Realtime de Pagos muerto.** El canal escucha `payments` y `enrollments`; `enrollments` no está en la publicación `supabase_realtime`, lo que deja mudo todo el canal (mismo mecanismo de `fix-227-m`). Una segunda sesión no ve pagos nuevos hasta volver a entrar. | `pagos.facade.ts:127-140`; `20260827160000_enable_realtime_students_payments.sql` (solo agrega `students` y `payments`) |
| S11 | 🟠 Media | **Reporte PDF sin control de rol/sede.** La función usa clave de servicio + el header del usuario y toma `branch_id` del navegador sin validar rol ni sede. Si RLS se aplica vía ese header, la fuga queda acotada por la RLS de `enrollments`; si no, cualquier usuario logueado obtiene pagos y deudores (con RUT) de todas las sedes. Además recorta en 500 pagos sin avisar. | `generate-payment-report/index.ts:32-46,86-88` |
| S12 | 🟠 Media | **Descuentos: porcentaje sobre el abono, no sobre el total.** Con "Pago parcial 50%", un 10% se calcula sobre la mitad del precio (5% real). Y un descuento predefinido fijo mayor o igual al monto a pagar (o 100%) deja el total en $0 → el insert falla por `CHECK (total_amount > 0)`. El descuento manual valida el tope, pero el predefinido no. | `enrollment-payment.facade.ts:88,102,143-147`; `payment.component.ts:59-68`; `20260301000005…:60-61` |
| S13 | 🟠 Media | **Reintentar el paso de pago de la matrícula como secretaria duplica pagos.** `recordPayment()` borra el pago anterior antes de reinsertar, pero la secretaria no tiene permiso de `DELETE` en `payments` ni en `discount_applications`: el borrado no hace nada, sin error, y el pago se inserta de nuevo (o el guard lo rechaza con un error confuso). Después el `UPDATE` manual pisa `total_paid` con un solo pago. | `enrollment-payment.facade.ts:233-242,304-313`; RLS `20260303120000…:63-64`, `20260301000011…:271` |
| S14 | 🟡 Baja-Media | **Montos con decimales.** Monto y desglose son `type=number` sin validar enteros; las columnas son `INTEGER` → la BD rechaza y se ve un error genérico. Igual en el valor del descuento (12,5%) y en el descuento manual del wizard (en ese caso el pago ya quedó insertado cuando falla el `UPDATE` de la matrícula). | `registrar-pago-drawer.component.ts:266-275,653`; `descuentos-drawer.component.ts:196-205`; `payment.component.ts:60`; `enrollment-payment.facade.ts:260-313` |
| S15 | 🟡 Baja-Media | **Mensajes de error genéricos.** Si el error de Supabase no es `instanceof Error`, el drawer muestra "Error al guardar. Intenta de nuevo." incluso cuando la causa es "excede el saldo" (la UAT lo registró así). | `registrar-pago-drawer.component.ts:740-745` |
| S16 | 🟡 Baja | **Badge "paid_full" en Estado de Cuenta.** El trigger escribe `paid_full`, pero el drawer solo traduce `paid`: al saldar una deuda desde "Estado de Cuenta" el badge muestra el texto crudo `paid_full` en gris. | `admin-pago-detalle-drawer.component.ts:320-342`; `20260301000008…:186` |
| S17 | 🟡 Baja | **Fechas en UTC en filtros y descuentos.** El filtro "Matrícula desde/hasta" compara `created_at.slice(0,10)` (UTC) mientras la columna muestra la fecha local → una matrícula de noche se ve el 29 pero el filtro la trata como del 30. "Vigente desde" de un descuento nuevo sale mañana después de las 21:00, y la vigencia se compara con la fecha UTC. | `admin-pagos.component.ts:658`; `secretaria-pagos.component.ts:570`; `descuentos-drawer.component.ts:369-371`; `enrollment-payment.facade.ts:175` |
| S18 | 🟡 Baja | **Conceptos y medios distintos según la vista.** Pagos guarda "Abono", "Pago Total", "Segunda Cuota…"; la ficha del alumno no los conoce y muestra "Pago #N". La ficha tampoco reconoce "Mixto" (muestra solo el primer medio) ni WebPay. | `registrar-pago-drawer.component.ts:562-568`; `admin-alumno-detalle.facade.ts:1114-1150` |
| S19 | 🟡 Baja | **Secretaria con grant multi-sede.** Su pantalla no recarga al cambiar de sede (la de admin sí tiene `effect`), no muestra la columna Sede, y el reporte usa siempre su sede de origen (`currentUser().branchId`), no la elegida. Sin sede asignada → `branch_id: null` = "Todas las escuelas". | `secretaria-pagos.component.ts:676-679,698`; `admin-pagos.component.ts:763-766` |
| S20 | 🟡 Baja | **Cambio rápido de sede sin guard.** `initialize()`/`fetchAll()` no usan `createRequestGuard()`: una respuesta vieja puede pisar a la nueva. | `pagos.facade.ts:159-204` |

**Otras observaciones menores** (van como casos, no como sospechas): la lista trae como máximo
200 deudores (`pagos.facade.ts:275`) y "N con deuda" cuenta sobre ese tope; incluye matrículas
`cancelled`/`withdrawn` y alumnos archivados (solo excluye `draft`, `:270`); con filtros que dejan
0 filas no hay estado vacío (`admin-pagos.component.ts:181` mira la lista sin filtrar); "Cargar
más" en móvil no vuelve a 5 al filtrar; "Boletas Emitidas" cuenta pagos del mes, no boletas
(`pagos.facade.ts:235-248`); "Pagos Recientes" son solo los últimos 50, sin paginación ni rango
de fechas; "Ingresos Hoy/Mes" incluyen pagos de matrículas aún en `draft` (sin filtro de estado).

---

## 2. Datos de prueba necesarios

Prepararlos antes de ejecutar, todos con prefijo `QA-TEST`. Anotar el nombre/RUT/N° de matrícula
real usado para cada uno. Precio de referencia: Clase B $180.000.

| Dato | Cómo debe estar | Para qué | Alumno usado |
|---|---|---|---|
| D1 | Clase B activa, pago parcial 50% (saldo $90.000) | Abono parcial, abono exacto, sobrepago | |
| D2 | Clase B activa, matrícula "pendiente de pago" (saldo $180.000, pago `pending`) | Primer pago real, S9 | |
| D3 | Clase B totalmente pagada (saldo 0) | NO debe aparecer en la lista | |
| D4 | Alumno con 2 matrículas con saldo (B + Profesional, o B regular + refuerzo) | S7, imputación | |
| D5 | Alumno con 2 matrículas: la antigua con deuda, la nueva pagada (caso `fix-058-b`) | Que la deuda antigua sea visible y pagable | |
| D6 | Matrícula con descuento aplicado (fijo y otro con %) | Total a Pagar = precio − descuento | |
| D7 | Matrícula `cancelled` o `withdrawn` con saldo > 0 | ¿Debe aparecer como deudor? | |
| D8 | Alumno archivado con saldo > 0 | ¿Debe aparecer? | |
| D9 | Matrícula en `draft` (wizard abandonado en el paso 5) con pago registrado | Ingresos Hoy / deudores | |
| D10 | Deudores en sede A y en sede B | Aislamiento entre sedes | |
| D11 | > 10 deudores (idealmente > 200) | Paginación, tope de 200 | |
| D12 | Matrícula creada después de las 21:00 (hora Chile) | S4, S17 | |
| D13 | Nombre con tilde y ñ, nombre muy largo | Búsqueda en Pagos Recientes y diseño | |
| D14 | Descuentos predefinidos: % Clase B todas las sedes; fijo solo sede A; % solo un curso Profesional; uno vencido (`valid_until` ayer); uno inactivo; uno que empieza mañana | CRUD y aplicación | |

**Cuentas:** admin; secretaria sede A; secretaria sede B; secretaria con grant multi-sede
(`can_access_both_branches = true`); secretaria sin sede asignada; alumno con cuenta activa (para
ver la notificación en la BD, ya que su portal está bloqueado en el piloto).

---

## 3. Casos

### A. Carga y acceso

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Admin entra a `/app/admin/pagos` | Skeleton → hero con 4 KPIs + lista de deudores. Consola sin errores, red sin 4xx/5xx | ✓ | |
| A02 | Secretaria entra a `/app/secretaria/pagos` | Igual, solo su sede, sin columna Sede | ✓ | |
| A03 | Secretaria escribe la URL `/app/admin/pagos` | Acceso denegado | ✓ | |
| A04 | Salir de la pantalla y volver | Datos al instante, sin skeleton | — | |
| A05 | Recargar con F5 | Carga normal | ✓ | |
| A06 | Menú lateral → Pagos (admin y secretaria) | Llega a la pantalla correcta | ✓ | |
| A07 | Carga con la red cortada **(§4)** | Mensaje de error claro, **no** "¡Sin saldos pendientes!" (S6) | — | |
| A08 | Desktop | App-like: la lista scrollea por dentro, el documento no | ✓ | |

### B. KPIs y chips del hero

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | "Ingresos Hoy" | Suma de los pagos con fecha de hoy de la sede = total de la Cuadratura de hoy (sin cursos singulares ni servicios especiales, que Pagos no suma) | ✓ | |
| B02 | Registrar un abono y mirar "Ingresos Hoy" | Sube en el monto exacto sin recargar | ✓ | |
| B03 | "Ingresos Mes" | Suma de pagos del 1 al último día del mes | — | |
| B04 | "Pagos Pendientes" | Suma de todos los saldos > 0 (no solo de los 200 listados) | — | |
| B05 | "Boletas Emitidas" y chip "N boletas emitidas" | Hoy cuenta **pagos** del mes, tengan o no N° de documento — ¿es lo deseado? | — | |
| B06 | Chip "N con deuda" | Igual al total de la lista (con > 200 deudores dirá 200) | ✓ | |
| B07 | Formato compacto | $15.500 → "$15.5K"; $1.250.000 → "$1.3M"; $9.500 → sin sufijo y con separador de miles | — | |
| B08 | Pago de matrícula de D9 (draft) | ¿Debe contar en "Ingresos Hoy"? Hoy sí cuenta — decisión | — | |
| B09 | Matrícula presencial pagada a las 21:30 (D12) **(§4)** | Cuenta en "Ingresos Hoy" de hoy (S4) | — | |

### C. Lista "Alumnos con saldo pendiente"

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | D1, D2, D4, D5, D6 | Aparecen | ✓ | |
| C02 | D3 (pagado) | No aparece | ✓ | |
| C03 | D9 (draft) | No aparece | ✓ | |
| C04 | D7 (cancelada/retirada) y D8 (archivado) | Hoy aparecen — decisión | — | |
| C05 | Orden | De mayor a menor saldo | ✓ | |
| C06 | Columnas | Alumno, RUT, Fecha Matrícula, Total a Pagar, Pagado, Saldo, Acciones (+ Sede con "Todas") | ✓ | |
| C07 | Total a Pagar de D6 | Precio − descuento | ✓ | |
| C08 | Pagado + Saldo = Total a Pagar en cada fila | Siempre cuadra | ✓ | |
| C09 | D4: las 2 matrículas **(§4)** | Se distinguen cuál es cuál (S7) | — | |
| C10 | Formato de montos | `$90.000` en todas las columnas, drawers y PDF | ✓ | |
| C11 | Fecha de matrícula de D12 | Fecha local correcta | — | |
| C12 | Nombre largo (D13) | Truncado con tooltip | — | |
| C13 | Contador "X de Y alumnos" | Correcto con y sin filtros | ✓ | |
| C14 | > 200 deudores (D11) | Hoy se ven solo 200 sin aviso — decisión | — | |
| C15 | Saldo negativo (sobrepago histórico) | No aparece en la lista: anotar si existe alguno en BD | — | |

### D. Filtros de la lista (fix-248-m / ASG-m-005)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | "Matrícula desde" | Solo matrículas desde esa fecha, inclusive | ✓ | |
| D02 | "Matrícula hasta" | Hasta esa fecha, inclusive | ✓ | |
| D03 | Rango desde > hasta | No se puede (min/max del calendario) | — | |
| D04 | D12 con "hasta" = día de la matrícula | Aparece (S17) | — | |
| D05 | Curso = Clase B / Profesional | Solo ese tipo | ✓ | |
| D06 | Curso singular con deuda | No hay opción — ¿aparecen en la lista? ¿con qué filtro? | — | |
| D07 | Fechas + curso combinados | Intersección correcta | ✓ | |
| D08 | "Limpiar filtros" | Aparece solo con filtros activos; resetea los 3 y vuelve a la página 1 | ✓ | |
| D09 | Filtro que deja 0 resultados | Hoy la lista queda en blanco, sin mensaje — debería decir "Sin resultados" | ✓ | |
| D10 | Filtrar estando en la página 3 | Vuelve a la página 1 | ✓ | |
| D11 | Salir y volver | ¿Se conservan los filtros? — decisión | — | |
| D12 | Búsqueda por nombre o RUT | No existe en la lista principal — ¿hace falta? | — | |

### E. Paginación y responsive de la lista

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | > 10 deudores en desktop | 10 por página, "Mostrando 1-10 de N" | ✓ | |
| E02 | Anterior / Siguiente, incluida la última | Sin filas repetidas ni faltantes; botones deshabilitados en los extremos | ✓ | |
| E03 | 375 px | Tarjetas, "Cargar más (N restantes)" de a 5, sin scroll horizontal | ✓ | |
| E04 | "Cargar más" y luego filtrar | Debería volver a 5 (hoy no se resetea) | — | |
| E05 | Drawer abierto en desktop | Lista compacta: Alumno, Saldo y botones apilados, sin desbordes | ✓ | |
| E06 | Modo oscuro | Todo legible | ✓ | |

### F. Registrar pago — apertura y modos

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | Botón "Registrar pago" de una fila | Drawer con el alumno fijo y su saldo | ✓ | |
| F02 | Hero → "Registrar Pago" | Drawer con selector de alumno con buscador | ✓ | |
| F03 | "Estado de Cuenta" → "Registrar Pago" | Se apila sobre el detalle; al guardar vuelve al detalle con saldo e historial actualizados | ✓ | |
| F04 | Cuadratura → "Registrar Ingreso" (admin y secretaria) **(§4)** | Modo global con selector cargado y alumno obligatorio (S8) | — | |
| F05 | Dashboard secretaria → acción rápida "Registrar Pago" | Igual que F04 | — | |
| F06 | Abrir el drawer de la fila del alumno X, cerrar, abrir el del hero | El hero no arrastra al alumno X | ✓ | |
| F07 | Abrir para X y luego para Y | Muestra a Y; el saldo no mezcla datos de X | ✓ | |
| F08 | Selector: buscar con tilde, sin tilde, por RUT | Encuentra (el filtro es por texto de la etiqueta) | — | |
| F09 | Selector con D4 | Distinguir las 2 matrículas (S7) | — | |
| F10 | Elegir alumno en el selector | Tarjeta "Seleccionado" con saldo y pagado correctos | ✓ | |
| F11 | Sin deudores en la sede | Hoy dice "se registrará sin matrícula"; al guardar falla (S8) — decisión | — | |
| F12 | Alumno sin deuda (D3) quiere pagar algo (ej. "Otro") | No se puede elegir — decisión | — | |
| F13 | "Cancelar" | Cierra sin guardar; al reabrir el formulario está limpio | ✓ | |

### G. Registrar pago — validaciones del formulario

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | Guardar vacío | "Guardar Pago" deshabilitado; al tocar campos aparecen los errores | ✓ | |
| G02 | Fecha por defecto | Hoy (hora Chile) | ✓ | |
| G03 | Fecha futura | Hoy se permite — decisión | — | |
| G04 | Fecha de un día cuya caja ya está cerrada **(§4)** | ¿Se permite? ¿Qué pasa con ese cierre? — decisión | — | |
| G05 | Concepto: cada una de las 5 opciones | Se guarda y se muestra igual en Pagos, Estado de Cuenta y ficha (S18) | — | |
| G06 | Monto 0 | "Ingresa un monto válido mayor a 0" | ✓ | |
| G07 | Monto negativo (−5000) | Error, no se guarda | ✓ | |
| G08 | Monto con decimales (1000,5 y 1000.5) | Rechazo claro en el formulario, no error genérico de BD (S14) | ✓ | |
| G09 | Letras o "e" en el monto | No se acepta | — | |
| G10 | Monto > saldo | Mensaje "El monto excede el saldo pendiente ($…)", botón deshabilitado | ✓ | |
| G11 | Monto = saldo + $0,4 / + $1 | El chequeo cliente tolera 0,5; la BD rechaza +1 — anotar mensajes | — | |
| G12 | Monto = saldo | Se permite | ✓ | |
| G13 | Desglose que no suma el total | Aviso "Faltan $X por asignar" / "excede en $X"; no se puede guardar | ✓ | |
| G14 | Desglose que cuadra | "Los montos cuadran correctamente" | ✓ | |
| G15 | Desglose con un medio negativo que compensa (−500 efectivo, +1500 transferencia, total 1000) | No se puede guardar | ✓ | |
| G16 | Solo total, sin desglose | Bloqueado (el desglose debe sumar el total) | ✓ | |
| G17 | N° documento vacío | Se guarda sin número | ✓ | |
| G18 | N° documento repetido (el mismo de otro pago) | Hoy se acepta — ¿debe validarse duplicado? decisión | — | |
| G19 | N° documento muy largo o con caracteres raros | Se guarda y no rompe las vistas | — | |
| G20 | Campo "WebPay" en pago presencial | ¿Debe estar disponible para la secretaria? — decisión | — | |

### H. Registrar pago — resultado e integridad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | Abono parcial a D1 **(§4)** | Toast, drawer cerrado, saldo/pagado actualizados en lista, Estado de Cuenta, ficha y Cuadratura | ✓ | |
| H02 | Abono exacto al saldo | Alumno sale de la lista; ficha "Saldo $0"; estado de pago "Pagado" | ✓ | |
| H03 | Intento de sobrepago por consola (saltando la UI) | La BD lo rechaza (trigger `trg_check_payment_within_pending_balance`) | ✓ | |
| H04 | Pago cuando el saldo cambió en otra sesión (saldo en pantalla viejo) | La BD rechaza si excede; mensaje entendible (S15) | — | |
| H05 | Doble clic en "Guardar Pago" | Un solo pago | ✓ | |
| H06 | Enter dos veces rápido en el campo N° documento **(§4)** | Un solo pago (S2) | ✓ | |
| H07 | 2 sesiones, abonos simultáneos que juntos exceden el saldo **(§4)** | Uno rechazado; saldo nunca negativo (S1) | ✓ | |
| H08 | 2 sesiones, abonos simultáneos que juntos caben | Ambos quedan; saldo = total − suma exacta (regresión `fix-114-m`) | ✓ | |
| H09 | Pago a la matrícula antigua de D5 | Se imputa a esa matrícula, no a la nueva (regresión `fix-058-b` en staff) | ✓ | |
| H10 | Pago a D4 **(§4)** | Se imputa solo a la matrícula elegida | ✓ | |
| H11 | Primer pago real de D2 (matrícula "pendiente de pago") | El pago `pending` de $0 recibido no se suma; saldo baja solo en lo pagado | — | |
| H12 | Pago efectivo / transferencia / tarjeta / mixto | En Cuadratura cada monto va a su columna; solo el efectivo entra al arqueo físico | ✓ | |
| H13 | Método en "Pagos Recientes" | Efectivo / Transferencia / Débito/Crédito / WebPay / Mixto según desglose | ✓ | |
| H14 | Auditoría | Queda registro del INSERT en el log de auditoría con usuario y monto | — | |
| H15 | "Registrado por" | `payments.registered_by` queda vacío en pagos de este drawer — ¿se necesita saber quién cobró? decisión | — | |
| H16 | La red falla al guardar | Mensaje de error en el drawer, el drawer sigue abierto y no se pierde lo escrito | — | |
| H17 | Pago a matrícula que llega a clase 7 (2ª cuota) | Tras pagar la 2ª cuota se habilita la clase 7 — verificar en Agenda | — | |

### I. Estado de Cuenta (drawer "Ver detalle")

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| I01 | Abrir "Ver detalle" | Skeleton → nombre, RUT, curso, email, teléfono, badge de estado | ✓ | |
| I02 | Descuento > 0 (D6) | Línea "Descuento: $X" | ✓ | |
| I03 | Total Curso / Pagado % / Saldo | Correctos; % redondeado | ✓ | |
| I04 | Saldar la deuda desde aquí | Saldo "Al día", botón Registrar Pago desaparece, badge "Pagado" (hoy "paid_full", S16) | ✓ | |
| I05 | Historial | Todos los pagos de la matrícula, con fecha, concepto, método, N° doc., monto, estado | ✓ | |
| I06 | Pago `pending` de matrícula "pendiente de pago" en el historial | Se ve como "Pend." — ¿confunde? El total del pie lo suma | — | |
| I07 | Total del historial | Igual a "Pagado" (si hay `pending` no cuadra) | ✓ | |
| I08 | Abrir detalle de X y rápido el de Y | Muestra Y, sin datos de X | — | |
| I09 | Matrícula sin permiso (otra sede) | "No se encontró la matrícula" (no los datos del alumno anterior) | — | |
| I10 | Editar o anular un pago | No existe en Pagos — decisión | — | |

### J. Pagos Recientes (drawer)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | Abrir | "Métodos de Pago (Mes)" + lista de los últimos 50 pagos | ✓ | |
| J02 | Porcentajes por método | Suman 100%; coinciden con los montos del mes | ✓ | |
| J03 | Mes sin pagos | "Sin pagos registrados este mes." | — | |
| J04 | Buscar por nombre, con y sin tilde, y por N° boleta | Encuentra (sin tilde probablemente falla) | ✓ | |
| J05 | Filtro Estado = Pendiente | Casi siempre vacío (los `pending` se excluyen, fix-135-m) — ¿sobra el filtro? | — | |
| J06 | Filtro por cada método, incluido Mixto | Correcto | ✓ | |
| J07 | Pago nº 51 o más antiguo | No aparece — ¿hace falta historial completo con fechas? decisión | — | |
| J08 | Admin "Todas las sedes" | No hay columna Sede — ¿hace falta? | — | |
| J09 | Pago recién registrado | Aparece primero | ✓ | |

### K. Reporte PDF

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | Abrir modal | Desde el 1 del mes a hoy; admin ve la sede del topbar | ✓ | |
| K02 | Generar | Descarga `Reporte_Pagos_<desde>_<hasta>.pdf`, toast de éxito, modal cerrado | ✓ | |
| K03 | Contenido | Pagos del período (con medio), KPIs y deudores actuales; totales = pantalla | — | |
| K04 | Admin "Todas" | Columna Sede y todas las sedes | — | |
| K05 | Secretaria | Solo su sede | ✓ | |
| K06 | Secretaria con grant y otra sede elegida | Debería ser la sede elegida (S19) | — | |
| K07 | Período con > 500 pagos | Hoy se recorta sin aviso (S11) | — | |
| K08 | Tildes, ñ y nombres largos en el PDF | Se ven bien | — | |
| K09 | Botón mientras genera | "Generando..." deshabilitado; Cancelar deshabilitado | — | |
| K10 | La función falla | Toast de error; el modal se cierra igual (¿debería quedarse abierto?) | — | |
| K11 | **Seguridad (S11)** **(§4)** | Una secretaria no obtiene pagos/deudores de otra sede | ✓ | |

### L. Descuentos predefinidos (Ajustes → Descuentos)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| L01 | Admin: Ajustes → "Administrar Descuentos" | Abre la lista | ✓ | |
| L02 | Secretaria | No ve la tarjeta de Descuentos | ✓ | |
| L03 | Secretaria intenta crear un descuento por consola | La BD lo rechaza (RLS solo admin) | — | |
| L04 | Lista vacía | "Aún no hay descuentos predefinidos." | — | |
| L05 | Crear % Clase B todas las sedes | Se guarda; muestra "10% · Clase B · Todas las sedes · Activo" | ✓ | |
| L06 | Crear fijo solo sede A | Muestra el monto con formato `$30.000` y la sede | ✓ | |
| L07 | "Clase Profesional" → curso específico | El selector lista los cursos Profesional de la sede elegida; cambiar de sede lo recarga | — | |
| L08 | Cambiar "Aplicable a" de Profesional a Clase B | Se limpia el curso específico | — | |
| L09 | Nombre vacío / valor 0 / valor negativo | Guardar deshabilitado | ✓ | |
| L10 | % = 101 | "Un porcentaje no puede superar 100%" | ✓ | |
| L11 | % = 12,5 | Rechazo claro (columna entera, S14) | — | |
| L12 | Fijo mayor que el precio del curso | Hoy se acepta — ver M05 | — | |
| L13 | "Vigente hasta" anterior a "Vigente desde" | Hoy se acepta — debería bloquearse | — | |
| L14 | "Vigente desde" por defecto después de las 21:00 | Debería ser hoy (S17) | — | |
| L15 | Editar un descuento | Precarga todos los campos; guarda cambios | ✓ | |
| L16 | Desactivar / Reactivar | Cambia el badge; mientras procesa los botones se deshabilitan | ✓ | |
| L17 | Descuento vencido | Hoy la lista lo muestra "Activo" — ¿debería mostrarse vencido? | — | |
| L18 | Editar un descuento ya usado en matrículas | Las matrículas anteriores conservan su monto de descuento | — | |
| L19 | No existe botón Eliminar | Correcto (preserva historial, AC-2) | — | |

### M. Descuentos aplicados en la matrícula (paso de pago)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | Matrícula Clase B sede A | Aparecen los activos y vigentes de Clase B/todos, de sede A o todas las sedes | ✓ | |
| M02 | Descuentos inactivo, vencido y que empieza mañana | No aparecen | ✓ | |
| M03 | Matrícula Profesional con descuento de curso específico | Solo aparece en ese curso | — | |
| M04 | % sobre pago total | $180.000 − 20% = $144.000 (regresión UAT) | ✓ | |
| M05 | Fijo o 100% que deja $0 **(§4)** | Mensaje claro; hoy el insert falla (S12) | — | |
| M06 | % con "Pago parcial 50%" **(§4)** | ¿Sobre el total o sobre el abono? (S12) — decisión | — | |
| M07 | Descuento manual > monto a pagar | "El descuento no puede superar el monto a pagar" | ✓ | |
| M08 | Descuento manual con decimales | Rechazo claro; no deja el pago a medias (S14) | — | |
| M09 | Elegir un predefinido y luego uno manual | Queda solo el manual | — | |
| M10 | Etiqueta del descuento aplicado | "Nombre (10%)" o "Nombre ($30.000)" (hotfix-088-m) | ✓ | |
| M11 | Después de confirmar | `enrollments.discount` y `discount_applications` guardados; Total a Pagar en Pagos = precio − descuento | — | |
| M12 | Volver al paso de pago y cambiar de medio/descuento, como secretaria **(§4)** | Un solo pago de matrícula (S13) | — | |

### N. Notificaciones

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| N01 | Abono desde Pagos | El alumno recibe "Pago registrado" con el monto (revisar tabla `notifications`) | — | |
| N02 | Formato del monto | Hoy "$90000" sin separador (S9) | — | |
| N03 | Admin/secretaria | No reciben notificación por el pago (AC8) | — | |
| N04 | Matrícula con medio "pendiente" | **No** debe notificar pago (S9) | — | |
| N05 | Alumno sin cuenta de usuario | El pago se registra igual; sin toast de error | — | |

### O. Sedes, roles y seguridad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| O01 | Admin "Todas las sedes" | Columna Sede, deudores de todas; KPIs = suma de las sedes | ✓ | |
| O02 | Admin cambia de sede | Recarga sola con datos solo de esa sede | ✓ | |
| O03 | Cambio rápido A→B→A con red lenta | Termina en A sin mezclar (S20) | — | |
| O04 | Secretaria sin grant | Solo su sede | ✓ | |
| O05 | Secretaria con grant cambia de sede | Recarga (S19) | — | |
| O06 | Secretaria sin sede asignada | Nunca ve todas las sedes | — | |
| O07 | **RLS lectura** **(§4)** | Secretaria A no lee pagos de sede B desde consola (S5) | ✓ | |
| O08 | **RLS escritura** **(§4)** | Secretaria A no puede insertar un pago en una matrícula de sede B (S5) | ✓ | |
| O09 | Secretaria intenta modificar un pago existente por consola (`update total_amount`) | Hoy la RLS lo permite y el guard solo cubre INSERT — decisión/bug | — | |

### P. Tiempo real y verificación cruzada

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| P01 | 2 sesiones: pago en A **(§4)** | En B baja el saldo y sube "Ingresos Hoy" sin recargar (S10) | ✓ | |
| P02 | Salir de la pantalla | Se cierra el canal (DevTools → WS) | — | |
| P03 | Abrir Registrar Ingreso desde Cuadratura y salir | ¿Queda un canal de Pagos colgado? | — | |
| P04 | Eliminar un ingreso en Cuadratura (admin) **(§4)** | El alumno vuelve a la lista con el saldo exacto; estado de pago correcto (S3) | — | |
| P05 | Eliminar un ingreso en Cuadratura (secretaria) **(§4)** | No debe cambiar ningún saldo si el pago no se borró (S3) | — | |
| P06 | Ficha del alumno tras un abono | Total pagado, saldo e historial iguales a Pagos; "Ver todo el historial" lleva a Pagos, que no muestra el historial de ese alumno — ¿es lo deseado? | — | |
| P07 | Dashboard | "Ingresos Mes" del dashboard = "Ingresos Mes" de Pagos para la misma sede | — | |
| P08 | Reportes Contables | Los pagos de prueba aparecen con el mismo monto y fecha | — | |

### Q. Visual y accesibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| Q01 | Modo oscuro y claro (lista, 3 drawers, modal, descuentos) | Todo legible | ✓ | |
| Q02 | 375 / 768 / 1440 px | Sin scroll horizontal; el drawer de pago usable en móvil | ✓ | |
| Q03 | Solo teclado | Se llega a todos los campos y botones; foco visible | — | |
| Q04 | Etiquetas de los inputs de monto | Asociadas a su campo (lectores de pantalla) | — | |
| Q05 | Animaciones | Sin parpadeos al abrir drawers | — | |

---

## 4. Casos con pasos numerados

### A07 — Error de carga visible

**Precondición:** sesión admin con deudores existentes.
1. DevTools → Network → "Offline".
2. Navegar a Pagos (o recargar).
3. Mirar el hero y la lista al terminar el skeleton.
4. Volver a "No throttling" y recargar.

**Esperado:** en el paso 3 un mensaje de error; **nunca** "¡Sin saldos pendientes!" con KPIs en $0
(S6). **Evidencia:** captura del paso 3.

### B09 — Pago de matrícula de noche

**Precondición:** después de las 21:00 hora Chile (o reloj del equipo ajustado); sesión secretaria.
1. Anotar "Ingresos Hoy" en Pagos y el total de la Cuadratura de hoy.
2. Hacer una matrícula presencial Clase B pagada en efectivo ($180.000).
3. Volver a Pagos y a Cuadratura.
4. En la consola (o como admin en Reportes), revisar el `payment_date` del pago.

**Esperado:** "Ingresos Hoy" y la Cuadratura suben $180.000 hoy y `payment_date` = fecha de hoy
en Chile. Si quedó con la fecha de mañana, S4 confirmada.

### C09 / H10 — Alumno con 2 matrículas

**Precondición:** D4 (dos matrículas con saldo). Anotar saldo de cada una.
1. En la lista, ubicar las 2 filas del alumno: ¿cómo sabes cuál es cuál?
2. Abrir "Ver detalle" de cada una y anotar el curso.
3. Hero → "Registrar Pago" → buscar al alumno en el selector: ¿se distinguen las 2 opciones?
4. Registrar $10.000 a la matrícula de Clase B.
5. Revisar ambas filas y la ficha del alumno (pestaña de cada matrícula).

**Esperado:** solo baja el saldo de la matrícula B; la otra queda igual. Si en los pasos 1 o 3 no
se puede distinguir, S7 confirmada.

### F04 — Registrar ingreso desde Cuadratura

**Precondición:** sesión secretaria recién iniciada, **sin** haber entrado a Pagos; DevTools → Slow 3G.
1. Ir a Cuadratura → "Registrar Ingreso" inmediatamente.
2. Mirar el bloque de alumno mientras carga y cuando termina de cargar.
3. Completar fecha, concepto y monto con desglose, **sin elegir alumno**, y "Guardar Pago".

**Esperado:** el selector exige alumno (error "Selecciona un alumno."). Si deja guardar y aparece
un error de BD, o el drawer dijo "se registrará sin matrícula", S8 confirmada.

### G04 — Pago con fecha de un día ya cerrado

**Precondición:** caja de ayer cerrada en la sede (coordinar con 029).
1. Registrar un abono de $5.000 con fecha de ayer.
2. Abrir el Historial de Cuadratura del día de ayer.

**Esperado:** definir la regla (bloquear fechas con caja cerrada o reabrir). Anotar qué pasa hoy:
¿cambian los totales de un cierre ya firmado?

### H01 — Abono parcial de punta a punta

**Precondición:** sesión secretaria sede A; D1 con saldo $90.000. Anotar Ingresos Hoy, Cuadratura
del día y saldo de D1 en la ficha.
1. En Pagos, fila de D1 → "Registrar pago".
2. Fecha hoy, concepto "Abono", monto 30000, efectivo 20000 + transferencia 10000, N° doc. "QA-001".
3. Verificar "Los montos cuadran correctamente" y guardar.
4. Verificar toast, que la fila muestra Pagado +$30.000 y Saldo $60.000.
5. "Ver detalle": historial con el pago "Abono · Mixto · QA-001 · $30.000".
6. "Pagos Recientes": el pago encabeza la lista con método "Mixto".
7. Ficha del alumno: total pagado y saldo iguales.
8. Cuadratura: $20.000 en efectivo y $10.000 en transferencia; el arqueo solo suma los $20.000.
9. Hero: Ingresos Hoy +$30.000.

**Evidencia:** captura de los pasos 4, 7 y 8.

### H06 — Doble envío con Enter

**Precondición:** D1; DevTools → Slow 3G.
1. Abrir "Registrar pago" de D1 y completar un abono válido de $1.000.
2. Poner el cursor en "N° Documento" y presionar Enter 2 veces seguidas.
3. Esperar y abrir "Ver detalle".

**Esperado:** un solo pago de $1.000. Si hay 2, S2 confirmada → P0.

### H07 — Concurrencia que excede el saldo

**Precondición:** 2 navegadores distintos (admin y secretaria de la misma sede); D1 con saldo
$90.000; ambos con el drawer de D1 abierto y un abono de $60.000 listo.
1. Contar "3, 2, 1" y hacer clic en "Guardar Pago" en ambos a la vez (repetir 3 veces con nuevos
   alumnos si la primera sale bien, para descartar suerte).
2. Revisar el historial y el saldo.

**Esperado:** uno se guarda y el otro se rechaza; el saldo nunca queda negativo. Si ambos se
guardan, S1 confirmada → P0 (el alumno queda con saldo −$30.000 y desaparece de la lista).

### K11 — Seguridad del reporte PDF

**Precondición:** sesión secretaria sede A.
1. Generar un reporte y copiar la petición `generate-payment-report` desde Network ("Copy as fetch").
2. En Console, ejecutarla cambiando `branch_id` a `null`.
3. Repetir con el id de la sede B.

**Esperado:** error/403 o, como mínimo, solo datos de la sede A. Si trae pagos o deudores (RUT) de
la sede B, S11 confirmada → P0.

### M05 — Descuento que deja el total en $0

**Precondición:** descuento predefinido fijo de $180.000 (o 100%) activo para Clase B.
1. Matrícula presencial Clase B hasta el paso de pago, pago total, medio efectivo.
2. Elegir el descuento → verificar el total a pagar.
3. Avanzar.

**Esperado:** o se bloquea con un mensaje claro, o se permite una matrícula becada sin pago
(decisión). Hoy lo probable es un error "Error al registrar pago" (S12).

### M06 — Porcentaje con pago parcial

**Precondición:** descuento 10% Clase B.
1. Matrícula Clase B → "Pago parcial 50%" → elegir el 10%.
2. Anotar descuento, monto a pagar y, tras confirmar, el saldo en Pagos.

**Esperado (hoy):** descuento $9.000 (10% de $90.000), saldo $81.000. Si el negocio espera $18.000
de descuento (10% del curso), es bug. Llevarlo a §5.

### M12 — Reintentar el paso de pago como secretaria

**Precondición:** sesión secretaria; matrícula nueva en el paso de pago.
1. Registrar pago parcial en efectivo y avanzar al paso 5.
2. Volver al paso 4, cambiar a transferencia y avanzar de nuevo.
3. Revisar el historial de pagos de la matrícula (admin → Estado de Cuenta) y la Cuadratura.

**Esperado:** un solo pago de matrícula, con el último medio elegido. Si hay 2 pagos, un error
confuso o el "Pagado" no coincide con la suma del historial, S13 confirmada.

### O07 — RLS: lectura de pagos de otra sede

**Precondición:** sesión secretaria sede A; conocer un `enrollment_id` de la sede B.
1. En Pagos, copiar desde Network una petición a `/rest/v1/payments` ("Copy as fetch").
2. En Console, cambiar el `select` a `id,total_amount,document_number,enrollment_id` sin el
   `enrollments!inner` y sin filtro de sede, y ejecutarla.

**Esperado:** solo pagos de la sede A. Si trae de la sede B, S5 confirmada (fuga de datos).

### O08 — RLS: escribir un pago en otra sede

**Precondición:** igual que O07; usar una matrícula `QA-TEST` de la sede B con saldo conocido.
1. Copiar la petición POST de un pago real propio (H01) y cambiar `enrollment_id` al de la sede B
   y `total_amount` a un monto mayor que su saldo.
2. Ejecutarla.
3. Como admin, revisar la matrícula de la sede B.

**Esperado:** rechazo (403/RLS). Si se inserta, S5 confirmada → **P0**; anotar además si el saldo
de la matrícula cambió o no.

### P01 — Tiempo real entre sesiones

**Precondición:** 2 navegadores distintos con Pagos abierto en la misma sede.
1. En A, registrar un abono a D1.
2. Sin tocar B, esperar 5 segundos.

**Esperado:** en B cambian el saldo de D1 e "Ingresos Hoy". Si no, recargar B para confirmar que
el dato existe (S10).

### P04 / P05 — Eliminar un ingreso desde Cuadratura

**Precondición:** alumno `QA-TEST` con un abono de $10.000 registrado hoy; anotar su saldo.
1. (P05) Como secretaria, Cuadratura → eliminar ese ingreso → confirmar.
2. Anotar el toast, si el ingreso sigue en la tabla tras recargar, y el saldo del alumno en Pagos.
3. (P04) Como admin, eliminar el mismo ingreso.
4. Revisar saldo, estado de pago (Estado de Cuenta) y que el pago ya no esté en el historial.

**Esperado:** en P05 la secretaria no puede eliminar (o si puede, el pago desaparece) y **el saldo
nunca cambia sin que el pago se borre**. En P04 el saldo vuelve exactamente al anterior y el estado
de pago es coherente. Si en P05 el saldo subió $10.000 con el pago todavía ahí, S3 confirmada → P0.

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| B05 | ¿"Boletas Emitidas" debe contar pagos o solo pagos con N° de boleta? |
| B08 | ¿Los pagos de una matrícula aún en borrador cuentan como ingreso del día? |
| C04 | ¿Matrículas canceladas/retiradas y alumnos archivados con saldo deben seguir como deudores? |
| C14 | ¿Hace falta ver más de 200 deudores o paginar desde el servidor? |
| D06 / D12 | ¿Faltan filtros por curso singular y búsqueda por nombre/RUT en la lista principal? |
| F11 / F12 | ¿Existe el "pago sin matrícula" o el pago de un alumno sin deuda (ej. "Otro")? Si no, quitar el texto del drawer |
| G03 / G04 | ¿Se permiten fechas futuras? ¿Y fechas de un día con la caja cerrada? |
| G18 | ¿El N° de boleta debe ser único? ¿Editable después? |
| G20 | ¿La secretaria debe poder registrar montos como "WebPay"? |
| H15 | ¿Debe quedar registrado qué usuario registró cada pago? |
| I10 | ¿Se necesita anular/editar un pago desde Pagos (hoy solo borrar desde Cuadratura)? |
| J07 | ¿Hace falta un historial completo de pagos con rango de fechas? |
| L13 / L17 | ¿Se valida "hasta ≥ desde"? ¿La lista marca los descuentos vencidos? |
| M05 | ¿Se permite una matrícula 100% becada (total $0)? |
| M06 | ¿El % de descuento se calcula sobre el precio del curso o sobre el abono? |
| O09 | ¿La secretaria puede modificar pagos existentes (hoy la RLS lo permite)? |
| P06 | ¿"Ver todo el historial" de la ficha debe llevar a un historial del alumno? |
