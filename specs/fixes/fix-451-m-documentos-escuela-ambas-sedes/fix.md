# Fix: Los documentos de la escuela "para ambas sedes" no aparecen con una sede elegida
> id: fix-451-m-documentos-escuela-ambas-sedes
> refs: fix-447-m-testing-documentos-certificacion (S5, caso I02) · spec 0047-b
> status: done
> closed: 2026-10-18
> created: 2026-10-18

## Root Cause

`school_documents.branch_id = NULL` significa "ambas sedes", y así se insertan todos los
documentos que se suben desde el DMS. La RLS los deja leer a la secretaria (`branch_id IS NULL OR
branch_id = su sede`), pero `DmsFacade.fetchAllData()` filtra la lista con
`.eq('branch_id', sede)`, que excluye los NULL. Resultado: la secretaria y el admin con una sede
elegida no ven ningún documento institucional; solo el admin en "Todas las sedes". Confirmado el
2026-10-18 como secretaria sede 1: la tabla le devuelve 1 fila (NULL) y la consulta de la app,
0.

## ACs Afectados

- AC propio — con una sede elegida, la lista muestra los documentos de esa sede **y** los de
  ambas sedes (NULL); en "Todas las sedes" no cambia.

## Cambio

- `dms.facade.ts` — `fetchAllData()`: el filtro de `school_documents` pasa a
  `.or('branch_id.is.null,branch_id.eq.<sede>')`.

## Test de regresión

- `dms.facade.spec.ts` — "documentos de la escuela con sede incluyen los de ambas sedes".
- Navegador: secretaria sede 1 → pestaña "Documentos de la Escuela" muestra el documento NULL.

### Resultado (2026-10-18)

- ✅ `dms.facade.spec.ts` 26/26 (el test nuevo falló antes del cambio).
- ✅ Navegador, secretaria sede 1 → "Documentos de la Escuela": aparece `EvYz_FrXcAUyt4h.jpg`
  (Decreto, 2026-03-22), antes la lista salía vacía.
