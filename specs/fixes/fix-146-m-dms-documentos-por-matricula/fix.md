# Fix: DMS agrupa documentos por alumno en vez de por matrícula
> id: fix-146-m-dms-documentos-por-matricula
> refs: — (independiente, detectado en revisión de la separación de carpetas de storage `student-docs/` vs `students/`)
> status: superseded — reemplazado por spec 0007-m-dms-documentos-por-matricula (el alcance real
> tocaba ~8 archivos + script de migración + SQL, más allá de "un fix = un archivo")
> created: 2026-08-09

## Root Cause
`student_documents` está scoped por `(enrollment_id, type)` — cada matrícula tiene su propio
juego de documentos (el patrón de "reutilizar foto de matrícula anterior" de fix-020 existe
justamente porque un alumno con dos matrículas tiene dos carnets/hojas de vida/cédulas/licencias
distintas). Pero la capa de presentación en `dms.facade.ts` no respeta ese scope:

1. **Lista (`loadAll()` / sección "alumnos con documentos")**: agrupa por `studentId`
   (`studentDocCount`, `studentsWithDocsUnsorted` en `dms.facade.ts:930-947`), usando solo la
   **última matrícula** (`latestEnrollment`) para mostrar sede/número, pero sumando en
   `docCount` los documentos de **todas** las matrículas del alumno mezclados.
2. **Detalle (`loadStudentDocuments(studentId)`, `dms.facade.ts:487`)**: consulta
   `v_dms_student_documents` filtrando solo por `student_id`, sin filtrar por `enrollment_id` —
   trae y muestra documentos de todas las matrículas del alumno juntos, sin indicar cuál
   corresponde a cuál matrícula.

Un alumno con 2 matrículas termina viéndose como una sola fila en la lista del DMS, y al abrir
su detalle ve carnets/contratos de ambas matrículas mezclados sin poder distinguir cuál es cuál
más allá de la fecha.

Adicionalmente, esta capa tiene una segunda inconsistencia relacionada: los documentos subidos
desde la pestaña DMS (`uploadStudentDocument()`) se guardan en Storage bajo
`student-docs/{studentId}/...`, mientras que los subidos desde el flujo de matrícula
(`enrollment-documents.facade.ts`, `admin-pre-inscritos.facade.ts`) usan
`students/{enrollmentId}/...`. Dos convenciones de carpeta para el mismo concepto de "documento
de alumno". No rompe nada hoy (todas las lecturas usan `storage_url` guardado en BD, ninguna
reconstruye la ruta ni hay RLS de Storage basada en el prefijo), pero es deuda que confunde
auditorías/limpiezas futuras y ya no tiene sentido mantener una vez que el resto de esta capa
pasa a razonar en términos de `enrollment_id`.

## ACs Afectados
- Ninguno — fix autónomo, no ligado a una spec existente.

## Cambio
- **Archivo:** `src/app/core/facades/dms.facade.ts`
- **Qué cambia:**
  1. La construcción de `studentsWithDocs` (lista) agrupa por `(studentId, enrollmentId)` en vez
     de solo `studentId` — un alumno con 2 matrículas produce 2 filas, cada una con su propia
     sede y número de matrícula (columnas ya existentes en la tabla, `matriculaNumber` y
     `branchName`, hoy resueltas desde `latestEnrollment` — deben resolverse por instancia).
  2. `loadStudentDocuments()` recibe también `enrollmentId` y filtra
     `v_dms_student_documents` por `enrollment_id` además de `student_id`, para que el detalle
     de una instancia solo muestre los documentos de esa matrícula.
  3. El llamado a `loadStudentDocuments()` desde el click de la lista (y desde
     `notifyUploadSaved()`) pasa el `enrollmentId` de la instancia seleccionada, propagado a
     través de `openStudentDocsDrawer()`, `openUpload()` y el nuevo signal
     `preselectedEnrollmentId`.
  4. `uploadStudentDocument()` sube al path `students/{enrollmentId}/{Date.now()}_{type}.{ext}`
     en vez de `student-docs/{studentId}/{Date.now()}_{type}.{ext}` — mismo esquema de nombre de
     archivo (timestamp + tipo, sin upsert de contenido, conserva histórico), solo cambia la
     carpeta raíz para unificar con la convención de matrícula.
  5. **Migración de datos** (`scripts/migrate-student-docs-storage.mjs`, ejecutar una vez a mano
     contra Supabase local): mueve cada objeto existente bajo `student-docs/{studentId}/...` a
     `students/{enrollmentId}/...` vía Storage API (`.move()`, no SQL — un `UPDATE storage.objects
     SET name=...` no mueve el archivo físico, solo el metadato) y actualiza
     `student_documents.storage_url` en la misma fila.
  6. **Migración SQL** (`supabase/migrations/<timestamp>_cleanup_student_docs_legacy_folder.sql`):
     idempotente, deja constancia de la baja de la convención `student-docs/` y limpia
     cualquier residuo de metadatos (`DELETE FROM storage.objects WHERE bucket_id='documents' AND
     name LIKE 'student-docs/%'`) — no-op en ambientes donde el script de migración ya corrió o
     donde nunca existió esa carpeta.
- **Fuera de alcance:** no se toca el comportamiento de `id_photo` (carnet), que sigue usando
  copy-on-confirm de fix-020 sin cambios.

## Test de Regresión
- `dms.facade.spec.ts` — nuevo caso: alumno con 2 enrollments produce 2 entradas en
  `studentsWithDocs()`, cada una con su propio `matriculaNumber`/`branchName` y `docCount`
  contando solo los documentos de su propio `enrollment_id`.
- `dms.facade.spec.ts` — `loadStudentDocuments(studentId, enrollmentId)` solo devuelve
  documentos cuyo `enrollment_id` coincide con el pasado, aunque existan documentos de otra
  matrícula del mismo alumno.
- `dms.facade.spec.ts` — `uploadStudentDocument()` construye el path bajo
  `students/{enrollmentId}/...`, no `student-docs/{studentId}/...`.
