# appPressFeedback

Feedback interactivo (hover + press) para botones y triggers. Coherente con pills del sidebar.

## Propósito
Añadir hover (scale 1.02, y: -1) y press (scale 0.98) a elementos interactivos. Usa `GsapAnimationsService.addInteractiveFeedback()`. Respeta `prefers-reduced-motion`.

## Uso

```html
<!-- Modo completo (default): hover + press -->
<button appPressFeedback (click)="toggle()">Abrir</button>

<!-- Modo solo press: útil para botones PrimeNG que ya tienen hover -->
<button pButton appPressFeedback="press" label="Ingresar"></button>
```

## Inputs

| Input | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `appPressFeedback` | `'full' \| 'press'` | `'full'` | Modo de feedback: `'full'` (hover + press) o `'press'` (solo press) |

## Cuándo usarlo
- Botones del topbar (search, user-menu, notifications)
- Triggers de dropdowns
- Cualquier botón que necesite feedback visual al hover/click
- **Usar `appPressFeedback="press"`** para botones PrimeNG que ya tienen estilos hover propios

## Cuándo NO usarlo
- Cards → usar `[appCardHover]` en su lugar
- Elementos no interactivos
- Si el componente ya tiene su propio feedback completo

## Dependencias
- `GsapAnimationsService` — inyectado en la directiva
- `DestroyRef` — cleanup automático cuando el elemento se destruye
