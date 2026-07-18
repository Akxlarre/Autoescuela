# Fix: Homogeneizar páginas al patrón bento (Tier B + B2)
> id: fix-015-b-homogeneizar-paginas-bento-tier-b
> refs: indices/UI-HOMOGENEITY-AUDIT.md (Tier B + B2)
> status: done
> closed: 2026-06-14
> created: 2026-06-14

## Root Cause
Cuatro páginas envuelven un componente `*-content` (que ya define su propio layout) en
un contenedor no canónico, rompiendo la homogeneidad respecto a sus páginas hermanas:

1. **liquidaciones** (admin + secretaria) usa `<div class="page-wide">` como raíz → ancho/padding
   distintos a reportes/cuadratura (que delegan **bare**).
2. **servicios-especiales** (admin + secretaria) usa `<div class="p-6">` como raíz → padding doble
   sobre el grid interno del content.
3. **`liquidaciones-content`** fragmenta el bento: el hero en un `bento-banner` suelto y los 3 KPIs
   en un `<div class="bento-grid">` **separado**. Como 3 KPIs no dividen las columnas bento (4/8/12),
   los `bento-square` ocupan 9/12 cols → quedan desalineados respecto al hero y al ancho de la tabla.
   El sibling bueno `reportes-contables-content` evita esto con un `grid grid-cols-1 md:grid-cols-3`.

## ACs Afectados
Ninguno — fix autónomo de consistencia visual (no altera contratos de datos ni lógica).
- Las 4 páginas deben delegar su `*-content` **sin wrapper** (igual que reportes/cuadratura).
- `liquidaciones-content` debe espejar la estructura de `reportes-contables-content`:
  hero `bento-banner` con `icon`, KPIs en `grid grid-cols-1 md:grid-cols-3 gap-4`,
  contenido en `px-4 sm:px-6 pb-6 flex flex-col gap-5`.

## Cambio
- **`features/admin/contabilidad-liquidaciones/admin-contabilidad-liquidaciones.component.ts`** — quitar `<div class="page-wide">`, delegar bare.
- **`features/secretaria/contabilidad-liquidaciones/secretaria-contabilidad-liquidaciones.component.ts`** — quitar `<div class="page-wide">`, delegar bare.
- **`features/admin/servicios-especiales/admin-servicios-especiales.component.ts`** — quitar `<div class="p-6">`, delegar bare.
- **`features/secretaria/servicios-especiales/secretaria-servicios-especiales.component.ts`** — quitar `<div class="p-6">`, delegar bare.
- **`shared/components/liquidaciones-content/liquidaciones-content.component.ts`** — reestructurar template a la forma de reportes: KPIs en grid plano (sin `bento-square`/`bento-grid`), hero con `icon="banknote"`, contenido en wrapper de padding consistente; eliminar `BentoGridLayoutDirective`, `GsapAnimationsService`, viewChildren y `ngAfterViewInit` (KPI counters siguen animando solos). Conservar lógica drawer (`isDrawerOpen`/`force-compact`/`adaptive-grid`). **Refinamiento (post-revisión visual):** quitar `[accent]="true"` de las 3 KPIs — tenía 3 bordes de color (violaba "máx 1 card-accent por sección" y se veía distinto a servicios/tareas, que usan KPIs planas sin accent).

## Test de Regresión
Sin lógica de negocio nueva → no hay `.spec.ts` (los component specs están excluidos de vitest en este repo; ver memoria del proyecto).
- `npm run lint:arch` verde ✓
- `ng build` sin errores ✓
- `/verify` visual: liquidaciones y servicios-especiales (admin+secretaria) con hero + KPIs alineados al mismo ancho, sin doble contenedor; comparar con reportes. ✓
