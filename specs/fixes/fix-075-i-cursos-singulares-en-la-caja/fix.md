# Fix: Cursos singulares — el cobro posterior no tiene medio de pago y se cobra con la caja cerrada
> id: fix-075-i-cursos-singulares-en-la-caja
> refs: fix-073-i (casos B07, D19 · sospechas S9, S17) · ASG-i-029
> status: done
> closed: 2026-11-13
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

- `supabase/migrations/20261112120000_fix075_cursos_singulares_caja_cerrada.sql`: función
  `guard_cobro_curso_singular_caja_cerrada()` + `trg_standalone_course_enrollments_caja_cerrada`.
  Función propia (no se reutilizó `guard_venta_servicio_caja_cerrada`: el día sale de
  `chile_date(paid_at)` y la sede del curso, no de una columna de la fila). **Aplicada a mano por
  Ignacio el 2026-11-12**; verificado en la base que el trigger y el cuerpo de la función coinciden
  con el archivo, `SECURITY DEFINER`, `search_path=''` y sin GRANT EXECUTE a `anon`/`authenticated`.
- `core/facades/cursos-singulares.facade.ts`: `marcarEnrollmentPagado(id, metodo)` guarda
  `payment_method`.
- `features/admin/contabilidad-cursos/admin-curso-singular-cobro-drawer.component.ts`: "Marcar
  cobrado" abre "¿Con qué pagó?" + "Confirmar cobro de $X" / "Cancelar"; muestra `facade.error()`.
- `core/utils/db-error.utils.ts`: `toFriendlyDbMessage()` muestra tal cual el mensaje propio "La
  caja del DD-MM-YYYY ya está cerrada: …" (antes caía al genérico "No se pudo registrar el cobro",
  también para pagos y ventas en los facades que usan esta función).

## Test de Regresión

- `src/app/core/facades/cursos-singulares.facade.spec.ts > marcarEnrollmentPagado — medio de pago (fix-075-i)` (2) ✓
- `src/app/features/admin/contabilidad-cursos/admin-curso-singular-cobro-drawer.component.spec.ts` (4) ✓
- `src/app/core/utils/db-error.utils.spec.ts > fix-075-i: …` (2) ✓
- Suite completa `npm run test:ci`: 5097 passed, 5 skipped, 0 failed. `npm run lint:arch`: 0 errores.
- `supabase/tests/caja/fix-075-i-cursos-singulares-caja-cerrada.sql` (bloque que siempre aborta,
  fechas 2099; corrido contra la base remota con autorización de Ignacio, 2026-11-12) ✓ 9/9:
  rechaza inscribir pagando, marcar cobrado, revertir, cambiar el medio y borrar un cobro de un día
  con caja cerrada; permite inscribir pendiente, un cambio que no toca el cobro, la otra sede el
  mismo día y cobrar en un día abierto. Verificado después: 0 cursos de prueba y 0 cierres 2099.

## Verificación en navegador (2026-11-12, sede 1, `secretaria@test.com`, `ng serve` :4300)

- Joaquín Sandoval inscrito pendiente en "test" → "Marcar cobrado" muestra "¿Con qué pagó?" →
  Transferencia → "Confirmar cobro de $280.000" → Cobrado. La Caja Diaria lo muestra en la columna
  **Transf.**, efectivo $0. AC-1 ✓
- Con la caja abierta, revertir ese cobro desde la Caja funciona (vuelve a pendiente). AC-4 ✓
- Caja de la sede 1 del 12-11 cerrada → "Marcar cobrado" a Joaquín → rechazado; el drawer muestra
  "No se registró el cobro — La caja del 12-11-2026 ya está cerrada: no se puede registrar un
  cobro con esa fecha." y la elección queda abierta. AC-2 ✓
- AC-3 (revertir/cambiar un cobro de un día cerrado): en la pantalla los botones de quitar ingreso
  ya están deshabilitados con la caja cerrada; por debajo lo prueban los casos 3, 4 y 5 del test SQL. ✓
- Inscribir **pagando** con la caja cerrada no se probó en el navegador (no quedaba un alumno de la
  sede 1 sin inscribir); lo prueba el caso 1 del test SQL. ✓
- Datos de prueba nuevos: inscripción de Joaquín en "test" (queda pendiente); `cash_closings` sede 1
  2026-11-12 `closed` sin arqueo.
