# Spec 0025-m — Anular pagos en vez de borrarlos

> **Status:** done
> **Created:** 2026-10-13
> **Owner:** Matías
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación `ASG-i-059` (Ignacio, 2026-10-10). Sigue a `fix-044-i` (§ Decisiones).

**Persona afectada:** Admin (quita pagos mal registrados), Secretaria (atiende al alumno que
reclama) y el alumno.

**Problema que resuelve:**
Desde `fix-044-i`, quitar un pago de matrícula en la Caja es solo del admin y es un `DELETE` real:
el saldo lo recalcula `trg_update_balance` y el rastro queda en `audit_log`. Se eligió así para
cerrar el bug de plata sin un cambio grande antes del piloto. Lo que no resuelve:

- El pago **desaparece** de la Caja y de la ficha del alumno. Si el alumno reclama ("yo pagué"),
  no se ve que ese pago existió ni por qué se quitó.
- No queda un **motivo**.
- El rastro existe, pero la vista Auditoría solo lista acciones de secretarias (`AuditoriaFacade`,
  `roles.name = 'secretary'`); un borrado del admin solo se ve en la actividad reciente del
  dashboard.

**Objetivo:** que quitar un pago lo deje **anulado** (estado `anulado`, con quién, cuándo y
motivo), visible tachado en la Caja y en la ficha del alumno, y que **no sume** en ningún total.

**Hipótesis de valor:**
Ante un reclamo, la secretaria puede mostrar qué pasó con el pago sin pedirle a un dev que revise
la BD, y ningún reporte suma plata que no entró.

---

## 2. User Stories

- **US1**: Como admin, quiero anular un pago mal registrado indicando el motivo, para corregir la
  Caja sin que el pago desaparezca.
- **US2**: Como secretaria, quiero ver en la Caja y en la ficha del alumno que un pago fue anulado,
  por quién, cuándo y por qué, para responder un reclamo sin pedir ayuda.
- **US3**: Como admin, quiero que ningún total (saldo, Caja, Pagos, reportes, dashboards) cuente un
  pago anulado, para que los números reflejen la plata que entró.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given un admin en la Caja del día con un pago de matrícula, When aprieta quitar,
  Then se le pide un motivo obligatorio y, al confirmar, el pago queda `anulado` con quién, cuándo
  y motivo. La fila no se borra de `payments`.
- **AC2**: Given un pago anulado hoy, When cualquier rol abre la Caja del día, Then la fila aparece
  tachada con la etiqueta "Anulado" y su motivo, sin botón de quitar, y **no suma** en los totales
  de ingresos, en el arqueo, en el cierre ni en la exportación.
- **AC3**: Given un pago anulado, When se lee la matrícula, Then `total_paid`, `pending_balance` y
  `payment_status` equivalen a la suma de los pagos no anulados (lo recalcula el trigger, sin
  cálculo en el cliente).
- **AC4**: Given un pago anulado, When se abre la ficha del alumno (Clase B y Profesional),
  Then el pago aparece tachado en el historial, con "Anulado", el motivo, quién y cuándo.
- **AC5**: Given un pago anulado, When se abre Pagos, Then los indicadores (ingresos de hoy, del
  mes, cantidad del mes y totales por método) no lo cuentan, y en el listado de recientes y en el
  estado de cuenta aparece como "Anulado", tachado.
- **AC6**: Given un pago anulado, When se abren Reportes Contables, el dashboard (recaudación del
  mes y del anterior) y la alerta "pagos registrados hoy", Then ninguno lo cuenta.
- **AC7**: Given un pago anulado, When se genera el reporte de pagos (PDF/Excel), Then aparece
  marcado "Anulado" y no suma en los totales; y en la ficha de matrícula impresa no aparece.
- **AC8**: Given una secretaria, When mira la Caja, Then no ve el botón de quitar en pagos de
  matrícula; y si intenta anular directo contra la BD, la BD lo rechaza.
- **AC9**: Given un pago de un día con caja cerrada, When el admin intenta anularlo, Then se
  rechaza con el aviso que apunta a Historial de Cuadraturas (mismo de `fix-044-i`).
- **AC10**: Given el código de la app, When una lectura de `payments` suma o cuenta sin declarar
  qué estados incluye, Then un test guardián falla y nombra el archivo.

### Edge cases obligatorios

- **AC-E1**: Given un pago ya anulado, When se intenta anularlo otra vez o modificarlo, Then la BD
  lo rechaza: la anulación es definitiva (si fue un error, se registra el pago de nuevo).
- **AC-E2**: Given una anulación sin motivo (vacío o solo espacios), When se envía, Then la BD la
  rechaza; quién y cuándo los fija la BD, no el cliente.
- **AC-E3**: Given una matrícula con un pago de matrícula anulado y uno nuevo, When se abre el
  paso de pago de esa matrícula, Then carga el pago vigente sin error.
- **AC-E4**: Given una matrícula en borrador vencida con pagos, When corre
  `cleanup_expired_drafts`, Then los borra como hoy (el borrado real sigue solo para borradores).
- **AC-E5**: Given un pago anulado, When el alumno abre su portal, Then lo ve como "Anulado" (no
  como "Pendiente") y sin el motivo interno.
- **AC-E6**: Given un cobro de curso singular o de servicio especial en la Caja, When se quita,
  Then se comporta como hoy (se revierte a pendiente): esta spec no los cambia.

---

## 4. Out of scope

- ❌ Mostrar las acciones del admin en la vista Auditoría (decisión de Matías, 2026-10-13). La
  anulación igual queda en `audit_log`.
