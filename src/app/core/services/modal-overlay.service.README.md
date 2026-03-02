# ModalOverlayService

## Propósito

Proporciona el contenedor donde se renderizan los modales para que cubran todo el viewport (incl. topbar). El MainLayout registra el contenedor al montarse.

## API pública

| Miembro | Tipo | Descripción |
|---------|------|-------------|
| `container` | `Signal<HTMLElement \| null>` | Contenedor donde se teleportan los modales |
| `setContainer(el)` | `void` | Registra el contenedor (MainLayout) |
| `clearContainer()` | `void` | Limpia al desmontar |

## Cuándo usarlo

- Modales que deben cubrir el topbar (ej. `app-modal` con `[appModalOverlay]`)
- El MainLayout llama `setContainer` en el overlay div

## Cuándo no usarlo

- Para modales que no necesitan cubrir el topbar → render normal
- Para el contenido del modal → `ConfirmModalService` o `app-modal`

## Dependencias

- Ninguna. Usado por la directiva `[appModalOverlay]`.
