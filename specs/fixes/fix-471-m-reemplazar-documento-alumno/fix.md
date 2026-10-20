# Fix: Reemplazar un documento del alumno (admin y secretaria)
> id: fix-471-m-reemplazar-documento-alumno
> refs: fix-447-m-testing-documentos-certificacion (S8)
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Root Cause

El DMS solo permitía subir y (al admin) eliminar. Si la secretaria subía un escaneo malo (borroso,
de otro alumno, mal recortado), no tenía cómo corregirlo: no puede eliminar, y subir otro deja los
dos visibles con el mismo tipo.

Decisión de Matías (2026-10-20): **la secretaria sí puede reemplazar un documento.**

La RLS ya lo permite: `update_student_documents` deja a la secretaria actualizar documentos de
matrículas de su sede y `documents_auth_insert` subir a `students/<matrícula>/`. Lo que no puede
es borrar del bucket (`documents_admin_delete` es solo admin).

## ACs Afectados

- AC propio — En el drawer de documentos del alumno, cada documento subido (`student_document`)
  tiene "Reemplazar", para admin y secretaria. Carnets, contrato y certificados no.
- AC propio — Al elegir el archivo se valida igual que al subir (PDF/JPG/PNG/WEBP, máx. 5 MB) y se
  pide confirmación nombrando el documento.
- AC propio — Al confirmar: el archivo nuevo se sube a una ruta nueva, la fila apunta a él (nombre,
  fecha de subida, estado `pending`) y la lista se recarga. Si la fila no se pudo actualizar, el
  archivo nuevo se borra y se muestra el motivo.
- AC propio — El archivo anterior se borra del bucket cuando quien reemplaza es admin. Con la
  secretaria queda en el bucket (no tiene permiso de borrado) sin que ninguna fila lo referencie.

Ruta nueva y no sobrescribir la misma: el CDN de Storage cachea por ruta y podía seguir sirviendo
el archivo viejo, y el reemplazo puede cambiar de extensión (JPG → PDF) y el visor detecta el tipo
por la extensión.

## Cambio

- `DmsFacade.replaceStudentDocument(docId, file)` + spec.
- `DmsStudentDocsDrawerComponent`: botón "Reemplazar" con input de archivo oculto.

## Test de Regresión

- `dms.facade.spec.ts` — reemplazo correcto (sube a ruta nueva, actualiza la fila, borra la vieja);
  archivo inválido no sube; fila no actualizada (0 filas) borra el archivo nuevo y avisa.

## Progreso

- [x] Tests rojos → verdes
- [x] `lint:arch`, `test:ci`
- [x] `/verify` como secretaria: reemplazar un documento
