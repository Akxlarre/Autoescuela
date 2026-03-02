# appCardHover

Aplica el efecto hover de card vía GSAP sobre cualquier elemento `.card`.

## Propósito
Centraliza el comportamiento hover de las cards (sombra elevada + y: -2px) sin que cada componente tenga que inyectar `GsapAnimationsService` manualmente. Usa los tokens del design system (`--card-shadow-hover`, `--border-strong`). Respeta `prefers-reduced-motion`.

## Uso

```html
<div class="card" appCardHover>
  <h3>KPI Title</h3>
  <p>Contenido de la card</p>
</div>

<!-- Combinable con otras directivas -->
<div class="card card-tinted bento-square" appCardHover appAnimateIn>
  ...
</div>
```

## Cuándo usarlo
- En cualquier elemento con clase `.card` que deba tener feedback hover
- KPI cards, summary cards, feature cards en bento-grid
- Cards en listas y grids

## Cuándo NO usarlo
- Elementos no interactivos o puramente decorativos
- Cards ya gestionadas por PrimeNG (p-card tiene su propio hover)
- Si el componente necesita personalizar el hover manualmente

## Dependencias
- `GsapAnimationsService.addCardHover()` — lógica de animación
- `afterNextRender` — asegura que el elemento está en el DOM antes de registrar listeners
