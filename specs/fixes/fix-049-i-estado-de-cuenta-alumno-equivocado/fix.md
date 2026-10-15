# Fix: Con el Estado de Cuenta abierto, "Ver detalle" de otro alumno deja los datos del anterior y el pago se imputa al alumno equivocado
> id: fix-049-i-estado-de-cuenta-alumno-equivocado
> refs: fix-048-i-testing-pagos-y-descuentos (B3-1, caso I08)
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Root Cause

`PagosFacade.seleccionarEnrollment(id)` solo cambia `_enrollmentSeleccionado`; los datos del
Estado de Cuenta (`_estadoCuentaResumen`, `_estadoCuentaHistorial`) los carga
`AdminPagoDetalleDrawerComponent.ngOnInit()`. Si el drawer ya está abierto y se aprieta "Ver
detalle" de otro alumno (la lista sigue visible y clickeable), `layoutDrawer.open()` con el mismo
componente no lo re-crea: `ngOnInit()` no vuelve a correr y la pantalla sigue mostrando al alumno
anterior mientras la selección ya es la del nuevo. "Registrar Pago" desde ese detalle muestra el
nombre viejo (`estadoCuentaResumen`) pero guarda en `enrollmentSeleccionado`.

Reproducido en `fix-048-i` (Playwright, 3/3): pantalla "Alumno87", POST a la matrícula 2749 =
"Alumno79" (interceptado). Además `cargarEstadoCuenta()` no tiene guard: una respuesta lenta de X
puede pisar la de Y.

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-048-i` B3-1). Criterios de este fix:

- **AC-F1:** con el Estado de Cuenta de X abierto, elegir el detalle de Y muestra los datos de Y
  (nunca los de X), en admin, secretaria y la ficha del alumno.
- **AC-F2:** si la respuesta de X llega después de la de Y, no pisa los datos de Y.
- **AC-F3:** "Registrar Pago" nunca muestra un alumno distinto de la matrícula a la que se guarda.

## Cambio

- **Archivo:** `src/app/core/facades/pagos.facade.ts`
- **Qué cambia:** `seleccionarEnrollment()` limpia el Estado de Cuenta anterior y carga el nuevo;
  `cargarEstadoCuenta()` descarta respuestas viejas con `createRequestGuard()`.
- **Archivo:** `src/app/features/admin/pagos/admin-pago-detalle-drawer.component.ts`
- **Qué cambia:** `ngOnInit()` ya no recarga si la selección ya está cargando o cargada.
- **Archivo:** `src/app/features/admin/pagos/registrar-pago-drawer.component.ts`
- **Qué cambia:** la tarjeta del alumno en modo contextual solo se muestra si el resumen es de la
  matrícula seleccionada.

## Test de Regresión

- `src/app/core/facades/pagos.facade.spec.ts > seleccionarEnrollment (fix-049-i)` ✓
- QA Playwright: abrir el detalle de X, luego el de Y con el drawer abierto → muestra Y y
  "Registrar Pago" guarda en Y. ✓ 2026-10-14 (admin): X = 6363 "Matricula Completa Prueba
  Wizard", Y = 2737 "Alumno67" → drawer, resumen y tarjeta de "Registrar Pago" muestran Alumno67
  con `enrollmentSeleccionado` = 2737.
