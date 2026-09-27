# Fix: "Este mes" del dashboard ejecutivo queda congelado en el mes en que se abrió la app
> id: fix-175-b-dashboard-ejecutivo-este-mes-congelado
> refs: 0044-b-dashboard-ejecutivo-admin
> status: done
> closed: 2026-09-27
> created: 2026-09-27

## Root Cause
`ExecutiveDashboardFacade` es singleton (`providedIn: 'root'`) y calcula su rango por defecto
(`resolvePresetRange('this_month', chileTodayIso())`) una sola vez, al construirse. Un preset
("Este mes", "Mes anterior", "Este año") se guarda como fechas fijas y nunca se re-resuelve: si la
app queda abierta al cambiar de mes, el admin ve el mes pasado rotulado "Este mes" hasta que vuelve
a elegir el preset.

## ACs Afectados
- AC1 (0044-b): los presets siempre se resuelven contra la fecha de hoy al momento de cargar.

## Cambio
- **Archivo:** `src/app/core/facades/executive-dashboard.facade.ts`
- **Qué cambia:** antes de cada carga, si el preset vigente no es `custom`, el rango se re-resuelve
  con `resolvePresetRange(preset, chileTodayIso())`. Los rangos personalizados no se tocan.

## Test de Regresión
- `src/app/core/facades/executive-dashboard.facade.spec.ts > fix-175-b: "Este mes" se re-resuelve al cambiar de mes` ✓
