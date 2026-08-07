# Spec 0002-i — Cuadratura editable vía ajustes + egresos de combustible por vehículo

> **Status:** done
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

- **US1**: Como Admin, quiero registrar un ajuste sobre una cuadratura ya cerrada (monto, motivo,
  autor), para reflejar correcciones sin alterar el arqueo original.
- **US2**: Como Admin, quiero que un ajuste correspondiente a un gasto olvidado (ej. combustible
  con fecha pasada) también quede registrado como gasto real en `expenses`, para que aparezca en
  Contabilidad/Reportes y no solo como un número aislado en la cuadratura.
- **US3**: Como Admin, quiero ver el total vigente de una cuadratura (original + ajustes) sin
  perder de vista el arqueo original, para auditar descuadres sin perder la evidencia física.
- **US4**: Como Secretaria, quiero seguir registrando el egreso de combustible de un vehículo
  desde el dashboard (ya resuelto en fix-006-i + migración `vehicle_id`), sin que esta spec
  cambie ese flujo — solo cubre la corrección posterior de cuadraturas ya cerradas.

> Nota (2026-08-06): al reclamar esta spec se verificó que el registro de egreso con vehículo
> asociado (US2 original del draft) **ya está resuelto** — `RegistrarEgresoDrawerComponent`
> (fix-006-i) + migración `expenses.vehicle_id` (hotfix-001-i, documentando lo ya aplicado en
> producción). El campo Fecha del drawer está fijo a "Hoy — no modificable": **no existe forma
> de registrar un egreso con fecha pasada vía UI**, por lo que el mecanismo de ajuste es el
> único camino real para el caso "combustible con fecha pasada" — no una alternativa a él.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given una cuadratura cerrada (`cash_closings.closed = true`) de un día pasado, When el
  Admin abre `app-detalle-cuadratura-modal` de ese día, Then ve un botón "Registrar ajuste"
  visible (no visible/habilitado para Secretaria).
- **AC2**: Given el Admin completa el formulario de ajuste con tipo "Gasto olvidado" (monto,
  motivo, categoría, fecha efectiva = la del cierre corregido), When lo guarda, Then se crea (a)
  una fila en la tabla de ajustes de cuadratura ligada a ese `cuadratura_id`, y (b) una fila en
  `expenses` con `date` = la fecha del cierre corregido (no la fecha de hoy).
- **AC3**: Given el Admin completa el formulario de ajuste con tipo "Corrección manual" (monto,
  motivo), When lo guarda, Then se crea solo la fila en la tabla de ajustes — **no** se inserta
  nada en `expenses`.
- **AC4**: Given una cuadratura cerrada con arqueo original de $X y 1+ ajustes registrados, When
  se consulta su detalle, Then se muestran **dos** cifras distintas: el arqueo original
  (inmutable, tal como se cerró) y el total vigente (original + suma de ajustes), calculado en
  vivo — sin sobrescribir ni recalcular el snapshot original.
- **AC5**: Given una cuadratura cerrada, When se registra un ajuste sobre ella, Then los campos
  de arqueo (`qty_bill_*`, `qty_coin_*`, `total_expenses` original) permanecen exactamente
  iguales a como quedaron al cerrar — el ajuste nunca los modifica ni los recalcula in place.
- **AC6**: Given un ajuste ya registrado, When se lista el detalle de la cuadratura, Then cada
  ajuste muestra su motivo, monto, autor (quién lo registró) y fecha de registro — trazabilidad
  completa, igual que exige RLS de auditoría del resto del sistema.
- **AC7**: Given un usuario con rol Secretaria, When intenta acceder a la acción de registrar
  ajuste (UI o API/RLS directa), Then la acción es rechazada — solo Admin puede crear ajustes.

### Edge cases obligatorios

