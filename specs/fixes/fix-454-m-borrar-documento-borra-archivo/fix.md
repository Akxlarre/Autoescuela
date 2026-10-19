# Fix: Borrar un documento del DMS deja el archivo en Storage
> id: fix-454-m-borrar-documento-borra-archivo
> refs: fix-447-m-testing-documentos-certificacion (S9, caso F05) · Ley 21.719
> status: done
> closed: 2026-10-18
> created: 2026-10-18

## Root Cause

`DmsFacade.deleteStudentDocument` / `deleteInstructorDocument` / `deleteSchoolDocument` solo
borran la fila; el archivo (cédula, certificado médico, licencia…) queda en el bucket
`documents` para siempre, sin ninguna fila que lo referencie. Lo mismo pasa al subir: si el
`upload` funciona y el `insert` falla, el archivo queda huérfano. Son datos personales (algunos
sensibles) que la escuela cree haber eliminado — relevante para Ley 21.719.

## ACs Afectados

- AC propio — al borrar un documento de alumno, instructor o escuela desde el DMS se borra la fila
  **y** su archivo de Storage. Si el archivo no se puede borrar, la fila igual queda borrada (no
  vuelve a aparecer en la lista) y se registra el error.
- AC propio — si al subir el `insert` falla, se borra el archivo recién subido.
- Fuera de alcance: contratos (`digital_contracts`), cuyo PDF genera el wizard de matrícula.

## Cambio

- `dms.facade.ts` — helper privado que borra la fila devolviendo `storage_url` y luego hace
  `storage.from('documents').remove()`; los 3 `upload*Document` limpian el archivo si el insert
  falla.

## Test de regresión

- `dms.facade.spec.ts` — borrar documento de instructor / escuela / alumno → `remove([storage_url])`;
  insert fallido → `remove([path])`.
- Navegador (admin): subir un documento de prueba, borrarlo y confirmar en Storage que el objeto
  ya no existe.

### Resultado (2026-10-18)

- ✅ `dms.facade.spec.ts` + `features/admin/documentos`: 37/37; los 5 tests nuevos fallaron antes
  del cambio. `tsc --noEmit` limpio.
- ✅ Navegador, admin → Documentos de la Escuela → Eliminar "Prueba fix-452" (el de `fix-452-m`):
  la fila `school_documents#2` desaparece y `school-docs/1792370495145_factura_folios.pdf` pasa de
  200 a 400 (objeto inexistente) en Storage. El documento viejo (#1) sigue intacto.
- Los archivos huérfanos que ya existen en el bucket por borrados anteriores no se limpian acá.
