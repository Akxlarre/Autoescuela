# Hotfix: badge de Estado duplicado y layout roto en "Pagos Recientes" con drawer abierto

## Problema
Al abrir un drawer en Pagos, la sección "Pagos Recientes" se vuelve `.force-compact`
(colapsa la grilla de 7 columnas a un layout tipo card apilado). El CSS de
`.force-compact` fuerza a mostrar todo lo marcado `lg:hidden` (contenido
"solo mobile") vía `.force-compact .lg\:hidden { display: block !important }`,
y oculta el contenido "solo desktop" — pero solo si usa el patrón literal
`.hidden.lg\:grid` (usado en los headers de tabla).

La columna Estado, en cambio, usa el patrón `hidden lg:flex` (no `hidden lg:grid`)
para su versión desktop-only
(`admin-pagos.component.ts:427`, `secretaria-pagos.component.ts:392`). Esa regla
nunca se ocultaba, así que con el drawer abierto se renderizaban **ambos**
badges de Estado (el mobile-only forzado a visible + el desktop-only que ya
era visible por el viewport real ≥1024px), produciendo el badge duplicado y
el layout desordenado que se ve en pantalla.

## Fix
Extender la regla existente en ambos componentes para cubrir también los
patrones `hidden lg:flex` y `hidden lg:block` (usados para otros elementos
desktop-only como el skeleton de Estado), simétrico a como ya se cubre
`hidden lg:grid`:

```css
.force-compact .hidden.lg\:grid,
.force-compact .hidden.lg\:flex,
.force-compact .hidden.lg\:block {
  display: none !important;
}
```

## AC
- Al abrir un drawer en Pagos (admin y secretaria), "Pagos Recientes" muestra un solo badge de Estado por fila, con el layout de card apilado limpio (sin elementos duplicados o descolocados).

## Cierre
- Regla `.force-compact .hidden.lg\:grid` extendida a `.hidden.lg\:flex` y `.hidden.lg\:block` en `admin-pagos.component.ts` y `secretaria-pagos.component.ts`.
- Corrige el badge de Estado duplicado (y cualquier otro elemento desktop-only con ese patrón, ej. el skeleton de Estado) al abrir un drawer.
- `tsc --noEmit` limpio.
