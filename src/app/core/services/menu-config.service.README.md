# MenuConfigService

## Propósito

Configuración del menú lateral. Provee los items de navegación como `MenuItem[]` (PrimeNG).

## API pública

| Miembro | Tipo | Descripción |
|---------|------|-------------|
| `menuItems` | `ComputedSignal<MenuItem[]>` | Items del menú agrupados por categoría |

## Estructura

- Grupos con `label` (ej. "Inicio", "Operación", "Alumnos")
- Cada grupo tiene `items` con `label`, `icon`, `routerLink`

## Cuándo usarlo

- Sidebar para renderizar el menú
- BreadcrumbService (fuente de verdad para rutas)
- Cualquier componente que necesite la estructura de navegación

## Cuándo no usarlo

- Para breadcrumb derivado → `BreadcrumbService`

## Dependencias

- `MenuItem` de PrimeNG
- Ver `src/app/core/layout/sidebar/ARCHITECTURE.md`
