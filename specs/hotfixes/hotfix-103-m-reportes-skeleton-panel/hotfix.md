# Hotfix: Reportes Contables — skeleton del panel en la primera carga
> id: hotfix-103-m-reportes-skeleton-panel
> refs: fix-242-m-reportes-contables-ajuste-minimo
> created: 2026-09-09
> status: done
> closed: 2026-09-09

## Problema

En la primera carga (`isLoading() && !kpis()`) de Reportes Contables el skeleton queda
incompleto:
1. El panel de filtros/pestañas/contenido está detrás de un `@if (!isLoading() || kpis())`
   sin `@else` → sólo se ve el skeleton del `<app-section-hero>` y el resto en blanco.
2. El skeleton del hero es mucho más chico que el hero real: `heroKpis()` devuelve `[]`
   mientras carga, así que `<app-section-hero>` no dibuja la fila de KPIs del skeleton
   (`@if (kpis().length || loadingKpiCount() > 0)`), y al llegar los datos el hero "salta".

## Cambios

- **Archivo:** `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.ts`
  - Rama `@else` al `@if (!isLoading() || kpis())`: skeleton del panel dentro de la misma
    celda `.bento-fill` — `<app-skeleton-block>` para selector, barra de pestañas y chip de
    la cabecera, + grilla de 2 "cards" de placeholders (barras de categoría). Mismo patrón
    single-component skeleton (`visual-system.md` §Skeletons). Importa `SkeletonBlockComponent`.
  - `<app-section-hero>` gana `[loadingKpiCount]="3"` para que el skeleton del hero incluya
    la fila de 3 KPIs (Total Ingresos / Gastos / Neto) y coincida con su alto real (usa el
    input ya existente del componente).
  - Skeleton de la cabecera reestructurado a 2 filas (selector arriba + chip a la derecha,
    barra de pestañas full-width abajo) para calcar el layout real del panel — antes ponía
    selector y pestañas lado a lado.

## Verificación

- `/verify` (Playwright, 1440×900) con `fetch` de Supabase throttleado + navegación SPA a
  la vista: el skeleton ahora cubre hero (icono + títulos + botón + fila de 3 KPIs) y panel
  (cabecera con selector/chip/barra de pestañas + 2 cards con filas de barras). Layout calca
  el estado cargado — mínimo layout shift. Captura `verify-hf103-skeleton-v2.png`.
- `npm run test:ci` — **2380 passed**. `npm run lint:arch` — 0 errores. `tsc --noEmit` — 0.
  Consola sin errores en la vista ya cargada.
