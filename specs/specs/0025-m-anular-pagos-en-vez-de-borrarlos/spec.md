# Spec 0025-m — Anular pagos en vez de borrarlos

> **Status:** draft
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

- **US1**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US2**: …

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given {{precondición}}, When {{acción}}, Then {{resultado observable}}.
- **AC2**: …

### Edge cases obligatorios

- **AC-E1**: Given {{caso límite}}, When …, Then …

---

## 4. Out of scope

- ❌ {{cosa que NO va}}

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

- Pantalla(s) afectada(s): Caja (Cuadratura), ficha del alumno (B y Profesional), Pagos.
- Flujo principal (happy path): …
- Estados especiales (loading, error, vacío): …

---

## 8. Métricas de éxito post-launch

- {{métrica}}

---

## 9. Notas / decisiones abiertas

- [ ] ¿Quién puede anular: solo admin (como hoy el borrado) o también la secretaria?
- [ ] ¿Desde dónde se anula: solo la Caja del día, o también desde la ficha del alumno y Pagos?
- [ ] ¿La vista Auditoría debe mostrar las acciones del admin sobre pagos?
- [ ] Un pago anulado que ya tenía boleta (`receipt_id`): ¿se permite anular?, ¿qué se muestra?
- [ ] ¿Sigue existiendo el borrado real para algún caso? (El cron `cleanup_expired_drafts` y el
  descarte de borradores sí borran: son matrículas que nunca se confirmaron.)
- Observado en `fix-044-i`: la Caja y las RPC del dashboard ejecutivo cuentan `paid` y
  `completado`; el saldo solo `paid`. En el piloto no existe ninguna fila `completado`
  (`ASG-i-060`).
- Originado de Asignación ASG-i-059 (specs/assignments/ASG-i-059-anular-pagos-en-vez-de-borrarlos.md)

---

## Changelog

- 2026-10-13 — draft inicial por Matías (reclamada desde ASG-i-059)
