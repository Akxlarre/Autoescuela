# Hotfix: el test de Mantenimientos de un vehículo falla desde spec 0051-b
> id: hotfix-076-b-test-mantenimientos-basepath
> refs: spec 0051-b (Flota para la secretaria)
> status: closed
> created: 2026-10-15

## Problema
Spec 0051-b hizo que `VehicleMaintenancesComponent` arme la ruta de "Volver" con
`route.snapshot.data['basePath']` (admin o secretaria). El mock de `ActivatedRoute` del spec no
tiene `data`, así que los 3 tests de `hasScheduledMaintenances` revientan con
"Cannot read properties of undefined (reading 'basePath')" y `npm run test:ci` queda en rojo en `main`.

## Cambios
- **Archivo:** `src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.spec.ts`
  — el mock de `ActivatedRoute` incluye `data: {}`. Sin cambios en el componente.

## Verificación
- [x] El spec pasa 3/3 y `npm run test:ci` queda en verde.
