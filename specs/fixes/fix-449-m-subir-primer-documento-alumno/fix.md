# Fix: No se puede subir el primer documento de un alumno desde "Subir documento"
> id: fix-449-m-subir-primer-documento-alumno
> refs: fix-447-m-testing-documentos-certificacion (S7, caso D03) · spec 0007-m
> status: done
> closed: 2026-10-18
> created: 2026-10-18

## Root Cause

El selector "Alumno" del drawer "Subir documento" se arma desde `DmsFacade.studentsWithDocs()`,
que agrupa `v_dms_student_documents` por matrícula: solo contiene matrículas que **ya tienen** al
menos un documento. Un alumno matriculado sin ningún documento (ni contrato) no aparece, así que
su primer documento no se puede subir desde el DMS. Confirmado el 2026-10-18 como secretaria sede
1: 73 de 74 alumnos en el selector; falta "Invitación Prueba" (matrícula #0081, activa, sin
documentos). Los instructores no tienen el problema: `instructorsWithDocs` ya incluye a los que
tienen 0 documentos.

## ACs Afectados

- Spec 0007-m (documentos por matrícula): subir un documento a cualquier matrícula del alumno.
- AC propio — el selector ofrece a todo alumno de la sede con al menos una matrícula, tenga o no
  documentos; un alumno sin matrícula no aparece (no hay a qué asociar el documento).

## Cambio

- `DmsFacade`: nuevo `uploadableStudents` (alumnos del scope con ≥1 matrícula, orden paterno),
  armado en `fetchAllData()` desde la consulta de `students` que ya existe.
- `dms-upload-drawer`: `studentOptions` lee `uploadableStudents()` en vez de deduplicar
  `studentsWithDocs()`.

## Test de regresión

- `dms.facade.spec.ts` — "uploadableStudents incluye al alumno con matrícula y sin documentos".
- Navegador: secretaria sede 1 → "Subir documento" ofrece a "Invitación Prueba".

### Resultado (2026-10-18)

- ✅ `dms.facade.spec.ts` + `dms-upload-drawer.component.spec.ts`: 30/30 (el test nuevo falló antes
  del cambio).
- ✅ Navegador, secretaria sede 1: el selector pasa de 73 a 74 alumnos e incluye a "Prueba Temp
  Mail Invitación"; al elegirlo ofrece los 7 tipos; se subió `cedula-prueba.pdf` (Cédula) → toast
  "Documento subido" y 1 fila en `student_documents` de la matrícula 6227 (#0081). Dato de prueba
  dejado a propósito.
- `npm run lint:arch`: 0 errores.
