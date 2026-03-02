# BreadcrumbService

## Propósito

Deriva el breadcrumb del menú lateral y la ruta actual. Fuente única de verdad: `MenuConfigService`. Genera `home` (Inicio) e `items` (ruta desde categoría hasta página actual).

## API pública

| Miembro | Tipo | Descripción |
|---------|------|-------------|
| `breadcrumb` | `ComputedSignal<BreadcrumbState>` | `{ home, items }` para renderizar el breadcrumb |
| `BreadcrumbState` | `interface` | `home: MenuItem`, `items: MenuItem[]` |

## Reglas de items

- **Último item**: sin `routerLink` (página actual)
- **Items intermedios**: con `routerLink` al primer item de la categoría
- **Home**: raíz (Inicio → /app/dashboard)

## Cuándo usarlo

- Componente de breadcrumb en el topbar
- Cualquier UI que necesite la ruta navegacional actual

## Cuándo no usarlo

- Para items del menú lateral → `MenuConfigService`
- Para la URL actual → `Router`

## Dependencias

- `Router`, `MenuConfigService`
