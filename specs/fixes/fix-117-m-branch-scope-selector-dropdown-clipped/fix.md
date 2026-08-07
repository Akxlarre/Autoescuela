# Fix: Dropdown de "Sede principal" se corta dentro del drawer
> id: fix-117-m-branch-scope-selector-dropdown-clipped
> refs: fix-116-m-vehicle-drawer-inputs-genericos
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Root Cause
El `p-select` de "Sede principal" en `BranchScopeSelectorComponent` no tiene `appendTo="body"`.
Por default PrimeNG monta el overlay del dropdown como hijo del propio contenedor del select, así
que hereda el `overflow`/stacking del contenido scrolleable del drawer y queda recortado cuando el
campo está cerca del borde inferior visible (reportado por el dueño al ver el drawer de "Nuevo
Vehículo", pero el bug es del componente compartido: también afecta a los drawers de instructor
que ya lo usaban). El patrón correcto ya existe en el proyecto — `dms-upload-drawer.component.ts`
usa `appendTo="body"` en sus tres `p-select` para evitar exactamente este recorte.

## ACs Afectados
Ninguno — fix autónomo de un bug visual, no cambia comportamiento ni contratos de datos.

## Cambio
- **Archivo:** `src/app/shared/components/branch-scope-selector/branch-scope-selector.component.ts`
- **Qué cambia:** se agrega `appendTo="body"` al `p-select` de "Sede principal" para que el
  overlay del dropdown se monte en `<body>` y no quede recortado por el overflow del contenedor
  scrolleable del drawer que lo contiene.

## Test de Regresión
- Verificación manual visual (`/verify`): al abrir el dropdown "Sede principal" en el drawer de
  "Nuevo Vehículo" (y de instructor), la lista de opciones se ve completa, sin recorte, incluso
  cuando el campo está cerca del borde inferior del drawer.