- **AC-E1**: Given una cuadratura del día de HOY (aún no cerrada), When se intenta registrar un
  ajuste sobre ella, Then el sistema lo rechaza — los ajustes solo aplican a cuadraturas ya
  cerradas (`closed = true`); el día en curso se corrige editando el registro normal, no vía
  ajuste.
- **AC-E2**: Given dos ajustes registrados el mismo día sobre la misma cuadratura (uno de cada
  Admin, o el mismo Admin dos veces), When se consulta el total vigente, Then ambos ajustes se
  suman — no se sobrescriben entre sí (evitar "lost update" del mismo patrón que ASG-b-063).
- **AC-E3**: Given un ajuste de tipo "Gasto olvidado" con `vehicle_id` asociado, When se guarda,
  Then el `expenses.vehicle_id` insertado sigue el mismo flujo/columna que fix-006-i /
  hotfix-001-i — sin duplicar lógica de selección de vehículo.

---

## 4. Out of scope

- ❌ Sobrescribir/editar directamente los campos de arqueo (`qty_bill_*`) de una cuadratura
  cerrada — descartado explícitamente por el cliente (respuesta 2026-08-02). Editar es siempre
  vía ajuste posterior.
- ❌ Eliminar o editar un ajuste ya registrado — un ajuste, una vez creado, es inmutable (mismo
  principio de auditoría que el arqueo original). Si se registró mal, se corrige con OTRO ajuste
  que lo compense — no se permite borrar evidencia.
- ❌ Que Secretaria registre ajustes — confirmado en la sección de decisiones (2026-08-06), solo
  Admin.
- ❌ Cambiar el flujo de registro de egreso "en caliente" (día actual, `RegistrarEgresoDrawerComponent`
  desde el dashboard) — esa parte ya está resuelta (fix-006-i + hotfix-001-i). Esta spec solo
  cubre corrección de cuadraturas YA cerradas.
- ❌ Nueva vista de registro de egreso desde Flota — descartado; el dashboard ya cubre el acceso
  rápido, y esta spec reutiliza `app-detalle-cuadratura-modal` en vez de crear una pantalla nueva
  (decisión 2026-08-06).

---

## 5. Dependencias

### Specs previas
- Ninguna directa.

### Asignaciones relacionadas
- ✅ ASG-b-039 (botón de registrar egreso en el dashboard) — completada
  (`fix-006-i-registrar-egreso-dashboard-boton`). Ya creó `RegistrarEgresoDrawerComponent`
  reutilizable con selector de vehículo — esta spec NO lo toca, solo agrega el flujo de ajuste
  sobre cuadraturas cerradas.
- ✅ `expenses.vehicle_id` — ya resuelto (aplicado en producción, documentado en
  `hotfix-001-i-egresos-cuadratura-chip-categoria` vía migración
  `20260806000000_expenses_add_vehicle_id.sql`). No es trabajo pendiente de esta spec.

### Capacidades nuevas requeridas
- Migración: tabla `cuadratura_adjustments` (o nombre equivalente) — `cuadratura_id` FK →
  `cash_closings.id`, `tipo` (`gasto_olvidado` | `correccion_manual`), `monto` INTEGER (signo
  según si aumenta o reduce el total vigente), `motivo` TEXT, `registered_by` FK → `users.id`,
  `created_at` TIMESTAMPTZ, `expense_id` FK nullable → `expenses.id` (solo si `tipo =
  'gasto_olvidado'`, para trazar el gasto real que el ajuste generó).
- RLS de la tabla nueva: solo Admin (INSERT/SELECT) — sin secretaria, sin UPDATE ni DELETE
  (inmutable, ver Out of scope).
- Extender `CuadraturaFacade`/`HistorialCuadraturasFacade` (o el Facade que resulte del diseño
  técnico en `plan.md`) con: `registrarAjuste()`, lectura de ajustes por cuadratura, cómputo del
  total vigente.
- `app-detalle-cuadratura-modal` gana el botón "Registrar ajuste" + listado de ajustes existentes
  + las dos cifras (original / vigente).

---

