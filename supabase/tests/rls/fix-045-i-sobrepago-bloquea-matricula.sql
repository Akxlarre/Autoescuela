-- ============================================================================
-- Prueba de BD — fix-045-i: el chequeo anti-sobrepago bloquea la matrícula
-- ============================================================================
-- ACs en specs/fixes/fix-045-i-pagos-duplicados-y-sobrepago/fix.md (AC-2).
-- Migración: 20261010140000_fix045_sobrepago_bloquea_matricula.sql.
-- La concurrencia real (dos sesiones a la vez) no se puede reproducir en un solo bloque: se
-- verifica que la función lea con FOR UPDATE y que la regla de saldo siga intacta.
-- Lo que escribe corre en sub-bloques que SIEMPRE abortan (ZZ001); los resultados se acumulan en
-- una variable y se escriben al final (una fila insertada dentro del sub-bloque se desharía).
-- Correr como postgres. Resultado en el último SELECT; "❌" = falla.
-- Datos de prueba: una matrícula no borrador con saldo pendiente ≥ 2.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r045;
CREATE TEMP TABLE r045 (n int, caso text, esperado text, obtenido text);

DO $test$
DECLARE
  v_rows    jsonb := '[]'::jsonb;
  v_enr     int;
  v_pending int;
  v_def     text;
  v_err     text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT id, pending_balance INTO v_enr, v_pending
  FROM public.enrollments
  WHERE status <> 'draft' AND pending_balance >= 2
  ORDER BY id DESC LIMIT 1;
  IF v_enr IS NULL THEN RAISE EXCEPTION 'Faltan datos de prueba'; END IF;

  -- ── Definición de la función ──────────────────────────────────────────────
  SELECT pg_get_functiondef('public.check_payment_within_pending_balance()'::regprocedure)
  INTO v_def;
  v_rows := v_rows || jsonb_build_object('n', 1, 'caso', 'La función lee el saldo con FOR UPDATE',
    'esperado', 'true', 'obtenido', (v_def ILIKE '%FOR UPDATE%')::text);
  v_rows := v_rows || jsonb_build_object('n', 2, 'caso', 'La función es SECURITY DEFINER',
    'esperado', 'true', 'obtenido', (v_def ILIKE '%SECURITY DEFINER%')::text);

  -- ── AC-2: un pago mayor al saldo se sigue rechazando ──────────────────────
  BEGIN
    v_err := 'sin error';
    BEGIN
      INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
      VALUES (v_enr, v_pending + 1, v_pending + 1, 'paid', DATE '2099-02-01');
    EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE;
    END;
    v_rows := v_rows || jsonb_build_object('n', 3, 'caso', 'Pago mayor al saldo se rechaza',
      'esperado', '23514', 'obtenido', v_err);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  -- ── AC-2: dos pagos seguidos que juntos superan el saldo: el segundo se rechaza ──
  -- (secuencial: es lo que el FOR UPDATE garantiza también cuando llegan a la vez)
  BEGIN
    INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
    VALUES (v_enr, v_pending - 1, v_pending - 1, 'paid', DATE '2099-02-01');
    v_err := 'sin error';
    BEGIN
      INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
      VALUES (v_enr, 2, 2, 'paid', DATE '2099-02-01');
    EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE;
    END;
    v_rows := v_rows || jsonb_build_object('n', 4,
      'caso', 'Segundo pago que excede el saldo restante se rechaza',
      'esperado', '23514', 'obtenido', v_err);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  -- ── Control: un pago dentro del saldo pasa ────────────────────────────────
  BEGIN
    v_err := 'sin error';
    BEGIN
      INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
      VALUES (v_enr, 1, 1, 'paid', DATE '2099-02-01');
    EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE;
    END;
    v_rows := v_rows || jsonb_build_object('n', 5, 'caso', 'Control: pago dentro del saldo pasa',
      'esperado', 'sin error', 'obtenido', v_err);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  INSERT INTO r045 (n, caso, esperado, obtenido)
  SELECT n, caso, esperado, obtenido
  FROM jsonb_to_recordset(v_rows) AS t(n int, caso text, esperado text, obtenido text);
END;
$test$;

SELECT n, caso, esperado, obtenido,
       CASE WHEN obtenido IS NOT DISTINCT FROM esperado THEN '✅' ELSE '❌' END AS resultado
FROM r045
ORDER BY n;
