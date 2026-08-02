# Fix: Área táctil de los botones del rail de alertas por debajo de 44×44px
> id: fix-095-b-area-tactil-rail-alertas
> refs: ASG-b-061
> status: done
> closed: 2026-08-02
> created: 2026-08-02

## Root Cause

**[Heredado de ASG-b-061, confirmado con medición]:** los botones "Recordar" / "Eliminar" /
"Reactivar" del rail de alertas (`asistencia-clase-b-content.component.ts`, agregados en
`fix-093-b`) usan `btn-sm`. Medido en vivo a 375px con `/verify`: 71×30px y 79×32px.

**Encuadre correcto (no confundir con incumplimiento):** ese tamaño ya cumple WCAG 2.5.8
(Target Size Minimum, AA, WCAG 2.2 → mínimo real 24×24px). No cumple 44×44px, que es guía de
Apple/Google HIG y WCAG 2.5.5 (AAA, no obligatorio). Es mejora de usabilidad táctil, no un
bug de accesibilidad.

## ACs Afectados

Ninguno — fix autónomo de usabilidad, sin AC de spec previa.

## Cambio

- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
- **Qué cambia:** los 3 botones del rail ganan la clase `.rail-action-btn` (`position: relative`
  + `::before` con `left/right: 0`, `top: 50%`, `min-height: 44px`, `transform: translateY(-50%)`).
  Solo crece en **alto**: el ancho visual medido (71-79px) ya supera 44px, así que no hizo falta
  `min-width` (ajuste respecto al plan original, que preveía inset simétrico en ambos ejes —
  innecesario una vez medido). Es puramente hit-area: sin fondo ni borde, no desplaza el flujo
  del layout ni cambia el tamaño visual del botón (`btn-sm` se mantiene intacto, y con él la
  densidad deliberada de `fix-086-m`). Escopado a estos 3 botones vía clase local + `styles:`
  del propio componente, no al `btn-sm` global (~44 usos en 3 componentes hermanos, fuera de
  alcance — ver Notas de ASG-b-061).

## Test de Regresión

Sin `.spec.ts` — cambio de solo CSS/template en un componente `shared/` sin lógica nueva (el
proyecto excluye component specs de Vitest, ver memoria `project_no_angular_component_tests`).
Resultado (2026-08-02, `/verify` a 375px de ancho, rol admin, `/app/admin/asistencia`):

- Hit-area medida en runtime: `min-height: 44px` computado en el `::before`, `top: 50%` +
  `translateY(-22px)` sobre botones de 32px de alto → extiende **6px arriba y 6px abajo** del
  borde visual (32 + 6 + 6 = 44) ✓
- Tamaño visual del botón sin cambios: 79×32px y 73×32px (idéntico a `fix-093-b`) ✓
- **Sin overlap entre alertas contiguas:** 34px de holgura medida entre el borde inferior del
  hit-area de una fila y el borde superior del hit-area de la siguiente, en las 4 filas
  consecutivas del rail ✓
- **Prueba funcional real** (no solo geométrica): `document.elementFromPoint()` en un punto 3px
  por encima del borde visual del botón "Recordar" (fuera de su caja de 32px) resuelve al
  propio `<button data-llm-action="send-reminder">`, confirmando que el hit-area extendido
  captura el click y no se lo roba ningún vecino ✓
- Capturas desktop (1280px) y mobile (375px): visualmente **idénticas** a `fix-093-b` — el
  `::before` no tiene fondo ni borde, cero cambio perceptible ✓
- Consola limpia (0 errores, 0 warnings) ✓
- `npx ng build` sin errores ✓
- `npm run lint:arch` exit 0 ✓
