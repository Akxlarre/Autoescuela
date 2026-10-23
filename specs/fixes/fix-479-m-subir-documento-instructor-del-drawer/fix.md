# Fix: "Subir documento" del drawer del instructor siempre apunta a ese instructor
> id: fix-479-m-subir-documento-instructor-del-drawer
> refs: fix-447-m-testing-documentos-certificacion (H05) · fix-472-m · 0003-m
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Root Cause

El mismo patrón de fix-472-m, en el drawer de documentos del instructor:
`DmsFacade.loadInstructorDocuments()` recién fija `instructorDetail` cuando responde la primera
consulta. "Subir documento" del drawer lee `instructorDetail` para preseleccionar al instructor,
así que si se presiona mientras carga, el formulario queda sin instructor (o con el del drawer
anterior). Hallado con la suite E2E (H05), que se colgaba con "Seleccionar instructor..." vacío.

## ACs Afectados

- AC propio — "Subir documento" desde el drawer de un instructor queda con ese instructor
  preseleccionado aunque el drawer siga cargando.
- AC propio — La respuesta tardía del drawer de otro instructor no lo pisa.

## Cambio

- `DmsFacade.loadInstructorDocuments()`: fija `instructorDetail` al empezar (conserva nombre y
  licencia si es el mismo instructor), vacía los documentos si cambia el instructor y descarta
  respuestas viejas con `createRequestGuard()`.

## Test de Regresión

- `dms.facade.spec.ts` — `instructorDetail` apunta al instructor nuevo antes de que respondan las
  consultas; la respuesta tardía de otro no lo pisa.
- `e2e/documentos-certificacion-2.spec.ts` (H05).

## Progreso

- [x] Tests rojos → verdes
- [x] E2E H05 verde
