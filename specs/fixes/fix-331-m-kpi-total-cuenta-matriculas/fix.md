# Fix: El total de la Base Profesional dice "alumnos" pero cuenta matrículas
> id: fix-331-m-kpi-total-cuenta-matriculas
> refs: fix-319-m-testing-clase-profesional-piloto (B05, D01, D10) · ASG-i-025
> status: done
> closed: 2026-10-05
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

**Verificado el 2026-10-05:** B05 confirmado antes del fix: con `E2E-ProfDoble` (2 matrículas
Profesional, sembrado en `fix-319-m`) la consola mostraba `NG0955` (claves duplicadas) en la vista
de tarjetas, que rastreaba por `alumno.id` (id del alumno). La tabla (`p-table`) no usa `track`.
Después del fix (Playwright, `secretaria2@test.com`): búsqueda "E2E-ProfDoble" → 2 tarjetas, hero
"64 matrículas · MATRÍCULAS 64 · ACTIVAS 64", consola sin warnings. Spec del componente: chip
"N matrículas" y KPIs "Matrículas"/"Activas" (3/3).
