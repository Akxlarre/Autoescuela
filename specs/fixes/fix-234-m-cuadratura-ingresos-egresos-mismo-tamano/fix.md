# Fix: Cuadratura Diaria — Egresos e Ingresos deben verse del mismo tamaño
> id: fix-234-m-cuadratura-ingresos-egresos-mismo-tamano
> refs: fix-230-m, fix-231-m, fix-232-m, fix-233-m
> status: done
> closed: 2026-08-31
> created: 2026-08-31

## Root Cause
`cuadratura-content.component.ts` repartía el alto disponible entre Ingresos y Egresos con
`flex: 3 1 0%` / `flex: 2 1 0%` (Ingresos "protagonista"), dentro de `@container layoutmain
(min-width: 1024px)`. Verificado en navegador (1920×1080, drawer de Arqueo abierto, ambas
listas vacías): el `.bento-fill` medía 682px totales, repartidos ~386px Ingresos / ~271px
Egresos. Dentro de esos 271px, el header (86.5px) + footer (109px) de Egresos por sí solos ya
consumían 195.5px, dejando el área de filas/empty-state comprimida a **9.9px** — el mensaje
"No hay egresos registrados hoy." (67px de alto real) quedaba técnicamente presente en el DOM
y scrolleable, pero invisible en la práctica (nadie hace scroll dentro de un hueco de 10px que
no se ve como scrolleable). El `min-height: 0` explícito en ambas cards es lo que permitía
este colapso por debajo del contenido mínimo. El dueño reportó la asimetría visual dos veces
en el mismo demo, señalando específicamente que las cards deberían verse del mismo tamaño.

## ACs Afectados
Ninguno — fix autónomo (hallado en revisión visual post fix-233-m).
- AC-1: Ingresos y Egresos usan el mismo peso de reparto (`flex: 1 1 0%` ambas) — se ven del
  mismo tamaño en cualquier viewport donde aplique el reparto proporcional.
- AC-2: Ninguna de las dos cards puede colapsar por debajo de `min-height: 280px` — el
  contenido mínimo (header + al menos una línea de empty-state + footer) SIEMPRE es visible,
  sin importar cuánto espacio real reparta el flex-grow.
- AC-3: Con datos reales (1 ítem, múltiples ítems) ambas cards siguen viéndose simétricas y
  sin recortes internos invisibles.

## Cambio
- **Archivo:** `src/app/shared/components/cuadratura-content/cuadratura-content.component.ts`
- **Qué cambia:** el bloque `@container layoutmain (min-width: 1024px)` pasa de
  `flex: 3 1 0%` / `flex: 2 1 0%` separados a `flex: 1 0 auto` + `min-height: 280px`
  compartido entre `.cuadratura-stack-ingresos` y `.cuadratura-stack-egresos`.
  `flex-shrink: 0` es intencional: la primera versión de este fix usó `flex: 1 1 0%`
  (shrink 1), y con datos reales (4 ingresos) el `min-height: 280px` se convertía en TECHO
  — el shrink comprimía la card al piso de 280px aunque el contenido real necesitara 438px,
  dejando el área de filas en 0px visibles (peor que el bug original de fix-234). Con
  `flex-basis: auto` + shrink 0, la card nunca se compacta por debajo de su propio
  contenido; si no entra en el alto disponible, crece `.bento-fill` (sin `contain: size`
  desde fix-233-m) y la página scrollea — nunca recorta.

## Test de Regresión
- Verificación visual con Playwright (`/verify`) en Cuadratura Diaria, 1920×1080 y 1280×800,
  con Arqueo abierto y cerrado, y con datos vacíos / múltiples ítems reales (4 ingresos, 3
  egresos): confirmado que ambas cards miden lo mismo en el caso vacío (328.75px ambas a
  1920px), que "No hay ingresos/egresos registrados hoy." es visible sin necesitar scroll, y
  que con datos reales ninguna card recorta contenido (el área de filas mide exactamente lo
  que necesita: 243px de contenido = 243px visibles, sin clipping).
