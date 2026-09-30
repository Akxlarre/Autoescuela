# Testing — Contabilidad (cuadratura, historial, reportes, anticipos, liquidaciones, cursos)

> **Asignación:** `ASG-i-029` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/app/{admin,secretaria}/contabilidad/cuadratura`, `/historial-cuadraturas`, `/reportes`,
> `/liquidaciones`, `/cursos`; `/app/admin/contabilidad/anticipos` (solo admin).
> **Incluye:** Caja Diaria (fondo, ingresos, egresos, arqueo, borrador, cierre, exportes), Historial
> de cuadraturas (calendario, detalle, ajustes, exportes), Reportes contables (4 pestañas, gasto fijo,
> exportes), Anticipos, Liquidaciones de instructores (tarifa por sede, pago, deshacer, exporte) y la
> pantalla Cursos Singulares en lo que toca a la caja (cobros).
> **No incluye:** registrar pagos por dentro (ver `028-pagos-y-descuentos.md`), vender servicios
> especiales por dentro (ver `031-servicios-especiales.md`), crear/inscribir cursos singulares en
> detalle, configurar la tarifa por hora en Ajustes (ver `036`), portal del instructor (fuera del piloto).
>
> **Código leído para armar esta lista:**
> `core/facades/{cuadratura,historial-cuadraturas,reportes-contables,liquidaciones,anticipos,cursos-singulares,payroll-config,servicios-especiales,enrollment-payment}.facade.ts`,
> `core/utils/{reportes-contables,cuadratura-hero-kpis,date,branch-scope}.utils.ts`,
> `core/models/ui/reportes-contables.model.ts`,
> `features/{admin,secretaria}/contabilidad-*/*.component.ts` (incluye `arqueo-cierre-drawer`,
> `registrar-egreso-drawer`, `registrar-ajuste-cuadratura-drawer`, `registrar-anticipo-drawer`,
> `admin-curso-singular-*-drawer`), `shared/components/{cuadratura-content,historial-cuadraturas-content,detalle-cuadratura-modal,reportes-contables-content,rentabilidad-cursos,liquidaciones-content,pago-instructor-modal}/`,
> `supabase/functions/{generate-cash-closing-report,generate-cash-history-report,generate-financial-report,generate-payroll-report}/`,
> migraciones de `cash_closings` (`20260827120000…150000`), `cuadratura_adjustments` (`20260806010000`),
> RLS base (`20260301000011_10_rls_policies.sql`), `20260303120000_update_rls_security_fixes.sql`,
> triggers de saldo (`20260301000008`), horas de instructor (`20260509000001`), tarifa por sede
> (`20260907120000`) y publicación Realtime (`20260827160000`, `20260907120000`).

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-029`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S20)** salen de leer el código, **no están confirmadas** en navegador.
  Confirmarlas o descartarlas es parte del trabajo.
- Conviene correr este documento **después** de `028` (Pagos) y `031` (Servicios especiales), sobre
  los mismos datos. Muchos casos se ejecutan **de noche** (después de las 21:00 hora de Chile) a
  propósito: ahí aparecen los errores de zona horaria.

---

## 1. Sospechas de bug encontradas en el código

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **Eliminar un ingreso como secretaria corrompe el saldo del alumno.** El facade primero resta el monto de `enrollments.total_paid` y lo suma a `pending_balance` (la secretaria sí puede hacer UPDATE en `enrollments`), y después borra el pago; pero la RLS solo deja borrar pagos al admin. El DELETE afecta 0 filas sin error, el facade no revisa el resultado y muestra "Movimiento eliminado y saldos revertidos". Resultado: el pago sigue en la caja y el alumno queda con deuda inventada. Para el admin, el trigger de saldo no corre en DELETE, así que `payment_status` queda desactualizado. | `cuadratura.facade.ts:536-555`; `20260303120000_update_rls_security_fixes.sql:63-64`; `20260301000008_08_misc_and_triggers.sql:200-202` |
| S2 | 🔴 Alta | **Eliminar un anticipo desde la caja como secretaria no hace nada, pero avisa éxito.** `instructor_advances` solo permite DELETE al admin; `eliminarEgreso()` no revisa el error y muestra "Egreso eliminado correctamente". | `cuadratura.facade.ts:564-578`; `20260301000011_10_rls_policies.sql:773-774` |
| S3 | 🔴 Alta | **"Caja cerrada correctamente" aunque el cierre falle.** El `upsert` de `cerrarCaja()` no revisa `error` (supabase-js no lanza excepción). Si la RLS lo rechaza (secretaria sobre una fila ya `closed`, por ejemplo con 2 pestañas) o se cae la red a mitad, igual limpia el arqueo y avisa éxito. | `cuadratura.facade.ts:777-817` |
| S4 | 🔴 Alta | **Una caja cerrada se puede "reabrir" o sobrescribir.** El admin tiene UPDATE sin restricción sobre `cash_closings`: un segundo "Cerrar Caja" (otra pestaña/otro admin) pisa el cierre con otros números y otro `closed_by`; y el autoguardado de borrador de una pestaña desactualizada hace `upsert` con `status: 'draft'` sobre la fila cerrada (solo lo frena el flag local `_cajaYaCerrada`). | `cuadratura.facade.ts:729-744,777-813`; `20260827140000_cash_closings_update_with_check_fix.sql:15-24` |
| S5 | 🔴 Alta | **Las 4 edge functions de reportes no validan rol ni sede.** Usan la clave de servicio (saltan RLS) y filtran por el `branch_id` que manda el navegador; solo verifican que haya sesión. Una secretaria puede pedir `branch_id: null` u otra sede y obtener la caja, el historial, el reporte contable (con RUT de alumnos) y **la nómina con sueldos** de todas las sedes. | `generate-cash-closing-report/index.ts:36-57`; `generate-cash-history-report/index.ts:36-57`; `generate-financial-report/index.ts:55-77`; `generate-payroll-report/index.ts:134-156` |
| S6 | 🟠 Media | **El Excel/PDF de la cuadratura no calcula igual que la pantalla.** Filtra pagos por `created_at` en UTC y solo `status='paid'` (la pantalla usa `payment_date` e incluye `completado`); no incluye ventas de servicios especiales; suma anticipos de **todas las sedes**; toma el fondo solo de un cierre ya cerrado (caja abierta ⇒ fondo $0 aunque haya borrador); el PDF no tiene columna Tarjeta y el Excel de egresos no muestra el método. | `generate-cash-closing-report/index.ts:80-93,133-137,142-160,423-426,649-660` vs `cuadratura.facade.ts:348-373,452-473` |
| S7 | 🟠 Media | **Zona horaria (pagos y anticipos de noche caen en otro día).** (a) Cobros de curso singular se buscan con `T00:00:00`–`T23:59:59` sin offset (UTC); `getChileDateTimeRange` está importado pero no se usa. (b) El anticipo registrado desde la caja y desde Anticipos usa `toISOString()` (UTC): después de las 21:00 queda con fecha de mañana y no aparece en la caja de hoy. (c) El pago de matrícula guarda `payment_date` en UTC. (d) Reportes usa `paid_at` UTC para cursos singulares. | `cuadratura.facade.ts:6,349-350,430-431`; `registrar-egreso-drawer.component.ts:595-597`; `registrar-anticipo-drawer.component.ts:160`; `enrollment-payment.facade.ts:254`; `reportes-contables.facade.ts:367-368`; `reportes-contables.utils.ts:153` |
| S8 | 🟠 Media | **Realtime de la caja probablemente muerto.** El canal escucha 6 tablas; `expenses`, `cash_closings`, `standalone_course_enrollments` y `special_service_sales` no están en `supabase_realtime`. Mismo mecanismo de `fix-227-m`: una tabla no publicada deja mudo todo el canal. | `cuadratura.facade.ts:251-285`; publicación solo en `20260827160000_enable_realtime_students_payments.sql` y `20260907120000_branch_payroll_config.sql:70-82` |
| S9 | 🟠 Media | **Curso singular inscrito "pendiente" y cobrado después no entra al efectivo.** La inscripción guarda `payment_method='pendiente'`; el cobro posterior no cambia el método. En la caja la fila suma al Total pero a ninguna columna (ni Efectivo): el saldo esperado queda corto. | `admin-curso-singular-inscribir-drawer.component.ts:706-708`; `cursos-singulares.facade.ts:333-338`; `cuadratura.facade.ts:70-85` |
| S10 | 🟠 Media | **Reportes suma pagos no pagados y no cuadra con su propio Excel.** La pantalla no filtra `status` (cuenta `pending`/`partial`); el export solo `paid` (sin `completado`), no suma gastos fijos, agrupa por `license_group` en vez de tipo, y no reconoce la categoría `combustible`. Ninguno de los dos suma ventas de servicios especiales (`special_service_sales`) ni anticipos/liquidaciones como gasto. | `reportes-contables.facade.ts:348-354,321-324`; `generate-financial-report/index.ts:41-47,101-111,142-154` |
| S11 | 🟠 Media | **Liquidaciones de la secretaria sale vacía o en cero.** `instructor_monthly_hours` e `instructor_monthly_payments` son solo admin por RLS: la secretaria ve horas 0, base $0 y todo "Pendiente" (solo aparecen instructores con anticipos); si pulsa "Pagar" falla. El export (clave de servicio) sí trae los montos reales. | `20260301000011_10_rls_policies.sql:332-336,778-784`; `liquidaciones.facade.ts:241-292` |
| S12 | 🟠 Media | **Liquidación: lo guardado no es lo mostrado.** `net_payment` = base − anticipos (puede ser negativo) mientras la pantalla muestra `max(0, …)`; el método de pago y el código de transferencia del modal no se guardan; una fila pagada se recalcula con las horas/tarifa actuales (no con lo pagado); "Deshacer" no pide confirmación; el pago en efectivo no aparece como egreso de la caja. | `liquidaciones.facade.ts:303-305,356-365`; `pago-instructor-modal.component.ts:245-250`; `liquidaciones-content.component.ts:863-865` |
| S13 | 🟠 Media | **Historial de la secretaria: solo últimos 3 días.** La RLS de `cash_closings` limita a la secretaria a `date >= CURRENT_DATE - 2 days`; el calendario del mes sale casi vacío y el Excel también, pero el PDF (clave de servicio) trae el mes completo. Los ajustes son solo admin (la secretaria ve "Sin ajustes"). | `20260301000011_10_rls_policies.sql:745-751`; `historial-cuadraturas.facade.ts:421-448,464-481`; `20260806010000_cuadratura_adjustments.sql` (policy SELECT admin) |
| S14 | 🟡 Baja-Media | **Historial admin en "Todas las sedes": un cierre tapa al otro.** El calendario indexa por fecha (`Map` fecha→cierre): si las 2 sedes cerraron el mismo día se ve solo uno. Y exportar un cierre usa la sede del selector (null), no la del cierre. | `historial-cuadraturas-content.component.ts` (`calendarDays`: `new Map(this.cierres().map((c) => [c.fecha, c]))`); `historial-cuadraturas.facade.ts:518-521`; `generate-cash-closing-report/index.ts:142-155` |
| S15 | 🟡 Baja-Media | **El arqueo "se arrastra" entre sedes/días.** Solo se restaura estado si hay borrador; si no, quedan el fondo y los billetes de la sede/día anterior (el `resetArqueoState()` no limpia el fondo). El borrador toma la sede **al momento de guardar** (debounce 800 ms): si el admin cambia de sede justo después de tipear, el conteo de A se guarda en B. | `cuadratura.facade.ts:481-506,701-706,729-761` |
| S16 | 🟡 Baja | **Secretaria con grant multi-sede:** no tiene el "gate" de sede del admin; con "Todas" la caja se cierra con `branch_id` null y `maybeSingle()` falla si hay 2 cierres; además su pantalla no recarga al cambiar de sede. | `secretaria-contabilidad-cuadratura.component.ts:48-51`; `cuadratura.facade.ts:481-484` |
| S17 | 🟡 Baja | **Movimientos después del cierre.** Nada impide registrar un pago (módulo Pagos), una venta, un egreso (atajo del dashboard) o un anticipo con la caja ya cerrada; la pantalla los suma en vivo, el snapshot del cierre no. | `cuadratura.facade.ts:592-632`; `registrar-egreso-drawer.component.ts:531-588` |
| S18 | 🟡 Baja | **Servicios especiales van siempre a "Tarjeta"** (columna `otros`) aunque se cobren en efectivo; nunca cuentan para el arqueo. Es una decisión (fix-025-i), pero hay que confirmarla con la operación real. | `cuadratura.facade.ts:97-117` |
| S19 | 🟡 Baja | **Filas duplicadas en la lista de ingresos:** `track fila.id` mezcla ids de 3 tablas distintas (pagos, cursos singulares, servicios especiales); dos filas con el mismo id rompen el render. | `cuadratura-content.component.ts:222,287` |
| S20 | 🟡 Baja | **Detalles de UI:** el drawer de ajuste agrega validadores que nunca quita (cambiar de tipo tras un intento fallido deja el form inválido); el "gasto olvidado" se inserta en 2 pasos (si falla el 2º queda un gasto huérfano) y sin `payment_method`; el calendario de escritorio muestra "Descuadre" también para sobrantes (el móvil dice "Sobrante"); los badges de margen/rentabilidad son siempre verdes aunque sean negativos; la hora de liquidación se redondea a 1 decimal (13 clases × 0,75 = 9,75 → 9,8 h). | `registrar-ajuste-cuadratura-drawer.component.ts` (`onSubmit`); `historial-cuadraturas.facade.ts:311-361`; `reportes-contables-content.component.ts:296-298`; `20260509000001_trg_instructor_monthly_hours_autorecalc.sql:31` |

---

## 2. Datos de prueba necesarios

Preparar antes de ejecutar (idealmente reutilizando los datos de `028` y `031`). Anotar el dato real
usado.

| Dato | Cómo debe estar | Para qué | Dato usado |
|---|---|---|---|
| D1 | Alumno B con saldo pendiente ≥ $300.000 en sede A | Pagos del día (efectivo, transferencia, tarjeta) | |
| D2 | Alumno B en sede B con saldo pendiente | Aislamiento de sedes en la caja | |
| D3 | Curso singular activo en sede A con cupo, precio conocido (ej. $90.000) | Cobro directo y cobro posterior (S9) | |
| D4 | Servicio especial del catálogo con precio conocido (ej. $25.000) | Venta que entra a la caja | |
| D5 | Vehículo con sede A, vehículo con sede B y (si existe) uno legacy sin sede | Egreso de combustible | |
| D6 | Instructor activo sede A con ≥ 13 clases B completadas en el mes | Liquidación, anticipos | |
| D7 | Instructor sede B con clases completadas | Tarifa por sede | |
| D8 | Tarifa por hora distinta por sede (ej. A = 5.000, B = 6.000) | Liquidaciones con "Todas" | |
| D9 | Cierres de caja de días anteriores en ambas sedes, uno con diferencia 0, uno faltante, uno sobrante, uno antiguo sin `opening_amount`/`cash_expenses` | Historial y fallbacks | |
| D10 | Mismo día cerrado en sede A **y** en sede B | S14 | |
| D11 | Gastos fijos (arriendo, sueldos) en el mes actual | Reportes | |
| D12 | Pago con `status='pending'` en el período (ej. matrícula con pago pendiente) | S10 | |
| D13 | Egresos categoría combustible, repair y materials en el mes | Rentabilidad | |
| D14 | Anticipo de un mes anterior sin liquidar | Decisión de arrastre | |

**Cuentas:** admin; secretaria sede A; secretaria sede B; secretaria con grant multi-sede
(`can_access_both_branches = true`); segundo navegador/perfil para los casos de 2 sesiones.

---

## 3. Casos

### A. Caja Diaria — carga y acceso

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Admin entra a `/app/admin/contabilidad/cuadratura` con "Todas las sedes" | Pantalla de "elige sede" (branch gate) con el texto "La Caja Diaria es por sede…" | ✓ | |
| A02 | Admin elige una sede en el gate | Carga la caja de esa sede; consola sin errores, red sin 4xx/5xx | ✓ | |
| A03 | Secretaria entra a `/app/secretaria/contabilidad/cuadratura` | Caja de su sede, sin gate | ✓ | |
| A04 | Hero | Título "Cuadratura Diaria", fecha de hoy (dd-mm-aaaa), chip "Caja Abierta" verde | ✓ | |
| A05 | KPIs del hero | Fondo inicial · Ingresos del día (efectivo) · Egresos del día (efectivo) · Saldo esperado = fondo + ingresos efvo − egresos efvo | ✓ | |
| A06 | Salir y volver | Datos al instante, sin skeleton | — | |
| A07 | Día sin movimientos | "No hay ingresos registrados hoy." y "No hay egresos registrados hoy." centrados, ambos paneles del mismo alto | ✓ | |
| A08 | Botón "Ver Historial" | Va a `…/historial-cuadraturas` del mismo rol | ✓ | |
| A09 | Desktop ≥ 1200 px de contenedor | Ingresos y Egresos lado a lado; abrir un drawer los apila y cambia a tarjetas | — | |
| A10 | 375 px | Tarjetas, sin scroll horizontal | ✓ | |
| A11 | Salir de la pantalla admin | El selector de sede vuelve a permitir "Todas" (se desactiva `requiresSpecificBranch`) | — | |

### B. Caja Diaria — ingresos

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | "Agregar Ingreso" | Abre "Registrar Ingreso" (drawer de Pagos) con el selector de alumnos poblado | ✓ | |
| B02 | Pago en efectivo de D1 | Fila con glosa "Matrícula #N — Clase B" (o el concepto), monto en Efectivo, Total correcto | ✓ | |
| B03 | Pago mixto (efectivo + transferencia) | Cada parte en su columna; Total = suma | ✓ | |
| B04 | Pago con voucher | Columna Voucher; **no** suma al efectivo ni al "otros" | — | |
| B05 | Pago de D2 (sede B) con la caja de A abierta | No aparece en A | ✓ | |
| B06 | Cobro de curso singular en efectivo (D3) | Fila "Curso singular: <curso> — <alumno>" en Efectivo | ✓ | |
| B07 | Curso singular inscrito como pendiente y cobrado después **(§4)** | Debe sumar al efectivo (S9) | — | |
| B08 | Venta de servicio especial (D4) | Fila "Servicio especial: …" en la columna **Tarjeta** (S18) y con N° de boleta si se ingresó | ✓ | |
| B09 | Pago registrado después de las 21:00 **(§4)** | Aparece en la caja de hoy (S7) | — | |
| B10 | Pie del panel | "Mostrando N ingresos", Total Ingresos (todos los métodos) y "en efectivo" | ✓ | |
| B11 | Nombre/glosa muy larga | Se trunca en la fila | — | |
| B12 | Eliminar ingreso como admin **(§4)** | Confirmación → el pago desaparece, el saldo del alumno vuelve y su estado de pago se recalcula (S1) | — | |
| B13 | Eliminar ingreso como secretaria **(§4)** | Error claro o botón oculto; **nunca** "eliminado" con el pago todavía ahí (S1) | — | |
| B14 | Eliminar un cobro de curso singular | La inscripción queda "pendiente de pago" (no se borra) | — | |
| B15 | Eliminar una venta de servicio especial | La venta queda pendiente de pago (no se borra); revisar que se vea así en Servicios especiales | — | |
| B16 | Ícono de eliminar solo aparece al pasar el mouse | Accesible con teclado (Tab → visible con foco) | — | |
| B17 | Pago de curso singular y pago normal con el mismo id | Ambas filas visibles, sin error en consola (S19) | — | |

### C. Caja Diaria — egresos

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | "Agregar Egreso" | Drawer con Tipo, Monto, Método (Efectivo por defecto), Descripción y Fecha "Hoy — no modificable" | ✓ | |
| C02 | Guardar sin completar | Errores por campo; botón "Guardar Egreso" deshabilitado | ✓ | |
| C03 | Monto 0 o negativo | "El monto debe ser mayor a 0." | ✓ | |
| C04 | Descripción de 1–2 letras | Inválido (mínimo 3) | — | |
| C05 | Combustible sin vehículo | "Seleccione el vehículo del egreso." | ✓ | |
| C06 | Combustible con vehículo de la sede A | Egreso en A con ícono de combustible y su tooltip | ✓ | |
| C07 | Admin en sede A registra combustible de un vehículo de la sede B | El egreso se va a B y **no** aparece en A — ¿es lo esperado? | — | |
| C08 | Vehículo legacy sin sede (admin) | Aparece el campo Sede, obligatorio | — | |
| C09 | Gastos Varios (admin) | Campo Sede visible y precargado con la sede activa | ✓ | |
| C10 | Gastos Varios (secretaria) | Sin campo Sede; queda en su sede | ✓ | |
| C11 | Egreso pagado con Transferencia/Tarjeta | Suma a "Total Egresos" pero **no** a "en efectivo" ni al saldo esperado | ✓ | |
| C12 | Anticipo a Instructor | Pide instructor (solo de la sede); se guarda en Anticipos y aparece en la lista sin categoría | ✓ | |
| C13 | Anticipo registrado después de las 21:00 **(§4)** | Aparece en la caja de hoy (S7) | — | |
| C14 | Eliminar egreso (admin y secretaria) | Confirmación; desaparece y los totales bajan | ✓ | |
| C15 | Eliminar un anticipo desde la caja como secretaria **(§4)** | Error claro o botón oculto (S2) | — | |
| C16 | Doble clic en "Guardar Egreso" | Un solo egreso | — | |
| C17 | Atajo de combustible del dashboard | Abre el drawer con tipo "Combustible" precargado; la siguiente apertura normal viene vacía | — | |

### D. Arqueo, borrador y cierre

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | "Arqueo y Cierre" | Drawer de 440 px con Fondo de Apertura, resumen y toggle apagado | ✓ | |
| D02 | Escribir el fondo | Solo acepta dígitos; el resumen "Debe Haber en Caja" y el KPI del hero se actualizan | ✓ | |
| D03 | Cerrar sin arqueo | Botón "Cerrar Caja" habilitado; el cierre guarda arqueo = saldo esperado y diferencia 0 | ✓ | |
| D04 | Activar arqueo y contar exacto | Diferencia $0 en verde; "Observaciones (Opcional)" | ✓ | |
| D05 | Contar de menos | Diferencia negativa en rojo; "Justificación Obligatoria"; botón deshabilitado hasta escribir algo | ✓ | |
| D06 | Contar de más | Diferencia "+" en amarillo; exige justificación | ✓ | |
| D07 | Justificación de solo espacios | No habilita el cierre | — | |
| D08 | Letras o "1.5" en billetes | Se limpian a dígitos | — | |
| D09 | Borrador: tipear, cerrar el navegador y volver **(§4)** | Fondo, toggle, cantidades y notas se conservan | — | |
| D10 | Borrador con el toggle apagado a mitad | Las cantidades tipeadas se conservan igual | — | |
| D11 | Admin cambia de sede con el drawer a medias **(§4)** | Cada sede conserva su propio conteo; nada se mezcla (S15) | — | |
| D12 | Día siguiente sin borrador | Fondo y billetes en 0 (S15) | — | |
| D13 | Confirmación "Cerrar Caja" → Cancelar | No cierra | ✓ | |
| D14 | Cerrar Caja **(§4, escenario día completo)** | Toast, chip "Caja Cerrada", botones de agregar/eliminar deshabilitados, inputs del drawer deshabilitados | ✓ | |
| D15 | Doble clic en "Cerrar Caja" | Un solo cierre | — | |
| D16 | Falla de red al cerrar **(§4)** | Error; la caja sigue abierta y el conteo no se pierde (S3) | — | |
| D17 | Cerrar dos veces desde 2 pestañas/sesiones **(§4)** | El segundo cierre se rechaza; el primero no se pisa (S4) | — | |
| D18 | Pestaña vieja con drawer abierto tipea después del cierre **(§4)** | La caja no vuelve a "abierta" (S4) | — | |
| D19 | Movimientos después del cierre **(§4)** | Definir: ¿se bloquean o van al día siguiente? Hoy entran a la pantalla pero no al cierre (S17) | — | |
| D20 | Secretaria con grant en "Todas" | No debería poder cerrar una caja "consolidada" (S16) | — | |

### E. Exportar la caja del día

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | Menú Exportar, cerrar con clic afuera | Se cierra | — | |
| E02 | Excel con caja abierta | `Cuadratura_AAAAMMDD.xlsx`, "Estado: Caja Abierta" | ✓ | |
| E03 | PDF con caja cerrada | Resultado del arqueo, desglose de billetes y "Cierre registrado" | ✓ | |
| E04 | Totales del archivo = pantalla **(§4)** | Fondo, total ingresos, efectivo, egresos, saldo teórico iguales (S6) | ✓ | |
| E05 | Venta de servicio especial en el export | Debe aparecer (S6) | — | |
| E06 | Anticipo de la otra sede el mismo día | No debe aparecer (S6) | — | |
| E07 | Pago de tarjeta en el PDF | Hoy no hay columna Tarjeta: la fila no cuadra a la vista (S6) | — | |
| E08 | Tildes/ñ en el PDF | Se ven bien o se reemplazan sin romper el texto | — | |
| E09 | Botón mientras exporta | "Exportando…" deshabilitado | — | |
| E10 | Seguridad **(§4)** | Una secretaria no obtiene la caja de otra sede (S5) | ✓ | |

### F. Historial de cuadraturas

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | Admin abre el historial | Calendario del mes actual LUN–DOM, hoy marcado; días cerrados con candado | ✓ | |
| F02 | Día cuadrado / faltante / sobrante (D9) | Badge "Cuadrado" verde / "Descuadre" con monto negativo rojo / monto "+" amarillo (el badge dice "Descuadre" también para sobrante, S20) | ✓ | |
| F03 | Hoy sin cierre | "En curso" | — | |
| F04 | Mes anterior / siguiente, cambio de año (dic → ene) | Navega bien; no ofrece meses futuros absurdos — ¿se permite? | ✓ | |
| F05 | Mes sin cierres (móvil) | "Sin Actividad" | ✓ | |
| F06 | Clic en un día cerrado | Drawer "Detalle Cuadratura — dd/mm/aaaa" | ✓ | |
| F07 | Detalle: conciliación | Fondo + ingresos efectivo − egresos efectivo = saldo teórico; físico; diferencia; egresos con tarjeta aparte | ✓ | |
| F08 | Detalle = cierre original **(§4)** | Cifras idénticas a las del momento del cierre, aunque después se haya movido algo (S17) | — | |
| F09 | Cierre antiguo sin fondo (D9) | "No registrado"; egreso en efectivo por fallback | — | |
| F10 | Cierre sin arqueo | Desglose vacío pero "Total Efectivo" con monto — ¿se entiende que no hubo conteo? | — | |
| F11 | Observaciones | Se muestran entre comillas, con saltos de línea | — | |
| F12 | Exportar mes (Excel) | Una fila por cierre con las 11 columnas | ✓ | |
| F13 | Exportar mes (PDF) | Mismos cierres y totales que el Excel | ✓ | |
| F14 | Exportar mes vacío | Aviso "No hay datos para exportar en este mes." | ✓ | |
| F15 | Exportar un cierre desde el detalle | Excel/PDF del día correcto y de su sede | ✓ | |
| F16 | Admin "Todas" con el mismo día cerrado en A y B (D10) **(§4)** | Se ven ambos cierres (S14) | — | |
| F17 | Secretaria abre el historial **(§4)** | Ve los cierres de su sede del mes (S13) | ✓ | |
| F18 | Secretaria exporta el mes en Excel y en PDF | Mismo contenido (S13) | — | |
| F19 | Admin cambia de sede | Recarga | ✓ | |

### G. Ajustes sobre cuadraturas cerradas

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| G01 | Admin ve "Registrar ajuste" en el detalle | Sí; la secretaria no | ✓ | |
| G02 | Gasto olvidado (combustible) de $10.000 **(§4)** | Ajuste −$10.000; se crea un gasto con la fecha del cierre y su sede; "Saldo vigente (con ajustes)" = físico − 10.000 | ✓ | |
| G03 | Corrección manual sin elegir Suma/Resta | Error pidiendo el efecto | ✓ | |
| G04 | Corrección manual "Suma" $5.000 | +$5.000, preview "El total vigente cambiará en +5.000" | ✓ | |
| G05 | Cambiar de tipo después de un intento fallido | El formulario vuelve a ser válido (S20) | — | |
| G06 | El snapshot original | Saldo físico y diferencia originales **no** cambian | ✓ | |
| G07 | Ajuste queda con autor y fecha/hora | Correctos (hora Chile) | — | |
| G08 | Borrar/editar un ajuste | No se puede (inmutable) | — | |
| G09 | Gasto olvidado en Reportes | Aparece en el mes del cierre corregido | — | |
| G10 | Secretaria ve la lista de ajustes | Hoy "Sin ajustes registrados" aunque existan (S13) — decisión | — | |

### H. Reportes contables

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | Admin abre Reportes | Hero con Total Ingresos, Total Gastos, Total Neto; chip de escuela; pestaña Categorías | ✓ | |
| H02 | Rango por defecto | "Mes actual" (1 al último día) | ✓ | |
| H03 | Mes anterior / Último trimestre / Año actual | Fechas del chip correctas (trimestre = 1° de hace 2 meses → hoy; año = 1 ene → 31 dic) | ✓ | |
| H04 | Personalizado | Aparecen Desde/Hasta; recarga solo con ambas fechas y Desde ≤ Hasta; con Desde > Hasta no pasa nada — ¿debería avisar? | ✓ | |
| H05 | Totales = Pagos + Servicios especiales + cursos singulares − egresos − gastos fijos **(§4)** | Coinciden al peso (S10) | — | |
| H06 | Pago pendiente (D12) en el período | No debe sumar (S10) | ✓ | |
| H07 | Ingresos por categoría | Clase B / Profesional / Clases Extra / Psicotécnico / Cursos Singulares; % suman 100,0 | ✓ | |
| H08 | Admin "Todas" | Categorías con sede ("Clase B (A. Chillán)"); total = A + B **(§4)** | ✓ | |
| H09 | Gastos por categoría | Combustible y "fuel" en una sola fila "Bencina"; sin categoría → "Gastos Varios" | ✓ | |
| H10 | Margen | (Neto / Ingresos) con 1 decimal; badge rojo si es negativo (S20) | — | |
| H11 | Pestaña Evolución Mensual | El selector cambia a Últimos 6/12 meses, Año actual, Año anterior; meses sin datos en 0 | ✓ | |
| H12 | Cambiar el rango de Evolución | No cambia los KPIs del hero ni Categorías | ✓ | |
| H13 | Volver a Categorías | El selector muestra de nuevo el rango general | — | |
| H14 | Pestaña Rentabilidad **(§4)** | Prorrateo según la fórmula; etiqueta del período ("Septiembre 2026" o rango) | ✓ | |
| H15 | Rentabilidad sin clases completadas | Bencina/reparaciones se reparten por ingresos | — | |
| H16 | Pestaña Gastos Fijos (admin) | Tabla con fecha, categoría, descripción, monto y total | ✓ | |
| H17 | Registrar Gasto Fijo | Exige sede; aparece en la tabla y en Total Gastos | ✓ | |
| H18 | Secretaria | Sin pestaña Gastos Fijos; totales sin gastos fijos — ¿debe verlos? | ✓ | |
| H19 | Export Excel/PDF = pantalla **(§4)** | Mismos totales (S10) | ✓ | |
| H20 | Seguridad export | Secretaria no obtiene otras sedes (S5) | ✓ | |
| H21 | Curso singular pagado a las 22:30 del último día del mes | Cuenta en ese mes (S7) | — | |
| H22 | Filtros al salir y volver | Se conservan (facade singleton) — confirmar si es lo deseado | — | |

### I. Anticipos (solo admin)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| I01 | Secretaria escribe `/app/admin/contabilidad/anticipos` | Acceso denegado | ✓ | |
| I02 | Admin abre Anticipos | KPIs Anticipos Pendientes, Total Anticipado, Ya Descontados; pestaña Cuenta Corriente | ✓ | |
| I03 | Cuenta corriente | Instructores activos de la sede, primero los con saldo pendiente | ✓ | |
| I04 | "Registrar Anticipo" del hero | Drawer con instructor vacío, fecha hoy, monto, motivo, descripción | ✓ | |
| I05 | Botón de fila (ícono check) | Abre el drawer con el instructor precargado; solo existe en filas con saldo pendiente — ¿y los "Al día"? | — | |
| I06 | Monto 0 | "Ingrese un monto mayor a cero." | ✓ | |
| I07 | Anticipo con fecha pasada o futura **(§4)** | ¿Se debe permitir? Hoy afecta la caja de esa fecha (incluso cerrada) y se registra en efectivo sin preguntar | — | |
| I08 | Historial | Fecha, instructor, motivo (descripción o motivo), monto, estado | ✓ | |
| I09 | Cambio de sede | Recarga solo instructores/anticipos de la sede | ✓ | |
| I10 | Anticipo registrado de noche | Fecha de hoy (S7) | — | |
| I11 | Notificación al instructor | Se crea (aunque el portal esté bloqueado en el piloto) | — | |

### J. Liquidaciones

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | Admin abre Liquidaciones | Mes actual; KPIs Total Nómina, Anticipos, Pagados N/M | ✓ | |
| J02 | Cálculo de una fila **(§4)** | Horas = clases × 0,75 (1 decimal); Base = horas × tarifa de la sede; Líquido = Base − anticipos del mes, mínimo 0 | ✓ | |
| J03 | "Todas las sedes" con tarifas distintas (D8) | Cada fila con la tarifa de su sede | ✓ | |
| J04 | Cambiar la tarifa en Ajustes con Liquidaciones abierta | Se recalcula sola (Realtime) | — | |
| J05 | Buscar por nombre o RUT | Filtra; totales del pie siguen el filtro | ✓ | |
| J06 | Pagar en efectivo **(§4)** | Queda "Pagado"; anticipos del mes "Descontado"; toast | ✓ | |
| J07 | Pagar por transferencia sin código | "Ingresa el código de la transferencia para continuar." | ✓ | |
| J08 | Método y código quedan guardados | Hoy no se guardan (S12) | — | |
| J09 | Anticipos > base | Líquido $0 en pantalla; revisar el `net_payment` guardado (S12) | — | |
| J10 | Deshacer pago | Pide confirmación (hoy no, S12); vuelve a Pendiente y los anticipos a pendientes | — | |
| J11 | Fila pagada y luego se completa otra clase del mes | ¿Cambian los montos de una liquidación ya pagada? (S12) | — | |
| J12 | Clase profesional completada | No suma horas (solo Clase B) — decisión | — | |
| J13 | Mes anterior/siguiente | Recalcula con los datos del período | ✓ | |
| J14 | Export Excel/PDF = pantalla | Mismos montos | ✓ | |
| J15 | Secretaria abre Liquidaciones **(§4)** | Ve lo mismo que el admin o no tiene acceso; nunca montos en cero (S11) | — | |
| J16 | Seguridad export nómina | La secretaria no descarga la nómina de otra sede (S5) | ✓ | |
| J17 | Pago de liquidación en efectivo y caja del día | ¿Debe aparecer como egreso? (S12) | — | |

### K. Cursos Singulares (lo que toca a la caja)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | Admin y secretaria abren `/contabilidad/cursos` | Lista con KPIs Cursos Activos, Total Inscritos, Ingresos Cobrados, Por Cobrar | ✓ | |
| K02 | Filtros tipo (SENCE/Particular) y estado | Filtran lista y totales | ✓ | |
| K03 | Inscribir pagando en efectivo | "Cobrado" sube; aparece en la caja de hoy (B06) | ✓ | |
| K04 | Inscribir con descuento y cobrar después | Se cobra precio − descuento; entra a la caja con el método correcto (S9) | — | |
| K05 | Cambio de sede (admin) | Recarga | ✓ | |

### L. Sedes, roles y tiempo real

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| L01 | Suma de sedes = "Todas" en Reportes y Liquidaciones **(§4)** | A + B = Todas | ✓ | |
| L02 | Secretaria A intenta leer la caja de B desde consola | 0 filas (RLS) | ✓ | |
| L03 | 2 sesiones: pago en A con la caja abierta en B **(§4)** | Aparece sin recargar (S8) | — | |
| L04 | 2 sesiones: egreso o cierre en A | ¿B se entera? (S8) | — | |
| L05 | Salir de la caja | El canal Realtime se cierra | — | |
| L06 | Secretaria con grant cambia de sede en la caja/historial | Recarga (S16) | — | |

### M. Visual y accesibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | Modo oscuro y claro en las 6 pantallas | Legible, incluidos badges, diferencias y calendario | ✓ | |
| M02 | 375 / 768 / 1440 px | Sin scroll horizontal; desktop app-like (scroll interno) | ✓ | |
| M03 | Solo teclado | Se llega a eliminar ingreso/egreso, días del calendario (Enter) y toggles | — | |
| M04 | Montos negativos | Un solo signo (sin "− -$500") | — | |

---

## 4. Casos con pasos numerados

### Escenario de día completo (D14, E04, F08) — el caso principal

**Precondición:** sede A, caja de hoy sin movimientos ni cierre; D1, D3, D4, D5 (vehículo A), D6.
Sesión de secretaria de la sede A.

1. Abrir Cuadratura → "Arqueo y Cierre" → Fondo de Apertura **50.000** → cerrar el panel.
2. Registrar en Pagos (o "Agregar Ingreso"): matrícula D1 **180.000 efectivo**; cuota D1 **120.000 transferencia**; pago D1 **60.000 tarjeta**.
3. Inscribir un alumno en D3 pagando **90.000 efectivo**.
4. Vender D4 (psicotécnico) por **25.000**.
5. Agregar Egreso: Combustible, vehículo A, **30.000 efectivo**; Gastos Varios **15.000 transferencia**; Anticipo a Instructor D6 **20.000 efectivo**.
6. Verificar en pantalla:
   - Ingresos: 5 filas; Total **475.000**; en efectivo **270.000** (180.000 + 90.000; el servicio especial va a Tarjeta).
   - Egresos: 3 filas; Total **65.000**; en efectivo **50.000**.
   - Hero: Fondo 50.000 · Ingresos efvo 270.000 · Egresos efvo 50.000 · Saldo esperado **270.000**.
7. Exportar Excel y PDF (caja abierta) y comparar con el paso 6 (S6: el fondo del export saldrá 0 y faltará el servicio especial si la sospecha se confirma).
8. "Arqueo y Cierre" → activar arqueo → contar 13 × $20.000, 1 × $5.000, 4 × $1.000, 1 × $500 = **269.500**.
9. Verificar Diferencia **−$500** en rojo y "Justificación Obligatoria"; "Cerrar Caja" deshabilitado.
10. Escribir "Vuelto mal dado" → Cerrar Caja → confirmar.
11. Ir al Historial (admin, sede A) → día de hoy → detalle.

**Esperado en el cierre (paso 11 y en la BD):** efectivo 270.000; transferencia 120.000; tarjeta
85.000 (60.000 + 25.000); voucher 0; total ingresos 475.000; total egresos 65.000; egresos en
efectivo 50.000; saldo sistema 270.000; físico 269.500; diferencia −500; estado "Descuadre"/Faltante;
cajero = la secretaria; nota visible. **Evidencia:** capturas de los pasos 6, 9 y 11 + Excel/PDF.

12. (F08) Registrar un pago más de 10.000 en efectivo después del cierre y volver al detalle del
    historial: debe seguir mostrando 270.000/269.500/−500 (snapshot). Anotar qué muestra la Caja
    Diaria (S17).

### B07 — Curso singular cobrado después (S9)

**Precondición:** D3.
1. Inscribir un alumno en D3 eligiendo "pendiente" como método.
2. En el detalle del curso, "Registrar cobro" de ese alumno.
3. Abrir la Caja Diaria.

**Esperado:** la fila del curso singular muestra el monto en una columna de método (idealmente
pregunta con qué pagó) y suma a "en efectivo" si fue efectivo. Si la fila tiene Total pero todas las
columnas en "—", S9 confirmada.

### B09 / C13 — Movimientos de noche (S7)

**Precondición:** ejecutar después de las 21:00 hora de Chile (septiembre: UTC−3; también probar en
invierno si es posible).
1. Registrar un pago normal, cobrar un curso singular y registrar un anticipo desde "Agregar Egreso".
2. Revisar la Caja Diaria de hoy.
3. Al día siguiente, revisar la caja del día nuevo.

**Esperado:** los 3 movimientos en la caja de hoy y ninguno en la de mañana. Anotar cuál salta de
día.

### B12 / B13 — Eliminar un ingreso (S1)

**Precondición:** D1 con un pago de 50.000 de hoy; anotar su saldo pendiente y estado de pago en la ficha.
1. Sesión **secretaria**: en la caja, tacho del pago → confirmar.
2. Recargar la caja y abrir la ficha de D1.
3. Repetir con sesión **admin** sobre otro pago.

**Esperado:** secretaria → error o acción no disponible, el pago sigue y el saldo del alumno **no
cambió**. Admin → el pago desaparece, el saldo vuelve exactamente +50.000 y el estado de pago se
recalcula. Si la secretaria ve "eliminado" y el pago sigue con el saldo alterado → **P0** (S1).

### C15 — Eliminar un anticipo desde la caja como secretaria (S2)

1. Secretaria registra un anticipo desde "Agregar Egreso".
2. Tacho del anticipo → confirmar.
3. Recargar.

**Esperado:** error o botón no disponible; nunca toast de éxito con la fila todavía ahí.

### D09 — Borrador persistido

1. Arqueo y Cierre: fondo 40.000, activar arqueo, 2 × $10.000, nota "prueba".
2. Esperar 2 segundos y cerrar el navegador por completo.
3. Volver a entrar a la caja y abrir el drawer.

**Esperado:** fondo 40.000, toggle activado, 2 × $10.000 y la nota. La caja sigue "Abierta".

### D11 — Cambio de sede con el arqueo a medias (S15)

**Precondición:** admin; ninguna de las 2 sedes con borrador hoy.
1. Sede A → fondo 30.000 y 3 × $1.000; **inmediatamente** (menos de 1 s) cambiar a la sede B.
2. En B abrir el drawer.
3. Volver a A.

**Esperado:** en B fondo 0 y sin billetes; en A 30.000 y 3 × $1.000. Si B muestra los datos de A o
A quedó vacía, S15 confirmada.

### D16 — Falla al cerrar (S3)

1. Dejar el arqueo listo; DevTools → Network → Offline.
2. Cerrar Caja → confirmar.

**Esperado:** mensaje de error, la caja sigue "Abierta" y el conteo sigue ahí. Si dice "Caja cerrada
correctamente" y al volver la red sigue abierta con el conteo borrado, S3 confirmada.

### D17 / D18 — Dos sesiones sobre el mismo cierre (S4)

**Precondición:** 2 navegadores con la caja de la sede A abierta (A = admin, B = admin o secretaria).
1. En A, cerrar con arqueo 100.000.
2. En B (sin recargar), abrir el drawer, contar 90.000 y "Cerrar Caja".
3. En otra prueba: después del cierre en A, en B tipear un número en el drawer y esperar 2 s.
4. Recargar ambos y revisar el historial.

**Esperado:** el cierre de A queda intacto (100.000, cajero A); el paso 2 se rechaza con mensaje; en
el paso 3 la caja **no** vuelve a "Abierta". Anotar cualquier sobrescritura.

### D19 — Movimientos después del cierre (S17)

1. Con la caja de hoy cerrada: registrar un pago en Pagos, una venta de servicio especial y un
   egreso desde el atajo del dashboard.
2. Mirar la Caja Diaria y el detalle del cierre en el historial.

**Esperado:** según la decisión de negocio (§5). Hoy: la pantalla los suma, el cierre no.

### E04 / H19 — Export = pantalla

1. Con el escenario del día completo, exportar la caja (Excel y PDF) y comparar cada total.
2. En Reportes (mes actual, sede A) anotar los 3 KPIs; exportar Excel y PDF; comparar.

**Esperado:** mismas cifras. Anotar cada diferencia y su causa probable (S6, S10).

### E10 / H20 / J16 — Seguridad de las edge functions (S5)

**Precondición:** sesión de secretaria de la sede A.
1. Exportar la caja y copiar la petición `generate-cash-closing-report` desde Network ("Copy as fetch").
2. En Console, repetirla con `branch_id: null` y luego con el id de la sede B.
3. Repetir con `generate-financial-report`, `generate-cash-history-report` y `generate-payroll-report`
   (esta última se puede invocar aunque la pantalla no lo permita).

**Esperado:** 403 o solo datos de la sede A. Si trae otra sede o la nómina → **P0 inmediato**.

### F16 — Mismo día cerrado en las 2 sedes (S14)

**Precondición:** D10.
1. Admin, "Todas las sedes", Historial del mes.
2. Mirar el día D10.
3. Abrir el detalle y exportar el cierre.

**Esperado:** se distinguen los 2 cierres; el export corresponde a la sede del cierre, no "Todas las escuelas".

### F17 — Historial de la secretaria (S13)

**Precondición:** la sede A tiene cierres hace 5, 10 y 20 días.
1. Secretaria A abre el Historial.
2. Exportar Excel y PDF del mes.

**Esperado:** ve los 3 cierres y ambos archivos coinciden. Si solo ve los últimos 3 días y el PDF trae
más, S13 confirmada (decidir en §5 si la secretaria debe ver el historial completo).

### G02 — Gasto olvidado

**Precondición:** admin; cierre de ayer de la sede A con físico 200.000.
1. Detalle → "Registrar ajuste" → Gasto olvidado → Combustible → vehículo → 10.000 → motivo.
2. Verificar el preview "−10.000" y guardar.
3. Revisar el detalle, Reportes del mes y la tabla `expenses`.

**Esperado:** ajuste −10.000 con autor; "Saldo vigente (con ajustes)" 190.000; saldo físico original
200.000 intacto; gasto de combustible con la fecha de ayer y la sede A en Reportes.

### H05 — Reportes = módulos de origen

**Precondición:** mes actual, sede A, con el escenario del día completo más D11 y D12.
1. Sumar a mano: pagos pagados (Pagos) + cursos singulares cobrados + ventas de servicios especiales.
2. Sumar egresos (`expenses`) + gastos fijos.
3. Comparar con Total Ingresos / Total Gastos / Neto.

**Esperado:** iguales al peso. Anotar si D12 (pendiente) aparece sumado o si faltan los servicios
especiales (S10).

### H08 / L01 — Suma de sedes

1. Reportes con sede A, sede B y "Todas": anotar ingresos, gastos y neto.
2. Liquidaciones con A, B y "Todas": anotar Total Nómina y Anticipos.

**Esperado:** Todas = A + B en cada cifra.

### H14 — Rentabilidad con números

**Precondición:** período con ingresos Clase B 1.000.000 y Profesional 500.000; egresos bencina
90.000 + reparación 30.000 (en `expenses`) + materiales 15.000; 30 clases B y 10 profesionales
completadas.
1. Pestaña Rentabilidad.

**Esperado:** pool vehículo 120.000 → Clase B 90.000 / Profesional 30.000; materiales 15.000 →
10.000 / 5.000. Clase B: gastos 100.000, margen 900.000, **90,0 %**. Profesional: gastos 35.000,
margen 465.000, **93,0 %**. Los gastos fijos no entran. Cambiar el rango a "Mes anterior" cambia la
etiqueta del período y los números.

### I07 — Anticipo con fecha distinta a hoy

1. Anticipos → Registrar → fecha de ayer (ya cerrada) → 15.000.
2. Revisar la caja de ayer en el historial, la Caja Diaria de hoy y Liquidaciones.

**Esperado:** definir la regla (§5). Hoy queda como egreso en efectivo de ayer (el cierre no lo
refleja) y cuenta en la liquidación de ese mes.

### J02 / J06 — Liquidación con números

**Precondición:** D6 con 13 clases B completadas en el mes, tarifa sede A 5.000, anticipo del mes 20.000.
1. Revisar la fila de D6.
2. "Pagar" → Efectivo → Confirmar.
3. Revisar Anticipos y la tabla `instructor_monthly_payments`.

**Esperado:** Clases 13; Horas **9,8** (9,75 redondeado, S20); Base **49.000** (con 9,75 exactas
serían 48.750 — anotar cuál es la regla deseada); Anticipos −20.000; Líquido **29.000**. Tras pagar:
"Pagado", anticipo "Descontado", `net_payment` 29.000. Con tarifa 6.000 en sede B, la misma cantidad
de clases da 58.800.

### J15 — Liquidaciones como secretaria (S11)

1. Secretaria A abre Liquidaciones del mes en curso.
2. Comparar con lo que ve el admin en la sede A.
3. Exportar la nómina como secretaria.

**Esperado:** o no tiene acceso, o ve lo mismo que el admin. Si ve horas 0/base $0 y el Excel trae
montos reales, S11 confirmada.

### L03 — Tiempo real en la caja (S8)

**Precondición:** 2 navegadores (no 2 pestañas), ambos en la caja de la sede A.
1. En A, registrar un pago → mirar B 5 s.
2. En A, registrar un egreso → mirar B.
3. En A, cerrar la caja → mirar B.

**Esperado:** B se actualiza sin recargar en los 3 pasos. Si ninguno llega, recargar B para confirmar
que el dato existe (S8).

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| B08 / S18 | ¿Los servicios especiales cobrados en efectivo deben contar para el arqueo? ¿Hay que preguntar el método? |
| B13 | ¿La secretaria puede eliminar ingresos del día o solo el admin? |
| C07 | ¿El combustible de un vehículo de otra sede se imputa a la sede del vehículo o a la caja donde se pagó? |
| D19 / S17 | Con la caja cerrada: ¿se bloquean pagos/egresos del día o pasan a la caja siguiente? ¿Se puede reabrir una caja y quién? |
| D20 | ¿Una secretaria multi-sede puede ver/cerrar la caja en "Todas"? |
| F04 | ¿Se puede navegar a meses futuros en el historial y liquidaciones? |
| F10 | ¿Cómo se muestra un cierre sin conteo físico? |
| F17 / G10 / S13 | ¿La secretaria debe ver el historial completo de su sede y los ajustes? |
| H04 | ¿El rango personalizado debe avisar si Desde > Hasta? |
| H05 / S10 | ¿Anticipos y liquidaciones pagadas cuentan como gasto en Reportes? ¿Las ventas de servicios especiales como ingreso? |
| H18 | ¿La secretaria debe ver los gastos fijos? |
| H22 | ¿Los filtros de Reportes se conservan al salir y volver? |
| I05 | ¿Un instructor "Al día" debe tener botón para registrarle un anticipo desde su fila? |
| I07 | ¿Se permiten anticipos con fecha pasada/futura? ¿Siempre en efectivo? |
| J02 | ¿Horas redondeadas a 1 decimal o exactas (0,75 por clase)? |
| J09 / D14 | Si los anticipos superan la base, ¿el saldo se arrastra al mes siguiente? ¿Qué pasa con anticipos de meses sin liquidar? |
| J12 | ¿Las clases profesionales (y teóricas) se pagan en la liquidación? |
| J15 / S11 | ¿La secretaria debe ver/pagar liquidaciones? (la ruta existe) |
| J17 / S12 | ¿El pago de liquidación en efectivo debe salir de la caja del día? |
