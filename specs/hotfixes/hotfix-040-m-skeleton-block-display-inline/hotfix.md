# Hotfix: SkeletonBlockComponent sin `display:block` — space-y-* no surte efecto en toda la app

> id: hotfix-040-m-skeleton-block-display-inline
> status: in-progress
> created: 2026-07-22

## Problema
`shared/components/skeleton-block/skeleton-block.component.ts` tiene `styles: []`
(vacío) — sin `:host { display: block }`. El navegador trata elementos
personalizados desconocidos como `display: inline` por defecto. Confirmado
con Playwright forzando `isLoadingSections` en vivo: el host de
`<app-skeleton-block>` computa `display: inline`, y por spec CSS los márgenes
verticales (`margin-top`/`margin-bottom`) en elementos inline no-reemplazados
**no afectan el layout**, aunque el computed style los reporte con valor
correcto. Resultado: cualquier `space-y-*` alrededor de varios
`<app-skeleton-block>` seguidos no genera separación real — se apilan pegados
usando solo su `1em` de alto (variant="text"), ignorando el gap declarado.
Esto no es un bug de Libro de Clases — afecta **cualquier** uso del
componente en toda la app.

## Fix
`shared/components/skeleton-block/skeleton-block.component.ts`: agrega
`:host { display: block; }` a `styles`. Con esto el host participa en el
flujo de bloque normal y los márgenes de `space-y-*` (o cualquier gap del
contenedor) vuelven a tener efecto.

## Cierre
- Verificado con Playwright: forzando `facade['_isLoadingSections'].set(true)`
  en `LibroDeClasesComponent` vía `ng.getComponent()`, capturas antes/después
  confirman que el skeleton de Cabecera ahora respeta el `space-y-2` real.
- `tsc --noEmit` limpio.
- `npm run test:ci` en verde.
