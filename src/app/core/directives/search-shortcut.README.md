# appSearchShortcut

Atajo global `Ctrl+K` / `Cmd+K` para abrir el panel de búsqueda.

## Propósito
Registrar el listener de teclado a nivel de documento para que el usuario pueda abrir la búsqueda desde cualquier parte de la app.

## Uso

```html
<!-- En app.ts (componente raíz) -->
<router-outlet appSearchShortcut />
```

## Cuándo usarlo
- Una sola vez en el componente raíz o layout principal
- Cuando la app tiene `app-search-panel` y `SearchPanelService`

## Cuándo NO usarlo
- Si no hay panel de búsqueda global
- En componentes anidados (el listener es a nivel document, basta con uno)

## Dependencias
- `SearchPanelService.open()` — dispara la apertura del panel
- El panel debe estar en el DOM (topbar) y reaccionar a `openRequested()`
