# View Transitions — Navegación de Rutas

Transiciones visuales para navegación usando la [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) nativa.

## Cómo Funciona

Sidebar y topbar permanecen **estáticos**. Solo el área `main-content` anima:

- **Salida** (`vt-page-out`): fade-out + translateY(-6px) en 180ms
- **Entrada** (`vt-page-in`): fade-in + translateY(+8px) en 280ms

Asimetría intencional: salida rápida, entrada suave.

**No requiere código adicional** — funciona automáticamente con cada navegación de ruta.

## Cambio de Tema

El cambio de tema **no usa View Transitions**. Se delega a CSS transitions en `body`:

```css
body {
  transition:
    background-color var(--duration-theme) var(--ease-standard),
    color var(--duration-theme) var(--ease-standard),
    border-color var(--duration-theme) var(--ease-standard);
}
```

Esto provee un cambio suave de 220ms sin complejidad adicional.

## Requisitos

| Pieza | Archivo | Función |
|---|---|---|
| CSS keyframes | `styles/motion/_view-transitions.scss` | `vt-page-out`, `vt-page-in` |
| `view-transition-name` | `app-shell.component.ts` → `.shell-content` | Identifica el área animable |
| `withViewTransitions()` | `app.config.ts` | Activa la API para navegación |

## Tokens

| Variable | Default | Uso |
|---|---|---|
| `--duration-page-out` | `180ms` | Duración salida |
| `--duration-page-in` | `280ms` | Duración entrada |

## Accesibilidad

`prefers-reduced-motion: reduce` desactiva todas las animaciones automáticamente.
