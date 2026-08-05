# Fix: Dropdown de "Estado Actual" se corta en drawer de editar vehículo
> id: fix-120-m-status-select-dropdown-clipped
> refs: fix-117-m-branch-scope-selector-dropdown-clipped
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Root Cause
Mismo root cause que fix-117-m pero en otra instancia: el `p-select` de "Estado Actual" en
`VehicleFormDrawerComponent` no tiene `appendTo="body"`. Por default PrimeNG monta el overlay
del dropdown como hijo del propio contenedor del select, heredando el `overflow` del contenido
scrolleable del drawer, y queda recortado/desaparece cuando el campo está cerca del borde
inferior visible. fix-117-m ya corrigió el mismo patrón en `app-branch-scope-selector`
(compartido), pero el `p-select` de estado vive directo en el template de
`vehicle-form-drawer.component.ts` y no se tocó en ese fix.

## ACs Afectados
Ninguno — fix autónomo de un bug visual, no cambia comportamiento ni contratos de datos.

## Cambio
- **Archivo:** `src/app/features/admin/flota/vehicle-form-drawer/vehicle-form-drawer.component.ts`
- **Qué cambia:** se agrega `appendTo="body"` al `p-select` de "Estado Actual" para que el
  overlay del dropdown se monte en `<body>` y no quede recortado por el overflow del
  contenedor scrolleable del drawer.

## Test de Regresión
- Verificación manual visual: al abrir el dropdown "Estado Actual" en el drawer de "Editar
  Vehículo", la lista de opciones se ve completa al hacer hover, sin desaparecer, incluso
  cuando el campo está cerca del borde inferior del drawer.
