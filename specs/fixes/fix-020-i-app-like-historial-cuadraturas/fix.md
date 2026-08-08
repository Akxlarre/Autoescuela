# Fix: App-like `/admin/contabilidad/historial-cuadraturas` + `/secretaria/...`
> id: fix-020-i-app-like-historial-cuadraturas
> refs: ASG-b-075
> status: active
> created: 2026-08-08

## Root Cause
[Heredado de ASG-b-075, a confirmar]: Paso 8 del rollout app-like
(`indices/APP-LIKE-ROLLOUT.md`), junto con liquidaciones (ASG-b-074, ya cerrado en fix-019-i).
`historial-cuadraturas-content` (shared admin+secretaria): hero + toolbar de mes + calendario
mensual acotado (máx 42 celdas, `hidden lg:grid` + fallback mobile aparte). 3 filas
conceptuales = `--fill-screen-kpi`.

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
1. Root → `bento-grid--fill-screen-kpi`.
2. Calendario → `bento-fill flex flex-col h-full`, el grid `hidden lg:grid...flex-1` → agregar
   `min-h-0 overflow-y-auto` (por si un mes tiene muchos eventos por celda).
3. Fallback mobile sin cambios.

Archivo principal:
`src/app/shared/components/historial-cuadraturas-content/historial-cuadraturas-content.component.ts`

## Test de Regresión
- `force-compact` verificado con drawer abierto.
- Sin `.spec.ts` nuevo obligatorio.
- `/verify` en **AMBAS rutas** (admin y secretaria — componente `shared`), 390×844, 1440×900 y
  768 de alto.

## Resultado
_Pendiente._
