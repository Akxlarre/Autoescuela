# Fix: Una matrícula con beca del 100 % no se puede confirmar
> id: fix-057-i-matricula-becada-100
> refs: fix-048-i-testing-pagos-y-descuentos (B4-4, caso M05)
> status: done
> closed: 2026-10-17
> created: 2026-10-16

## Root Cause

Con un descuento que cubre todo el monto, el paso Pago del wizard manda un pago de $0:
`record_enrollment_payment()` (fix-050-i) lo inserta y choca con `chk_positive_amount`
(`total_amount > 0`). La secretaria ve un error genérico y la matrícula no avanza. Además el paso
exige elegir un medio de pago aunque no haya nada que cobrar.

## Decisión de negocio (Ignacio, 2026-10-16)

Opción A: **no se registra ningún pago**. La beca queda como descuento aplicado; la matrícula
queda con saldo $0 y estado "Pagado". En los historiales de pago se muestra "Becado 100 %" en vez
de "sin pagos" (aviso derivado del saldo, no un pago de $0 que ensucie la Caja y los reportes).

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-048-i` B4-4). Criterios de este fix:

- **AC-F1:** con total a pagar $0, el paso Pago no pide medio de pago, muestra "El descuento
  cubre el total: no hay monto a cobrar" y deja avanzar al contrato.
- **AC-F2:** la BD no inserta ningún pago y deja la matrícula con `pending_balance` 0,
  `total_paid` 0 y `payment_status` `paid_full` (con el descuento aplicado guardado).
- **AC-F3:** el Estado de Cuenta y la ficha del alumno muestran "Becado 100 %" en el historial
  cuando no hay pagos y la matrícula no debe nada.
- **AC-F4:** un pago con monto > 0 sigue igual que en fix-050-i.

## Cambio

- **Archivo:** `supabase/migrations/20261016180000_fix057i_matricula_becada_sin_pago.sql` —
  `record_enrollment_payment()`: sin INSERT si el monto es 0 (medio de pago opcional en ese caso)
  y recálculo explícito de los totales al final (sin INSERT no corre el trigger de saldo).
- **Archivo:** `src/app/core/facades/enrollment-payment.facade.ts` — `canConfirmPayment` y
  `recordPayment()` aceptan total $0 sin medio de pago.
- **Archivo:** `src/app/core/utils/beca.utils.ts` (+ spec) — `esBecaCompleta(totalPagado, saldo)`.
- **Archivo:** `src/app/shared/components/matricula-steps/payment/payment.component.html` —
  aviso en vez de medios de pago con total $0.
- **Archivo:** `src/app/features/admin/pagos/admin-pago-detalle-drawer.component.ts` y
  `src/app/features/admin/alumno-detalle/components/historial-pagos/admin-historial-pagos.component.ts`
  — "Becado 100 %" en el historial vacío.

## Test de Regresión

- `enrollment-payment.facade.spec.ts` (total $0 sin medio de pago confirma y llama a la RPC).
- `beca.utils.spec.ts`.
- `supabase/tests/rls/fix-057-i-matricula-becada.sql` (sin pago insertado, saldo 0, `paid_full`;
  con monto > 0 igual que antes).

## Progreso

- [x] Front: facade (+2 tests), `beca.utils` (+3 tests), paso Pago, Estado de Cuenta y ficha.
      Suite completa 4347 en verde, `tsc` limpio, `lint:arch` 0 errores (2026-10-16).
- [x] Migración `20261016180000` aplicada en Supabase (2026-10-17).
- [x] Test SQL `fix-057-i-matricula-becada.sql`: 4/4 ✅ (2026-10-17).

## Verificación

- Test de regresión del front: `enrollment-payment.facade.spec.ts` (2 casos fix-057-i) y
  `beca.utils.spec.ts` (3 casos) en verde; suite completa 4347; `lint:arch` 0 errores.
- Test de regresión SQL (corrido por Ignacio en Supabase, 2026-10-17): beca 100 % → 0 pagos,
  saldo 0, `paid_full`; abono y luego beca → 0 pagos, `paid_full`; abono $10.000 → 1 pago,
  `partial`; monto > 0 sin medio de pago → rechazado. 4/4 ✅.
- QA visual + axe (2026-10-17, como secretaria, con datos de beca simulados porque no hay una
  matrícula becada real): paso Pago muestra "Beca 100 %" sin medios de pago y `canAdvance` true;
  Estado de Cuenta muestra badge "Pagado", saldo "Al día" y "Becado 100 %" en el historial.
  axe (WCAG 2 A/AA) en claro y oscuro: 0 problemas en lo nuevo. La primera pasada encontró el
  texto secundario de los avisos en `text-text-muted` con contraste 2.56:1 (mínimo 4.5:1): se pasó
  a `text-text-secondary` (7.73:1) en los tres avisos. "RESUMEN FINANCIERO" y "DESCUENTOS" del
  paso Pago fallan igual, pero ya existían (token `text-muted` del DS, fuera de este fix).
- La decisión "sin pagos" pasó a `esBecaCompleta(totalPagado, saldo, cantidadPagos)` (4 tests):
  el historial de la ficha no se puede testear renderizado (un hijo exige inputs propios).
- Suite completa: 4347 en verde; el único rojo es `agenda.facade.spec.ts > hotfix-077-b`, de
  Benjamín, que depende de la fecha real (falla desde el 2026-10-17), sin relación con este fix.