## 6. Datos y modelo (preliminar)

- Tablas existentes involucradas: `expenses` (ya tiene `vehicle_id`), `cash_closings` (arqueo de
  billetes/monedas, `closed`, `total_expenses` snapshot).
- Tabla nueva: `cuadratura_adjustments` (ver "Capacidades nuevas requeridas" arriba). Detalle
  final de columnas/constraints se congela en `plan.md`.
- RLS de `expenses`: sin cambios (admin + secretaria de su sede, CRUD completo) — el INSERT que
  dispara un ajuste tipo `gasto_olvidado` lo hace el Admin, ya cubierto por esa policy existente.
- RLS de `cuadratura_adjustments`: solo Admin, sin UPDATE/DELETE (inmutable).

---

## 7. UX y flujos (preliminar)

- Pantalla afectada: `app-detalle-cuadratura-modal` (Historial de Cuadraturas → click en un día
  cerrado → detalle). Gana un botón "Registrar ajuste" (solo visible para Admin) y una sección
  de ajustes existentes debajo del arqueo original.
- Flujo principal: Admin abre el detalle de un día pasado → "Registrar ajuste" → elige tipo
  (Gasto olvidado / Corrección manual) → si es "Gasto olvidado", completa monto + motivo +
  categoría + vehículo (opcional, mismo selector que `RegistrarEgresoDrawerComponent`) → guarda →
  el detalle se refresca mostrando el ajuste nuevo y el total vigente actualizado.
- El arqueo original (billetes/monedas, total al cierre) se mantiene siempre visible, sin
  edición — solo lectura, con el total vigente mostrado aparte (AC4).

---

## 8. Métricas de éxito post-launch

- Cero cuadraturas cerradas editadas directamente (los campos de arqueo nunca cambian post-cierre
  — verificable con un `updated_at`/trigger que detecte writes a `cash_closings` fuera del cierre
  inicial).
- Todo gasto de combustible con fecha pasada registrado vía ajuste aparece correctamente en
  Contabilidad/Reportes (mismo criterio que un gasto normal, gracias a AC2).

---

## 9. Notas / decisiones abiertas

- [x] Solo Admin puede registrar ajustes — confirmado por el owner (i) el 2026-08-06.
- [x] El flujo vive dentro de `app-detalle-cuadratura-modal`, reutilizando la vista existente —
  confirmado por el owner (i) el 2026-08-06. No se crea pantalla nueva.
- [x] El total vigente se calcula en vivo (original + suma de ajustes), sin tocar el snapshot
  cerrado — confirmado por el owner (i) el 2026-08-06.
- [x] Un ajuste de tipo "gasto olvidado" también inserta en `expenses` con la fecha del cierre
  corregido — confirmado por el owner (i) el 2026-08-06, para que no quede fuera de reportes.
- [x] `expenses.vehicle_id` y el flujo de registro de egreso desde el dashboard ya estaban
  resueltos antes de activar esta spec (fix-006-i + hotfix-001-i) — no son parte del alcance.
- Originado de Asignación ASG-b-037 (specs/assignments/ASG-b-037-cuadratura-editable-egreso-vehiculo.md).

---

## Changelog

- 2026-08-05 — draft inicial por i, a partir de ASG-b-037 (reclamada vía /assign-claim).
- 2026-08-06 — completadas User Stories, Acceptance Criteria (7 ACs + 3 edge cases), Out of
  scope, Dependencias, Datos y modelo, UX y Métricas. Confirmado con el owner (i): solo Admin,
  flujo dentro de `app-detalle-cuadratura-modal`, total vigente en vivo, ajuste tipo "gasto
  olvidado" inserta en `expenses`. Ajustado el alcance real tras confirmar que `vehicle_id` y el
  drawer de registro de egreso ya estaban resueltos (fix-006-i + hotfix-001-i) — esta spec se
  enfoca exclusivamente en el mecanismo de ajuste sobre cuadraturas cerradas.
