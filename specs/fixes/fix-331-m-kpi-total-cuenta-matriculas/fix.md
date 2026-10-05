# Fix: El total de la Base Profesional dice "alumnos" pero cuenta matrículas
> id: fix-331-m-kpi-total-cuenta-matriculas
> refs: fix-319-m-testing-clase-profesional-piloto (B05, D01, D10) · ASG-i-025
> status: in_progress
> created: 2026-10-05

## Root Cause
La Base Profesional muestra una fila por matrícula (un alumno con A2 y A4 sale dos veces), pero el
chip "N alumnos" y el KPI "Total" se rotulan como alumnos. Además la vista de tarjetas podría
repetir claves con el mismo alumno (a confirmar en consola, caso B05).

Decisión D10 (Matías, 2026-10-05): **una fila por matrícula** (como hoy); el KPI se rotula como
matrículas.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- **`src/app/shared/components/alumnos-profesional-list-content/alumnos-profesional-list-content.component.ts`**
  — rotular chip y KPI como matrículas; `track` por `enrollmentId` (no por alumno) en tabla y
  tarjetas.

## Test de Regresión
- E2E con un alumno de 2 matrículas Profesional: 2 filas, el total las cuenta y no hay errores de
  claves duplicadas en consola.
