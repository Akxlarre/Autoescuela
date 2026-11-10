# Fix: Testing — Contabilidad (cuadratura, historial, reportes, anticipos, liquidaciones, cursos)
> id: fix-073-i-testing-contabilidad
> refs: ASG-i-029
> status: in_progress
> created: 2026-11-09

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> **Checklist que se ejecuta:** `specs/testing-piloto/029-contabilidad.md`.

## Root Cause

[Heredado de ASG-i-029, a confirmar]: Contabilidad es donde se cierra la caja y se sacan los
números del negocio. Todo lo que se cobra, egresa o liquida en otros módulos tiene que cuadrar
acá, al peso, y los PDFs/Excel que generan las edge functions tienen que coincidir con lo que
muestra la pantalla.

**Clasificación:** Integración · dificultad Alta · rutas:
`/app/{admin,secretaria}/contabilidad/{cuadratura,historial-cuadraturas,reportes,liquidaciones,cursos}`,
`/app/admin/contabilidad/anticipos`.

### Alcance confirmado al reclamar (Ignacio, 2026-11-09)

Las 3 capas de la ASG entran en este track: funcional (ACs de `0002-i`, `0003-i`, `0004-i`,
`0012-m`, `0014-m`, `0015-m`, `fix-226-m`, `fix-237-m`), E2E manual (casos A…M del checklist) y
candidatos a Playwright ("Auto ✓").

**Supuestos confirmados al reclamar:**

1. **Las sospechas ya resueltas por otros tracks se ejecutan como regresión, no como sospecha.**
2. **Los datos de prueba se crean en la base compartida con el plan y el SQL aprobados antes por
   Ignacio**, que los aplica él. Se limpian al cerrar.
3. **Este track no corrige nada:** cada bug confirmado abre su propio fix/hotfix.

## Revisión de las sospechas contra el código (2026-11-09, sin navegador)

Leído el código actual (`main` @ `42e5628f`). Las políticas RLS se leyeron en las migraciones del
repo, no en la base remota. Falta confirmar en el navegador todo lo que figura como "sigue".

| # | Estado en código | Detalle |
|---|---|---|
| S1–S4 | Resuelta — regresión | `fix-044-i`: la secretaria no ve "quitar pago", las escrituras revisan error/filas, cierre definitivo (trigger `CIERRE_DEFINITIVO`). |
| S5 | Resuelta — regresión | `0009-i` (`requireStaff`) + `fix-430-m` (la sede se valida en el servidor). |
| S6 | **Sigue** | `generate-cash-closing-report`: pagos por `created_at` (la pantalla usa `payment_date`); sin `special_service_sales`; anticipos sin filtro de sede (suma y muestra los de la otra sede); fondo solo de un cierre `closed` (caja abierta ⇒ $0). |
| S7 | Resuelta — regresión | `0024-m` (fechas en hora de Chile). |
| S8 | Resuelta — regresión | `fix-360` publica `expenses`, `cash_closings`, `standalone_course_enrollments`, `special_service_sales`; `payments` e `instructor_advances` ya estaban. |
| S9 | **Sigue** | `CursosSingularesFacade.marcarEnrollmentPagado()` no cambia `payment_method`: una inscripción "pendiente" cobrada después suma al Total de la caja y a ninguna columna. |
| S10 | A medias | Pantalla corregida (estados que suman + servicios especiales, `fix-047-i`; `ASG-i-060` descartada). El export `generate-financial-report` sigue sin `fixed_expenses` y sin la categoría `combustible`. |
| S11 | **Sigue** | RLS de `instructor_monthly_hours` / `instructor_monthly_payments`: solo admin e instructor. La secretaria tiene la ruta y ve $0. |
| S12 | **Sigue** | `net_payment` = base − anticipos (puede ser negativo); no se guardan método ni código de transferencia; "Deshacer" sin confirmación. |
| S13 | **Sigue** | `select_cash_closings`: secretaria solo `chile_today() - 2`; `cuadratura_adjustments` solo admin. |
| S14 | **Sigue** | `historial-cuadraturas-content`: `new Map(cierres.map(c => [c.fecha, c]))`. |
| S15 | **Sigue** | `checkCajaStatus()` restaura solo si hay borrador; si no, quedan fondo y billetes anteriores. `buildBorradorPayload()` toma la sede al persistir (debounce 800 ms). |
| S16 | **Sigue** | Secretaria con grant: sin gate de sede; con "Todas" `branch_id` null. |
| S17 | A medias | Bloqueados en día cerrado: `payments` (`fix-051-i`), `expenses` e `instructor_advances` (`fix-445-m`) y `special_service_sales` (trigger que la búsqueda en migraciones no encontró; confirmado en la base y en el navegador). **Sin bloqueo:** `standalone_course_enrollments`. |
| S18 | Resuelta — regresión | `fix-047-i`: medio de pago real de la venta. |
| S19 | **Sigue** | `cuadratura-content`: `track fila.id` con ids de 3 tablas. |
| S20 | Sin revisar | Detalles de UI menores. |

