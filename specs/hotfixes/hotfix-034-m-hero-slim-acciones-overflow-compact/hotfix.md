# Hotfix: botones de acción del Section Hero (slim) se cortan en modo force-compact

## Problema
En `admin-alumno-detalle.component.ts` (y cualquier otra vista con
`app-section-hero density="slim"` y varias acciones en el hero), al abrir un
drawer (`force-compact` activo en el `.bento-grid`), el último botón de
acción queda parcialmente cortado en el borde derecho en vez de bajar a una
segunda línea.

Causa raíz: el contenedor RIGHT del slim hero
(`section-hero.component.ts:459`, clase
`flex items-center gap-2 flex-wrap shrink-0`) tiene `shrink-0`. Bajo
force-compact, el override ya existente fuerza el layout de la fila superior
a columna (`.sm\:flex-row → flex-direction: column`) y
`.sm\:items-center → align-items: flex-start`. Con `align-items: flex-start`
en un contenedor flex-column, los hijos NO se estiran al ancho completo —
adoptan su ancho natural (shrink-to-fit). Combinado con `shrink-0` (que
impide encogerse), el contenedor RIGHT retiene su ancho natural aunque este
exceda el ancho disponible en modo compacto. El wrapper exterior del slim
mode (`overflow-hidden`, línea 361) recorta ese sobrante en vez de dejarlo
bajar de línea — de ahí el botón cortado.

El override existente ya fuerza `[role='group'] { width: 100% }` (el grupo
de botones en sí), pero ese 100% es relativo a su contenedor padre (RIGHT),
que seguía en ancho natural — el fix no tenía efecto real.

## Fix
Agregado override para el contenedor RIGHT
(`.flex.items-center.gap-2.flex-wrap.shrink-0`) dentro del bloque
`:host-context(.force-compact)` ya existente: `width: 100%` y
`flex-shrink: 1` (revierte el `shrink-0`). Con esto, el `width: 100%` del
`[role='group']` hijo sí resuelve contra el ancho disponible real, y su
`flex-wrap` permite que los botones bajen de línea en vez de desbordarse.

## AC
- En `admin-alumno-detalle.component.ts`, con un drawer abierto y varios
  botones en el hero (Reagendar, Ver Contrato, Carnet, Ver Certificado,
  Editar Perfil, Eliminar Alumno), todos los botones son visibles —bajan de
  línea si no caben— sin recorte en el borde.

## Cierre
- `section-hero.component.ts`: agregado override `.flex.items-center.gap-2.flex-wrap.shrink-0 { width: 100%; flex-shrink: 1; }` dentro del bloque `:host-context(.force-compact)` ya existente (slim mode overrides).
- Fix puramente CSS (ViewEncapsulation por defecto — no hay bleed a otros componentes); sin cambios de lógica/computed, no se agregó spec nuevo.
- `tsc --noEmit` limpio. Afecta a toda vista que use `app-section-hero density="slim"` con múltiples acciones dentro de un `.bento-grid.force-compact` (drawer abierto) — mismo componente compartido, mismo fix aplica globalmente.
