-- Migration: 20260416000001_rpc_get_student_payment_status.sql
--
-- Propósito: Optimización de rendimiento para la acción load-enrollment-status
-- de la edge function student-payment.
--
-- Antes: 5 round-trips secuenciales (user → student → enrollment → parallel[4] → instructor)
-- Después: 1 sola llamada RPC que ejecuta todo en una transacción PostgreSQL.
--
-- SECURITY DEFINER: necesario porque la edge function usa service_role y necesita
-- acceder a datos del alumno sin que el alumno tenga policies directas sobre
-- instructors/vehicles. El JWT del alumno ya fue validado antes de llamar la RPC.

CREATE OR REPLACE FUNCTION get_student_payment_status(p_supabase_uid TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_user_id        INT;
  v_student_id     INT;
  v_student_name   TEXT;
  v_enrollment     RECORD;
  v_branch_name    TEXT;
  v_course_name    TEXT;
  v_instructor_id  INT;
  v_instructor_name TEXT;
  v_session_count  INT;
  v_payments       JSONB;
  v_payment_row    RECORD;
  v_dominant_type  TEXT;
  v_result         JSONB;
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

  -- ── 3. Enrollment activo con saldo pendiente ────────────────────────────────
  SELECT e.id, e.number, e.branch_id, e.base_price,
         e.pending_balance, e.total_paid, e.payment_status,
         e.course_id
  INTO   v_enrollment
  FROM   enrollments e
  WHERE  e.student_id    = v_student_id
    AND  e.status        = 'active'
    AND  e.license_group = 'class_b'
    AND  e.payment_mode  = 'partial'
    AND  e.payment_status IN ('partial', 'pending')
    AND  e.pending_balance > 0
  LIMIT  1;

  -- Sin deuda pendiente → respuesta rápida
  IF v_enrollment.id IS NULL THEN
    RETURN jsonb_build_object('hasPaymentPending', FALSE);
  END IF;

  -- ── 4. Datos auxiliares en paralelo (en PostgreSQL todo corre en un plan) ───

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

  -- ── 5. Historial de pagos ───────────────────────────────────────────────────
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

  -- ── 6. Construir respuesta final ────────────────────────────────────────────
  RETURN jsonb_build_object(
    'hasPaymentPending', TRUE,
    'studentName',       v_student_name,
    'existingSessionCount', v_session_count,
    'enrollment', jsonb_build_object(
      'id',             v_enrollment.id,
      'number',         v_enrollment.number,
      'courseName',     v_course_name,
      'branchName',     v_branch_name,
      'branchId',       v_enrollment.branch_id,
      'basePrice',      COALESCE(v_enrollment.base_price, 0)::NUMERIC,
      'pendingBalance', COALESCE(v_enrollment.pending_balance, 0)::NUMERIC,
      'totalPaid',      COALESCE(v_enrollment.total_paid, 0)::NUMERIC
    ),
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

-- Revocar acceso público y permitir solo service_role (llamado desde Edge Function)
REVOKE ALL ON FUNCTION get_student_payment_status(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_student_payment_status(TEXT) FROM anon;
REVOKE ALL ON FUNCTION get_student_payment_status(TEXT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION get_student_payment_status(TEXT) TO service_role;
