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
| S17 | A medias | Bloqueados en día cerrado: `payments` (`fix-051-i`), `expenses` e `instructor_advances` (`fix-445-m`). **Sin bloqueo:** `standalone_course_enrollments` y `special_service_sales`. |
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

_(se completa al ejecutar el checklist)_

## Fixes abiertos desde este track

_(ninguno todavía)_

## Test de Regresión

- No aplica: cada fix que salga de aquí trae su propio test.
