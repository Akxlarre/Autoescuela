# Fix: DMS — `v_dms_student_documents.limit(100)` compartido rompe docCount/filas de la tabla principal
> id: fix-132-b-dms-limit100-docCount-incorrecto
> refs: specs/0007-m-dms-documentos-por-matricula
> status: done
> closed: 2026-08-11
> created: 2026-08-11

## Root Cause

`DmsFacade.fetchAllData()` trae `v_dms_student_documents` con `.limit(100)` (ordenado por
`document_at desc`) en una única query (`vDocsRes`), y ese mismo resultado (`allVDocs`) se usa
para DOS cosas con requisitos distintos:

1. `recentDocs` ("Últimos subidos") — correcto: quiere los 5 documentos más recientes, un
   pool de 100 ordenado por fecha es más que suficiente.
2. `enrollmentDocCount` — el mapa `enrollment_id → docCount` que arma **tanto el `docCount` de
   cada fila como qué matrículas aparecen en la tabla "Alumnos con documentos"** (spec 0007-m,
   AC1). Este cálculo necesita **todos** los documentos, no solo los 100 más recientes.

Con ≤100 documentos totales en la escuela (el caso actual, dev) es invisible. Apenas se superen
los 100 documentos de alumnos acumulados, empieza a fallar en silencio: matrículas cuyos
documentos son todos más antiguos que los 100 más recientes desaparecen de la tabla por
completo, y las que sí aparecen muestran un `docCount` subcontado — el paginador nativo del
`p-table` (10/página) da la falsa sensación de que se está viendo el listado completo.

## ACs Afectados

- **AC1** (spec 0007-m): "aparecen 2 filas para ese alumno... con su propio `docCount`" — deja
  de cumplirse una vez el total de documentos de alumnos supera 100 (la fila puede no aparecer,
  o el `docCount` puede venir incompleto).

## Cambio

- **Archivo:** `src/app/core/facades/dms.facade.ts`
  - Quita el `.limit(100)` de la query a `v_dms_student_documents` en `fetchAllData()` — pasa a
    ser unbounded, igual que `schoolDocsQuery`/`document_templates` en la misma función (mismo
    patrón ya usado ahí, sin límite artificial).
  - `recentDocs` sigue siendo `allVDocs.slice(0, 5)` (ya viene ordenado por `document_at desc`,
    sin cambios en su lógica) — con el pool completo en vez de acotado a 100, el resultado de
    "Últimos subidos" es idéntico o más preciso, nunca peor.
  - `enrollmentDocCount` ahora se calcula sobre el pool completo → `docCount` y la existencia de
    filas en la tabla vuelven a ser correctos sin importar cuántos documentos totales haya.

## Test de Regresión

- Nuevo test en `src/app/core/facades/dms.facade.spec.ts` (fix-132-b): alumno cuyo único
  documento tiene `document_at` más antiguo que un pool simulado de 100 documentos "de
  relleno" de otro alumno más recientes — verifica `vDocsBuilder.limit` NO llamado (guardia
  contra reintroducir el tope) y que `studentsWithDocs()` sigue incluyendo esa matrícula con
  `docCount: 1` correcto. ✓ (24/24 tests de `dms.facade.spec.ts` en verde)
- `npx tsc --noEmit`: sin errores.
- `npm run lint:arch`: exit 0, 0 errores.
- `npm run test:ci` (suite completa): 1976/1976 tests en verde (155 archivos, 5 skipped
  pre-existentes), sin regresiones en los tests existentes de `dms.facade.spec.ts` (AC1/AC2/
  AC-E1 de spec 0007-m).
- `/verify` manual en navegador (`/admin/documentos`): tabla "Alumnos con documentos" y
  "Últimos subidos" renderizan igual que antes (49 filas, sin cambios visibles — esperado, los
  datos actuales nunca llegaron al tope de 100 que se eliminó). Sin errores nuevos en consola.
