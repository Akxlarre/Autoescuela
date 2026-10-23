# Hotfix: Buscar en "Documentos del Alumno" vuelve a la página 1
> id: hotfix-163-m-dms-buscar-vuelve-a-la-pagina-1
> refs: fix-447-m-testing-documentos-certificacion (B09)
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Problema
En la página 3 de la lista, escribir una búsqueda con muchos resultados dejaba el paginador en la
página 3: los primeros resultados quedaban escondidos en la página 1 (caso B09: "al buscar vuelve
a la página 1").

## Cambios
- **Archivo:** `src/app/shared/components/dms-list-content/dms-list-content.component.ts` — la
  tabla de alumnos usa `[first]` con un signal que vuelve a 0 cada vez que cambia la búsqueda
  (incluida la X); el paginador lo actualiza con `(onPage)`. Verificado en navegador.
