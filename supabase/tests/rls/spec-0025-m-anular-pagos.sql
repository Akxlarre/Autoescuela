-- ============================================================================
-- Prueba de BD — spec 0025-m: anular un pago en vez de borrarlo
-- ============================================================================
-- ACs en specs/specs/0025-m-anular-pagos-en-vez-de-borrarlos/spec.md.
-- Migración: 20261013150000_spec0025m_payments_anulacion.sql.
-- Todo lo que escribe corre en sub-bloques que SIEMPRE abortan (ZZ001): no deja pagos ni cierres
-- de prueba. Las fechas de prueba (2099-02-0X) no chocan con cierres reales.
-- Los resultados se acumulan en una variable (v_rows) y se escriben en r0025 al final: una fila
-- insertada DENTRO de un sub-bloque que aborta se deshace junto con él.
-- La sesión se simula con request.jwt.claims (auth.uid()); se sigue como postgres, así que la RLS
-- no participa: lo que se prueba es el trigger guard_anulacion_pago.
-- Correr como postgres. Resultado en la tabla temporal r0025 (último SELECT); "FALLA" = ❌.
-- Datos de prueba: una matrícula no borrador con sede y saldo pendiente ≥ 1, un admin activo y
-- una secretaria activa.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r0025;
CREATE TEMP TABLE r0025 (n int, caso text, esperado text, obtenido text);

