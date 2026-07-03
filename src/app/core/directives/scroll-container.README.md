# ScrollContainerDirective — `[appScrollContainer]`

Directiva reutilizable que convierte cualquier contenedor en una caja con **scroll interno vertical**, evitando que el contenido desborde la página o un drawer/panel.

## Selector
`[appScrollContainer]`

## Inputs

| Input       | Tipo      | Default  | Descripción                                                       |
|-------------|-----------|----------|-------------------------------------------------------------------|
| `maxHeight` | `string`  | `'65vh'` | Altura máxima CSS. Ej: `'400px'`, `'70vh'`, `'none'`             |
| `scrollX`   | `boolean` | `false`  | Si `true`, habilita scroll horizontal además del vertical          |

## Uso

```html
<!-- Básico: scroll vertical con 65vh -->
<div appScrollContainer>
  <!-- contenido largo -->
</div>

<!-- Altura personalizada -->
<div appScrollContainer maxHeight="400px">
  <!-- contenido largo -->
</div>

<!-- Con scroll horizontal (útil para tablas/grids anchos) -->
<div appScrollContainer maxHeight="70vh" [scrollX]="true">
  <!-- contenido ancho -->
</div>

<!-- Sin límite de altura (el padre controla vía flex) -->
<div appScrollContainer maxHeight="none">
  <!-- contenido -->
</div>
```

## Comportamiento

1. Aplica `overflow-y: auto` + `max-height` al host element
2. Activa `scroll-behavior: smooth` y `-webkit-overflow-scrolling: touch`
3. Respeta los estilos de scrollbar del design system (`_scrollbar.scss`)
4. Los inputs son reactivos (signal-based): si cambian en runtime, los estilos se actualizan
