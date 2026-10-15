# Fix: Las matrículas con deuda de un mismo alumno se ven idénticas en Pagos
> id: fix-053-i-matriculas-del-mismo-alumno-indistinguibles
> refs: fix-048-i-testing-pagos-y-descuentos (B2-1, casos F09 y C09)
> status: done
> closed: 2026-10-15
> created: 2026-10-15

## Root Cause

`PagosFacade.fetchAlumnosConDeuda()` no trae `enrollments.number` ni `enrollments.status`, y el
selector de "Registrar Pago" (`${alumno} — ${rut}`) y las filas de deudores de Pagos (admin y
secretaria: nombre, RUT, fecha) solo muestran datos del alumno. Dos matrículas con saldo del
mismo alumno salen idénticas y es fácil imputar el abono a la equivocada. Pasa con una matrícula
terminada o cancelada con deuda + una nueva (la lista incluye todo estado salvo `draft`) o con
duplicados viejos (alumno de prueba de la 6363).

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-048-i` B2-1). Criterios de este fix:

- **AC-F1:** el selector de "Registrar Pago" muestra por matrícula: N° de matrícula, curso,
  estado si no está en curso, y saldo.
- **AC-F2:** las listas de deudores (admin y secretaria) muestran bajo el nombre el N° de
  matrícula, el curso y el estado si no está en curso.
- **AC-F3:** una matrícula sin número muestra "sin N°" (no un hueco).

## Cambio

- **Archivo:** `src/app/core/utils/deudor-label.utils.ts` (+ spec) — función pura que arma
  "N° B-0123 · Clase B · cancelada".
- **Archivo:** `src/app/core/models/ui/pagos.model.ts` — `AlumnoDeudor` suma `numeroMatricula` y
  `estadoMatricula`.
- **Archivo:** `src/app/core/facades/pagos.facade.ts` — `fetchAlumnosConDeuda()` trae `number` y
  `status`.
- **Archivo:** `src/app/features/admin/pagos/registrar-pago-drawer.component.ts` — etiqueta del
  selector y tarjeta "Seleccionado". En la QA el texto largo desbordaba el panel: las opciones se
  muestran en 2 líneas con un template `#item` (el buscador sigue usando el texto completo).
- **Archivo:** `src/app/features/admin/pagos/admin-pagos.component.ts` y
  `src/app/features/secretaria/pagos/secretaria-pagos.component.ts` — línea bajo el nombre.

## Test de Regresión

- `src/app/core/utils/deudor-label.utils.spec.ts`
- `src/app/features/admin/pagos/registrar-pago-drawer.component.spec.ts` (etiqueta del selector)
- QA Playwright con el alumno de la matrícula 6363 (2 matrículas).

## Verificación

- 2026-10-15: `deudor-label.utils.spec.ts` + `registrar-pago-drawer.component.spec.ts` en verde,
  suite completa 4191, `lint:arch` 0 errores.
- QA Playwright como secretaria: el alumno de prueba muestra "N° 0083 · Clase B" (en curso, 6363)
  y "N° 0082 · Clase B · terminada" (6248), ambas con $180.000; el selector las lista en 2 líneas
  sin scroll horizontal. Otros alumnos también aparecen como "terminada" con deuda (ej. N° 0015).
