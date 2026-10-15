# Fix: "Ir a Cuadratura" lleva a la secretaria a la ruta del admin
> id: fix-401-m-ir-a-cuadratura-segun-rol
> refs: fix-395-m-testing-dashboards (caso Q08, sospecha S3)
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Secretaria → "Ver todas las alertas" → alerta "Caja sin cerrar" → "Ir a Cuadratura": la app intenta
abrir `/app/admin/contabilidad/cuadratura`, que es del admin; el guard la devuelve a su dashboard
y nunca llega a la Cuadratura.

## Root Cause

`AlertsDrawerComponent.routeForAlert()` tiene la ruta del admin escrita fija, pero el mismo drawer
se abre desde el dashboard de secretaria, cuya Cuadratura vive en
`/app/secretaria/contabilidad/cuadratura`.

## Fix

La ruta se arma con el rol del usuario (misma regla que `RecentActivityDrawerComponent`) y el
drawer se cierra al navegar.

## Acceptance Criteria

- [x] AC1 — Como secretaria, "Ir a Cuadratura" abre `/app/secretaria/contabilidad/cuadratura`.
- [x] AC2 — Como admin, abre `/app/admin/contabilidad/cuadratura`.
- [x] AC3 — El drawer de alertas se cierra al navegar.

## Regression Test

- `alerts-drawer.component.spec.ts` → `"Ir a Cuadratura" según el rol (fix-401-m)`

## Verificación (2026-10-13)

- Unit: `alerts-drawer.component.spec.ts` 20/20 (dos tests nuevos, rojo → verde). `tsc` sin errores.
- Navegador: como secretaria de la sede 1, "Ir a Cuadratura" abre
  `/app/secretaria/contabilidad/cuadratura` ("Cuadratura Diaria · Caja Abierta") y el drawer queda
  cerrado. Como admin abre `/app/admin/contabilidad/cuadratura`, también con el drawer cerrado.