- ❌ Anular desde la ficha del alumno o desde Pagos: solo desde la Caja del día.
- ❌ Anular en un día con caja cerrada o "reabrir caja": se corrige con un ajuste de cuadratura.
- ❌ Deshacer una anulación.
- ❌ Anular gastos, anticipos, cursos singulares o servicios especiales.
- ❌ Unificar `paid` / `completado` en la BD (no hay filas `completado` en el piloto).
- ❌ Nota de crédito o anulación de boleta ante el SII.

---

## 5. Dependencias

### Specs previas
- `fix-044-i` (done): borrado solo admin, `trg_update_balance` en `DELETE`, bloqueo por día cerrado.
- `ASG-i-060` (descartada 2026-10-13): los `pending` no se suman hoy porque no tienen
  `payment_date`. El criterio es implícito; esta spec lo hace explícito.

### Capacidades del proyecto que se asumen existentes
- `recalculate_enrollment_balance()` suma solo `status = 'paid'` y corre en `UPDATE`: pasar un pago
  a `anulado` ya lo saca del saldo.
- `guard_movimiento_caja_cerrada` (DG-106), hoy solo `BEFORE DELETE`.
- `assertWriteOk` / `toFriendlyDbMessage` (`core/utils/db-error.utils.ts`).

### Capacidades nuevas requeridas
- Estado `anulado` y columnas de anulación en `payments`.

---

## 6. Datos y modelo (preliminar)

- Tablas modificadas: `payments` (estado `anulado`; quién, cuándo y motivo de la anulación).
- Inventario de lecturas de `payments`, relevado el 2026-10-13 sobre el código actual:

| Lectura | Filtra por estado hoy | Con un `anulado` |
|---|---|---|
| `pagos.facade.ts`: ingresos de hoy, del mes, conteo del mes, totales por método | No | Lo sumaría |
| `pagos.facade.ts`: listado de recientes (`neq 'pending'`) y estado de cuenta | Parcial / No | Lo listaría como pago normal |
| `reportes-contables.facade.ts` | No | Lo sumaría |
| `dashboard.facade.ts`: recaudación del mes y del mes anterior | No | Lo sumaría |
| `dashboard-alerts.facade.ts`: "N pagos registrados hoy" | No | Lo contaría |
| `admin-alumno-detalle.facade.ts` (2 lecturas, B y Profesional) | No | Lo listaría como pago normal |
| `admin-alumnos.facade.ts` / `admin-alumnos-profesional.facade.ts`: conteo previo a borrar un alumno | No | Lo cuenta (correcto: es historial) |
| `enrollment-payment.facade.ts`: pago `type = 'enrollment'` con `maybeSingle()` | No | Falla si hay un anulado y uno nuevo |
| `cuadratura.facade.ts`: Caja del día (`paid`, `completado`) | Sí | No lo trae: hay que traerlo para mostrarlo tachado |
| Edge `generate-payment-report` | No | Lo sumaría |
| Edge `generate-enrollment-sheet` | No | Lo listaría |
| Edge `student-payment` (portal alumno) y RPC `get_student_payment_status` | No (devuelven `status`) | Lo listaría; revisar cómo lo pinta el portal |
| Edge `generate-financial-report`, `generate-cash-closing-report` | Sí (`paid`) | Ya excluido |
| RPC `exec_dashboard_kpis`, `exec_dashboard_monthly_series` | Sí (`paid`, `completado`) | Ya excluido |
| `recalculate_enrollment_balance()` | Sí (`paid`) | Ya excluido |

- RLS: `update_payments` hoy deja a la secretaria modificar pagos de su sede; anular es un `UPDATE`.

---

## 7. UX y flujos (preliminar)

- Pantallas afectadas: Caja (Cuadratura), ficha del alumno (B y Profesional), Pagos, portal del
  alumno.
- Flujo principal: admin en la Caja → quitar pago → modal con motivo obligatorio → la fila queda
  tachada con "Anulado" y el motivo; los totales bajan; el saldo del alumno sube.
- Errores: día cerrado, pago ya anulado o sin permiso muestran un aviso claro, nunca el de éxito.

---

## 8. Métricas de éxito post-launch

- Ningún `DELETE` en `payments` de matrículas confirmadas en `audit_log` tras el despliegue.

---

## 9. Notas / decisiones

Decididas por Matías el 2026-10-13:

- [x] Anula solo el admin.
- [x] Solo desde la Caja del día, como hoy.
- [x] La vista Auditoría no cambia.
- [x] La Caja deja de borrar; el borrado real queda solo para matrículas en borrador.

Supuestos de la redacción (corregir si no corresponden):

- Un pago con boleta asociada se puede anular igual; la boleta sigue visible en la fila.
- El alumno ve "Anulado" en su portal, sin el motivo.
- La ficha de matrícula impresa no lista los pagos anulados.

Otras notas:

- Observado en `fix-044-i`: la Caja y las RPC del dashboard ejecutivo cuentan `paid` y
  `completado`; el saldo solo `paid`. En el piloto no existe ninguna fila `completado`
  (`ASG-i-060`).
- Originado de Asignación ASG-i-059 (specs/assignments/ASG-i-059-anular-pagos-en-vez-de-borrarlos.md)

---

## Changelog

- 2026-10-13 — draft inicial por Matías (reclamada desde ASG-i-059)
- 2026-10-13 — decisiones de alcance, user stories y criterios de aceptación
- 2026-10-13 — implementada y verificada (ver acceptance.md)
