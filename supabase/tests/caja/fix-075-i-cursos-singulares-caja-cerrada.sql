-- ============================================================================
-- Prueba de BD — fix-075-i: un cobro de curso singular no entra, cambia ni se borra en un día con
-- caja cerrada
-- ============================================================================
-- Migración: 20261112120000_fix075_cursos_singulares_caja_cerrada.sql.
-- Todo corre dentro de un bloque que SIEMPRE aborta: no deja cursos, inscripciones ni cierres de
-- prueba. Las fechas (2099-03-0X) no chocan con cierres reales. Correr como postgres:
--   npx supabase db query --linked -f supabase/tests/caja/fix-075-i-cursos-singulares-caja-cerrada.sql
-- El resultado sale en el mensaje del error final ("RESULT: …"); "FALLA" = ❌.
-- Día del cobro = chile_date(paid_at): 2099-03-01T15:00Z es el 01-03 en Chile.
-- ============================================================================

DO $test$
DECLARE
  r          text := '';
  v_curso_a  int;  -- curso de la sede 1 (caja cerrada el 2099-03-01)
  v_curso_b  int;  -- curso de la sede 2 (caja abierta)
  v_al1      int;
  v_al2      int;
  v_al3      int;
  v_pagada   int;  -- inscripción cobrada el día cerrado
  v_pend     int;  -- inscripción pendiente
  n          int;
BEGIN
  SELECT id INTO v_al1 FROM public.students ORDER BY id LIMIT 1;
  SELECT id INTO v_al2 FROM public.students ORDER BY id OFFSET 1 LIMIT 1;
  SELECT id INTO v_al3 FROM public.students ORDER BY id OFFSET 2 LIMIT 1;

  INSERT INTO public.standalone_courses
    (name, type, billing_type, base_price, duration_hours, max_students, start_date, status, branch_id)
  VALUES ('Prueba fix-075 A', 'particular', 'boleta', 1000, 1, 10, '2099-01-01', 'active', 1)
  RETURNING id INTO v_curso_a;
  INSERT INTO public.standalone_courses
    (name, type, billing_type, base_price, duration_hours, max_students, start_date, status, branch_id)
  VALUES ('Prueba fix-075 B', 'particular', 'boleta', 1000, 1, 10, '2099-01-01', 'active', 2)
  RETURNING id INTO v_curso_b;

  -- Cobrada el 01-03 y una pendiente, ANTES de cerrar la caja.
  INSERT INTO public.standalone_course_enrollments
    (standalone_course_id, student_id, amount_paid, payment_status, payment_method, paid_at)
  VALUES (v_curso_a, v_al1, 1000, 'paid', 'efectivo', '2099-03-01T15:00:00Z')
  RETURNING id INTO v_pagada;
  INSERT INTO public.standalone_course_enrollments
    (standalone_course_id, student_id, amount_paid, payment_status, payment_method)
  VALUES (v_curso_a, v_al2, 0, 'pending', 'pendiente')
  RETURNING id INTO v_pend;

  INSERT INTO public.cash_closings (date, branch_id, status, closed)
  VALUES ('2099-03-01', 1, 'closed', true);

  BEGIN
    INSERT INTO public.standalone_course_enrollments
      (standalone_course_id, student_id, amount_paid, payment_status, payment_method, paid_at)
    VALUES (v_curso_a, v_al3, 1000, 'paid', 'efectivo', '2099-03-01T16:00:00Z');
    r := r || '1 inscribir pagando en caja cerrada: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '1 inscribir pagando en caja cerrada: ok | ';
  END;

  BEGIN
    UPDATE public.standalone_course_enrollments
       SET payment_status = 'paid', amount_paid = 1000, payment_method = 'transferencia',
           paid_at = '2099-03-01T17:00:00Z'
     WHERE id = v_pend;
    r := r || '2 marcar cobrado en caja cerrada: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '2 marcar cobrado en caja cerrada: ok | ';
  END;

  BEGIN
    UPDATE public.standalone_course_enrollments
       SET payment_status = 'pending', amount_paid = 0, paid_at = NULL
     WHERE id = v_pagada;
    r := r || '3 revertir cobro de caja cerrada: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '3 revertir cobro de caja cerrada: ok | ';
  END;

  BEGIN
    UPDATE public.standalone_course_enrollments SET payment_method = 'tarjeta' WHERE id = v_pagada;
    r := r || '4 cambiar medio de pago de caja cerrada: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '4 cambiar medio de pago de caja cerrada: ok | ';
  END;

  BEGIN
    DELETE FROM public.standalone_course_enrollments WHERE id = v_pagada;
    r := r || '5 borrar cobro de caja cerrada: FALLA | ';
  EXCEPTION WHEN raise_exception THEN r := r || '5 borrar cobro de caja cerrada: ok | ';
  END;

  -- Lo que NO mueve dinero sigue permitido aunque la caja esté cerrada.
  BEGIN
    INSERT INTO public.standalone_course_enrollments
      (standalone_course_id, student_id, amount_paid, payment_status, payment_method)
    VALUES (v_curso_a, v_al3, 0, 'pending', 'pendiente');
    r := r || '6 inscribir pendiente en caja cerrada: ok | ';
  EXCEPTION WHEN raise_exception THEN r := r || '6 inscribir pendiente en caja cerrada: FALLA | ';
  END;

  BEGIN
    UPDATE public.standalone_course_enrollments SET discount_reason = 'nota' WHERE id = v_pagada;
    r := r || '7 cambio sin dinero en cobro de caja cerrada: ok | ';
  EXCEPTION WHEN raise_exception THEN r := r || '7 cambio sin dinero en cobro de caja cerrada: FALLA | ';
  END;

  -- Otra sede, el mismo día: abierta.
  BEGIN
    INSERT INTO public.standalone_course_enrollments
      (standalone_course_id, student_id, amount_paid, payment_status, payment_method, paid_at)
    VALUES (v_curso_b, v_al1, 1000, 'paid', 'efectivo', '2099-03-01T15:00:00Z');
    r := r || '8 otra sede mismo día: ok | ';
  EXCEPTION WHEN raise_exception THEN r := r || '8 otra sede mismo día: FALLA | ';
  END;

  -- Un día sin cierre: cobrar la pendiente funciona.
  UPDATE public.standalone_course_enrollments
     SET payment_status = 'paid', amount_paid = 1000, payment_method = 'efectivo',
         paid_at = '2099-03-02T15:00:00Z'
   WHERE id = v_pend;
  GET DIAGNOSTICS n = ROW_COUNT;
  r := r || '9 cobrar en día abierto: ' || CASE WHEN n = 1 THEN 'ok' ELSE 'FALLA' END;

  RAISE EXCEPTION 'RESULT: %', r;
END
$test$;
