# Fix: force-compact no desactiva el fill-screen cuando main sigue midiendo ≥1024px
> id: fix-233-m-force-compact-no-relaja-fill-screen
> refs: fix-230-m, fix-231-m, fix-232-m
> status: done
> closed: 2026-08-31
> created: 2026-08-31

## Root Cause
`_bento-grid.scss` gatea TODO el comportamiento fill-screen (`height: calc(100vh - 120px)`,
`grid-template-rows` fijo, y `contain: size` en `.bento-fill`) exclusivamente por
`@container layoutmain (min-width: 1024px)` — el ancho real de `main`. La directiva
`[appBentoGridLayout]` agrega `.force-compact` al grid cuando un drawer está abierto, pero
las únicas reglas que reaccionan a `.force-compact` son `grid-column: 1/-1` (spec 0030,
apilar columnas) y el `min-height` del hero — ninguna toca `height`/`contain`. Verificado en
navegador (Playwright, 1920×1080, drawer de Arqueo abierto en Cuadratura Diaria): `main` mide
1222px (sigue ≥1024), por lo que el container query matchea igual que sin drawer:
`.bento-fill` con `contain: size`, `cuadratura-stack-ingresos` en `flex: 3 1 0%`,
`cuadratura-stack-egresos` en `flex: 2 1 0%`, todo comprimido en 617px de alto total. El
`min-height` de fix-232-m no ayuda aquí porque el problema no es el empty-state — es que el
`.bento-fill` completo está `contain: size` a una altura insuficiente y el `overflow: hidden`
de cada card recorta el contenido en vez de crecer. Esto solo se evitaba antes por accidente,
en viewports donde el drawer alcanzaba a angostar `main` por debajo de 1024px (fix-231-m/232-m
verificados a 1280×800) — en un monitor ancho (1680px+, típico 1920×1080) el drawer nunca
angosta lo suficiente y el bug reaparece igual, tal como reportó el dueño con capturas a ese
ancho.

## ACs Afectados
Ninguno — fix autónomo, root cause distinta a fix-231-m/232-m (esos sí corrigieron lo suyo,
verificable en viewports angostos; este es el caso general).
- AC-1: Con `.force-compact` presente en `.bento-grid`, el fill-screen (`height`,
  `grid-template-rows`, `contain: size` en `.bento-fill`) se desactiva SIEMPRE — sin importar
  cuánto mida `main` — igual que ya ocurre con el apilado de columnas.
- AC-2: Sin `.force-compact` (drawer cerrado), el comportamiento fill-screen en `main` ≥1024px
  no cambia.
- AC-3: Verificado en Cuadratura Diaria a 1920×1080 con el drawer de Arqueo abierto: Ingresos
  y Egresos usan alto natural (no 3:2 forzado), sin `overflow: hidden` recortando contenido.

## Cambio
- **Archivo:** `src/styles/layout/_bento-grid.scss`
- **Qué cambia:** en la sección "DRAWER MODE (force-compact) FIXES", agrega overrides con
  mayor especificidad que las reglas dentro del `@container` (sin depender de él) para las 4
  variantes `--fill-screen*`: `height: fit-content` (el default base de `.bento-grid`) y
  `grid-template-rows: none` cuando `.force-compact` está presente; y `contain: none` en
  `> .bento-fill` bajo `.force-compact`.

## Test de Regresión
- Verificación visual con Playwright (`/verify`) en Cuadratura Diaria a 1920×1080 (el ancho
  donde se reprodujo el bug) con el drawer de Arqueo abierto: confirmar `contain: none` en
  `.bento-fill`, `flex: 0 0 auto` en ambas cards, y que ninguna queda con `overflow: hidden`
  recortando contenido real.
- Re-verificar al menos una página más que combine `bento-grid--fill-screen*` + drawer (ej.
  dashboard o servicios-especiales) para confirmar que no rompe el fill-screen normal sin
  drawer, ni el apilado de columnas ya validado en spec 0030.

**Resultado:** verificado en Cuadratura Diaria a 1920×1080 — Ingresos y Egresos completos
sin corte, `contain: none` confirmado. Sin drawer, `gridHeight: 960px` / `contain: size`
sin cambios (AC-2 ok). Servicios Especiales con su drawer de "Registrar Venta" abierto
renderiza sin regresión visible. Nota de implementación: la especificidad por clases NO
fue suficiente en la práctica (motivo no determinado con certeza — posible interacción
con cascade layers de Tailwind v4); se usó `!important`, mismo patrón ya establecido en
el resto de esta sección de `_bento-grid.scss`.
