# ModalOverlayDirective

Mueve el modal al contenedor de overlay del layout para que el backdrop cubra todo el viewport (incl. topbar). Crea un wrapper con `pointer-events: auto` que bloquea el fondo sin modificar el overlay (evita bloquear el botón al abrir).

## Propósito

El modal está dentro del área de contenido (`main`), que tiene un z-index menor que el topbar. Esta directiva "teleporta" el modal al contenedor de overlay del `MainLayoutComponent`, que está por encima de todo (z-index 9999).

## Selector

`[appModalOverlay]`

## Uso

Aplicar en `app-modal` cuando el modal está dentro del main layout:

```html
<app-modal
  [appModalOverlay]="isModalOpen()"
  [isOpen]="isModalOpen()"
  (closed)="isModalOpen.set(false)"
  title="Título"
>
  ...
</app-modal>
```

## Input

| Input | Tipo | Descripción |
|-------|------|-------------|
| `appModalOverlay` | `boolean` | Cuando `true`, mueve el host al overlay container |

## Cuándo usarla

- Siempre que uses `app-modal` dentro de una página del main layout (con topbar y sidebar)

## Cuándo NO usarla

- Modales en el login u otras rutas fuera del main layout (no hay overlay container)

## Dependencias

- `ModalOverlayService` (el MainLayout registra el contenedor)
- El modal debe estar dentro de una ruta que use `MainLayoutComponent`
