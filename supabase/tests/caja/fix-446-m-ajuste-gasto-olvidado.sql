-- ============================================================================
-- Prueba de BD — fix-446-m: el ajuste "gasto olvidado" corrige un día cerrado; un gasto directo en
-- ese día sigue rechazado
-- ============================================================================
-- Migración: 20261016170000_fix446_rpc_registrar_ajuste_cuadratura.sql (sobre la de fix-445-m).
-- Los cierres de prueba los crea postgres; las pruebas corren como el rol authenticated suplantando
-- a admin@test.com y secretaria@test.com (sede 1). Todo dentro de una transacción que termina en
-- RAISE: no deja cambios. Fechas 2099-08-0X (sin cierres reales).
--   npx supabase db query --linked -f supabase/tests/caja/fix-446-m-ajuste-gasto-olvidado.sql
-- El resultado sale en el mensaje del error final ("RESULT: …"); "FALLA" = ❌.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE t446 ON COMMIT DROP AS
WITH c AS (
  INSERT INTO public.cash_closings (date, branch_id, status, closed) VALUES
    ('2099-08-01', 1, 'closed', true),
    ('2099-08-02', 1, 'draft', false)
  RETURNING id, status
)
SELECT status AS k, id FROM c;
GRANT SELECT ON t446 TO authenticated;

SET LOCAL role authenticated;

DO $test$
DECLARE
  r         text := '';
  v_cerrado int := (SELECT id FROM t446 WHERE k = 'closed');
  v_borr    int := (SELECT id FROM t446 WHERE k = 'draft');
  v_aj      int;
  g         record;
  n         int;
BEGIN
  -- Admin
  PERFORM set_config('request.jwt.claims',
    '{"sub":"d3fdf4cc-2b54-4b67-8ebe-00d38d1f7fe5","role":"authenticated"}', true);

  BEGIN
    INSERT INTO public.expenses (date, amount, branch_id, description)
    VALUES ('2099-08-01', 1000, 1, 'Prueba fix-446 directo');
    r := r || '1 gasto directo en día cerrado: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '1 gasto directo en día cerrado: ok | ';
  END;

  BEGIN
    v_aj := public.registrar_ajuste_cuadratura(v_cerrado, 'gasto_olvidado', -4500, '  Peaje olvidado  ', 'otros', NULL);
    SELECT e.date, e.amount, e.branch_id, e.description INTO g
    FROM public.cuadratura_adjustments a JOIN public.expenses e ON e.id = a.expense_id
    WHERE a.id = v_aj;
    r := r || '2 ajuste gasto olvidado: '
      || CASE WHEN g.date = '2099-08-01' AND g.amount = 4500 AND g.branch_id = 1
                AND g.description = 'Peaje olvidado' THEN 'ok' ELSE 'FALLA (datos)' END || ' | ';
  EXCEPTION WHEN OTHERS THEN r := r || '2 ajuste gasto olvidado: FALLA (' || SQLERRM || ') | ';
  END;

  -- La marca no queda puesta después de la RPC.
  BEGIN
    INSERT INTO public.expenses (date, amount, branch_id, description)
    VALUES ('2099-08-01', 1000, 1, 'Prueba fix-446 después');
    r := r || '3 gasto directo después del ajuste: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '3 gasto directo después del ajuste: ok | ';
  END;

  BEGIN
    v_aj := public.registrar_ajuste_cuadratura(v_cerrado, 'correccion_manual', 2000, 'Conteo', NULL, NULL);
    SELECT count(*) INTO n FROM public.cuadratura_adjustments WHERE id = v_aj AND expense_id IS NULL;
    r := r || '4 corrección manual sin gasto: ' || CASE WHEN n = 1 THEN 'ok' ELSE 'FALLA' END || ' | ';
  EXCEPTION WHEN OTHERS THEN r := r || '4 corrección manual sin gasto: FALLA (' || SQLERRM || ') | ';
  END;

  BEGIN
    PERFORM public.registrar_ajuste_cuadratura(v_borr, 'correccion_manual', 2000, 'Conteo', NULL, NULL);
    r := r || '5 ajuste sobre cierre en borrador: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '5 ajuste sobre cierre en borrador: ok | ';
  END;

  -- Atomicidad: un vehículo inexistente hace fallar el gasto; no queda nada.
  SELECT count(*) INTO n FROM public.expenses WHERE date = '2099-08-01';
  BEGIN
    PERFORM public.registrar_ajuste_cuadratura(v_cerrado, 'gasto_olvidado', -100, 'Atomicidad', NULL, -1);
    r := r || '6 fallo a medias no deja nada: FALLA (no falló) | ';
  EXCEPTION WHEN OTHERS THEN
    r := r || '6 fallo a medias no deja nada: '
      || CASE WHEN (SELECT count(*) FROM public.expenses WHERE date = '2099-08-01') = n
              THEN 'ok' ELSE 'FALLA' END || ' | ';
  END;

  -- Secretaria (sede 1)
  PERFORM set_config('request.jwt.claims',
    '{"sub":"bc4dbbc8-2fef-433d-bede-61f00ae10976","role":"authenticated"}', true);
  BEGIN
    PERFORM public.registrar_ajuste_cuadratura(v_cerrado, 'gasto_olvidado', -100, 'Secretaria', NULL, NULL);
    r := r || '7 secretaria registra ajuste: FALLA';
  EXCEPTION WHEN insufficient_privilege THEN r := r || '7 secretaria registra ajuste: ok';
  END;

  RAISE EXCEPTION 'RESULT: %', r;
END
$test$;

ROLLBACK;
