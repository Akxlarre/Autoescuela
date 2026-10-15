# Fix: Reintentar el paso Pago de la matrícula como secretaria duplica el pago de matrícula
> id: fix-050-i-pago-matricula-duplicado-al-reintentar
> refs: fix-048-i-testing-pagos-y-descuentos (B4-3, caso S13)
> status: done
> closed: 2026-10-15
> created: 2026-10-14

## Root Cause

`EnrollmentPaymentFacade.recordPayment()` reemplaza el pago del paso Pago del wizard con dos
DELETE (`discount_applications` y `payments` de tipo `enrollment`) y después un INSERT. La RLS
deja sin DELETE a la secretaria en las dos tablas (a propósito: protege el historial de pagos), y
PostgREST responde a un DELETE filtrado por RLS **sin error y con 0 filas**. `fix-362-m` agregó el
chequeo de `error`, no el de filas, así que el código sigue e inserta un segundo pago (y un
segundo descuento aplicado).

Evidencia real: matrícula 7003, 2 pagos de matrícula `pending` de $180.000 (pagos 2642 y 2643).
Si alguno se marcara `paid`, el saldo bajaría dos veces por un solo cobro.

Darle DELETE a la secretaria iría contra la protección del historial; la salida es la misma de
`confirm_enrollment_with_payment()`: una RPC `SECURITY DEFINER` que hace el reemplazo completo.

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-048-i` B4-3). Criterios de este fix:

- **AC-F1:** volver al paso Pago y guardarlo de nuevo deja **un solo** pago de matrícula y como
  mucho un descuento aplicado, sea admin o secretaria.
- **AC-F2:** el reemplazo es atómico: si algo falla, queda el pago anterior intacto.
- **AC-F3:** solo se reemplaza el pago de una matrícula en `draft`; una matrícula activa no se
  toca. Solo admin, o secretaria de la sede de la matrícula.
- **AC-F4:** el pago queda con la fecha de hoy en Chile y `registered_by` = usuario de la sesión.

## Cambio

- **Archivo:** `supabase/migrations/20261014180000_fix050i_record_enrollment_payment.sql`
- **Qué cambia:** nueva RPC `record_enrollment_payment()` (borrador + permiso por sede + DELETE
  e INSERT del pago y del descuento, en una transacción). Guarda `enrollments.discount` antes de
  tocar los pagos y deja los totales a `recalculate_enrollment_balance()`: si se calcularan con el
  descuento viejo, quitar el descuento al reintentar haría que `check_payment_within_pending_balance()`
  rechace un pago correcto.
- **Archivo:** `src/app/core/facades/enrollment-payment.facade.ts`
- **Qué cambia:** `recordPayment()` llama a la RPC en vez de hacer DELETE/INSERT/UPDATE sueltos.
- **Archivo:** `src/app/core/facades/hora-chile.facades.spec.ts`
- **Qué cambia:** se quita el caso de `recordPayment` (la fecha ya no la pone el front sino
  `public.chile_today()` en la RPC; lo cubre el test SQL).
- **Datos:** limpieza de la matrícula 7003 (se borra el pago duplicado 2642, ambos `pending`),
  SQL manual en el SQL Editor.

## Test de Regresión

- `src/app/core/facades/enrollment-payment.facade.spec.ts > recordPayment` (llama a la RPC con
  los datos del paso; error de la RPC → `false` sin notificar)
- `supabase/tests/rls/fix-050-i-record-enrollment-payment.sql` (secretaria guarda 2 veces → 1
  pago; matrícula activa → rechazo; otra sede → rechazo)

## Progreso

- [x] Tests del front (`enrollment-payment.facade.spec.ts`) en verde + suite completa (4182) + `lint:arch` 0 errores.
- [x] Migración `20261014180000` aplicada en Supabase (2026-10-15).
- [x] Test SQL `fix-050-i-record-enrollment-payment.sql`: 9/9 ✅ (2026-10-15).
- [x] Limpieza de la matrícula 7003 (borrado el pago duplicado 2642) verificada 2026-10-15: 1 pago de matrícula, saldo $180.000, 0 descuentos.
