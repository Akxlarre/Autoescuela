# Spec 0002-i — Cuadratura editable vía ajustes + egresos de combustible por vehículo

> **Status:** draft
> **Created:** 2026-08-05
> **Owner:** i
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación ASG-b-037
(`specs/assignments/ASG-b-037-cuadratura-editable-egreso-vehiculo.md`), originada en la reunión
con el cliente del 2026-07-28.

Agrupa 2 anotaciones de la reunión que chocan con la misma pared técnica:

1. "Ver alguna manera de registrar por ej los egresos de combustible para un vehículo en otra
   vista y que aparezca luego automáticamente en la vista de Cuadratura."
2. "Que admin pueda editar una cuadratura pasada."

### Hallazgo verificado en código

- `src/app/core/facades/cuadratura.facade.ts:289` consulta los egresos con `.eq('date', today)`
  — hardcodeado a hoy. Un egreso con fecha pasada nunca aparece en la cuadratura de ese día.
- Línea 463 guarda `total_expenses` como snapshot al momento de cerrar. No se recalcula.
- La tabla `expenses` no tiene `vehicle_id` → registrar combustible por vehículo requiere
  migración (columna FK nullable → `vehicles.id`).

Por eso las dos anotaciones son una: "que aparezca automáticamente en Cuadratura" solo funciona
para el día en curso. En cuanto el egreso lleva fecha pasada, estamos en el caso 2.

### El punto que se discutió con el cliente, no se asumió

La cuadratura no es un reporte, es un arqueo físico: la tabla guarda `qty_bill_20000`,
`qty_bill_10000`, `qty_bill_5000`, etc. Es una constatación de "esto es lo que había en la caja
ese día". Sobrescribirla borra la evidencia del descuadre, que es justamente lo que la cuadratura
existe para detectar.

**Respuesta del cliente (2026-08-02):** Opción (a) Ajuste posterior con motivo — confirmado. La
cuadratura cerrada queda inmutable; editar es registrar un ajuste con monto, motivo y autor. El
total vigente = original + ajustes. Esto resuelve de paso el caso del egreso con fecha pasada.

**Hipótesis de valor:** Permite reflejar egresos de combustible registrados con fecha pasada (o
cualquier corrección post-cierre) sin destruir la evidencia del arqueo original — la cuadratura
cerrada sigue siendo un snapshot auditable, y las correcciones quedan trazadas por separado.

---

## 2. User Stories

_(placeholder — completar antes de `/spec-plan`)_

- **US1**: Como Admin, quiero registrar un ajuste sobre una cuadratura ya cerrada (monto, motivo,
  autor), para reflejar correcciones sin alterar el arqueo original.
- **US2**: Como Secretaria, quiero registrar el egreso de combustible de un vehículo desde la
  vista de Flota, para que quede asociado al vehículo correspondiente.
- **US3**: Como Admin/Secretaria, quiero ver el total vigente de una cuadratura (original +
  ajustes) sin perder de vista el arqueo original, para auditar descuadres.

---

## 3. Acceptance Criteria (Gherkin)

_(placeholder — completar antes de `/spec-plan`; cada AC debe ser verificable empíricamente)_

---

## 4. Out of scope

_(placeholder)_

- ❌ Sobrescribir/editar directamente los campos de arqueo (`qty_bill_*`) de una cuadratura
  cerrada — descartado explícitamente por el cliente (respuesta 2026-08-02). Editar es siempre
  vía ajuste posterior.

---

## 5. Dependencias

### Specs previas
- Ninguna directa.

### Asignaciones relacionadas
- ⚠️ Se solapa con ASG-b-039 (botón de registrar egreso en el dashboard), **ya completada**
  (`fix-006-i-registrar-egreso-dashboard-boton`). Revisar si ese fix ya creó un componente
  reutilizable de formulario de egreso que esta spec deba consumir en vez de duplicar.

### Capacidades nuevas requeridas
- Migración: `expenses.vehicle_id` (FK nullable → `vehicles.id`).
- Migración: tabla de ajustes de cuadratura (monto, motivo, autor, fecha, `cuadratura_id`).
- Vista de registro de egreso de combustible asociada al vehículo (probablemente desde Flota).
- Cuadratura deja de estar clavada a `today` para poder reflejar egresos con fecha anterior vía
  ajuste posterior.

---

## 6. Datos y modelo (preliminar)

- Tablas existentes involucradas: `expenses` (ya tiene `category`, `description`, `amount`,
  `date`, `receipt_url`, `branch_id`), tabla de cuadratura con arqueo de billetes/monedas.
- Tablas/columnas nuevas: `expenses.vehicle_id` (FK nullable), tabla de ajustes de cuadratura.
- RLS de `expenses`: admin + secretaria de su propia sede, CRUD completo. `fixed_expenses` es
  solo admin — el combustible va en `expenses`, no en `fixed_expenses`.

---

## 7. UX y flujos (preliminar)

_(placeholder)_

---

## 8. Métricas de éxito post-launch

_(placeholder)_

---

## 9. Notas / decisiones abiertas

- Originado de Asignación ASG-b-037 (specs/assignments/ASG-b-037-cuadratura-editable-egreso-vehiculo.md).

---

## Changelog

- 2026-08-05 — draft inicial por i, a partir de ASG-b-037 (reclamada vía /assign-claim).
