# Fix: El DMS pierde filas en silencio pasadas las 1.000
> id: fix-457-m-dms-sin-tope-1000-filas
> refs: fix-447-m-testing-documentos-certificacion (S12, caso B16) · DG-008
> status: done
> closed: 2026-10-18
> created: 2026-10-18

## Root Cause

`DmsFacade.fetchAllData()` trae sin paginar `v_dms_student_documents`, `students` e
`instructor_documents`. PostgREST corta en `max_rows = 1000` sin error (DG-008): con una escuela
real (~4 documentos por alumno) se pierden documentos y alumnos y los conteos quedan mal, sin
ningún aviso. Hoy en dev hay 222 documentos y 211 alumnos: no se nota todavía.

## ACs Afectados

- AC propio — el DMS trae todas las filas de esas tres consultas aunque pasen de 1.000.

## Cambio

- `core/utils/paged-fetch.utils.ts` (nuevo, función pura) — `fetchAllPages(fetchPage, pageSize)`:
  pide páginas con `range(from, to)` hasta que una venga incompleta; corta en el primer error.
- `dms.facade.ts` — las tres consultas pasan por `fetchAllPages`, con un orden estable (`id` como
  desempate) para que las páginas no se solapen.

## Test de regresión

- `paged-fetch.utils.spec.ts` — 2.500 filas en páginas de 1.000 → 3 llamadas y 2.500 filas; error
  en la página 2 → devuelve el error; vacío → 1 llamada.
- `dms.facade.spec.ts` — las consultas del DMS usan `range`.

### Resultado (2026-10-18)

- ✅ `paged-fetch.utils.spec.ts` 4/4 (falló antes de existir el módulo); `dms.facade.spec.ts` +
  `features/{admin,secretaria}/documentos` 48/48. Los mocks del request guard (spec 0005-m)
  necesitaron `range`. `tsc --noEmit` limpio.
- ✅ Navegador, admin: las 3 consultas salen con `offset=0&limit=1000` y orden estable
  (`document_at.desc,source.asc,id.asc` / `id.asc`), 200, sin toasts de error, lista cargada.
- Con los datos de dev (222 documentos) no se puede ver una segunda página real; la paginación
  queda cubierta por el test de la util (2.500 filas → 3 páginas).
