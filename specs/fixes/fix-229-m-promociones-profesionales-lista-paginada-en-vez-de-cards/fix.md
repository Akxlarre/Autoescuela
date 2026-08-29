# Fix: Promociones Profesionales — lista paginada en vez de grilla de cards
> id: fix-229-m-promociones-profesionales-lista-paginada-en-vez-de-cards
> refs: 0002-m-promociones-cadencia
> status: done
> closed: 2026-08-29
> created: 2026-08-29

## Root Cause
La vista `AdminProfesionalPromocionesComponent` renderiza las promociones como una
grilla de cards con una paginación custom ad-hoc (`.pagination-btn`, botones
Anterior/Siguiente, `pageSize = 6`). El resto de listados equivalentes de la app
(Base Alumnos B, Base Alumnos Profesional, Relatores) usan el patrón dual-viewport
canónico: `p-table` de PrimeNG con `[paginator]="true"` + `currentPageReportTemplate`
en desktop, y cards apiladas solo cuando el contenedor se comprime (drawer abierto)
o en móvil, vía container query. La vista de promociones quedó fuera de ese estándar.

Además, la lista no prioriza las promociones activas: se ordena solo por `start_date`
descendente, mezclando "En curso" con "Planificada".

## ACs Afectados
Ninguno — fix autónomo (consistencia de UI con el resto de listados de la app).

## Cambio
- **Archivo:** `src/app/features/admin/profesional-promociones/admin-profesional-promociones.component.ts`
- **Qué cambia:**
  1. Reemplaza la grilla de cards + paginación custom por el patrón dual-viewport de
     Relatores: `p-table` con `[paginator]="true"`, `[rows]="10"`,
     `[showCurrentPageReport]="true"` y `currentPageReportTemplate` en la vista
     desktop; cards apiladas en la vista `show-on-squeeze` (drawer abierto / móvil)
     vía container query.
  2. Elimina el estado de paginación manual (`currentPage`, `pageSize`,
     `paginatedPromociones`, `totalPages`, `paginationStart`, `paginationEnd`) y la
     clase `.pagination-btn`.
  3. `filteredPromociones` ordena por prioridad de estado: `in_progress` primero,
     `planned` al final (`finished` y `cancelled` en medio). Orden estable dentro de
     cada grupo (respeta el `start_date` desc que ya trae el facade).

## Test de Regresión
- `src/app/features/admin/profesional-promociones/admin-profesional-promociones.component.spec.ts > filteredPromociones ordena in_progress primero y planned al final` ✓
