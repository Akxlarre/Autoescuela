# Fix: Excluir matrículas con pago pendiente del listado "Pagos recientes"
> id: fix-135-m-excluir-matriculas-pago-pendiente-de-pagos-recientes
> refs: fix-134-m-estados-pago-sin-traducir
> status: done
> closed: 2026-08-06
> created: 2026-08-06

## Root Cause
`fetchPagosRecientes()` en `pagos.facade.ts` lista **toda** la tabla `payments` sin filtrar
por `status`. Cuando una matrícula se confirma con método de pago `'pendiente'` (RPC
`confirm_enrollment_with_payment`, ver `20260618130000_rpc_confirm_enrollment_with_payment.sql:59-98`),
se inserta igual una fila en `payments` con `cash_amount`/`transfer_amount`/`card_amount` en $0
y `status = 'pending'` — es un placeholder para registrar la deuda, **no un pago recibido**.

Confirmado que `payments.status = 'pending'` solo lo produce ese único camino (la inserción
manual de `registrarNuevoPago()` en `pagos.facade.ts:368-378` siempre usa `status: 'paid'`, y
no hay otro INSERT a `payments` en las migraciones): toda fila `pending` es dinero $0 recibido.
Mostrarla en "Pagos recientes" con su monto total confunde: parece un pago cobrado cuando en
realidad es saldo por cobrar — y ese alumno ya aparece correctamente en la lista de deudores
(`fetchAlumnosConDeuda()`, basada en `enrollments.pending_balance > 0`, independiente de
`payments`).

## ACs Afectados
Ninguno — fix autónomo (aclaración de negocio pedida por el dueño tras ver el panel).
- AC-1: "Pagos recientes" solo lista pagos con dinero efectivamente recibido (`status <> 'pending'`).
- AC-2: Una matrícula con pago pendiente sigue apareciendo en la lista de deudores (sin cambios ahí).

## Cambio
- **Archivo:** `src/app/core/facades/pagos.facade.ts`
- **Qué cambia:** `fetchPagosRecientes()` agrega `.neq('status', 'pending')` a la query de
  `payments`, para no traer placeholders de matrícula sin pago inicial.

## Test de Regresión
- `src/app/core/facades/pagos.facade.spec.ts` > `fetchPagosRecientes (fix-135-m)` — verifica que la
  query a `payments` excluye `status = 'pending'` ✓
