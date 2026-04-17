-- Migration: 20260416000003_rpc_fix_payment_history_always.sql
--
-- Corrección: el historial de pagos no aparecía cuando el alumno ya no tenía
-- saldo pendiente, porque la versión anterior retornaba "hasPaymentPending: false"
-- antes de ejecutar la query de pagos.
--
-- Fix: buscar el enrollment sin filtrar por pending_balance/payment_status,
-- calcular hasPaymentPending como valor derivado, y siempre retornar payments.

CREATE OR REPLACE FUNCTION get_student_payment_status(p_supabase_uid TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_user_id         INT;
  v_student_id      INT;
  v_student_name    TEXT;
  v_enrollment      RECORD;
  v_branch_name     TEXT;
  v_course_name     TEXT;
  v_instructor_id   INT;
  v_instructor_name TEXT;
  v_session_count   INT;
  v_payments        JSONB;
  v_has_pending     BOOLEAN;
BEGIN
  -- ── 1. Usuario ─────────────────────────────────────────────────────────────
  SELECT id,
         TRIM(COALESCE(first_names, '') || ' ' || COALESCE(paternal_last_name, ''))
  INTO   v_user_id, v_student_name
  FROM   users
  WHERE  supabase_uid = p_supabase_uid::uuid
  LIMIT  1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Usuario no encontrado', 'status', 404);
  END IF;

  -- ── 2. Alumno ───────────────────────────────────────────────────────────────
  SELECT id INTO v_student_id
  FROM   students
  WHERE  user_id = v_user_id
  LIMIT  1;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Alumno no encontrado', 'status', 404);
  END IF;

  -- ── 3. Enrollment activo (partial) — sin filtrar por saldo pendiente ────────
  -- Se busca el enrollment más reciente para poder mostrar el historial de pagos
  -- incluso cuando el alumno ya está al día.
  SELECT e.id, e.number, e.branch_id, e.base_price,
         e.pending_balance, e.total_paid, e.payment_status,
         e.course_id
  INTO   v_enrollment
  FROM   enrollments e
  WHERE  e.student_id    = v_student_id
    AND  e.status        = 'active'
    AND  e.license_group = 'class_b'
    AND  e.payment_mode  = 'partial'
  ORDER  BY e.created_at DESC
  LIMIT  1;

  -- Sin enrollment de pago parcial → no hay historial relevante
  IF v_enrollment.id IS NULL THEN
    RETURN jsonb_build_object('hasPaymentPending', FALSE, 'payments', '[]'::JSONB);
  END IF;

  -- Determinar si hay deuda pendiente
  v_has_pending := (
    v_enrollment.pending_balance > 0
    AND v_enrollment.payment_status IN ('partial', 'pending')
  );

  -- ── 4. Datos auxiliares ──────────────────────────────────────────────────────

  -- Nombre de la sede
  SELECT name INTO v_branch_name
  FROM   branches
  WHERE  id = v_enrollment.branch_id
  LIMIT  1;

  -- Nombre del curso
  SELECT name INTO v_course_name
  FROM   courses
  WHERE  id = v_enrollment.course_id
  LIMIT  1;

  -- Instructor asignado (primera sesión no cancelada, más antigua)
  SELECT instructor_id INTO v_instructor_id
  FROM   class_b_sessions
  WHERE  enrollment_id = v_enrollment.id
    AND  status        <> 'cancelled'
  ORDER  BY created_at ASC
  LIMIT  1;

  -- Conteo de sesiones no canceladas
  SELECT COUNT(*) INTO v_session_count
  FROM   class_b_sessions
  WHERE  enrollment_id = v_enrollment.id
    AND  status        <> 'cancelled';

  -- Nombre del instructor (si existe)
  IF v_instructor_id IS NOT NULL THEN
    SELECT TRIM(COALESCE(u.first_names, '') || ' ' || COALESCE(u.paternal_last_name, ''))
    INTO   v_instructor_name
    FROM   instructors i
    JOIN   users u ON u.id = i.user_id
    WHERE  i.id = v_instructor_id
    LIMIT  1;
  END IF;

  -- ── 5. Historial de pagos (siempre se consulta) ─────────────────────────────
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',     p.id,
      'date',   p.payment_date,
      'amount', COALESCE(p.total_amount, 0)::NUMERIC,
      'type',   CASE
                  WHEN p.type = 'online'
                    OR COALESCE(p.card_amount, 0) > 0  THEN 'online'
                  WHEN COALESCE(p.transfer_amount, 0) > 0 THEN 'transfer'
                  ELSE 'cash'
                END,
      'status', COALESCE(p.status, 'paid')
    )
    ORDER BY p.payment_date DESC
  )
  INTO v_payments
  FROM payments p
  WHERE p.enrollment_id = v_enrollment.id;

  -- ── 6. Construir respuesta final ─────────────────────────────────────────────
  RETURN jsonb_build_object(
    'hasPaymentPending',    v_has_pending,
    'studentName',          v_student_name,
    'existingSessionCount', v_session_count,
    -- enrollment: solo se incluye cuando hay saldo pendiente (alimenta los KPIs del wizard)
    'enrollment', CASE WHEN v_has_pending THEN
      jsonb_build_object(
        'id',             v_enrollment.id,
        'number',         v_enrollment.number,
        'courseName',     v_course_name,
        'branchName',     v_branch_name,
        'branchId',       v_enrollment.branch_id,
        'basePrice',      COALESCE(v_enrollment.base_price, 0)::NUMERIC,
        'pendingBalance', COALESCE(v_enrollment.pending_balance, 0)::NUMERIC,
        'totalPaid',      COALESCE(v_enrollment.total_paid, 0)::NUMERIC
      )
    ELSE NULL END,
    'instructor', CASE
      WHEN v_instructor_id IS NOT NULL THEN
        jsonb_build_object(
          'id',   v_instructor_id,
          'name', v_instructor_name
        )
      ELSE NULL
    END,
    'payments', COALESCE(v_payments, '[]'::JSONB)
  );
END;
$$;

-- Mantener los mismos permisos
REVOKE ALL ON FUNCTION get_student_payment_status(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_student_payment_status(TEXT) FROM anon;
REVOKE ALL ON FUNCTION get_student_payment_status(TEXT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION get_student_payment_status(TEXT) TO service_role;
