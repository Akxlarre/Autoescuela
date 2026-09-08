# Fix: `:host { display: block }` faltante en las 7 cards del rollout
> id: fix-163-b-host-display-block-cards-rollout
> refs: fix-158-b-rediseno-cards-alumnos, fix-159-b-rollout-cards-alumnos-profesional-y-ex-alumnos, fix-161-b-rollout-cards-instructores-relatores-promociones-flota
> status: done
> closed: 2026-09-08
> created: 2026-09-08

## Root Cause
Ninguna de las 7 cards creadas en el rollout (fix-158-b/159-b/161-b) declaraba
`:host { display: block }`. Sin esa declaración, el navegador aplica el default de un
elemento custom no reconocido: `display: inline`. Las páginas que apilan estas cards con
`space-y-4` (margin-top vía selector de hermanos `:not([hidden]) ~ :not([hidden])`) no
lograban separación real porque **el margin-top vertical no aplica sobre elementos
inline** — el navegador lo ignora en el eje de bloque. Resultado: cards prácticamente
pegadas entre sí ("casi nulo margen", reporte del usuario).

`alumnos-list-content` no mostraba el bug porque usa `.bento-grid` + `gap` (propiedad del
contenedor grid, no depende del `display` del hijo) en vez de `space-y-4` — coincidencia
de layout, no una corrección real.

Ya existía precedente exacto de este mismo bug en `skeleton-block.component.ts`
(documentado en `indices/COMPONENTS.md`), pero la lección no se aplicó al crear las 7
cards nuevas por no ser un checklist activo en el momento del rollout.

## ACs Afectados
- Ninguno — bug visual introducido por el propio rollout de cards, no una spec previa.

## Cambio
Se agregó `styles: [':host { display: block; }']` (o se insertó dentro del `styles`
existente cuando ya había uno) a los 7 componentes:
- `src/app/shared/components/alumno-card/alumno-card.component.ts`
- `src/app/shared/components/alumno-profesional-card/alumno-profesional-card.component.ts`
- `src/app/shared/components/egresado-card/egresado-card.component.ts`
- `src/app/shared/components/instructor-card/instructor-card.component.ts`
- `src/app/shared/components/relator-card/relator-card.component.ts` (ya tenía `styles`
  para `.spec-badge`, se insertó `:host` al inicio del mismo bloque)
- `src/app/shared/components/promocion-card/promocion-card.component.ts` (ídem,
  `.course-badge`)
- `src/app/shared/components/vehiculo-card/vehiculo-card.component.ts`

Efecto colateral menor detectado al correr `npm run lint:arch` post-fix: el JSDoc de
`vehiculo-card.component.ts` citaba literalmente `` `bg-white` `` para documentar un bug
histórico ya corregido, y el escaneo de texto de ARCH-26 lo contaba como una regresión
del ratchet (1 caso vs. baseline 0) aunque el componente usa `bg-elevated`. Se reescribió
el comentario a "fondo blanco opaco hardcodeado" (mismo significado, sin el token
literal) para no dejar el lint en falso rojo.

## Test de Regresión
- Verificación en vivo (`localhost:4210`, viewport 420px): `getComputedStyle(el).display`
  de `app-instructor-card` era `"inline"` con `marginTop: "0px"` antes del fix pese a
  `space-y-4` en el padre. **Confirmado post-fix**: `display: "block"` + `marginBottom:
  "16px"` real (el CSS de Tailwind v4 para `space-y-4` aplica `margin-block-end`, no
  `margin-top` — se corrigió el diagnóstico de eje en vivo). Verificado en Instructores
  (screenshot con separación visible), Relatores y Flota. Promociones/Ex-Alumnos
  Profesional no tenían datos de seed para poblar la vista mobile en este momento — mismo
  componente exacto que sus pares ya verificados, sin lógica condicional nueva.
- `npm run lint:arch` → **exit 0** (incluye fix del falso positivo ARCH-26 en el JSDoc de
  `vehiculo-card.component.ts`).
- `npm run test:ci` → **2333/2333 tests, 0 fallos** (188 archivos, 2 skipped preexistentes).
