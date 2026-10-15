-- ============================================================================
-- fix-397-m — Dashboard ejecutivo: "Vehículos disponibles" dejaba fuera a los
-- vehículos con status = 'available'.
--
-- exec_dashboard_today_ops() contaba solo 'operational' e 'in_use', pero el
-- formulario de Flota guarda 'available'. Disponible pasa a ser todo vehículo
-- que no está en mantención, fuera de servicio ni bloqueado: la misma regla de
-- resolveVehicleStatus() que usan Flota y el dashboard de secretaria.
--
-- Idempotente: CREATE OR REPLACE. Misma firma, permisos y search_path. El resto
-- de la respuesta no cambia.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.exec_dashboard_today_ops(
  p_branch_id INT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today  DATE := public.chile_today();
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
      AND s.scheduled_at >= public.chile_day_start(v_today)
      AND s.scheduled_at <  public.chile_day_start(v_today + 1)
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
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(v.status, '')) NOT IN ('maintenance', 'out_of_service', 'blocked')
      )::INT AS disponibles,
      COUNT(*) FILTER (WHERE LOWER(v.status) = 'maintenance')::INT AS mantencion
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