## Decisiones de negocio (Ignacio, 2026-11-09)

Responden a la §5 del checklist:

- **D19 / S17 — Caja cerrada:** no se registra ningún ingreso en un día con la caja cerrada,
  tampoco cobros de curso singular ni ventas de servicios especiales.
- **Tope de anticipos:** $300.000 por instructor, **sumando todos los anticipos del mes**. Se
  puede superar con una justificación obligatoria, que queda guardada junto con quién lo
  autorizó.
- **J09 / D14 — Anticipos mayores que el sueldo:** al liquidar se descuenta como máximo el sueldo
  base del mes; el líquido nunca queda negativo (ni en pantalla ni en `net_payment`). El
  excedente queda como anticipo pendiente y se descuenta en la liquidación siguiente.
- **J15 / S11 — Secretaria en Liquidaciones:** ve y exporta las liquidaciones de **su sede**.
  Puede marcar una liquidación como **pagada** (el admin paga, pero quien registra en el sistema
  es la secretaria); **no** puede deshacer un pago, eso queda solo para el admin.
- **Auditoría del pago:** marcar una liquidación como pagada (y deshacerla) debe aparecer en la
  vista de Auditoría con quién lo hizo, cuándo y qué marcó (instructor, período, montos). Hoy
  `instructor_monthly_payments` e `instructor_advances` no tienen trigger de auditoría.
- **Aviso de pagos sin marcar:** Liquidaciones avisa cuando un mes ya terminado tiene
  instructores sin marcar como pagados.

Pendientes de decidir: el resto de la §5 del checklist (B08, C07, D20, F04, F10, F17/G10, H04,
H05, H18, H22, I05, I07, J02, J12, J17).

## ACs Afectados

Ninguno — track de testing (originado de ASG-i-029). Los ACs de las specs listadas en "Alcance"
se verifican como regresión.

## Cambio

- **Archivo:** ninguno de producto. Solo este `fix.md` y el checklist.
- **Qué cambia:** registro de resultados y de los fixes que se abran.

## Resultados

### Tanda 1 — Escenario de día completo, sede 1 (2026-11-10, ~02:40–03:00 hora Chile)

Sesión `secretaria@test.com` (Lorena Morales, sede 1). Datos escritos en la base (todos con
`QA-073` en boleta o descripción, salvo los cursos singulares):

- `payments`: 3 abonos de Joaquín Sandoval (`qa058.claseb`, matrícula 8495): $50.000 efectivo
  (`QA-073-1`), $30.000 transferencia (`QA-073-2`), $10.000 tarjeta (`QA-073-3`). Su saldo queda en $0.
- `standalone_course_enrollments`: curso 2 "Operador de Retroexcavadora" — Joaquín pagado en
  efectivo ($220.000) y Camila Reyes (99.123.457-8) "pendiente" y cobrada después ($220.000);
  curso 1 "test" — Camila pagada en efectivo **después del cierre** ($280.000).
