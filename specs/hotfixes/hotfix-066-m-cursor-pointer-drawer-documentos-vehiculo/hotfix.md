# Hotfix: cursor-pointer faltante en botones de icono del drawer de documentos de vehículo
> id: hotfix-066-m-cursor-pointer-drawer-documentos-vehiculo
> refs: —
> status: done
> closed: 2026-08-11
> created: 2026-08-11

## Problema
Los botones de icono "Ver documento" y "Actualizar documento" en
`VehicleDocumentsDrawerComponent` no tienen `cursor-pointer` — el mouse muestra el cursor
default sobre un elemento clickeable.

## Cambios
- **Archivo:** `src/app/features/admin/flota/vehicle-documents-drawer/vehicle-documents-drawer.component.ts` — agregar `cursor-pointer` a la clase de ambos botones de icono.
