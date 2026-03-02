# LayoutService

## Propósito

Estado del layout responsive. Controla el sidebar drawer en mobile (hamburger). En desktop el sidebar está siempre visible; en mobile es un overlay controlado por `sidebarOpen`.

## API pública

| Miembro | Tipo | Descripción |
|---------|------|-------------|
| `sidebarOpen` | `Signal<boolean>` | true si el drawer está abierto |
| `openSidebar()` | `void` | Abre el drawer |
| `closeSidebar()` | `void` | Cierra el drawer |
| `toggleSidebar()` | `void` | Alterna abierto/cerrado |

## Cuándo usarlo

- Botón hamburger en mobile para abrir/cerrar sidebar
- Backdrop del sidebar para cerrar al hacer click fuera
- Cualquier lógica que dependa del estado del drawer

## Cuándo no usarlo

- Para el contenido del menú → `MenuConfigService`
- Para breadcrumb → `BreadcrumbService`

## Dependencias

- Ninguna
