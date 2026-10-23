# Fix: Base Alumnos B decide la sede de un alumno por su usuario, no por sus matrículas
> id: fix-458-m-base-alumnos-sede-de-la-matricula
> refs: fix-447-m-testing-documentos-certificacion (hallazgo al verificar fix-456-m) · DG-115 · spec 0007-m
> status: done
> closed: 2026-10-18
> created: 2026-10-18

## Root Cause

`AdminAlumnosFacade.fetchAlumnosData()` filtra con `.eq('users.branch_id', sede)` y la columna
Sede sale de `users.branches.name`. Pero un alumno es de cada sede donde tiene matrícula (DG-115):
tras aplicar `20261018120000` la secretaria de la sede 1 ya puede leer a Samuel José Merino
(usuario sede 2, matrícula #0008 activa en la sede 1), y el DMS lo muestra, pero Base Alumnos no
(verificado el 2026-10-18). Al revés, un alumno de la sede 1 re-matriculado en la sede 2 aparece
en la sede 1 con la matrícula de la sede 2. En "Todas las sedes" la columna Sede muestra la del
usuario, no la de la matrícula.

## ACs Afectados

- AC propio — con una sede elegida, un alumno aparece si tiene alguna matrícula en esa sede (y la
  fila usa solo esas matrículas); un alumno sin ninguna matrícula aparece en la sede de su usuario.
- AC propio — la columna Sede muestra la sede de la matrícula de la fila (la del usuario si no tiene
  matrícula).

## Cambio

- `core/utils/branch-scope.utils.ts` — `scopeStudentsToBranch(rows, sede)` (pura).
- `admin-alumnos.facade.ts` — sin `.eq('users.branch_id')`; `enrollments` trae `branch_id` y
  `branches(name)`; aplica `scopeStudentsToBranch`; Sede desde la matrícula elegida.

## Test de regresión

- `branch-scope.utils.spec.ts` — casos de `scopeStudentsToBranch`.
- `admin-alumnos.facade.spec.ts` — no filtra por `users.branch_id`; Sede de la matrícula.
- Navegador: secretaria sede 1 → Base Alumnos muestra a Samuel con #0008.

### Resultado (2026-10-18)

- ✅ `branch-scope.utils.spec.ts` (5 casos nuevos, fallaron antes); `admin-alumnos.facade.spec.ts`
  con los bloques de sede (fix-027, spec 0017) reescritos para mirar las filas que quedan en vez
  del `.eq()` — 4 fallaron antes del cambio. 166/166 con `features/admin/alumnos` y
  `features/secretaria`. `tsc --noEmit` limpio.
- ✅ Navegador, secretaria sede 1 → Base Alumnos, buscar "Merino": aparece Samuel José Merino con
  0008 (antes no).
- Impacto en datos de dev (regla vieja vs nueva): sede 1 pasa de 74 a 75 (entra solo Samuel, no
  sale nadie); sede 2 queda igual (137).
