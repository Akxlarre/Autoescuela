# Hotfix: StableWidthDirective nunca fija min-width — afterRenderEffect no se ejecuta
> id: hotfix-050-m-stable-width-directive-afterrendereffect-nunca-corre
> status: done
> closed: 2026-07-25
> created: 2026-07-25

## Problema
Verificado con Playwright en vivo (`/app/admin/matricula`, paso 1 → "Guardar y Continuar"): el botón sigue achicándose (223px idle → 176px "Procesando...") pese al fix de hotfix-048/049. Inspección con `window.ng.getDirectives()` confirma que `StableWidthDirective` SÍ está adjunta al botón, pero su señal `stableWidth()` permanece `null` indefinidamente (incluso tras múltiples renders/navegaciones), aunque `offsetWidth` real del botón es 223px (no cero). Conclusión: el `afterRenderEffect()` dentro del constructor de la directiva nunca ejecuta su callback (o nunca llega a escribir la señal) — causa raíz no determinada con certeza (posible incompatibilidad con el modo de detección de cambios de la app), pero el mecanismo es inservible en la práctica.

## Cambios
- **Archivo:** `src/app/core/directives/stable-width.directive.ts` — reemplazar `afterRenderEffect` por `ResizeObserver` nativo del navegador: observa el elemento host directamente y, mientras `appStableWidth()` sea `false` (idle), toma el `contentRect`/`offsetWidth` real ya calculado por el navegador y lo fija como `min-width`. No depende de ningún hook de renderizado de Angular — reacciona a cambios de tamaño reales del DOM.
## Verificación (Playwright MCP, en vivo)
- Antes del fix: `window.ng.getDirectives(btn)` mostraba `stableWidth() === null` indefinidamente; al hacer clic en "Guardar y Continuar" (paso 1 matrícula), el ancho pasaba de 223.2px a 176.3px y `getComputedStyle(btn).minWidth` se mantenía en `"0px"` todo el tiempo.
- Después del fix: `stableWidth()` se pobló a `223` apenas se montó el botón (`getComputedStyle(btn).minWidth === "223px"`); al hacer clic, muestreado con `requestAnimationFrame` frame por frame, el botón midió `width: 223, minWidth: "223px", text: "Procesando..."` — ya no se achica.
- `tsc --noEmit` sin errores.
