# View Transitions — Navegación de Rutas

Transiciones visuales para navegación usando la [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) nativa.

## Cómo Funciona

### Navegación intra-app (página ↔ página)

Sidebar y topbar permanecen **estáticos**. Solo el área `main-content` anima:

- **Salida** (`vt-page-out`): fade-out + translateY(-10px) + scale(0.98) en 200ms
- **Entrada** (`vt-page-in`): fade-in + translateY(+12px) + scale(0.99→1) en 320ms con 60ms delay

Asimetría: salida ágil, entrada más visible con ligero retraso y sensación de profundidad.

**No requiere código adicional** — funciona automáticamente con cada navegación de ruta.

### Variante: crossfade suave (`vt-main-fade`)

Para una transición más minimalista (solo opacidad, sin movimiento ni scale), añade la clase al root al arranque o cuando quieras cambiar de estilo:

```ts
document.documentElement.classList.add('vt-main-fade');
```

Para volver al estilo por defecto (slide + scale):

```ts
document.documentElement.classList.remove('vt-main-fade');
```

| Estilo        | Clase en `<html>`   | Efecto                          |
|---------------|---------------------|---------------------------------|
| **Por defecto** | ninguna             | slide vertical + scale suave     |
| **Variante**    | `vt-main-fade`      | crossfade (opacity only)         |

### Login → App (transición cinematic)

El root completo anima con blur + scale para dar sensación de "entrar" a la app:

- **Salida** (`vt-login-out`): fade-out + blur(4px) + scale(0.97) en 250ms
- **Entrada** (`vt-login-in`): fade-in + blur(0) + scale(1.02→1) en 400ms con 80ms delay

Activada imperativamente por `onViewTransitionCreated` en `app.config.ts`.
El callback detecta la ruta de origen/destino y añade `.vt-login-enter` al `<html>`.

### App → Login (logout)

Versión más sutil sin scale agresivo:

- **Salida** (`vt-logout-out`): fade-out + blur(3px) en 250ms
- **Entrada** (`vt-logout-in`): fade-in + blur(0) + scale(0.98→1) en 400ms

Clase CSS temporal: `.vt-login-leave`.

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
| CSS keyframes | `styles/motion/_view-transitions.scss` | `vt-page-out`, `vt-page-in`, `vt-login-out`, `vt-login-in`, `vt-logout-out`, `vt-logout-in` |
| `view-transition-name` | `app-shell.component.ts` → `.shell-content` | Identifica el área animable |
| `withViewTransitions()` | `app.config.ts` | Activa la API para navegación |
| `onViewTransitionCreated` | `app.config.ts` | Discrimina login↔app vs navegación normal |
| Variante crossfade | `html.vt-main-fade` | Opcional: transición solo opacidad (sin slide/scale) |

## Tokens

| Variable | Default | Uso |
|---|---|---|
| `--duration-page-out` | `200ms` | Duración salida intra-app |
| `--duration-page-in` | `320ms` | Duración entrada intra-app (con 60ms delay) |
| `--duration-login-out` | `250ms` | Duración salida login↔app |
| `--duration-login-in` | `400ms` | Duración entrada login↔app |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Easing de salida |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Easing de entrada |

## Accesibilidad

`prefers-reduced-motion: reduce` desactiva todas las animaciones automáticamente
(tanto intra-app como login↔app).
