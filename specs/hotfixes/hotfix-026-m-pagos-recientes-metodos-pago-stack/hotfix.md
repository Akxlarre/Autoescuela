# Hotfix: "Pagos Recientes" y "Métodos de Pago" siguen lado a lado con drawer abierto

## Problema
El wrapper "Layout: Pagos Recientes | Sidebar" (`grid grid-cols-1 lg:grid-cols-12
... lg:col-span-12 items-start` + `[class.force-compact]="layoutDrawer.isOpen()"`)
tiene la clase `force-compact` en el **mismo elemento** que `lg:grid-cols-12`,
no en un ancestro. La regla existente `.force-compact .lg\:grid-cols-6,
.lg\:grid-cols-7, .lg\:grid-cols-12 { display:flex; flex-direction:column }`
usa combinador descendiente (espacio), así que solo colapsa las FILAS internas
(descendientes de `.force-compact`), pero nunca al wrapper raíz mismo — porque
`.force-compact .lg\:grid-cols-12` no matchea cuando ambas clases están en el
mismo nodo (haría falta `.force-compact.lg\:grid-cols-12`, sin espacio).

Resultado: con el drawer abierto, "Pagos Recientes" (`lg:col-span-8`) y
"Métodos de Pago" (`lg:col-span-4`) se siguen renderizando en la misma fila de
12 columnas, ambos apretados en el ancho reducido del panel izquierdo.

## Fix
Agregar una clase dedicada `pagos-recientes-layout` a ese wrapper raíz (en vez
de depender del nombre genérico `lg:grid-cols-12`, evitando falsos positivos
en otros grids de 12 columnas de la página) y una regla que:
1. Colapsa el wrapper a `flex-direction: column` cuando tiene `force-compact`.
2. Estira los 2 hijos directos (`Pagos Recientes` y `Métodos de Pago`) a
   `width: 100%`, ya que `items-start` evita el stretch por defecto y los
   `lg:col-span-*` dejan de tener efecto fuera de un grid.

```css
.pagos-recientes-layout.force-compact {
  display: flex !important;
  flex-direction: column !important;
  align-items: stretch !important;
}
.pagos-recientes-layout.force-compact > * {
  width: 100% !important;
}
```

Aplicado en `admin-pagos.component.ts` y `secretaria-pagos.component.ts`.

## AC
- Con un drawer abierto en Pagos, "Pagos Recientes" y "Métodos de Pago" se apilan uno arriba del otro (no lado a lado).
- Ambos ocupan el 100% del ancho disponible en el panel izquierdo (no más de la mitad cada uno).

## Cierre
- Clase `pagos-recientes-layout` agregada al wrapper raíz en ambos componentes.
- Regla `.pagos-recientes-layout.force-compact { flex-direction: column }` + `> * { width: 100% }` agregada en `admin-pagos.component.ts` y `secretaria-pagos.component.ts`.
- `tsc --noEmit` limpio.