- `special_service_sales`: Psicotécnico $20.000 efectivo (`QA-073-4`).
- `expenses`: combustible ABCD43 $30.000 efectivo; gasto varios $15.000 transferencia.
- `instructor_advances`: Gabriel Molina (instructor 222) $20.000 efectivo.
- `cash_closings` id 62: sede 1, 2026-11-10, `closed`, fondo 50.000, efectivo 290.000,
  transferencia 30.000, tarjeta 10.000, total 550.000, egresos 65.000, saldo 290.000,
  arqueo 289.500, diferencia −500, `closed_by` 8, nota "Vuelto mal dado (QA-073)".

| Caso | Res. | Evidencia |
|---|---|---|
| A03 / A04 / A07 | ✅ | Caja de la sede 1 sin gate, "Cuadratura Diaria", 10-11-2026, "Caja Abierta"; día vacío con ambos mensajes. |
| D02 / D08 | ✅ | El fondo y los billetes descartan letras (`5a0.000` → 50000, `1a4` → 14); hero y resumen se actualizan. |
| B02 / B03 / B10 | ✅ | Efectivo, transferencia y tarjeta en su columna; pie "Mostrando N", total y efectivo correctos. |
| B06 | ✅ | Curso singular pagado en efectivo → fila "Curso singular: … — Joaquín Sandoval" en Efectivo. |
| **B07 / S9** | ❌ **confirmada** | Inscripción "pendiente" + "Marcar cobrado": no pide medio de pago ni confirmación; la fila sale con método "—", suma $220.000 al Total y $0 al efectivo. El cierre guardó `total_income` 550.000 con solo 330.000 repartidos en columnas. |
| B08 / S18 | ✅ regresión | Psicotécnico en efectivo suma al efectivo y al arqueo (`fix-047-i`). |
| B09 / S7 | ✅ parcial | Pagos registrados a las 02:42 hora Chile caen en la caja del 10-11 y la fecha del pago viene por defecto en 10/11/2026. **Falta** la ventana 21:00–24:00 (donde UTC ya es el día siguiente). |
| C01 / C02 / C03 | ✅ | Drawer con fecha "Hoy — no modificable"; Guardar deshabilitado vacío; monto 0 → "El monto debe ser mayor a 0.". |
| C06 / C10 / C11 / C12 | ✅ | Combustible con vehículo de la sede (lista incluye el "Ambas" AB1234); secretaria sin campo Sede; transferencia fuera del efectivo; anticipo pide instructor y entra a la lista. |
| A05 / escenario §4 paso 6 | ✅ | Ingresos 6 filas, total 550.000, efectivo 290.000; egresos 3 filas, total 65.000, efectivo 50.000; saldo esperado 50.000 + 290.000 − 50.000 = 290.000. (Montos distintos a los del checklist: el alumno de prueba debía $90.000 y el curso cuesta $220.000.) |
| **E02 / E04 / S6** | ❌ **confirmada** | Excel y PDF con caja abierta: fondo **$0** (pantalla 50.000), total **530.000** (pantalla 550.000: falta el Psicotécnico), efectivo **270.000** (290.000), saldo teórico **220.000** (290.000). |
| **E07** | ❌ | El PDF no tiene columna Tarjeta: el abono de $10.000 con tarjeta sale "$0 $0 $0 … $10.000". El Excel la llama "Otro". |
| E (Excel egresos) | ❌ menor | Los egresos del Excel/PDF no muestran el método de pago (solo Gasto/Anticipo). |
| D05 / D07 | ✅ | Diferencia "$-500" en rojo, "Justificación obligatoria"; solo espacios no habilita el cierre. |
| D09 | ✅ | Recargar la página conserva fondo, toggle, billetes y nota. |
| D13 | ✅ | Cancelar en la confirmación no cierra. |
| D14 | ✅ | Cierre con toast, chip "Caja Cerrada", agregar/eliminar y fondo deshabilitados; fila en BD con los montos del escenario. |
| D19 / S17 — pago de matrícula | ✅ | Pagos → abono de Camila Reyes con la caja cerrada: "La caja del 10-11-2026 ya está cerrada: no se puede registrar un pago con esa fecha." |
| D19 / S17 — servicio especial | ✅ | Venta rechazada con el mismo mensaje (trigger `trg_special_service_sales_caja_cerrada`; la revisión de código lo había dado por faltante). |
| **D19 / S17 — curso singular** | ❌ **confirmada** | Inscripción pagada en efectivo ($280.000) con la caja cerrada: "Alumno inscrito correctamente". La Caja Diaria pasa a efectivo 570.000 y total 830.000, mientras el cierre sigue en 290.000/550.000. `standalone_course_enrollments` es la única tabla de ingresos sin trigger de caja cerrada. |
| Consola | ✅ | Solo los dos 400 esperados de los rechazos por caja cerrada. |

