# Hotfix: "Clases Actuales" se ve roto (icono sin texto) con un drawer abierto

## Problema
`app-live-classes-panel` en el Dashboard (admin y secretaria) usa
`data-row-span="2"` para ocupar 2 filas del bento-grid. Ese atributo solo
tiene efecto dentro de `@container layoutmain (min-width: 1024px)`
(`_bento-grid.scss:299-317`, breakpoint `lg`).

Pero el `min-height` de fallback del panel (`min-h-[450px]` en
`live-classes-panel.component.ts`) se neutraliza en un breakpoint distinto:
`@container layoutmain (min-width: 768px)` (breakpoint `md`).

Cuando se abre un drawer, `<main>` (el contenedor `layoutmain`) se angosta.
Si su ancho cae en la franja 768px–1024px (típico con un drawer grande como
"Agenda Semanal" abierto en resoluciones de laptop), pasa lo peor de ambos
mundos: el `min-height:450px` ya se neutralizó (por eso el panel se ve corto,
no alto), pero el `grid-row: span 2` **todavía no se activa** (por eso no hay
altura extra del grid para compensar). El panel colapsa a la altura de 1 sola
fila del grid (~120-140px), insuficiente para el ícono + mensaje + subtítulo
del estado vacío, que queda recortado por el `overflow-hidden` del host —
solo se alcanza a ver el ícono.

## Fix
Agregar también `data-row-span-md="2"` (variante que activa `grid-row: span 2`
desde el breakpoint `md`, 768px — `_bento-grid.scss:279-297`) junto al
`data-row-span="2"` existente, para que el row-span se active en el mismo
breakpoint donde ya se neutraliza el `min-height`, cerrando la franja rota.

Aplicado en `dashboard.component.ts` (admin) y `secretaria-dashboard.component.ts`.

## AC
- Con un drawer abierto en el Dashboard, "Clases Actuales" mantiene su altura
  de 2 filas y el estado vacío (o la lista de clases) se ve completo, sin
  texto recortado, en cualquier ancho de `<main>` ≥768px.

## Cierre
- `data-row-span-md="2"` agregado (junto al `data-row-span="2"` existente) en `dashboard.component.ts` y `secretaria-dashboard.component.ts`.
- Cierra la franja rota 768px-1024px donde el min-height ya se neutralizaba pero el row-span aún no se activaba.
- `tsc --noEmit` limpio.

## Nota de seguimiento
Pendiente de verificación visual por el dueño con varias clases reales
(no solo el estado vacío) y drawer abierto. Análisis de código: la rama con
clases (`classes().length > 0`) usa lista con scroll interno
(`overflow-y-auto`), a diferencia de la rama de estado vacío que usaba
`overflow-hidden` sin scroll (la que causaba el bug original). Combinado con
`data-row-span-md="2"` + el piso de 300px reforzado en los paneles vecinos
(hotfix-029, mismas filas del grid), la altura disponible debería ser
generosa. Sin confirmación visual todavía — Playwright MCP inactivo en esta
máquina.
