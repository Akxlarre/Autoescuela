# Fix: Hueco vacío bajo el hero slim de `/admin/auditoria` con el drawer abierto
> id: fix-123-m-bento-fill-screen-hero-slim-gap-sub-lg
> refs: fix-122-m-app-like-admin-auditoria
> status: done
> closed: 2026-08-06
> created: 2026-08-06

## Root Cause
`.bento-grid--fill-screen` (`src/styles/layout/_bento-grid.scss`) solo define
`grid-template-rows: auto minmax(0, 1fr)` **dentro del container query `@container layoutmain
(min-width: 1024px)`**. Por debajo de ese ancho de `<main>` (fácil de gatillar con el drawer
lateral abierto en un viewport de 1440px), el grid cae al default de la clase base `.bento-grid`:
`grid-auto-rows: minmax(120px, auto)`.

El hero de `AdminAuditoriaComponent` usa `density="slim"` **sin** `[kpis]` ni `[actions]` — mide
~64-70px de alto real, pero el `align-items: stretch` por defecto del grid estira su fila al piso
de 120px, dejando un espacio vacío visible entre la card del hero y la card de tabla.

**Revisado y descartado como bug sistémico (2026-08-06):** se verificó manualmente
`admin-secretarias`, `admin-alumno-detalle` y `admin-tareas` — ninguna reproduce el hueco.
`admin-secretarias`/`admin-tareas` pasan `[kpis]` al hero, lo que ya lo hace más alto que el piso
de 120px (el estiramiento ocurre pero es invisible). `admin-alumno-detalle` ni usa
`bento-grid--fill-screen` — y ya tiene documentado y resuelto este mismo problema con un override
de componente (`admin-alumno-detalle.component.ts:826-841`): un bloque `styles:` de Angular NO
está dentro de ningún `@layer`, así que gana por cascada sobre la regla base (`@layer bento.grid`)
sin `!important` ni tocar el archivo compartido. Se replica esa misma técnica acá, en vez de
modificar `_bento-grid.scss` (que afectaría a todas las páginas que ya usan el modificador).

## ACs Afectados

- AC-1: Con el drawer lateral abierto en un viewport donde `<main>` cae por debajo de 1024px de
  ancho, no debe verse un hueco vacío entre la card del hero y la card de tabla en
  `/admin/auditoria`.
- AC-2: El comportamiento en `lg+` (card de tabla llenando el resto del viewport,
  `minmax(0, 1fr)`, scroll interno) no se rompe — el override solo debe aplicar por debajo de
  `1024px` de ancho de contenedor.
- AC-3: El comportamiento en mobile (scroll nativo) no se rompe.

## Cambio
- **Archivo:** `src/app/features/admin/auditoria/admin-auditoria.component.ts`
  - Agregar un override de componente (fuera de `@layer`, mismo patrón que
    `admin-alumno-detalle.component.ts`) que fije `grid-template-rows: auto auto` para
    `.bento-grid.bento-grid--fill-screen` **solo** dentro de
    `@container layoutmain (max-width: 1023px)` — así no interfiere con el `minmax(0, 1fr)` que
    la regla compartida ya aplica en `lg+`.

## Test de Regresión
`/verify` visual en `/admin/auditoria`: abrir un drawer (ej. "Ver Detalle") en un viewport de
1440×900 para angostar `<main>` por debajo de 1024px y confirmar que no queda espacio vacío
entre el hero y la card de tabla. Confirmar también que sin drawer (desktop ancho) la card sigue
llenando el resto del viewport con scroll interno (AC-2), y que en mobile no cambia nada (AC-3).
