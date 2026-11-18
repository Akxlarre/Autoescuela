# Fix: Descuento manual del paso Pago se pierde al reanudar un borrador de matrícula
> id: fix-253-b-descuento-manual-se-pierde-al-reanudar-borrador
> refs: 0060-b-lecturas-fallidas-como-ceros (hallazgo de T1.5)
> status: done
> closed: 2026-11-18
> created: 2026-11-18

## Root Cause
Un descuento manual no tiene `discount_id`, así que `record_enrollment_payment` guarda su monto en
`enrollments.discount` y no crea fila en `discount_applications`. `rehydrateFromEnrollment()` solo
reconstruye el descuento desde `discount_applications`: lee `enrollments.discount` y no lo usa. Al
reanudar el borrador el descuento no aparece, el total sube y, al confirmar, la RPC deja
`enrollments.discount` en 0 y registra el pago por el monto completo.

## ACs Afectados
Ninguno — fix autónomo.

- AC-1: un borrador con `enrollments.discount > 0` y sin `discount_applications` rehidrata un
  descuento manual: conserva monto y total, con `selectedDiscountId` en null.
- AC-2: confirmar después de rehidratar reenvía el mismo monto de descuento y el mismo total a la RPC.
- AC-3: un descuento predefinido sigue rehidratándose con su id y su nombre.
- AC-4: un borrador sin descuento sigue sin descuento.

## Cambio
- **Archivo:** `src/app/core/facades/enrollment-payment.facade.ts`
- **Qué cambia:** `rehydrateFromEnrollment()` usa `enrollments.discount` cuando no hay fila en
  `discount_applications`.
- **Integración:** se aplicó sobre la rehidratación de 0060-b T1.5, dentro del bloque que corre solo
  si las tres lecturas salieron bien.

**Límite conocido:** la BD no guarda el motivo escrito para un descuento manual. Al reanudar se
muestra "Descuento Manual". Conservarlo requiere cambiar la BD y la RPC, fuera de este fix.

## Test de Regresión
- `src/app/core/facades/enrollment-payment.facade.spec.ts > rehydrateFromEnrollment — descuento (fix-253-b)`
