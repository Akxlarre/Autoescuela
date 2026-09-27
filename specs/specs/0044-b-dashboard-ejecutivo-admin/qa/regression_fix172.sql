-- Regresión fix-172-b: una matrícula online en pending_payment (checkout abandonado) no debe
-- contar como deuda ni como matrícula nueva. Correr DESPUÉS de seed_exec.sql, contra Postgres
-- local (nunca contra producción). Falla con RAISE EXCEPTION si el bug vuelve.
SET session_replication_role = replica;
DELETE FROM enrollments WHERE id = 5099;
INSERT INTO enrollments (id, student_id, course_id, branch_id, status, license_group,
                         pending_balance, created_at)
VALUES (5099, 701, 1, 1, 'pending_payment', 'class_b', 999000, '2026-09-20 12:00-03');
SET session_replication_role = origin;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

DO $$
DECLARE
  v_total BIGINT;
  v_nuevas INT;
  v_serie INT;
BEGIN
  SELECT SUM(monto) INTO v_total FROM exec_dashboard_receivables(1);
  IF v_total <> 150000 THEN
    RAISE EXCEPTION 'fix-172-b: cartera esperada 150000, obtenida %', v_total;
  END IF;

  v_nuevas := (exec_dashboard_kpis('2026-09-01', '2026-09-30', 1) ->> 'nuevas_matriculas')::int;
  IF v_nuevas <> 1 THEN
    RAISE EXCEPTION 'fix-172-b: nuevas matrículas esperadas 1, obtenidas %', v_nuevas;
  END IF;

  SELECT matriculas INTO v_serie FROM exec_dashboard_monthly_series(2026, 1) WHERE year = 2026 AND month = 9;
  IF v_serie <> 1 THEN
    RAISE EXCEPTION 'fix-172-b: serie sep-2026 esperada 1, obtenida %', v_serie;
  END IF;

  RAISE NOTICE 'fix-172-b OK: cartera %, nuevas %, serie %', v_total, v_nuevas, v_serie;
END $$;

SET session_replication_role = replica;
DELETE FROM enrollments WHERE id = 5099;
SET session_replication_role = origin;