Detalles menores vistos (no abren fix por sí solos): la glosa de un pago de matrícula muestra solo
el concepto ("Abono"), sin el nombre del alumno; las filas de ingresos no salen en orden de hora.

### Tanda 2 — Sede 2, Historial, ajustes, Reportes y Liquidaciones (2026-11-10, ~03:00–03:15)

Datos escritos además de la tanda 1:

- `payments`: abono $10.000 efectivo de Marcos Sandoval Pizarro (99.563.148-2, matrícula N° 0073
  Clase B, sede 2), boleta `QA-073-5`. Sesión `secretaria2@test.com` (Maria Torres).
- `cash_closings`: sede 2, 2026-11-10, `closed`, arqueo 1 × $10.000, diferencia 0.
- `cuadratura_adjustments` + `expenses`: gasto olvidado combustible ABCD43 $10.000 sobre el cierre
  id 62 (sede 1), motivo "QA-073 bencina olvidada", admin.
- `fixed_expenses`: Arriendo $100.000, sede 1, 2026-11-10, "QA-073 arriendo noviembre".
- `instructor_monthly_payments` id 7: Gabriel Molina (222), 2026-11, pagado por el admin;
  `instructor_advances` id 26 queda `discounted`.

| Caso | Res. | Evidencia |
|---|---|---|
| B05 | ✅ | La caja de la sede 2 no muestra nada de la sede 1. |
| **D03** | ❌ **bug nuevo** | "Cerrar Caja" sin arqueo falla con 400: `chk_arqueo_amount`. `buildCierrePayload()` (`cuadratura.facade.ts:797`) guarda `arqueo_amount` = saldo esperado con todas las cantidades en 0, y el CHECK exige `arqueo_amount` = suma de billetes. Sin arqueo solo se puede cerrar una caja con saldo esperado $0. Se cerró la sede 2 activando el arqueo. |
| **F16 / S14** | ❌ **confirmada** | Admin con "Todas las sedes": el día 10 muestra solo el cierre de la sede 2 (Maria Torres, cuadrado); el de la sede 1 (−$500) no aparece, y el detalle no dice de qué sede es. |
| F19 / F02 | ✅ | Al elegir la sede 1 recarga y muestra "Descuadre − $500 · Lorena Morales". |
| F06 / F07 / F08 / F11 | ✅ | Detalle de la sede 1 = snapshot del cierre (50.000 / 290.000 / 50.000 / 290.000 / 289.500), aunque después entró un curso singular; observaciones entre comillas; aviso de $15.000 por transferencia. |
| **M04** | ❌ menor | La diferencia del detalle se muestra "− $-500" (doble signo); el PDF del cierre dice "Faltante: $500" arriba y "$-500" abajo. |
| G03 | ✅ | Corrección manual sin efecto → "Elija si el ajuste suma o resta.". |
| **G05 / S20** | ❌ **confirmada** | Tras ese intento fallido, cambiar a "Gasto olvidado" y completarlo deja "Registrar Ajuste" deshabilitado; con el formulario nuevo se habilita. |
| G02 / G06 / G07 | ✅ | Preview "El total vigente cambiará en -10.000"; "Saldo vigente (con ajustes)" $279.500; físico 289.500 intacto; autor y hora Chile (03:05). |
| **F15 / S6** | ❌ **confirmada (variante)** | El PDF de un cierre **ya cerrado** exportado desde el detalle recalcula en vivo: total 810.000 (suma el curso singular de después del cierre, omite el Psicotécnico), saldo teórico 540.000, pero "Faltante $500" del arqueo. No usa el snapshot. |
| F13 | ✅ | PDF del mes (sede 1) = snapshot: 1 cierre, 550.000 / 65.000 / 290.000 / 289.500, "Faltante". |
| **F17 / S13** | ❌ **confirmada** | Agosto, sede 1: el admin ve 2 cierres (6 y 27), la secretaria 0. En noviembre la secretaria sí ve el de hoy. |
| F18 | ✅ | Con 0 cierres visibles la secretaria no puede exportar: no obtiene datos que la pantalla le oculta. |
| H01 / H02 / H05 / H07 / H09 | ✅ | Mes actual, sede 1: ingresos 1.190.000 = pagos 450.000 + singulares 720.000 + servicios 20.000 (igual a la BD); gastos 55.000 = combustible 40.000 ("Bencina") + varios 15.000. El anticipo de $20.000 no cuenta como gasto (decisión H05 pendiente). |
| H16 / H17 | ✅ | Gasto fijo Arriendo $100.000 aparece en la tabla y Total Gastos pasa a 155.000. |
| **H19 / S10** | ❌ **confirmada** | El PDF de Reportes sigue en gastos 55.000 / neto 1.135.000 con el gasto fijo registrado (pantalla 155.000 / 1.035.000). Además nombra las categorías distinto: "combustible" (pantalla "Bencina"), "Otros" (pantalla "Gastos Varios"), "Servicio Especial" (pantalla "Psicotécnico / Servicios"). |
| J01 / J02 | ✅ / ❌ | KPIs y fila correctos según la regla actual. **S20:** 3 clases × 0,75 = 2,25 h se muestran "2.3 hrs" y se pagan $11.500 (exacto: $11.250); la suma del pie da 9.9 h (exacto 9,75). Decisión J02 pendiente. |
| **J09 / S12** | ❌ **confirmada** | Gabriel Molina: base 11.500, anticipo 20.000 → pantalla "Total a pagar $0", pero `net_payment` guardado **−8.500** y `advances_deducted` 20.000; el anticipo queda `discounted` completo. El modal pide Efectivo/Transferencia y no se guarda. El resumen del modal dice "Anticipos a descontar −20.000 · Total final 38.000" (49.500 − 20.000 ≠ 38.000). |
| **J15 / S11** | ❌ **confirmada** | Secretaria sede 1: solo ve a Gabriel (por su anticipo) con 0 clases, $0 y botón "Pagar", aunque el admin ya lo pagó. |
| **Auditoría del pago** | ❌ **confirmada** | `audit_log` de la sesión tiene pagos, cierres, ajustes, gastos, gasto fijo, ventas y cursos, pero **ninguna** fila de `instructor_monthly_payments` ni de `instructor_advances`. |

## Fixes abiertos desde este track

| Track | Prioridad | Cubre |
|---|---|---|
| `fix-074-i-cierre-sin-arqueo-falla` | P0 | D03 (bug nuevo: `chk_arqueo_amount`) |
| `fix-075-i-cursos-singulares-en-la-caja` | P0 | B07/S9 (cobro posterior sin medio de pago), D19/S17 (cobro con caja cerrada) |
| `fix-076-i-exporte-caja-no-cuadra` | P1 | E02/E04/E07/F15/S6, M04 |
| `fix-077-i-exporte-reportes-sin-gastos-fijos` | P1 | H19/S10 |
| `fix-078-i-historial-todas-las-sedes` | P1 | F16/S14; F17/S13 si Ignacio decide |
| spec `0012-i-anticipos-y-liquidaciones` | P1 | J09/S12, J15/S11, auditoría de pagos y anticipos, tope de anticipos, aviso de meses sin pagar |
| hotfix (por crear al trabajarlo) | P2 | G05/S20: el drawer de ajuste queda inválido tras un intento fallido |

## Test de Regresión

- No aplica: cada fix que salga de aquí trae su propio test.
