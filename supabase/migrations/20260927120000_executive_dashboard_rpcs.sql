-- ============================================================================
-- Spec 0044-b — Dashboard Ejecutivo de Admin (fase 1: Clase B)
--
-- Funciones de agregación de solo lectura para /admin/dashboard. Devuelven los
-- números ya calculados para un rango de fechas y una sede, para no traer filas
-- crudas al cliente (decisión D3 de la spec).
--
-- Convenciones comunes a todas las funciones:
--   * Solo admin: la primera sentencia llama a exec_dashboard_assert_admin().
--   * SECURITY INVOKER: las tablas base mantienen su RLS (admin ve todo).
--   * p_branch_id NULL = "Todas las escuelas" (sin filtro de sede).
--   * Rangos p_from/p_to son fechas LOCALES de Chile, inclusivas. Toda columna
--     timestamptz se convierte con AT TIME ZONE 'America/Santiago' antes de
--     compararla (DG-071).
--   * Alcance Clase B = enrollments.license_group = 'class_b' (AC-E5).
--   * Ingresos = payments.status IN ('paid','completado') (D5). 'pending' es un
--     placeholder de deuda con $0 recibido (DG-056) y NO cuenta.
--
-- Idempotente: CREATE OR REPLACE en todas las funciones.
-- ============================================================================


-- ── 0. Guard de rol ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.exec_dashboard_assert_admin()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden: executive dashboard is admin-only'
      USING ERRCODE = '42501';
  END IF;
END;
$$;


-- ── 1. Costo devengado de instructores (D2) ─────────────────────────────────
-- Por cada mes 'YYYY-MM' tocado por el rango y cada instructor de la sede:
--   * mes liquidado    → instructor_monthly_payments.base_salary (valor congelado)
--   * mes no liquidado → instructor_monthly_hours.total_equivalent × tarifa por
--                        hora de la sede (branch_payroll_config; fallback 5000,
--                        igual que PAYROLL_RATE_FALLBACK en el frontend)
-- Sede del instructor = users.branch_id (mismo criterio que Liquidaciones).
-- El costo del mes se prorratea por los días del mes que caen dentro del rango.
-- Riesgo aceptado (R1): meses pasados no liquidados usan la tarifa ACTUAL.

