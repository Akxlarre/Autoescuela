# Fix: Cursos singulares — el cobro posterior no tiene medio de pago y se cobra con la caja cerrada
> id: fix-075-i-cursos-singulares-en-la-caja
> refs: fix-073-i (casos B07, D19 · sospechas S9, S17) · ASG-i-029
> status: in_progress
> created: 2026-11-10
> priority: P0

## Root Cause

Una sola tabla, `standalone_course_enrollments`, con dos huecos que hacen descuadrar la caja.
Confirmados en el navegador en `fix-073-i`, tanda 1:

1. **S9 — cobro posterior sin medio de pago.** La inscripción con "Dejar pago pendiente" guarda
   `payment_method = 'pendiente'`. "Marcar cobrado" (`CursosSingularesFacade.marcarEnrollmentPagado()`)
   solo cambia `payment_status`, `amount_paid` y `paid_at`: no pregunta ni guarda el medio de pago,
   y no pide confirmación. En la Caja Diaria la fila sale con método "—", suma $220.000 al total y
   $0 al efectivo; el cierre id 62 quedó con `total_income` 550.000 y solo 330.000 repartidos en
   columnas.
2. **S17 — se cobra con la caja cerrada.** `payments`, `expenses`, `instructor_advances` y
   `special_service_sales` tienen trigger de caja cerrada; `standalone_course_enrollments` no.
   Inscribir pagando $280.000 en efectivo después del cierre funcionó, y la Caja Diaria pasó a
   efectivo 570.000 mientras el cierre seguía en 290.000.

Decisión de Ignacio (2026-11-09): con la caja cerrada no entra ningún ingreso del día.

## ACs Afectados

- `fix-051-i` AC-F2 / `fix-445-m` (no se registra dinero en un día con caja cerrada) se extiende a
  los cobros de cursos singulares.
- AC-1: "Marcar cobrado" pide el medio de pago (efectivo, transferencia, tarjeta) y confirmación;
  la fila de la Caja Diaria sale en la columna de ese medio y el efectivo suma al saldo esperado.
- AC-2: inscribir pagando, o marcar cobrado, en un día con la caja cerrada de esa sede se rechaza
  con el mismo mensaje que pagos y ventas ("La caja del … ya está cerrada").
- AC-3: revertir un cobro de un día cerrado también se rechaza (mismo criterio que borrar un pago).
- AC-4: con la caja abierta, inscribir y cobrar sigue funcionando como hoy.

## Cambio

- **Archivos:** migración nueva con el trigger de caja cerrada para `standalone_course_enrollments`
  (reutilizando el guard existente); `cursos-singulares.facade.ts` (`marcarEnrollmentPagado`) y el
  drawer de cobro.
- **Qué cambia:** el cobro guarda el medio de pago; la BD bloquea cobros en días cerrados.

## Test de Regresión

- `src/app/core/facades/cursos-singulares.facade.spec.ts > marcarEnrollmentPagado guarda el medio de pago`
- `supabase/tests/` — test SQL del trigger: cobro en día con caja cerrada → `CAJA_CERRADA`.
