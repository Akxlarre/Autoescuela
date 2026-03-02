# appBentoGridLayout

Proporciona `BENTO_GRID_LAYOUT_CONTEXT` para que hijos del bento-grid animen cambios de layout (reflow).

## Propósito
Cuando un hijo del grid cambia de tamaño (ej. paginación cambia filas visibles), la animación FLIP manual mueve las celdas suavemente a sus nuevas posiciones en lugar de un salto brusco.

## Uso en el contenedor

```html
<section appBentoGridLayout class="bento-grid">
  <!-- celdas -->
</section>
```

## Uso en hijos que cambian tamaño

```typescript
// En un componente hijo que modifica el layout (ej. data-table-card con paginación)
private layoutContext = inject(BENTO_GRID_LAYOUT_CONTEXT, { optional: true });

onPageChange(): void {
  this.layoutContext?.runLayoutChange(() => {
    // Aplicar el cambio (ej. actualizar rows del paginador)
    this.rows.set(newRows);
  }, () => {
    // Opcional: callback al terminar la animación
  });
}
```

## Cuándo usarlo
- Contenedor con clase `bento-grid` que tenga hijos que cambien de tamaño
- Tablas con paginación que modifican el número de filas visibles
- Cualquier reflow del grid que deba animarse

## Cuándo NO usarlo
- Grid estático sin cambios de layout
- Cambios que no afectan posiciones/tamaños de celdas

## Nota técnica
Usa FLIP manual con `getBoundingClientRect()` (no el plugin GSAP Flip) por conflicto de casing en Windows. Ver `docs/GSAP-FLIP-CASING-ISSUE.md`.
