# Fix: "Fecha de ingreso" de la ficha muestra el alta del alumno, en formato aaaa-mm-dd
> id: fix-273-m-fecha-ingreso-de-la-matricula-elegida
> refs: fix-264-m (bug B14, casos B08 / B09 de `024b`), ASG-i-024
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause

`AdminAlumnoDetalleFacade.fetchDetalleData()` arma el campo con
`students.created_at.slice(0, 10)`: la fecha en que se creó el registro del alumno, recortada
del ISO. Dos defectos de esa misma línea:

1. **Formato** (B14): se ve `2026-10-01`; el resto de la ficha usa fechas chilenas.
2. **Qué fecha es** (B09): es la del alta del alumno, igual para todas sus matrículas. Al cambiar
   de matrícula en el selector no cambia.

**Decisión del owner (Matías, 2026-10-01):** "Fecha de ingreso" es **la de la matrícula elegida**
y cambia con el selector.

## ACs Afectados

- AC-1: "Fecha de ingreso" muestra la fecha de creación de la matrícula que se está viendo, en
  formato `dd-mm-aaaa`.
- AC-2: al elegir otra matrícula en el selector, la fecha cambia a la de esa matrícula.
- AC-3: un alumno sin ninguna matrícula mostrable muestra "—".

Fuera de alcance: la zona horaria con la que se calcula el día (`ASG-i-054`). La fecha se
formatea en la hora local del navegador, como el resto de las fechas de la ficha.

## Cambio

- **Archivo:** `src/app/core/utils/date.utils.ts` — `formatDayMonthYear()`: `dd-mm-aaaa`, o "—"
  si no hay fecha.
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts` — `fechaIngreso` sale de
  `created_at` de la matrícula mostrada, en `fetchDetalleData()` y en `selectEnrollment()`.

## Test de Regresión

- `src/app/core/utils/date.utils.spec.ts > formatDayMonthYear` ✓ (6 casos)
- `src/app/core/facades/admin-alumno-detalle.facade.spec.ts > fecha de ingreso — fix-273-m` ✓
  (3 tests)
- `e2e/alumnos-b-ficha.spec.ts > B08 (S17)` ✓ — se le quitó la marca `knownBug` y pasa en
  navegador.

## Verificación
Verificado el 2026-10-01: 85 tests de los dos `.spec.ts` en verde; en navegador pasan B08, C03 y
C04.

## Fuera de este fix
La columna "Fecha ingreso" de la **lista** de alumnos tenía el mismo formato `aaaa-mm-dd`
(sospecha S9 de `024a`): se corrigió después en `hotfix-123-m`.
