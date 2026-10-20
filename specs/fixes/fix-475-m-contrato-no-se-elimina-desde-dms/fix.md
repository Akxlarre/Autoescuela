# Fix: El contrato de la matrícula no se elimina desde el DMS
> id: fix-475-m-contrato-no-se-elimina-desde-dms
> refs: fix-447-m-testing-documentos-certificacion (F04) · fix-470-m
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Root Cause

El admin podía eliminar desde el DMS la fila "Contrato" de una matrícula, y eso borraba el registro
de `digital_contracts` (contrato firmado y su hash de aceptación). Decisión de Matías (2026-10-20):
**el contrato no se elimina desde el DMS**, igual que el carnet y el certificado; si está mal se
reemplaza desde la ficha del alumno.

## ACs Afectados

- AC propio — Ninguna fila "Contrato" del DMS (drawer del alumno ni "Últimos subidos") muestra
  "Eliminar".
- AC propio — `deleteStudentDocument(id, 'digital_contract')` se rechaza con el mismo mensaje que
  las demás filas no eliminables y no toca `digital_contracts`.

## Cambio

- `core/utils/dms-documents.utils.ts`: `isDeletableStudentDoc` solo acepta `student_document`.
- `DmsFacade.deleteStudentDocument`: deja de tener la rama que borraba `digital_contracts`.

## Test de Regresión

- `dms-documents.utils.spec.ts` — `digital_contract` no se puede borrar.
- `dms.facade.spec.ts` — borrar un `digital_contract` se rechaza sin tocar la BD.

## Progreso

- [x] Tests rojos → verdes
- [x] Navegador: el contrato del drawer no tiene Eliminar (E2E C05/C06, que ahora lo verifica)
