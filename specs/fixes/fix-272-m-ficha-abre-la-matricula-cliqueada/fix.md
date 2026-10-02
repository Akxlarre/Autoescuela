# Fix: La ficha abre siempre la matrícula más reciente, no la de la fila que se cliqueó
> id: fix-272-m-ficha-abre-la-matricula-cliqueada
> refs: fix-264-m (casos C05 / T11 de `024b`), fix-265-m, ASG-i-024
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause

La ruta de la ficha solo lleva el id del alumno (`/alumnos/:id`). `AdminAlumnoDetalleFacade`
decide sola qué matrícula mostrar con `pickFichaEnrollment()`: la más reciente válida
(fix-265-m). Las listas no le dicen sobre qué matrícula se hizo clic, así que:

- desde **Ex-Alumnos**, la ficha de un egresado que se volvió a matricular abre la matrícula
  nueva, no la terminada que representa esa fila;
- desde la **Base de Alumnos B**, la ficha de un alumno con una matrícula Profesional más
  reciente abre la Profesional, no la Clase B de la fila;
- al volver a entrar a la ficha del mismo alumno, se conserva la matrícula elegida en la visita
  anterior (la caché SWR trata la re-entrada como un refresco).

**Decisión del owner (Matías, 2026-10-01):** la ficha abre **la matrícula que se cliqueó**. Desde
Ex-Alumnos, la terminada; desde la Base, la vigente de esa fila. En ambos casos se puede cambiar
con el selector.

## ACs Afectados

Ninguno de una spec previa. Ajusta el alcance de `fix-265-m` AC-2 (ver AC-3).

- AC-1: "Ver ficha" desde Ex-Alumnos B (tabla y tarjeta) abre la ficha mostrando la matrícula de
  esa fila, aunque el alumno tenga otra más reciente.
- AC-2: "Ver ficha" desde la Base de Alumnos B (tabla y tarjeta) abre la matrícula Clase B que
  representa la fila.
- AC-3: cada **entrada** a la ficha decide de nuevo qué matrícula mostrar: la pedida por la
  lista o, si no se pidió ninguna (URL directa), la regla de `fix-265-m` AC-1. La matrícula
  elegida en el selector se sigue conservando en los **refrescos** de la ficha abierta
  (`fix-265-m` AC-2 intacto).
- AC-4: si la matrícula pedida no existe para ese alumno o es un borrador, se aplica la regla
  por defecto. Un valor no numérico en la URL se ignora.

## Cambio

- **Archivo:** `src/app/core/utils/ficha-enrollment.utils.ts` — `parseEnrollmentParam()`: lee el
  parámetro `?enrollment=` de la URL (entero positivo o `null`).
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts` — `initialize(studentId,
  enrollmentId?)`: la matrícula pedida al entrar tiene prioridad sobre la elegida antes.
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts` — pasa
  `?enrollment=` a `initialize()`.
- **Archivos:** `src/app/shared/components/ex-alumnos-content/ex-alumnos-content.component.ts`,
  `egresado-card`, `alumnos-list-content`, `alumno-card` — los enlaces "Ver ficha" agregan
  `?enrollment=<id>`.

Ex-Alumnos Profesional y la Base Profesional no cambian (`ASG-i-025`).

## Test de Regresión

- `src/app/core/utils/ficha-enrollment.utils.spec.ts > parseEnrollmentParam` ✓ (8 casos)
- `src/app/core/facades/admin-alumno-detalle.facade.spec.ts > matrícula pedida al entrar — fix-272-m` ✓
  (4 tests)
- `e2e/alumnos-b-ficha.spec.ts > C05 · T11` ✓ — desde Ex-Alumnos abre la terminada; desde la
  Base, la vigente.

## Verificación
Verificado el 2026-10-01: `tsc` de la app sin errores, 87 tests de los dos `.spec.ts` en verde y
`e2e/alumnos-b-ficha.spec.ts` con 30/30 esperados. El test A01 · A02 se ajustó: la URL de la
ficha abierta desde la lista ahora termina en `?enrollment=<id>`.

## Nota de implementación
Los botones "Ver ficha" de la Base (tabla y tarjeta) no tenían `data-llm-action`; se les agregó
`view-student-detail` / `view-student-detail-card`, los mismos de Ex-Alumnos.
