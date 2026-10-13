-- ============================================================================
-- fix-396-m — Dashboard ejecutivo: el costo de instructores del mes en curso se
-- descontaba dos veces.
--
-- exec_instructor_accrued_cost() valoriza un mes sin liquidar con
-- instructor_monthly_hours.total_equivalent, que son las horas ACUMULADAS A LA
-- FECHA, y además lo prorrateaba por (días del rango / días del mes completo).
-- Con "Este mes" (1 → hoy) el día 13 de 31, 10 horas a $5.000 daban $20.968 en
-- vez de $50.000: Gastos subestimado y Resultado inflado.
--
-- Regla nueva para un mes SIN liquidar: las horas a la fecha se reparten sobre
-- los días transcurridos del mes (1 → hoy, o el mes entero si ya terminó), y el
-- rango toma la parte que le corresponde hasta hoy. Un mes pasado se comporta
-- igual que antes. Un mes LIQUIDADO no cambia: su sueldo es del mes completo y
-- se prorratea por los días del mes que caen en el rango.
--
-- Idempotente: CREATE OR REPLACE. Misma firma, permisos y search_path.
-- ============================================================================

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
  v_today DATE := public.chile_today();
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
      -- Mes liquidado: sueldo del mes completo × días del mes dentro del rango.
      (LEAST(p_to, month_end) - GREATEST(p_from, month_start) + 1)::NUMERIC
        / (month_end - month_start + 1)::NUMERIC AS fraction_paid,
      -- Mes sin liquidar: horas a la fecha × días del rango ya transcurridos
      -- sobre los días transcurridos del mes. Un mes que aún no empieza da 0.
      CASE
        WHEN v_today < month_start THEN 0
        ELSE GREATEST(
               LEAST(p_to, month_end, v_today) - GREATEST(p_from, month_start) + 1,
               0
             )::NUMERIC
             / (LEAST(month_end, v_today) - month_start + 1)::NUMERIC
      END AS fraction_accrued
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
      CASE
        WHEN imp.base_salary IS NOT NULL
          THEN mo.fraction_paid * imp.base_salary::NUMERIC
        ELSE mo.fraction_accrued
               * COALESCE(imh.total_equivalent, 0)
               * COALESCE(bpc.amount_per_hour, 5000)
      END AS cost
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
