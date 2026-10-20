# Fix: "Subir documento" del drawer del alumno siempre apunta a esa matrícula
> id: fix-472-m-subir-documento-matricula-del-drawer
> refs: fix-447-m-testing-documentos-certificacion (C08, C09) · 0007-m (AC3)
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Root Cause

`DmsFacade.loadStudentDocuments()` recién fija `studentDetail` (alumno + matrícula del drawer)
cuando terminan sus 2 consultas. "Subir documento" del drawer lee `studentDetail` para
preseleccionar alumno y matrícula, así que:

- Si se presiona mientras el drawer carga (lo normal: el botón está visible desde el inicio), el
  formulario se abre **sin alumno** y con selectores genéricos. Reproducido en navegador con un
  alumno real: `preselectedStudentId = null`.
- Si antes se había abierto el drawer de **otro** alumno, se preselecciona **ese otro**: el
  documento se sube a la matrícula equivocada.
- Abrir A y luego B rápido: la respuesta de A puede llegar después y dejar `studentDetail` en A.

## ACs Afectados

- AC3 de `0007-m` — "Subir documento" desde el drawer de una matrícula queda con alumno y
  matrícula resueltos, también si se presiona mientras el drawer carga.
- AC propio — Nunca queda preseleccionado el alumno de un drawer abierto antes.

## Cambio

- `DmsFacade.loadStudentDocuments()`: fija `studentDetail` con alumno y matrícula **al empezar**
  (conserva nombre y RUT si es el mismo alumno) y descarta respuestas viejas con
  `createRequestGuard()`.

## Test de Regresión

- `dms.facade.spec.ts` — `studentDetail` apunta al alumno nuevo antes de que respondan las
  consultas; la respuesta tardía de un alumno anterior no lo pisa.
- `e2e/documentos-certificacion.spec.ts` (C08) — subir desde el drawer sin esperar la carga.

## Progreso

- [x] Tests rojos → verdes
- [x] E2E C08 verde