DO $test$
DECLARE
  v_rows      jsonb := '[]'::jsonb;
  v_enr       int;
  v_branch    int;
  v_admin_uid text;
  v_admin_id  int;
  v_sec_uid   text;
  v_paid0     int;
  v_paid1     int;
  v_pay       int;
  v_err       text;
  v_txt       text;
  v_row       public.payments%ROWTYPE;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  SELECT id, branch_id INTO v_enr, v_branch
  FROM public.enrollments
  WHERE status <> 'draft' AND branch_id IS NOT NULL AND pending_balance >= 1
  ORDER BY id DESC LIMIT 1;

  SELECT u.supabase_uid::text, u.id INTO v_admin_uid, v_admin_id
  FROM public.users u JOIN public.roles r ON r.id = u.role_id
  WHERE r.name = 'admin' AND u.active IS NOT FALSE AND u.supabase_uid IS NOT NULL
  ORDER BY u.id LIMIT 1;

  SELECT u.supabase_uid::text INTO v_sec_uid
  FROM public.users u JOIN public.roles r ON r.id = u.role_id
  WHERE r.name = 'secretary' AND u.active IS NOT FALSE AND u.supabase_uid IS NOT NULL
  ORDER BY u.id LIMIT 1;

  IF v_enr IS NULL OR v_admin_uid IS NULL OR v_sec_uid IS NULL THEN
    RAISE EXCEPTION 'Faltan datos de prueba';
  END IF;

  -- ── Instalación ───────────────────────────────────────────────────────────
  SELECT string_agg(column_name, ', ' ORDER BY column_name) INTO v_txt
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'payments'
    AND column_name IN ('voided_at', 'voided_by', 'void_reason');
  v_rows := v_rows || jsonb_build_object('n', 1, 'caso', 'Columnas de anulación',
    'esperado', 'void_reason, voided_at, voided_by', 'obtenido', v_txt);

  SELECT string_agg(tgname, ', ' ORDER BY tgname) INTO v_txt
  FROM pg_trigger
  WHERE NOT tgisinternal AND tgrelid = 'public.payments'::regclass
    AND tgname IN ('trg_payments_guard_anulacion', 'trg_update_balance');
  v_rows := v_rows || jsonb_build_object('n', 2, 'caso', 'Triggers instalados',
    'esperado', 'trg_payments_guard_anulacion, trg_update_balance', 'obtenido', v_txt);

  -- ── AC1 / AC3 / AC-E2: el admin anula; saldo recalculado; quién y cuándo los fija la BD ──
  BEGIN
    SELECT total_paid INTO v_paid0 FROM public.enrollments WHERE id = v_enr;
    INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
    VALUES (v_enr, 1, 1, 'paid', DATE '2099-02-01')
    RETURNING id INTO v_pay;
    SELECT total_paid INTO v_paid1 FROM public.enrollments WHERE id = v_enr;
    v_rows := v_rows || jsonb_build_object('n', 3,
      'caso', 'AC3 total_paid sube 1 al registrar el pago (control)',
      'esperado', (v_paid0 + 1)::text, 'obtenido', v_paid1::text);

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_admin_uid, 'role', 'authenticated')::text, true);

    v_err := 'sin error';
    BEGIN
      -- El cliente intenta además falsificar quién/cuándo y cambiar el monto: la BD lo ignora.
      UPDATE public.payments
      SET status = 'anulado', void_reason = '  monto mal digitado  ',
          voided_by = -1, voided_at = TIMESTAMPTZ '2000-01-01', total_amount = 999
      WHERE id = v_pay;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 4, 'caso', 'AC1 el admin anula con motivo',
      'esperado', 'sin error', 'obtenido', v_err);

    SELECT * INTO v_row FROM public.payments WHERE id = v_pay;
    v_rows := v_rows || jsonb_build_object('n', 5, 'caso', 'AC1 la fila sigue existiendo, anulada',
      'esperado', 'anulado', 'obtenido', COALESCE(v_row.status, 'no existe'));
    v_rows := v_rows || jsonb_build_object('n', 6, 'caso', 'AC1 motivo guardado sin espacios',
      'esperado', 'monto mal digitado', 'obtenido', v_row.void_reason);
    v_rows := v_rows || jsonb_build_object('n', 7, 'caso', 'AC-E2 voided_by es el admin de la sesión',
      'esperado', v_admin_id::text, 'obtenido', v_row.voided_by::text);
    v_rows := v_rows || jsonb_build_object('n', 8, 'caso', 'AC-E2 voided_at lo fija la BD',
      'esperado', 'true', 'obtenido', (v_row.voided_at > NOW() - INTERVAL '1 minute')::text);
    v_rows := v_rows || jsonb_build_object('n', 9, 'caso', 'AC1 anular no cambia el monto',
      'esperado', '1', 'obtenido', v_row.total_amount::text);

    SELECT total_paid INTO v_paid1 FROM public.enrollments WHERE id = v_enr;
    v_rows := v_rows || jsonb_build_object('n', 10,
      'caso', 'AC3 total_paid vuelve al valor previo al anular',
      'esperado', v_paid0::text, 'obtenido', v_paid1::text);

    -- AC-E1: definitivo
    v_err := 'sin error';
    BEGIN
      UPDATE public.payments SET void_reason = 'otro motivo' WHERE id = v_pay;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 11, 'caso', 'AC-E1 modificar un pago anulado',
      'esperado', 'PAGO_YA_ANULADO', 'obtenido', v_err);

    v_err := 'sin error';
    BEGIN
      UPDATE public.payments SET status = 'paid' WHERE id = v_pay;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 12, 'caso', 'AC-E1 revivir un pago anulado',
      'esperado', 'PAGO_YA_ANULADO', 'obtenido', v_err);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  -- ── AC8 / AC-E2: secretaria, sin sesión y sin motivo ──────────────────────
  BEGIN
    INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
    VALUES (v_enr, 1, 1, 'paid', DATE '2099-02-02')
    RETURNING id INTO v_pay;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_sec_uid, 'role', 'authenticated')::text, true);
    v_err := 'sin error';
    BEGIN
      UPDATE public.payments SET status = 'anulado', void_reason = 'prueba' WHERE id = v_pay;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 13, 'caso', 'AC8 la secretaria no anula',
      'esperado', 'ANULAR_SOLO_ADMIN', 'obtenido', v_err);

    PERFORM set_config('request.jwt.claims', '', true);
    v_err := 'sin error';
    BEGIN
      UPDATE public.payments SET status = 'anulado', void_reason = 'prueba' WHERE id = v_pay;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 14, 'caso', 'AC8 sin sesión no se anula',
      'esperado', 'ANULAR_SOLO_ADMIN', 'obtenido', v_err);

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_admin_uid, 'role', 'authenticated')::text, true);
    v_err := 'sin error';
    BEGIN
      UPDATE public.payments SET status = 'anulado', void_reason = '   ' WHERE id = v_pay;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 15, 'caso', 'AC-E2 anular sin motivo',
      'esperado', 'ANULAR_SIN_MOTIVO', 'obtenido', v_err);

    -- Un UPDATE normal no puede escribir datos de anulación.
    v_err := 'sin error';
    BEGIN
      UPDATE public.payments SET void_reason = 'colado' WHERE id = v_pay;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 16,
      'caso', 'AC-E2 datos de anulación en un pago vigente',
      'esperado', 'ANULACION_INVALIDA', 'obtenido', v_err);

    -- Control: un UPDATE normal de un pago vigente sigue permitido.
    v_err := 'sin error';
    BEGIN
      UPDATE public.payments SET document_number = 'prueba-0025' WHERE id = v_pay;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 17,
      'caso', 'Control: modificar un pago vigente sigue permitido',
      'esperado', 'sin error', 'obtenido', v_err);

    -- Un pago no nace anulado.
    v_err := 'sin error';
    BEGIN
      INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
      VALUES (v_enr, 1, 1, 'anulado', DATE '2099-02-02');
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 18, 'caso', 'AC-E2 insertar un pago ya anulado',
      'esperado', 'ANULACION_INVALIDA', 'obtenido', v_err);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  -- ── AC9: no se anula un pago de un día con caja cerrada ───────────────────
  BEGIN
    INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
    VALUES (v_enr, 1, 1, 'paid', DATE '2099-02-03')
    RETURNING id INTO v_pay;
    INSERT INTO public.cash_closings (date, branch_id, status, closed)
    VALUES (DATE '2099-02-03', v_branch, 'closed', true);

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_admin_uid, 'role', 'authenticated')::text, true);
    v_err := 'sin error';
    BEGIN
      UPDATE public.payments SET status = 'anulado', void_reason = 'prueba' WHERE id = v_pay;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 19, 'caso', 'AC9 anular pago de día cerrado',
      'esperado', 'CAJA_CERRADA', 'obtenido', v_err);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  -- ── AC-E4: el borrado real sigue funcionando (borradores, limpieza) ───────
  BEGIN
    INSERT INTO public.payments (enrollment_id, total_amount, cash_amount, status, payment_date)
    VALUES (v_enr, 1, 1, 'paid', DATE '2099-02-04')
    RETURNING id INTO v_pay;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_admin_uid, 'role', 'authenticated')::text, true);
    UPDATE public.payments SET status = 'anulado', void_reason = 'prueba' WHERE id = v_pay;
    PERFORM set_config('request.jwt.claims', '', true);

    v_err := 'sin error';
    BEGIN
      DELETE FROM public.payments WHERE id = v_pay;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    v_rows := v_rows || jsonb_build_object('n', 20,
      'caso', 'AC-E4 un proceso de limpieza puede borrar un pago anulado',
      'esperado', 'sin error', 'obtenido', v_err);
    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN NULL;
  END;

  INSERT INTO r0025 (n, caso, esperado, obtenido)
  SELECT n, caso, esperado, obtenido
  FROM jsonb_to_recordset(v_rows) AS t(n int, caso text, esperado text, obtenido text);
END;
$test$;

SELECT n, caso, esperado, obtenido,
       CASE WHEN obtenido IS NOT DISTINCT FROM esperado THEN '✅' ELSE '❌' END AS resultado
FROM r0025
ORDER BY n;
