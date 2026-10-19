# Fix: El DMS filtra los documentos de alumno por la sede del alumno, no por la de la matrícula
> id: fix-456-m-dms-sede-de-la-matricula
> refs: fix-447-m-testing-documentos-certificacion (S19, caso B17) · spec 0007-m
> status: open
> created: 2026-10-18

## Root Cause

Con una sede elegida, `DmsFacade.fetchAllData()` trae los alumnos con
`.eq('users.branch_id', sede)` y después descarta los documentos cuyo alumno no está en esa
lista. Pero `0007-m` permite que una matrícula sea de otra sede que el alumno (re-matrícula), y
los documentos van por matrícula. Confirmado el 2026-10-18: Samuel José Merino (alumno sede 2)
tiene la matrícula #0008 **activa en la sede 1** con 2 documentos; la secretaria de la sede 1 no
los ve en el DMS y, en cambio, aparecen en el DMS de la sede 2.

## ACs Afectados

- `0007-m` — los documentos son de la matrícula, con la sede de esa matrícula.
- AC propio — con una sede elegida, el DMS lista las matrículas **de esa sede** (y sus
  documentos), sea cual sea la sede del alumno; las matrículas de la otra sede no aparecen. En
  "Todas las sedes" no cambia.

## Cambio

- `dms.facade.ts` — `fetchAllData()`: con sede, `students` se trae con `enrollments!inner(...)`
  filtrando `enrollments.branch_id`; los documentos de alumno se filtran por matrícula (el mapa de
  matrículas de la sede), no por alumno.

## Test de regresión

- `dms.facade.spec.ts` — "con sede, filtra por la sede de la matrícula": alumno de la sede 2 con
  matrícula en la sede 1 aparece en la sede 1; el documento de su matrícula de la sede 2 no.
- Navegador: secretaria sede 1 → Samuel José Merino aparece con la matrícula #0008.

## Progreso

- [x] Cliente (`dms.facade.ts`): filtro por `enrollments.branch_id` + documentos por matrícula.
  `dms.facade.spec.ts` 43/43 (el test nuevo falló antes). Admin con "Autoescuela Chillán" → Samuel
  aparece con #0008 y 2 docs (antes no).
- [ ] **Secretaria sede 1: sigue sin verlo — lo bloquea la RLS.** `select_students`
  (`20260723030000`) solo deja ver alumnos cuyo `users.branch_id` es la sede de la secretaria. Con
  su token: `enrollments` #0008 → 1 fila, `v_dms_student_documents` de Samuel → 2 filas,
  `students` id 84 → 0 filas. No es solo del DMS: un alumno re-matriculado en la otra sede es
  invisible para esa secretaria en toda la app. Requiere migración (y decisión de Matías).
