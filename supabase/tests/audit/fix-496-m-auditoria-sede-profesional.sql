-- ============================================================================
-- Prueba de BD — fix-496-m: sede de Profesional y etiquetas legibles en audit_log
-- ============================================================================
-- Hallazgos en specs/fixes/fix-496-m-auditoria-sede-profesional-y-etiquetas/fix.md.
-- Lo que escribe corre en un sub-bloque que SIEMPRE aborta (ZZ001): no deja cambios ni filas en
-- audit_log. Correr como postgres después de aplicar la migración. Resultado en la tabla
-- temporal r496 (último SELECT); "FALLA" = ❌. Usa la sesión Profesional más reciente, un pago
-- pendiente y un descuento cualquiera de la BD.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.r496;
CREATE TEMP TABLE r496 (caso text, esperado text, obtenido text, resultado text);

DO $test$
DECLARE
  v_max      bigint;
  v_row      record;
  v_sede     int;
  v_txt      text;
  v_nulls    int;
  v_res      r496[] := '{}';
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Correr como postgres'; END IF;

  -- Registros históricos de Profesional sin sede (la migración los rellena)
  SELECT count(*) INTO v_nulls FROM public.audit_log
   WHERE branch_id IS NULL
     AND entity IN ('promotion_courses', 'professional_theory_sessions',
                    'professional_practice_sessions', 'class_book', 'professional_module_grades',
                    'enrollment_payment_overrides');
  INSERT INTO r496 VALUES ('H1 Profesional sin sede (histórico)', '0', v_nulls::text,
    CASE WHEN v_nulls = 0 THEN 'ok' ELSE 'FALLA' END);

  -- Diccionarios
  v_txt := public.audit_humanize_enum_value('autorizacion_notarial');
  INSERT INTO r496 VALUES ('H4 tipo de documento', 'Autorización notarial', v_txt,
    CASE WHEN v_txt = 'Autorización notarial' THEN 'ok' ELSE 'FALLA' END);
  v_txt := public.audit_humanize_column('qty_bill_20000');
  INSERT INTO r496 VALUES ('H5 columna de caja', 'Billetes de $20.000', v_txt,
    CASE WHEN v_txt = 'Billetes de $20.000' THEN 'ok' ELSE 'FALLA' END);
  v_txt := public.audit_website_config_diff('{"courses":[1]}'::jsonb, '{"courses":[1,2]}'::jsonb);
  INSERT INTO r496 VALUES ('H7 lista de cursos', 'Cursos: lista actualizada (2 ítems)', v_txt,
    CASE WHEN v_txt = 'Cursos: lista actualizada (2 ítems)' THEN 'ok' ELSE 'FALLA' END);

  SELECT max(id) INTO v_max FROM public.audit_log;

  BEGIN
    -- H1: sesión Profesional → sede de la promoción
    SELECT s.id, p.branch_id INTO v_row
      FROM public.professional_theory_sessions s
      JOIN public.promotion_courses pc ON pc.id = s.promotion_course_id
      JOIN public.professional_promotions p ON p.id = pc.promotion_id
     ORDER BY s.id DESC LIMIT 1;
    UPDATE public.professional_theory_sessions SET notes = 'QA fix-496-m' WHERE id = v_row.id;
    SELECT branch_id, detail INTO v_sede, v_txt FROM public.audit_log
     WHERE id > v_max AND entity = 'professional_theory_sessions' ORDER BY id DESC LIMIT 1;
    v_res := v_res || ROW('H1 sesión Profesional con sede', v_row.branch_id::text,
      COALESCE(v_sede::text, 'NULL') || ' | ' || COALESCE(v_txt, '—'),
      CASE WHEN v_sede = v_row.branch_id THEN 'ok' ELSE 'FALLA' END)::r496;

    -- H6: pago pendiente sin medio + monto con miles en el diff
    SELECT id INTO v_row FROM public.payments
     WHERE status = 'pending' AND COALESCE(cash_amount, 0) + COALESCE(transfer_amount, 0)
           + COALESCE(card_amount, 0) + COALESCE(voucher_amount, 0) = 0
     ORDER BY id DESC LIMIT 1;
    IF v_row.id IS NOT NULL THEN
      UPDATE public.payments SET document_number = 'QA496' WHERE id = v_row.id;
      SELECT detail INTO v_txt FROM public.audit_log
       WHERE id > v_max AND entity = 'payments' ORDER BY id DESC LIMIT 1;
      v_res := v_res || ROW('H6 pago pendiente', '(Pendiente)', v_txt,
        CASE WHEN v_txt LIKE '%(Pendiente)%' THEN 'ok' ELSE 'FALLA' END)::r496;
    END IF;

    -- H5/H6: descuento — etiqueta "Valor" y monto/porcentaje
    SELECT id, discount_type, value INTO v_row FROM public.discounts ORDER BY id LIMIT 1;
    UPDATE public.discounts SET value = value + 1 WHERE id = v_row.id;
    SELECT detail INTO v_txt FROM public.audit_log
     WHERE id > v_max AND entity = 'discounts' ORDER BY id DESC LIMIT 1;
    v_res := v_res || ROW('H5 descuento', 'Valor: …', v_txt,
      CASE WHEN v_txt LIKE '%Valor: %'
            AND v_txt LIKE CASE WHEN v_row.discount_type = 'percentage' THEN '%\%%' ELSE '%$%' END
           THEN 'ok' ELSE 'FALLA' END)::r496;

    -- H8: NULL -> '' no deja registro
    SELECT id INTO v_row FROM public.expenses WHERE receipt_url IS NULL ORDER BY id DESC LIMIT 1;
    UPDATE public.expenses SET receipt_url = '' WHERE id = v_row.id;
    SELECT count(*) INTO v_nulls FROM public.audit_log
     WHERE id > v_max AND entity = 'expenses' AND entity_id = v_row.id;
    v_res := v_res || ROW('H8 vacío = sin asignar', '0 registros', v_nulls::text,
      CASE WHEN v_nulls = 0 THEN 'ok' ELSE 'FALLA' END)::r496;

    RAISE EXCEPTION USING ERRCODE = 'ZZ001';
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN
    NULL; -- revierte todo lo del sub-bloque (también lo escrito en r496: por eso v_res)
  END;

  INSERT INTO r496 SELECT * FROM unnest(v_res);
  SELECT count(*) INTO v_nulls FROM public.audit_log WHERE id > v_max;
  INSERT INTO r496 VALUES ('Sin efectos: audit_log no creció', '0', v_nulls::text,
    CASE WHEN v_nulls = 0 THEN 'ok' ELSE 'FALLA' END);
END
$test$;

SELECT * FROM r496 ORDER BY caso;
