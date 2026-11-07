# Fix: La web anuncia un precio promocional que la matrícula no cobra
> id: fix-501-m-web-sin-precio-promocional
> refs: fix-485-m-testing-auditoria-configuracion-web
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

Q04 de `fix-485-m`. Configuración web → Cursos & Precios tenía la casilla "Personalizar precio
para promo": un precio guardado solo en `website_config` que la landing mostraba con el precio
del catálogo tachado. La matrícula (presencial y online) cobra siempre `courses.base_price`, así
que la web podía anunciar $160.000 y el sistema cobrar $180.000.

**Decisión de Matías (2026-11-07):** el precio siempre sale de la Configuración de precios del
admin. Se quita el precio promocional de la web. Las promociones van en el banner "Campaña Promo"
y en los descuentos del sistema.

## ACs Afectados

- `0004-b` AC3 / AC-E3 (override de precio y "Gratis") — **se eliminan** por la decisión.
- `0003-b` AC8 (validación del precio promocional) — deja de aplicar.

## Cambio

- **Panel:** `core/utils/website-config.utils.ts` (sin `overrideEnabled`/`priceOverride` ni
  `courseOverrideValidator`), `tabs/cursos-tab.component.ts` (sin la fila de precio promo),
  `admin-configuracion-web.component.ts` (guarda `priceOverride: null`).
- `core/facades/website-config.facade.ts` + `core/models/ui/resolved-course.model.ts`: el precio
  resuelto es el del catálogo.
- `core/models/dto/website-config.model.ts`: `priceOverride` queda como campo heredado (siempre
  `null`) para no romper configuraciones guardadas.
- **Landing (`webs/`):** `resolveCourses`, la hidratación y `Services`/`Pricing` muestran el
  precio del catálogo e ignoran un `priceOverride` guardado; la hidratación oculta el tachado
  (también en un sitio compilado antes). El marcado del tachado en `Services`/`Pricing` queda
  sin usarse (`isOverrideActive` siempre es `false`).

## Test de Regresión

- `website-config.utils.spec.ts` y `website-config.facade.spec.ts`: 30/30 (incluye fix-501-m: un `priceOverride` guardado no cambia el precio). `ng build` OK, `lint:arch` 0 errores.
- Navegador (2026-11-07): con `priceOverride` 160000 y 0 guardados en las dos cards de la sede 1, la landing compilada muestra $180.000 en ambas, sin "Gratis" ni precio tachado; la pestaña Cursos ya no tiene la casilla y muestra "Precio (Configuración de precios)". Config restaurada.
