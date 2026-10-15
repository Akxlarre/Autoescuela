# Fix: "Cobrar después" le avisa al alumno un pago que no hizo, y el monto del aviso sale sin formato
> id: fix-052-i-aviso-pago-falso-cobrar-despues
> refs: fix-048-i-testing-pagos-y-descuentos (B4-2, casos N02 y N04)
> status: done
> closed: 2026-10-15
> created: 2026-10-15

## Root Cause

- `EnrollmentPaymentFacade.recordPayment()` llama `notifyPaymentRegistered(enrollmentId, total)`
  con cualquier medio de pago, también `pendiente` ("Cobrar después"). El alumno recibe "Se
  registró un pago de $180000" sin haber pagado nada (el pago queda `pending`).
- El mensaje arma el monto con `` `$${amount}` ``, sin separador de miles, en
  `enrollment-payment.facade.ts` y en `pagos.facade.ts`.

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-048-i` B4-2). Criterios de este fix:

- **AC-F1:** con "Cobrar después" el alumno no recibe el aviso de pago registrado.
- **AC-F2:** el aviso de un pago real muestra el monto en pesos chilenos con separador de miles
  (`$180.000`), en el wizard de matrícula y en Pagos.
- **AC-F3:** sigue sin avisar un pago de $0 (spec 0025, AC-E1) y un fallo del aviso no revierte el
  pago.

## Cambio

- **Archivo:** `src/app/core/facades/enrollment-payment.facade.ts`
- **Qué cambia:** no avisa si el medio es `pendiente`; el monto usa `formatCLP()`.
- **Archivo:** `src/app/core/facades/pagos.facade.ts`
- **Qué cambia:** el monto del aviso usa `formatCLP()`.

## Test de Regresión

- `src/app/core/facades/enrollment-payment.facade.spec.ts > recordPayment > notificación al alumno`
  ("Cobrar después" no avisa; el monto sale como `$300.000`).
- `src/app/core/facades/pagos.facade.spec.ts` (el aviso sale con `$` y separador de miles).

## Verificación

- 2026-10-15: tests nuevos en `enrollment-payment.facade.spec.ts` y `pagos.facade.spec.ts` (58/58),
  suite completa 4186, `tsc` limpio, `lint:arch` 0 errores. Sin cambios visuales en pantalla: el
  aviso es una notificación al alumno.
