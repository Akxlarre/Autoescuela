-- fix-428-m: la cartera del ejecutivo cuenta a cada alumno con saldo una sola vez.
--
-- exec_dashboard_receivables contaba alumnos distintos DENTRO de cada tramo de antigüedad y el
-- cliente sumaba los tramos: un alumno con deuda en dos matrículas de tramos distintos contaba 2.
-- Ahora cada fila trae además `alumnos_total` (alumnos distintos en toda la cartera, el mismo
-- valor en las 4 filas), que el cliente usa en vez de la suma. El criterio de deuda no cambia
-- (toda matrícula Clase B con saldo salvo draft, cancelled y pending_payment, también egresados y
-- retirados) y es el mismo que usan ahora las alertas de los dashboards.
--
-- Cambia la firma de retorno (RETURNS TABLE): hay que borrar la función antes de recrearla.
-- Idempotente.

DROP FUNCTION IF EXISTS public.exec_dashboard_receivables(INT);

CREATE FUNCTION public.exec_dashboard_receivables(
  p_branch_id INT DEFAULT NULL
) RETURNS TABLE (bucket TEXT, monto BIGINT, alumnos INT, alumnos_total INT)
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
        (public.chile_today() - public.chile_date(e.created_at)) AS age_days
      FROM public.enrollments e
      WHERE e.license_group = 'class_b'
        AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
        -- pending_payment: su saldo es el precio completo de un checkout abandonado (fix-172-b).
        AND e.status NOT IN ('draft', 'cancelled', 'pending_payment')
        AND COALESCE(e.pending_balance, 0) > 0
    ) x
  ),
  total AS (
    SELECT COUNT(DISTINCT d.d_student_id)::INT AS t_alumnos FROM debt d
  )
  SELECT
    b.b_name::TEXT,
    COALESCE(SUM(d.d_balance), 0)::BIGINT,
    COUNT(DISTINCT d.d_student_id)::INT,
    (SELECT t.t_alumnos FROM total t)
  FROM buckets b
  LEFT JOIN debt d ON d.d_bucket = b.b_name
  GROUP BY b.b_name, b.b_ord
  ORDER BY b.b_ord;
END;
$$;

REVOKE ALL ON FUNCTION public.exec_dashboard_receivables(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_dashboard_receivables(INT) TO authenticated;
