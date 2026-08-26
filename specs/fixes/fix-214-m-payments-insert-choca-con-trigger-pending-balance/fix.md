# Fix: Insert de payments en completarMatricula() choca con trigger de saldo pendiente
> id: fix-214-m-payments-insert-choca-con-trigger-pending-balance
> refs: fix-213-m-pago-efectivo-preinscripcion-sin-registro-en-payments
> status: done
> created: 2026-08-25
> closed: 2026-08-25

## Root Cause
fix-213-m agregó el insert a `payments` en `completarMatricula()`, pero el insert de
`enrollments` que lo precede ya calcula `total_paid`/`pending_balance`/`payment_status`
como si el pago ya estuviera aplicado (ej. `pending_balance: 0` si se pagó todo).
El trigger `BEFORE INSERT` `check_payment_within_pending_balance()`
(`20260723010000_fix_h024_payments_exceed_pending_balance_guard.sql`) lee
`enrollments.pending_balance` y rechaza cualquier pago que lo supere — como ya está en
0, cualquier pago no-cero es rechazado con `23514`. Confirmado en producción al correr
el backfill de hotfix-091-m (`ERROR: El monto del pago (180000) excede el saldo
pendiente de la matrícula 152 (0)`), pero el mismo choque ocurre en el código de
`completarMatricula()` en vivo, no solo en el backfill.

El flujo normal (RPC `confirm_enrollment_with_payment`) evita esto insertando el pago
mientras el enrollment sigue en `draft` (`pending_balance IS NULL`, el trigger no
bloquea NULL) y dejando que el trigger `AFTER INSERT` `recalculate_enrollment_balance()`
(`20260301000008_08_misc_and_triggers.sql`) recalcule `total_paid`/`pending_balance`/
`payment_status` automáticamente tras el insert de `payments`.

## ACs Afectados
Ninguno — fix autónomo, continúa fix-213-m.
- AC-1: al crear el `enrollment` en `completarMatricula()`, los campos
  `total_paid`/`pending_balance`/`payment_status` reflejan el estado ANTES del pago
  (`total_paid: 0`, `pending_balance: basePrice - discountAmount`, `payment_status:
  'pending'`), para que el trigger `check_payment_within_pending_balance` no bloquee el
  insert posterior a `payments`.
- AC-2: tras insertar el pago (método ≠ 'pendiente'), el enrollment queda con los
  totales correctos — delegado al trigger `recalculate_enrollment_balance`, no
  recalculado a mano en el facade.
- AC-3: con método 'pendiente', el enrollment queda igual que antes (`pending_balance =
  basePrice - discountAmount`, sin fila en `payments`).

## Cambio
- **Archivo:** `src/app/core/facades/admin-pre-inscritos.facade.ts`
- **Qué cambia:** en `completarMatricula()`, el insert de `enrollments` deja de calcular
  `total_paid`/`pending_balance`/`payment_status` en función del pago ya aplicado —
  siempre inserta el estado "sin pagar" (`total_paid: 0`, `pending_balance: basePrice -
  discountAmount`, `payment_status: 'pending'`). El insert de `payments` que sigue
  (agregado en fix-213-m) queda igual; el trigger de BD sincroniza los totales finales.
- **Archivo:** `src/app/core/facades/admin-pre-inscritos.facade.spec.ts` — actualizar los
  tests de "completarMatricula — reglas de pago" para reflejar que el insert de
  `enrollments` siempre lleva el estado pre-pago, y agregar aserciones sobre el insert a
  `payments` en vez de sobre `payment_status`/`pending_balance` post-pago (eso ya no lo
  calcula el cliente).

## Test de Regresión
- `src/app/core/facades/admin-pre-inscritos.facade.spec.ts > completarMatricula` (suite actualizada) ✓
