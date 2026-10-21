# Fix: Un documento de la escuela queda de la sede de quien lo sube
> id: fix-476-m-documento-escuela-sede-de-quien-sube
> refs: fix-447-m-testing-documentos-certificacion (I07) · fix-451-m
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Root Cause

`DmsFacade.uploadSchoolDocument()` insertaba en `school_documents` sin `branch_id`: todo documento
institucional quedaba para ambas sedes (NULL), también una factura de folios de una sola escuela.
Decisión de Matías (2026-10-20): **queda de la sede de quien sube**; el admin con "Todas las
sedes" sube para ambas.

## ACs Afectados

- AC propio — La secretaria sube con `branch_id` = su sede; con acceso a ambas sedes, la sede
  elegida en el selector (o ambas si está en "Todas").
- AC propio — El admin con una sede elegida sube para esa sede; con "Todas las sedes", para ambas
  (NULL), como antes.
- AC propio — Una secretaria sin sede asignada sube para ambas (NULL), nunca con un id inválido.
- La lista ya muestra los de la sede elegida más los de "ambas" (fix-451-m); no cambia.

## Cambio

- `DmsFacade.uploadSchoolDocument()`: `branch_id` sale de `getActiveBranchId()` (misma regla que
  filtra las listas); `NO_BRANCH_SCOPE` se guarda como NULL.

## Test de Regresión

- `dms.facade.spec.ts` — secretaria de la sede 1 → `branch_id: 1`; admin con sede 2 → 2; admin en
  "Todas" → null.

## Progreso

- [x] Tests rojos → verdes
- [x] Navegador / E2E I02: la fila queda con la sede de la secretaria
