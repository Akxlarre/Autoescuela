# Fix: KPIs de reportes sin triple-accent (homogeneidad contabilidad)
> id: fix-016-b-reportes-kpi-accent
> refs: indices/UI-HOMOGENEITY-AUDIT.md · fix-015
> status: done
> closed: 2026-06-14
> created: 2026-06-14

## Root Cause
`reportes-contables-content` aplica `[accent]="true"` a sus 3 KPIs → 3 bordes de color.
Tras fix-015 (liquidaciones quedó con KPIs planas como servicios/tareas), reportes es ahora
el outlier de la sección contabilidad. Además viola la regla "máx 1 `.card-accent` por sección".
`cuadratura-content` ya cumple (un solo `card-accent`), no requiere cambio.

## ACs Afectados
Ninguno — fix autónomo de consistencia visual.
- KPIs de reportes deben quedar planas (sin accent), igual que servicios/tareas/liquidaciones.

## Cambio
- **Archivo:** `shared/components/reportes-contables-content/reportes-contables-content.component.ts`
- **Qué cambia:** quitar las 3 ocurrencias de `[accent]="true"` en los `app-kpi-card-variant`.

## Test de Regresión
- `/verify` visual: KPIs de `/app/admin/contabilidad/reportes` sin borde de color, consistentes con liquidaciones/servicios. ✓
- 0 errores de consola. ✓
