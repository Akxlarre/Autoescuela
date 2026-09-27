# Fix: Dashboard ejecutivo cuenta matrículas online sin pagar como deuda y como matrícula nueva
> id: fix-172-b-dashboard-ejecutivo-excluir-pending-payment
> refs: 0044-b-dashboard-ejecutivo-admin
> status: done
> closed: 2026-09-27
> created: 2026-09-27

## Root Cause
Las funciones `exec_dashboard_kpis`, `exec_dashboard_monthly_series` y `exec_dashboard_receivables`
(migración `20260927120000`, aún no aplicada en producción) excluyen solo `enrollments.status IN
('draft','cancelled')`. Una matrícula online con checkout iniciado y no pagado queda en
`status = 'pending_payment'` con `pending_balance` = precio completo (Edge Function
`public-enrollment`, acción `initiate-payment`) hasta que `cleanup_expired_public_enrollment()` la
cancela — y esa función es "manual o pg_cron", no garantizada. Resultado: checkouts abandonados
inflan "Saldo por cobrar" (tramo 0–30), "alumnos con saldo" y "Nuevas matrículas", cuyo tooltip
dice "confirmadas".

## ACs Afectados
- AC6 (0044-b): la cartera ya no incluye matrículas `pending_payment`.
- AC7 / AC14 (0044-b): "Nuevas matrículas" y la serie de matrículas cuentan solo matrículas reales.

## Cambio
- **Archivo:** `supabase/migrations/20260927120000_executive_dashboard_rpcs.sql`
- **Qué cambia:** las 3 exclusiones pasan a `status NOT IN ('draft', 'cancelled', 'pending_payment')`.
  Se edita la misma migración porque todavía no se aplicó en ningún entorno compartido (vive solo
  en la rama de 0044-b).

## Test de Regresión
- `specs/specs/0044-b-dashboard-ejecutivo-admin/qa/regression_fix172.sql` — contra Postgres local con
  el seed `qa/seed_exec.sql` + una matrícula `pending_payment` con saldo $999.000 creada en
  septiembre: la cartera de la sede 1 sigue en $150.000 y "nuevas matrículas" de septiembre sigue
  en 1 ✓
