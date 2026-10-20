# Hotfix: El buscador del DMS ignora tildes y el formato del RUT
> id: hotfix-162-m-dms-busqueda-sin-tildes-y-rut-con-formato
> refs: fix-447-m-testing-documentos-certificacion (B05, B06) · fix-267-m
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Problema
"Documentos del Alumno" filtraba con `toLowerCase().includes()`: "jose" no encontraba a "José"
(0 resultados, "José" daba 2) y el RUT solo se encontraba escrito igual que en la BD
("25000010-3"); "25.000.010-3" y "250000103" daban 0. La Base de Alumnos ya usa
`filterBySearchTokens()` (fix-267-m), que ignora tildes, compara el RUT sin puntuación y acepta
nombre y apellido en cualquier orden. Certificación ya normalizaba.

## Cambios
- **Archivo:** `src/app/shared/components/dms-list-content/dms-list-content.component.ts` —
  `filteredStudentsWithDocs` usa `filterBySearchTokens(rows, query, (s) => [s.name, s.rut])`.
  Cubierto por los tests de `search-filter.utils.spec.ts`; verificado en navegador.
