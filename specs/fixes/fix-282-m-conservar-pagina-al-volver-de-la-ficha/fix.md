# Fix: Conservar la página de la Base de Alumnos B al volver desde la ficha
> id: fix-282-m-conservar-pagina-al-volver-de-la-ficha
> refs: ASG-i-024
> status: done
> closed: 2026-10-03
> created: 2026-10-03

## Root Cause
`fix-275-m` + `hotfix-126-m` conservan búsqueda, filtros y orden al volver desde la ficha: la lista
los avisa por `filtersChanged`, el facade los guarda (`listFilters`) y la lista los restaura en
`ngOnInit`. La posición de la tabla (`tableFirst`) y las tarjetas cargadas (`mobileShown`) nunca
entraron en `AlumnoListFilters`, así que al volver la tabla arranca en la página 1. Encontrado en
la 2ª pasada de `fix-264-m` (`024a` I03); decisión de Matías: conservar también la página.

## ACs Afectados
- `024a` I03: al volver desde la ficha se conservan página, filtros y orden.
- Regla de `hotfix-126-m` intacta: solo al volver desde la ficha; por otro camino la lista
  aparece limpia (el facade vuelve a `EMPTY_ALUMNO_LIST_FILTERS`, que trae página 1).

## Cambio
- **Archivo:** `src/app/core/models/ui/alumno-table-row.model.ts` — `AlumnoListFilters` suma
  `first` (primera fila de la página de la tabla) y `cardsShown` (tarjetas cargadas).
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` —
  avisa `first`/`cardsShown` al cambiar de página o cargar más tarjetas y los restaura en
  `ngOnInit`. Si al volver la página ya no existe (p. ej. se archivó un alumno), se muestra la
  última que sí existe.

## Test de Regresión
- `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.spec.ts >
  conservar la página al volver de la ficha (fix-282-m)` ✓
