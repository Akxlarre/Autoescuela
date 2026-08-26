# Fix: Pago en efectivo al convertir pre-inscripción profesional no aparece en Cuadratura de Caja
> id: fix-213-m-pago-efectivo-preinscripcion-sin-registro-en-payments
> refs: —
> status: done
> created: 2026-08-25
> closed: 2026-08-25

## Root Cause
`completarMatricula()` en `src/app/core/facades/admin-pre-inscritos.facade.ts` (líneas
256-284) crea la fila en `enrollments` con `total_paid`/`payment_status` correctos, pero
nunca inserta una fila en la tabla `payments`. `CuadraturaFacade` arma el efectivo del día
leyendo exclusivamente `payments` (`status in ('paid','completado')`, `payment_date = hoy`)
— sin esa fila, el pago queda invisible ahí aunque la matrícula sí lo muestre como pagado.

El flujo normal de matrícula (público/secretaría, vía `EnrollmentFacade` → RPC
`confirm_enrollment_with_payment`) sí inserta en `payments`, pero esa RPC asume un
`enrollment` preexistente en `status='draft'` — algo que el flujo de conversión de
pre-inscripción profesional no tiene (crea el `enrollment` directo en `status='active'`).
Reestructurar ese flujo para encajar en la RPC es un cambio mayor con riesgo de regresión;
el fix mínimo es espejar el mismo insert de `payments` que hace la RPC.

## ACs Afectados
Ninguno — fix autónomo.
- AC-1: Al completar una matrícula desde pre-inscripción profesional con método de pago
  distinto de "pendiente", se crea una fila en `payments` con `enrollment_id`, el monto
  correspondiente en `cash_amount`/`transfer_amount`/`card_amount` según el método,
  `type='enrollment'`, `status='paid'`, `payment_date` = hoy, `registered_by`.
- AC-2: Con método "pendiente", no se inserta fila en `payments` (igual que hoy no se
  inserta pago cuando el enrollment queda en `payment_status: 'pending'`).

## Cambio
- **Archivo:** `src/app/core/facades/admin-pre-inscritos.facade.ts`
- **Qué cambia:** en `completarMatricula()`, tras crear el `enrollment` (paso 3), insertar
  la fila correspondiente en `payments` cuando `payload.paymentMethod !== 'pendiente'`,
  espejando las columnas que usa `confirm_enrollment_with_payment`
  (`cash_amount`/`transfer_amount`/`card_amount`/`voucher_amount`, `type: 'enrollment'`,
  `status: 'paid'`, `payment_date`, `registered_by`, `total_amount`).

## Test de Regresión
- `src/app/core/facades/admin-pre-inscritos.facade.spec.ts > completarMatricula > inserta un pago en payments cuando el método no es pendiente` ✓