CREATE OR REPLACE FUNCTION public.exec_instructor_accrued_cost(
  p_from      DATE,
  p_to        DATE,
  p_branch_id INT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total NUMERIC := 0;
BEGIN
  PERFORM public.exec_dashboard_assert_admin();

  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RETURN 0;
  END IF;

  WITH months AS (
    SELECT
      m::date                                            AS month_start,
      (m + INTERVAL '1 month' - INTERVAL '1 day')::date  AS month_end,
      TO_CHAR(m, 'YYYY-MM')                              AS period
    FROM generate_series(
      date_trunc('month', p_from::timestamp),
      date_trunc('month', p_to::timestamp),
      INTERVAL '1 month'
    ) AS m
  ),
  months_overlap AS (
    SELECT
      period,
      (LEAST(p_to, month_end) - GREATEST(p_from, month_start) + 1)::NUMERIC
        / (month_end - month_start + 1)::NUMERIC AS fraction
    FROM months
  ),
  instructor_months AS (
    -- Todo instructor-mes con horas registradas o con liquidación pagada.
    SELECT instructor_id, period FROM public.instructor_monthly_hours
    UNION
    SELECT instructor_id, period FROM public.instructor_monthly_payments
  ),
  costs AS (
    SELECT
      mo.fraction
        * COALESCE(
            imp.base_salary::NUMERIC,
            COALESCE(imh.total_equivalent, 0)
              * COALESCE(bpc.amount_per_hour, 5000)
          ) AS cost
    FROM months_overlap mo
    JOIN instructor_months im ON im.period = mo.period
    JOIN public.instructors i ON i.id = im.instructor_id
    JOIN public.users u ON u.id = i.user_id
    LEFT JOIN public.instructor_monthly_payments imp
      ON imp.instructor_id = im.instructor_id AND imp.period = im.period
    LEFT JOIN public.instructor_monthly_hours imh
      ON imh.instructor_id = im.instructor_id AND imh.period = im.period
    LEFT JOIN public.branch_payroll_config bpc
      ON bpc.branch_id = u.branch_id
    WHERE p_branch_id IS NULL OR u.branch_id = p_branch_id
  )
  SELECT COALESCE(SUM(cost), 0) INTO v_total FROM costs;

  RETURN ROUND(v_total)::BIGINT;
END;
$$;


-- ── 2. KPIs de un rango ──────────────────────────────────────────────────────
-- El Facade la llama 3 veces: rango actual, período anterior de igual largo y
-- mismo rango del año anterior. Los Δ% se calculan en el frontend (funciones
-- puras testeadas), no acá.

CREATE OR REPLACE FUNCTION public.exec_dashboard_kpis(
  p_from      DATE,
  p_to        DATE,
  p_branch_id INT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM public.exec_dashboard_assert_admin();

  WITH
  b_enrollments AS (
    SELECT e.*
    FROM public.enrollments e
    WHERE e.license_group = 'class_b'
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
  ),
  ingresos AS (
    SELECT COALESCE(SUM(p.total_amount), 0)::BIGINT AS total
    FROM public.payments p
    JOIN b_enrollments e ON e.id = p.enrollment_id
    WHERE p.status IN ('paid', 'completado')
      AND p.payment_date BETWEEN p_from AND p_to
  ),
  gastos_variables AS (
    SELECT COALESCE(SUM(x.amount), 0)::BIGINT AS total
    FROM public.expenses x
    WHERE x.date BETWEEN p_from AND p_to
      AND (p_branch_id IS NULL OR x.branch_id = p_branch_id)
  ),
  gastos_fijos AS (
    SELECT COALESCE(SUM(f.amount), 0)::BIGINT AS total
    FROM public.fixed_expenses f
    WHERE f.date BETWEEN p_from AND p_to
      AND (p_branch_id IS NULL OR f.branch_id = p_branch_id)
  ),
  matriculas AS (
    SELECT COUNT(*)::INT AS nuevas
    FROM b_enrollments e
    WHERE (e.created_at AT TIME ZONE 'America/Santiago')::date BETWEEN p_from AND p_to
      AND e.status NOT IN ('draft', 'cancelled')
  ),
  sesiones AS (
    SELECT
      COUNT(*) FILTER (
        WHERE s.status = 'completed'
          AND (COALESCE(s.completed_at, s.scheduled_at) AT TIME ZONE 'America/Santiago')::date
              BETWEEN p_from AND p_to
      )::INT AS realizadas,
      -- En agenda: futuras (desde ahora) y dentro del rango. 'reserved' excluido:
      -- son reservas de matrículas en borrador (DG-050).
      COUNT(*) FILTER (
        WHERE s.status = 'scheduled'
          AND s.scheduled_at >= NOW()
          AND (s.scheduled_at AT TIME ZONE 'America/Santiago')::date <= p_to
      )::INT AS en_agenda,
      COUNT(*) FILTER (
        WHERE s.status = 'cancelled'
          AND (COALESCE(s.cancelled_at, s.scheduled_at) AT TIME ZONE 'America/Santiago')::date
              BETWEEN p_from AND p_to
      )::INT AS canceladas
    FROM public.class_b_sessions s
    JOIN b_enrollments e ON e.id = s.enrollment_id
  ),
  inasistencias AS (
    -- Una inasistencia es una fila de asistencia 'absent' (la marca el cron de
    -- fin de día). Se cuentan también las archivadas: son faltas reales que
    -- ocurrieron antes de reagendar la sesión (DG-075). Se fechan por recorded_at.
    SELECT COUNT(*)::INT AS total
    FROM public.class_b_practice_attendance a
    JOIN public.class_b_sessions s ON s.id = a.class_b_session_id
    JOIN b_enrollments e ON e.id = s.enrollment_id
    WHERE a.status = 'absent'
      AND (a.recorded_at AT TIME ZONE 'America/Santiago')::date BETWEEN p_from AND p_to
  ),
  ensayos AS (
    SELECT
      COUNT(*)::INT                                 AS total,
      COUNT(*) FILTER (WHERE x.passed IS TRUE)::INT AS aprobados
    FROM public.class_b_exam_scores x
    JOIN b_enrollments e ON e.id = x.enrollment_id
    WHERE x.date BETWEEN p_from AND p_to
  ),
  etapas AS (
    -- Foto del momento (no dependen del rango), salvo "nuevos" que es AC7.
    SELECT
      COUNT(*) FILTER (WHERE e.status = 'active')::INT AS activos,
      COUNT(*) FILTER (WHERE e.status = 'active' AND e.certificate_enabled IS NOT TRUE)::INT
        AS en_curso,
      COUNT(*) FILTER (WHERE e.status = 'active' AND e.certificate_enabled IS TRUE)::INT
        AS pendiente_examen,
      COUNT(*) FILTER (WHERE e.status = 'completed')::INT AS finalizados
    FROM b_enrollments e
  )
  SELECT jsonb_build_object(
    'ingresos',               (SELECT total FROM ingresos),
    'gastos_variables',       (SELECT total FROM gastos_variables),
    'gastos_fijos',           (SELECT total FROM gastos_fijos),
    'costo_instructores',     public.exec_instructor_accrued_cost(p_from, p_to, p_branch_id),
    'nuevas_matriculas',      (SELECT nuevas FROM matriculas),
    'alumnos_activos',        (SELECT activos FROM etapas),
    'clases_realizadas',      (SELECT realizadas FROM sesiones),
    'clases_en_agenda',       (SELECT en_agenda FROM sesiones),
    'clases_canceladas',      (SELECT canceladas FROM sesiones),
    'inasistencias',          (SELECT total FROM inasistencias),
    'ensayos_total',          (SELECT total FROM ensayos),
    'ensayos_aprobados',      (SELECT aprobados FROM ensayos),
    'etapa_en_curso',         (SELECT en_curso FROM etapas),
    'etapa_pendiente_examen', (SELECT pendiente_examen FROM etapas),
    'etapa_finalizados',      (SELECT finalizados FROM etapas)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- ── 3. Series mensuales: año p_year y p_year-1 (AC13/AC14) ──────────────────
-- Siempre 24 filas (meses sin movimiento en 0), con las mismas definiciones de
-- ingresos y nuevas matrículas que exec_dashboard_kpis.

CREATE OR REPLACE FUNCTION public.exec_dashboard_monthly_series(
  p_year      INT,
  p_branch_id INT DEFAULT NULL
) RETURNS TABLE (year INT, month INT, ingresos BIGINT, matriculas INT)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.exec_dashboard_assert_admin();

  RETURN QUERY
  WITH
  grid AS (
    SELECT y::INT AS g_year, m::INT AS g_month
    FROM generate_series(p_year - 1, p_year) AS y,
         generate_series(1, 12) AS m
  ),
  b_enrollments AS (
    SELECT e.id, e.created_at, e.status
    FROM public.enrollments e
    WHERE e.license_group = 'class_b'
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
  ),
  pay AS (
    SELECT
      EXTRACT(YEAR FROM p.payment_date)::INT  AS p_y,
      EXTRACT(MONTH FROM p.payment_date)::INT AS p_m,
      SUM(p.total_amount)::BIGINT             AS total
    FROM public.payments p
    JOIN b_enrollments e ON e.id = p.enrollment_id
    WHERE p.status IN ('paid', 'completado')
      AND p.payment_date >= make_date(p_year - 1, 1, 1)
      AND p.payment_date <  make_date(p_year + 1, 1, 1)
    GROUP BY 1, 2
  ),
  enr AS (
    SELECT
      EXTRACT(YEAR FROM (e.created_at AT TIME ZONE 'America/Santiago'))::INT  AS e_y,
      EXTRACT(MONTH FROM (e.created_at AT TIME ZONE 'America/Santiago'))::INT AS e_m,
      COUNT(*)::INT AS total
    FROM b_enrollments e
    WHERE e.status NOT IN ('draft', 'cancelled')
      AND (e.created_at AT TIME ZONE 'America/Santiago')::date >= make_date(p_year - 1, 1, 1)
      AND (e.created_at AT TIME ZONE 'America/Santiago')::date <  make_date(p_year + 1, 1, 1)
    GROUP BY 1, 2
  )
  SELECT g.g_year, g.g_month, COALESCE(pay.total, 0)::BIGINT, COALESCE(enr.total, 0)::INT
  FROM grid g
  LEFT JOIN pay ON pay.p_y = g.g_year AND pay.p_m = g.g_month
  LEFT JOIN enr ON enr.e_y = g.g_year AND enr.e_m = g.g_month
  ORDER BY g.g_year, g.g_month;
END;
$$;


-- ── 4. Horas por instructor (AC16) ───────────────────────────────────────────
-- Instructores activos de la sede (incluye los que trabajan en ambas sedes) con
-- sus clases Clase B completadas en el rango. Los que tienen 0 también aparecen.

CREATE OR REPLACE FUNCTION public.exec_dashboard_instructor_hours(
  p_from      DATE,
  p_to        DATE,
  p_branch_id INT DEFAULT NULL
) RETURNS TABLE (instructor_id INT, nombre TEXT, clases INT, minutos INT)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.exec_dashboard_assert_admin();

  RETURN QUERY
  WITH
  done AS (
    SELECT
      s.instructor_id                                     AS d_instructor_id,
      COUNT(*)::INT                                       AS d_clases,
      COALESCE(SUM(COALESCE(s.duration_min, 45)), 0)::INT AS d_minutos
    FROM public.class_b_sessions s
    JOIN public.enrollments e ON e.id = s.enrollment_id
    WHERE e.license_group = 'class_b'
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
      AND s.status = 'completed'
      AND (COALESCE(s.completed_at, s.scheduled_at) AT TIME ZONE 'America/Santiago')::date
          BETWEEN p_from AND p_to
    GROUP BY s.instructor_id
  ),
  roster AS (
    SELECT i.id AS r_id
    FROM public.instructors i
    JOIN public.users u ON u.id = i.user_id
    WHERE i.active IS TRUE
      AND (p_branch_id IS NULL OR u.branch_id = p_branch_id OR i.both_branches IS TRUE)
    UNION
    SELECT d.d_instructor_id FROM done d
  )
  SELECT
    r.r_id::INT,
    TRIM(CONCAT_WS(' ', u.first_names, u.paternal_last_name))::TEXT,
    COALESCE(d.d_clases, 0)::INT,
    COALESCE(d.d_minutos, 0)::INT
  FROM roster r
  JOIN public.instructors i ON i.id = r.r_id
  JOIN public.users u ON u.id = i.user_id
  LEFT JOIN done d ON d.d_instructor_id = r.r_id
  ORDER BY COALESCE(d.d_minutos, 0) DESC, 2 ASC;
END;
$$;


-- ── 5. Cartera por cobrar por antigüedad (AC6) ──────────────────────────────
-- Foto del momento. Antigüedad = días desde la creación de la matrícula.
-- Siempre devuelve los 4 buckets, aunque estén en 0.

CREATE OR REPLACE FUNCTION public.exec_dashboard_receivables(
  p_branch_id INT DEFAULT NULL
) RETURNS TABLE (bucket TEXT, monto BIGINT, alumnos INT)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.exec_dashboard_assert_admin();

  RETURN QUERY
  WITH
  buckets(b_name, b_ord) AS (
    VALUES ('0-30', 1), ('31-60', 2), ('61-90', 3), ('90+', 4)
  ),
  debt AS (
    SELECT
      x.student_id      AS d_student_id,
      x.pending_balance AS d_balance,
      CASE
        WHEN x.age_days <= 30 THEN '0-30'
        WHEN x.age_days <= 60 THEN '31-60'
        WHEN x.age_days <= 90 THEN '61-90'
        ELSE '90+'
      END AS d_bucket
    FROM (
      SELECT
        e.student_id,
        e.pending_balance,
        ((NOW() AT TIME ZONE 'America/Santiago')::date
          - (e.created_at AT TIME ZONE 'America/Santiago')::date) AS age_days
      FROM public.enrollments e
      WHERE e.license_group = 'class_b'
        AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
        AND e.status NOT IN ('draft', 'cancelled')
        AND COALESCE(e.pending_balance, 0) > 0
    ) x
  )
  SELECT
    b.b_name::TEXT,
    COALESCE(SUM(d.d_balance), 0)::BIGINT,
    COUNT(DISTINCT d.d_student_id)::INT
  FROM buckets b
  LEFT JOIN debt d ON d.d_bucket = b.b_name
  GROUP BY b.b_name, b.b_ord
  ORDER BY b.b_ord;
END;
$$;


-- ── 6. Operación de hoy (AC19) ──────────────────────────────────────────────
-- Independiente del filtro de período. "Hoy" = fecha local de Chile.
-- Vehículos: el dominio real de vehicles.status es
-- 'operational' | 'in_use' | 'maintenance' | 'out_of_service' | 'blocked' (DG-003).

CREATE OR REPLACE FUNCTION public.exec_dashboard_today_ops(
  p_branch_id INT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today  DATE := (NOW() AT TIME ZONE 'America/Santiago')::date;
  v_result JSONB;
BEGIN
  PERFORM public.exec_dashboard_assert_admin();

  WITH
  today_sessions AS (
    SELECT s.status
    FROM public.class_b_sessions s
    JOIN public.enrollments e ON e.id = s.enrollment_id
    WHERE e.license_group = 'class_b'
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
      AND (s.scheduled_at AT TIME ZONE 'America/Santiago')::date = v_today
      AND s.status <> 'reserved'
  ),
  instr AS (
    SELECT COUNT(*)::INT AS activos
    FROM public.instructors i
    JOIN public.users u ON u.id = i.user_id
    WHERE i.active IS TRUE
      AND (p_branch_id IS NULL OR u.branch_id = p_branch_id OR i.both_branches IS TRUE)
  ),
  fleet AS (
    SELECT
      COUNT(*) FILTER (WHERE v.status IN ('operational', 'in_use'))::INT AS disponibles,
      COUNT(*) FILTER (WHERE v.status = 'maintenance')::INT             AS mantencion
    FROM public.vehicles v
    WHERE p_branch_id IS NULL OR v.branch_id = p_branch_id OR v.both_branches IS TRUE
  )
  SELECT jsonb_build_object(
    'clases_programadas',    (SELECT COUNT(*) FROM today_sessions WHERE status NOT IN ('cancelled', 'no_show')),
    'clases_realizadas',     (SELECT COUNT(*) FROM today_sessions WHERE status = 'completed'),
    'clases_canceladas',     (SELECT COUNT(*) FROM today_sessions WHERE status IN ('cancelled', 'no_show')),
    'instructores_activos',  (SELECT activos FROM instr),
    'vehiculos_disponibles', (SELECT disponibles FROM fleet),
    'vehiculos_mantencion',  (SELECT mantencion FROM fleet)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- ── Permisos ────────────────────────────────────────────────────────────────
-- EXECUTE para authenticated; el guard de rol dentro de cada función rechaza a
-- todo lo que no sea admin. anon no puede ejecutarlas.

REVOKE ALL ON FUNCTION public.exec_dashboard_assert_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_instructor_accrued_cost(DATE, DATE, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_dashboard_kpis(DATE, DATE, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_dashboard_monthly_series(INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_dashboard_instructor_hours(DATE, DATE, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_dashboard_receivables(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_dashboard_today_ops(INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.exec_dashboard_assert_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_instructor_accrued_cost(DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_dashboard_kpis(DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_dashboard_monthly_series(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_dashboard_instructor_hours(DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_dashboard_receivables(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_dashboard_today_ops(INT) TO authenticated;
