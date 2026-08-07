# Fix: Race condition "lost update" en `pending_balance` al registrar pagos
> id: fix-114-m-race-condition-pending-balance-pagos
> refs: ASG-b-063
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Problema
`PagosFacade.registrarNuevoPago()` (`src/app/core/facades/pagos.facade.ts:357-393`) calcula
`pending_balance` y `total_paid` a partir de `montosActuales`, un snapshot pasado por
**parámetro** desde el componente caller — no lo relee de BD antes de escribir. Si el mismo
abono se dispara dos veces con ese snapshot desactualizado (doble submit por latencia, dos
pestañas del mismo usuario, o un replay del request), la segunda escritura pisa el saldo que
ya había calculado la primera: ambos pagos quedan insertados en `payments` (correcto), pero
`enrollments.pending_balance` solo refleja uno de los dos — el alumno queda con saldo
pendiente incorrecto, sin error visible en ningún lado.

Mismo patrón de fondo en `EnrollmentFacade.confirmWithPayment()`
(`src/app/core/facades/enrollment.facade.ts:1327+`) y `confirmEnrollment()` (línea 1259): el
flag `_isSubmitting` se setea al entrar, pero el método nunca chequea `_isSubmitting()` al
principio para rechazar una re-entrada — la única defensa real hoy es el `isSaving` local del
componente (`[disabled]="isSaving()"` en el botón), que no protege contra dos pestañas ni
contra un caller que no la respete.

## Root Cause
Ausencia de un cálculo atómico en el motor de base de datos — el saldo se leía, se calculaba
en el cliente (`montosActuales`, snapshot pasado por parámetro) y se escribía de vuelta en
pasos separados sin ningún lock que serializara escrituras concurrentes sobre el mismo
`enrollment`.

**Hallazgo clave al investigar (no estaba en el análisis original de la Asignación):** el
proyecto **ya tiene** ese cálculo atómico — el trigger `trg_update_balance`
(`recalculate_enrollment_balance()`, `20260301000008_08_misc_and_triggers.sql:170-202`) corre
`AFTER INSERT OR UPDATE ON payments` y recalcula `total_paid`/`pending_balance`/
`payment_status` de `enrollments` **siempre desde `SUM(payments.total_amount WHERE
status='paid')`**, nunca desde un snapshot. Al ser una `UPDATE ... WHERE id = enrollment_id`,
Postgres serializa dos triggers concurrentes vía row lock: el segundo espera a que el primero
commitee y su subconsulta `SUM(...)` ve ambos pagos. Es exactamente la garantía atómica que
`get_next_enrollment_number` provee para otro caso.

El bug real no era la ausencia de un mecanismo atómico, sino que `registrarNuevoPago()` hacía
un **segundo `UPDATE` manual sobre `enrollments`** justo después del insert (con el snapshot
stale), que **pisaba** el valor ya correcto que el trigger acababa de calcular. La solución no
es un RPC nuevo (habría sido lógica duplicada y redundante con el trigger existente) sino
**eliminar esa escritura manual** y dejar que el trigger sea la única fuente de verdad —mismo
patrón/espíritu que "replicar el atómico existente", pero el atómico existente resultó ser el
trigger, no `get_next_enrollment_number`.

Por separado, el guard de re-entrada (`_isSubmitting`) tampoco existía a nivel de dominio en
`EnrollmentFacade.confirmEnrollment()`/`confirmWithPayment()`, solo como flag de UI
(`isSaving` en el componente) — no protegía contra dos pestañas ni contra un caller que no lo
respetara.

Auditoría completa (incluye el segundo hallazgo relacionado, `ASG-b-064`) hecha a pedido del
cliente evaluando "qué pasa si un usuario usa la app de la peor forma posible" — sesión
2026-08-02/03.

## Archivos involucrados
- `src/app/core/facades/pagos.facade.ts` (método `registrarNuevoPago`, línea ~357)
- `src/app/features/admin/pagos/registrar-pago-drawer.component.ts` (caller — ya no pasa
  `montosActuales` a `registrarNuevoPago`; `resolveMontosActuales()` se mantiene solo para la
  validación de saldo excedido en el cliente)
- `src/app/core/facades/enrollment.facade.ts` (métodos `confirmEnrollment` línea ~1259 y
  `confirmWithPayment` línea ~1327)

## Cambios
- **`pagos.facade.ts` — `registrarNuevoPago()`:** eliminado el `UPDATE` manual sobre
  `enrollments` (`total_paid`/`pending_balance`/`payment_status`) que corría después del
  insert de `payments`. El trigger `trg_update_balance` ya existente es ahora la única fuente
  de verdad para esos campos — atómico, sin lost-update. El parámetro `montosActuales` se
  eliminó de la firma por quedar sin uso.
- **`registrar-pago-drawer.component.ts` — `onSubmit()`:** dejó de resolver y pasar
  `montosActuales` a `registrarNuevoPago()`. `resolveMontosActuales()` se conserva porque
  sigue siendo necesario para `saldoPendienteActual`/`saldoExcedido` (validación de UI antes
  de enviar).
- **`enrollment.facade.ts` — `confirmEnrollment()` y `confirmWithPayment()`:** agregado guard
  de re-entrada `if (this._isSubmitting()) return null;` al inicio de cada método, como
  segunda línea de defensa a nivel de dominio (la UI ya tenía `isSaving`, pero no cubre dos
  pestañas ni callers que no la respeten).
- No se creó ninguna migración SQL nueva — el mecanismo atómico que se necesitaba ya existía.

## Test de Regresión
- `pagos.facade.spec.ts`: nuevo describe "fix-114-m" con (1) test que confirma que
  `registrarNuevoPago` nunca llama a `enrollments.update()`, y (2) test que dispara dos
  `registrarNuevoPago` concurrentes (sin await intermedio) contra el mismo enrollment sobre un
  fake que simula el trigger (`SUM` de los `payments` insertados) y verifica que el balance
  final refleja AMBOS pagos.
- `enrollment.facade.spec.ts`: un test por método (`confirmEnrollment`/`confirmWithPayment`)
  que dispara dos llamadas concurrentes y verifica que la segunda devuelve `null` sin invocar
  el RPC.
- `registrar-pago-drawer.component.spec.ts`: actualizado el test que verificaba la prioridad
  de `estadoCuentaResumen` sobre la lista de deudores — ahora se verifica contra el getter
  público `saldoPendienteActual` en vez de los argumentos de `registrarNuevoPago` (que ya no
  recibe ese dato).

## Notas
- Prioridad Alta: es un bug de dinero (saldo de alumno incorrecto), pero requiere doble-submit
  o dos pestañas para gatillarse — no es explotable con un solo click normal.
- Relacionado por síntoma con `ASG-b-013` (fix-h024-registrar-pago-silencioso) — no es el
  mismo bug pero toca el mismo método, coordinar si siguen abiertos a la vez.
- Originado de Asignación ASG-b-063 (specs/assignments/ASG-b-063-race-condition-pending-balance-pagos.md)
