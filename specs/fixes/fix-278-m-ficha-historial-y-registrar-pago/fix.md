# Fix: Desde la ficha no se puede registrar un pago, y "Ver todo el historial" abre Pagos sin el alumno
> id: fix-278-m-ficha-historial-y-registrar-pago
> refs: fix-264-m (casos I06 / I08, sospecha S19 de `024b`), fix-235-m, ASG-i-024
> status: done
> closed: 2026-10-02
> created: 2026-10-02

## Root Cause

La tarjeta "Estado Financiero" de la ficha solo tiene un enlace, "Ver todo el historial", que
navega al módulo Pagos del portal (`fix-235-m`). Dos problemas:

1. Ese módulo es la lista de **alumnos con deuda** de la sede: no tiene filtro por alumno, y un
   alumno al día ni siquiera aparece. El enlace saca al usuario de la ficha y lo deja buscando a
   mano.
2. No hay forma de registrar un pago sin salir de la ficha.

El módulo Pagos ya tiene las dos piezas por matrícula: el panel "Estado de Cuenta"
(`AdminPagoDetalleDrawerComponent`: precio, descuento, pagado, saldo e historial completo) y el
formulario "Registrar Pago" (`RegistrarPagoDrawerComponent`). Ambos trabajan sobre
`PagosFacade.enrollmentSeleccionado`, no sobre la lista de deudores.

**Decisión del owner (Matías, 2026-10-01):** "Ver todo el historial" debe mostrar los pagos de
ese alumno, y se agrega un botón "Registrar pago" en "Estado Financiero".

## ACs Afectados

- AC-1: "Ver todo el historial" abre, sin salir de la ficha, el panel "Estado de Cuenta" de la
  matrícula que se está viendo.
- AC-2: con saldo pendiente, "Estado Financiero" muestra el botón "Registrar pago", que abre el
  formulario de pago con esa matrícula ya elegida (sin selector de alumno).
- AC-3: sin saldo pendiente el botón no aparece: el formulario rechaza montos mayores al saldo.
- AC-4: al cerrar cualquiera de los dos paneles la ficha se refresca: total pagado, saldo y lista
  de pagos reflejan el pago recién registrado.
- AC-5: funciona igual para admin y secretaria, y para la matrícula elegida en el selector.

## Cambio

- **Archivo:** `src/app/core/utils/ficha-pagos.utils.ts` — `canRegistrarPago(saldoPendiente)`.
- **Archivo:** `src/app/features/admin/alumno-detalle/components/historial-pagos/admin-historial-pagos.component.ts`
  — el enlace pasa a ser un botón que emite `verHistorial`; botón "Registrar pago" que emite
  `registrarPago`. Se quita el input `historialPagosRoute`.
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts` — abre
  los dos paneles del módulo Pagos con la matrícula mostrada y refresca la ficha al cerrarse. Se
  elimina `resolvePagosRoute()` (queda sin uso).
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.spec.ts` — se
  quitan los tests de `resolvePagosRoute()`.

## Test de Regresión

- `src/app/core/utils/ficha-pagos.utils.spec.ts` ✓ (5 casos)
- `e2e/alumnos-b-ficha.spec.ts > I06 · I08` ✓ — desde la ficha se registra un abono de $30.000:
  la ficha se refresca sola (aparece el pago y baja el saldo) y "Ver todo el historial" abre el
  estado de cuenta de ese alumno, todo sin cambiar de URL.

## Verificación
Verificado el 2026-10-02: `npx vitest run` (2954 tests), `npm run lint:arch` (0 errores) y los dos
archivos E2E de Alumnos B (56/56 esperados) en verde. Captura de la ficha con el panel "Estado
de Cuenta" abierto revisada a 1600 px. Se probó como secretaria; admin usa el mismo componente.

## Nota de implementación
- La decisión decía "abrir Pagos filtrado por el alumno". El módulo Pagos no tiene un listado
  filtrable por alumno (es la lista de deudores), así que se usa su vista por matrícula, el panel
  "Estado de Cuenta", abierto sobre la ficha.
- El pago y el aviso al alumno que crea la app durante el test E2E se registran en `cleanup`
  para que no queden en la BD.
- Al escribir el test apareció que la siembra E2E crea matrículas "con saldo" sin filas en
  `payments`; al registrar un pago, el trigger recalcula el saldo desde la suma de pagos. No es
  un bug de la app (una matrícula real siempre tiene sus pagos): el test parte de una matrícula
  que debe el precio completo.
