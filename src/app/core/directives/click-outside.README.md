# appClickOutside

Detecta clics fuera del elemento host y emite un evento para cerrar panels, dropdowns y menús custom.

## Propósito
Evitar repetir `HostListener('document:click')` en cada componente que necesite cerrarse al hacer clic fuera. Soporta activación condicional para no registrar listeners innecesarios cuando el panel está cerrado.

## Uso

```html
<!-- Panel de notificaciones -->
<div
  class="notif-panel card"
  [appClickOutside]
  [clickOutsideEnabled]="panelOpen()"
  (clickOutside)="panelOpen.set(false)"
>
  ...
</div>

<!-- Menú de usuario custom -->
<div
  class="user-menu"
  [appClickOutside]
  [clickOutsideEnabled]="menuOpen()"
  (clickOutside)="menuOpen.set(false)"
>
  ...
</div>
```

## API

| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `clickOutsideEnabled` | `input<boolean>` | `true` | Activa/desactiva el listener. Pasa `panelOpen()` para evitar escuchar cuando está cerrado |
| `clickOutside` | `output<void>` | — | Emite cuando se hace clic fuera del host |

## Cuándo usarlo
- Panels de notificaciones, menús de usuario, popovers custom
- Cualquier elemento que deba cerrarse al hacer clic fuera y no sea un componente PrimeNG

## Cuándo NO usarlo
- Overlays de PrimeNG (p-dropdown, p-menu, p-dialog) — ya lo manejan internamente
- Elementos que deben permanecer abiertos aunque se haga clic fuera

## Nota técnica
Usa `capture: true` en el listener para interceptar el evento antes que los listeners internos del panel, evitando falsos positivos al hacer clic en botones dentro del panel.
