# Fix: Mover KPI "En Taller" de bento-square a hero strip en Flotas
> id: fix-086-flota-kpi-en-taller-hero
> refs: —
> status: done
> closed: 2026-07-28
> created: 2026-07-28

## Root Cause
El KPI "En Taller" estaba implementado como un componente `app-action-kpi-card` en una celda bento-square separada, cuando el patrón canónico dicta que todos los KPIs de estado deben estar agrupados en el **KPI strip del hero** (header), junto con Total, Disponibles, En Clase. La separación fragmentaba visualmente la información de estado de la flota.

## ACs Afectados
Ninguno — fix autónomo de patrón arquitectónico.

## Cambio
- **Archivo:** `src/app/shared/components/flota-list-content/flota-list-content.component.ts`
- **Qué cambia:** 
  - Agregar KPI "En Taller" al computed `heroKpis()` (display-only, sin `clickable`)
  - Eliminar la card `bento-square` con `app-action-kpi-card`

**Nota de iteración:** se probó hacer el KPI clickeable (`clickable: true` + `kpiClick` para filtrar la tabla, patrón de "Por Vencer" en `alumnos-list-content.component.ts`) pero se descartó por decisión del usuario: el filtro por estado "Mantenimiento" ya existe en el `p-select` de Estado del toolbar, así que el click era funcionalidad redundante. Se revirtió `clickable`, el binding `(kpiClick)`, el método `handleKpiClick()` y el botón "Limpiar" que se había agregado para poder deshacer ese filtro. El KPI queda solo informativo, igual que Total/Disponibles/En Clase.

## Test de Regresión
- Navegar a Admin > Flota → verificar que el KPI "En Taller" aparezca en el hero strip junto a Total/Disponibles/En Clase, sin cursor pointer (no clickeable) ✓
