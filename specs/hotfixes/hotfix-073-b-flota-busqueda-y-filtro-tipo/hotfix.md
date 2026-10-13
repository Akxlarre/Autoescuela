# Hotfix: El buscador de Flota no filtra nada y el filtro "Tipo" adivina por la marca
> id: hotfix-073-b-flota-busqueda-y-filtro-tipo
> refs: ASG-i-032 (checklist 032, S4 y S20; decisión 8 del owner, 2026-10-12)
> status: closed
> created: 2026-10-12

## Problema
1. **S4:** el buscador del listado de Flota emite el texto, pero la página solo hace
   `console.log('Buscando:', term)`: escribir no cambia la lista.
2. **S20:** el filtro "Tipo" (Clase B / Profesional) no sale de un dato del vehículo: se adivina por
   la marca o el modelo (un Volvo XC40 cae como "Profesional"). Decisión del owner: quitarlo.

## Cambios
- **Archivo:** `src/app/core/utils/vehicle-search.utils.ts` (+ spec) — `matchesVehicleSearch()`:
  patente (sin guiones ni espacios), marca y modelo, sin distinguir mayúsculas ni tildes.
- **Archivo:** `src/app/core/facades/flota.facade.ts` (+ spec) — `setSearchTerm()` y filtro por texto
  en `filteredVehicles`; se van `typeFilter`, `setTypeFilter()` y `resolveType()`.
- **Archivo:** `src/app/features/admin/flota/admin-flota.component.ts` — el buscador llama al facade.
- **Archivo:** `src/app/shared/components/flota-list-content/flota-list-content.component.ts` — se quita
  el selector "Todos los tipos".
- **Archivo:** `src/app/core/models/ui/vehicle-table.model.ts` — se van `VehicleType` y `type`.

## Verificación
- vitest de la util y del facade; `ng build`, `lint:arch`; e2e del buscador (D01).

## Resultado (2026-10-12)
- vitest: `vehicle-search.utils.spec.ts` 12/12, `flota.facade.spec.ts` (+4 del buscador) y `flota-detalle.facade.spec.ts` en verde (37 en total).
- `e2e/flota-listado.spec.ts` 3/3: busca por patente en minúsculas y por marca, lista vacía sin coincidencias, vuelven todos al borrar; al salir y volver a Flota la lista no queda filtrada; el filtro "Tipo" ya no existe.
- `tsc` sin errores, `lint:arch` 0 errores (182).
- Extra: al salir de la página se limpia el texto del buscador en el facade (vive más que la página).
