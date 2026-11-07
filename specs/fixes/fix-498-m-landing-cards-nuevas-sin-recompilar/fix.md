# Fix: La landing no muestra una card de curso publicada después de compilarla
> id: fix-498-m-landing-cards-nuevas-sin-recompilar
> refs: fix-485-m-testing-auditoria-configuracion-web
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

S20 / Q02 de `fix-485-m` (AC6 de `0003-b`: los cambios se ven sin recompilar). La landing
(`webs/`) se compila estática con las cards de ese momento y al abrirla se hidrata con lo que hay
en `website_config`. La hidratación (`LandingLayout.astro`, bloques 3A y 3B) solo rellena por
índice los nodos `[data-course-index]` que ya venían en el HTML: una card publicada después de
compilar no tiene nodo y no aparece.

Reproducido: compilada con 1 card y publicadas 2, el sitio sigue mostrando 1 (cursos, tabla de
precios y tarjetas móviles). Por lo mismo, el destacado (`card-accent`, `row-highlighted`,
`mobile-price-card--featured`) y la grilla (`courses-single`/`courses-duo`/`bento-grid`) quedan
como al compilar.

## ACs Afectados

- `0003-b` AC6 (cambios visibles sin recompilar).

## Cambio

- `webs/src/layouts/LandingLayout.astro`: antes de los bloques 3A y 3B, si hay más cursos
  resueltos que nodos, se clona el último nodo de cada sección con el índice que falta; cada
  bloque actualiza además la clase de destacado, y la grilla de cursos se ajusta a la cantidad.

## Test de Regresión

- Navegador (2026-11-07): landing compilada con 1 card (`astro build`, 3 nodos `data-course-index=0`); con 2 publicadas, `astro preview` muestra las 2 en cursos, tabla de precios y tarjetas móviles, a 1440 y 375 px; destacado solo en la primera, grilla `courses-duo`, consola sin errores (captura `c485-21-landing-cursos.png`).
- Sin test unitario: el cambio está en el script inline de hidratación (no importable). `resolveCourses`/`getSiteData`, que sí tienen tests, no cambian.
