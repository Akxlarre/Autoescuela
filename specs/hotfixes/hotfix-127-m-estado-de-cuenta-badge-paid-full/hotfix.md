# Hotfix: El badge del "Estado de Cuenta" muestra el texto crudo "paid_full"
> id: hotfix-127-m-estado-de-cuenta-badge-paid-full
> refs: fix-278-m
> status: done
> closed: 2026-10-02
> created: 2026-10-02

## Problema
En el panel "Estado de Cuenta" (módulo Pagos, y desde `fix-278-m` también la ficha del alumno), el badge de estado de pago de una matrícula totalmente pagada dice `paid_full`. Reportado por el owner con captura (2026-10-02).

**Causa:** el badge traduce `enrollments.payment_status` con un `switch` que conoce `paid`, `partial` y `pending`, y en cualquier otro caso devuelve el valor tal cual. Pero el valor que escribe la base para una matrícula pagada completa es `paid_full` (trigger `recalculate_enrollment_balance()` y el flujo de matrícula); `paid` es el estado de un **pago** individual, no de la matrícula.

## Cambios
- **Archivo:** `src/app/core/utils/payment-status.utils.ts` — funciones puras `enrollmentPaymentStatusLabel()` y `enrollmentPaymentStatusVariant()`: `paid_full` y `paid` → "Pagado" (verde), `partial` → "Parcial", `pending` → "Pendiente". Un valor desconocido se muestra como "—", nunca crudo.
- **Archivo:** `src/app/features/admin/pagos/admin-pago-detalle-drawer.component.ts` — usa esas funciones.

## Verificación
Verificado el 2026-10-02: `payment-status.utils.spec.ts` (8 casos) en verde. En navegador, la matrícula de la captura del owner (pagada completa) muestra el badge "Pagado" en verde; y el test E2E `I06 · I08` comprueba que una matrícula con un abono muestra "Parcial" y que el panel no contiene ningún valor crudo (`paid_full`, `partial`, `pending`).
