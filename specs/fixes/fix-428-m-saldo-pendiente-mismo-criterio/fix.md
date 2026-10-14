# Fix: "alumnos con saldo" da un número distinto en la cartera del ejecutivo y en las alertas
> id: fix-428-m-saldo-pendiente-mismo-criterio
> refs: fix-395-m-testing-dashboards (casos H05, Q03, sospecha S16; decisión de Matías 2026-10-14) · fix-270-m · hotfix-153-m
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Síntoma

La cartera del ejecutivo ("Saldo por cobrar · N alumnos con saldo") y la alerta "N Pagos pendientes"
de los dashboards no cuadran: miden cosas distintas con nombres parecidos.

- Cartera: deuda de todas las matrículas Clase B (también egresados y retirados), pero suma los
  alumnos tramo por tramo, así que un alumno con dos matrículas en tramos distintos cuenta 2.
- Alerta "Pagos pendientes": solo matrículas **activas**, de todos los cursos, y cuenta matrículas.
- Alerta "más de 60 días con saldo": igual, solo activas.

## Root Cause

Cada consulta se escribió con su propio criterio de "deuda": la RPC `exec_dashboard_receivables`
excluye borradores, canceladas y pagos online abandonados; las alertas filtran `status = 'active'`.
La RPC cuenta alumnos distintos dentro de cada tramo y el cliente (`mapReceivables`) los suma.

## Fix

Decisión de Matías: todos muestran todo el saldo pendiente, incluidos los egresados.

- Un solo criterio de deuda: matrícula Clase B con `pending_balance > 0` y estado distinto de
  `draft`, `cancelled` y `pending_payment` (el de la cartera).
- Alerta "Pagos pendientes" → "N alumnos con saldo pendiente": alumnos distintos con ese criterio.
- Alerta de más de 60 días → alumnos distintos con saldo en una matrícula de más de 60 días, con el
  mismo criterio.
- Migración: `exec_dashboard_receivables` devuelve además `alumnos_total` (alumnos distintos en
  toda la cartera) y `mapReceivables` lo usa en vez de sumar los tramos. Sin la migración aplicada
  sigue sumando, como hoy.
- Base B "Con deuda" no cambia: ya suma todas las matrículas B del alumno (`fix-270-m`), y los
  egresados están en Ex-Alumnos B, no en Base B.

## Acceptance Criteria

- [x] AC1 — La alerta de saldo cuenta alumnos distintos con deuda en matrículas Clase B no
  borradores, canceladas ni pagos abandonados, incluidos egresados y retirados.
- [x] AC2 — La alerta de más de 60 días usa el mismo criterio.
- [x] AC3 — La cartera cuenta a cada alumno una vez aunque tenga deuda en dos tramos.
- [x] AC4 — Con la migración aplicada, la cartera y la alerta de una misma sede dan el mismo número.

## Regression Test

- `dashboard-alerts.facade.spec.ts` → `fix-428-m`
- `executive-dashboard.utils.spec.ts` → `fix-428-m`

## Migración

`supabase/migrations/20261014120000_fix428_exec_receivables_alumnos_total.sql` — **la aplica
Matías.** Mientras no se aplique, `mapReceivables` sigue sumando los tramos (hoy da lo mismo: en
dev ningún alumno tiene deuda en dos tramos).

## Verificación (2026-10-14)

- Unit: 2 tests en `dashboard-alerts.facade.spec.ts` (alumnos distintos; filtros del criterio de la
  cartera en las dos consultas) y 1 en `executive-dashboard.utils.spec.ts` (`alumnos_total`).
  `buildChain` fabrica filas cuando un mock declara solo `count`. Suites del dashboard: 218/218.
  `tsc` sin errores; `lint:arch` 0 errores, ARCH-28 sin regresiones.
- Migración ensayada contra la BD de dev en una transacción que se revierte (`supabase db query
  --linked`): la función se crea y la cartera da sede 1 = 25, sede 2 = 22, todas = 47 alumnos;
  el criterio de las alertas da los mismos 25, 22 y 47.
- Navegador, secretaria de la sede 1: "25 alumnos con saldo pendiente · Incluye egresados y
  retirados" (antes "22 Pagos pendientes", que contaba solo matrículas activas).
