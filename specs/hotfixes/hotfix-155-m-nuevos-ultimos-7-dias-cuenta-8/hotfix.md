# Hotfix: "nuevos últ. 7 días" cuenta 8 días
> id: hotfix-155-m-nuevos-ultimos-7-dias-cuenta-8
> refs: fix-395-m-testing-dashboards (caso K03)
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Problema
La tendencia de "Alumnos Activos" en el dashboard de secretaria cuenta las matrículas creadas
desde el inicio del día de hace 7 días: con hoy incluido son 8 días (el 14 cuenta desde el 7).

## Cambios
- **Archivo:** `src/app/core/facades/dashboard.facade.ts` — el corte es el inicio del día de hace 6 días (hoy y los 6 anteriores)
- **Archivo:** `src/app/core/facades/dashboard.facade.spec.ts` — test del corte

## Verificación
- [x] El 14 de octubre el corte es el inicio del 8 de octubre en hora Chile (`2026-10-08T03:00:00.000Z`): test nuevo en `dashboard.facade.spec.ts`, que fallaba antes del cambio. 53/53 junto con `hora-chile.facades.spec.ts`
