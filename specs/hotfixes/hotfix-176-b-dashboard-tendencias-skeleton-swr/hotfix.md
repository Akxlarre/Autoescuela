# Hotfix: skeleton y feedback SWR en tarjeta de tendencias del dashboard
> id: hotfix-176-b-dashboard-tendencias-skeleton-swr
> refs: —
> status: done
> created: 2026-11-09
> closed: 2026-11-09

## Problema
En el Dashboard Ejecutivo (`/admin/dashboard`):
1. En la primera carga en frío, el skeleton del gráfico de líneas (`LineComparisonChartComponent`) colapsa a 0px de alto porque `SkeletonBlockComponent` no enlaza `height` al `:host`, dejando solo el título y subtítulo flotando en el vacío hasta que cargan los datos.
2. Durante recargas SWR (cambio de sede o período), la tarjeta protagonista `.bento-fill` (donde viven las tendencias) no aplica `opacity-60` ni `aria-busy`, quedando congelada sin feedback visual a diferencia del Hero y los KPIs.

## Cambios
- **`src/app/shared/components/skeleton-block/skeleton-block.component.ts`**:
  Enlazar `[style.height]: height()` en el host del componente para evitar el colapso a 0px cuando se usa porcentaje (`100%`) o dimensiones explícitas.
- **`src/app/shared/components/line-comparison-chart/line-comparison-chart.component.ts`**:
  Asegurar que el skeleton del gráfico tenga un área visual con altura mínima garantizada y líneas simuladas, evitando el salto de layout al cargar el SVG.
- **`src/app/features/dashboard/dashboard.component.ts`**:
  Agregar `[class.opacity-60]="facade.isRefreshing()"` y `[attr.aria-busy]="facade.isRefreshing()"` a la celda protagonista `.bento-fill` para coordinar el feedback SWR.

## Verificación
- Revisión visual del skeleton durante carga en frío en localhost:4200.
- Transición suave con opacidad al conmutar sedes y filtros de período.
- `npm run lint:arch`: 0 errores.
