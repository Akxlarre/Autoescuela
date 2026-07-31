# Fix: Wrapper `bento-banner` redundante alrededor del hero slim en `instructor-ficha`
> id: fix-073-b-hero-wrapper-redundante
> refs: fix-071-b-fase-5-qa-visual-restante
> status: done
> closed: 2026-07-31
> created: 2026-07-31

## Root Cause

`fix-071-b` (Hallazgo 6) detectó 4 componentes que envuelven `<app-section-hero density="slim">`
en un `<div class="bento-banner">` extra, pese a que `SectionHeroComponent` ya se autoaplica esa
misma clase vía host binding (`section-hero.component.ts:350-354`:
`'[class.bento-hero]': density()==='full'`, `'[class.bento-banner]': density()==='slim'`).
Investigación caso por caso — **no son el mismo bug**:

- **`cuadratura-content`, `liquidaciones-content`, `reportes-contables-content`:** el wrapper
  **es funcionalmente necesario**. Además de `bento-banner` carga `relative overflow-visible`,
  que ancla el menú desplegable de exportación (`.export-menu.absolute.top-14.right-4`) — sin ese
  contenedor posicionado, el dropdown se posicionaría relativo a un ancestro distinto y quedaría
  mal ubicado. Confirmado que `.bento-banner` en SCSS (`_bento-grid.scss:285-288`) solo aporta
  `grid-column: 1/-1; grid-row: span 1` — cuando queda anidado (no hijo directo del grid), esas
  propiedades son inertes por spec de CSS Grid, así que la duplicación de clase no causa ningún
  efecto visual doble. **No se tocan — el wrapper resuelve un problema real, el "hallazgo" ahí es
  inofensivo.**
- **`instructor-ficha`:** wrapper sin ningún propósito funcional (no hay overlay, no hay
  `relative`/`overflow`). Además tenía un comentario que decía "Hero — direct child" mientras el
  código de al lado lo envolvía igual — inconsistencia real entre comentario e implementación.
  **Este es el único de los 4 que se corrige.**

## ACs Afectados
Ninguno — fix autónomo de limpieza estructural, sin AC de spec previa.

## Cambio
- **Archivo:** `src/app/features/instructor/ficha/instructor-ficha.component.ts`
- **Qué cambia:** se remueve el `<div class="bento-banner">` que envolvía
  `<app-section-hero density="slim">` en la rama `@else if (facade.studentDetail(); as detail)`.
  El hero pasa a ser hijo directo del `.bento-grid`; su host se autoaplica `bento-banner` (el
  grid span ahora sí tiene efecto real). Se actualiza el comentario para que describa el estado
  real. La rama de skeleton (`facade.detailLoading()`) **no cambia** — `<app-skeleton-block>` no
  tiene ese host binding, así que su wrapper sí es necesario.

## Decisión de alcance
Los otros 3 archivos listados en el hallazgo original **quedan sin tocar a propósito** — su
wrapper no es redundante, es la base de posicionamiento del menú de exportación. Tocarlos para
"limpiar" la duplicación de clase inerte introduciría riesgo real (romper el posicionamiento del
dropdown) por cero beneficio visual. Si en el futuro se rediseña el menú de exportación como
patrón compartido, ahí sí valdría revisar si puede vivir sin el wrapper.

## Test de Regresión
⚠️ Este proyecto no tiene tests de componentes Angular (`vitest.config` los excluye).
Verificación real ejecutada (2026-07-31):
- ✅ `ng build` — limpio, solo el warning de bundle pre-existente (no relacionado).
- ✅ `npm run lint:arch` — 0 errores, ninguna advertencia nueva referencia este archivo.
- ✅ Render real de `/app/instructor/alumnos/1/ficha` (Playwright, login `instructor@test.com`):
  hero slim (breadcrumb + título + chip "0% práctico") full-width, sin overlap ni gap distinto
  al esperado. Captura: `evidencia/instructor-ficha-post-fix.png`.
