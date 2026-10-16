-- ============================================================================
-- fix-446-m — El ajuste "gasto olvidado" de un cierre pasado vuelve a funcionar
-- ============================================================================
-- Regresión de fix-445-m: guard_egreso_en_caja_cerrada() rechaza todo gasto con la fecha de un día
-- con caja cerrada, y el ajuste "Gasto olvidado" del Historial de Cuadraturas (spec 0002-i, AC2)
-- corrige justamente así: crea el gasto con la fecha del cierre. Además el gasto y el ajuste se
-- insertaban en dos llamadas desde el navegador; si fallaba la segunda, el gasto quedaba suelto.
--
--   1. RPC registrar_ajuste_cuadratura(): solo admin, solo sobre un cierre 'closed'. Crea el gasto
--      (fecha y sede del CIERRE, monto en positivo) y el ajuste enlazado en una sola transacción.
--   2. La RPC marca la transacción con app.ajuste_cuadratura = 'on' solo durante el INSERT del gasto;
--      guard_egreso_en_caja_cerrada() deja pasar ese INSERT y nada más. Un cliente no puede fijar
--      esa marca: PostgREST no expone set_config() (solo el esquema public).
--
-- La función del candado es copia de la de 20261016150000 (fix-445-m) + la excepción del ajuste.
-- Idempotente. Al aplicarla con la app en uso: SET lock_timeout = '5s' y reintentar (DG-107).
-- ============================================================================

-- 1. Candado de egresos con la excepción del ajuste -------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_egreso_en_caja_cerrada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_branch_old INT;
  v_branch_new INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- fix-446-m: el gasto de un ajuste "gasto olvidado" entra al día cerrado que corrige. Solo lo
  -- inserta registrar_ajuste_cuadratura(), que valida admin y cierre y marca la transacción.
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'expenses'
     AND current_setting('app.ajuste_cuadratura', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'expenses' THEN
    IF TG_OP = 'UPDATE'
       AND NEW.date           IS NOT DISTINCT FROM OLD.date
       AND NEW.amount         IS NOT DISTINCT FROM OLD.amount
       AND NEW.branch_id      IS NOT DISTINCT FROM OLD.branch_id
       AND NEW.payment_method IS NOT DISTINCT FROM OLD.payment_method
    THEN
      RETURN NEW;
    END IF;
    v_branch_new := NEW.branch_id;
    IF TG_OP = 'UPDATE' THEN
      v_branch_old := OLD.branch_id;
    END IF;
  ELSE -- instructor_advances
    IF TG_OP = 'UPDATE'
       AND NEW.date           IS NOT DISTINCT FROM OLD.date
       AND NEW.amount         IS NOT DISTINCT FROM OLD.amount
       AND NEW.instructor_id  IS NOT DISTINCT FROM OLD.instructor_id
       AND NEW.payment_method IS NOT DISTINCT FROM OLD.payment_method
    THEN
      RETURN NEW;
    END IF;
    SELECT u.branch_id INTO v_branch_new
    FROM public.instructors i
    JOIN public.users u ON u.id = i.user_id
    WHERE i.id = NEW.instructor_id;
    IF TG_OP = 'UPDATE' THEN
      SELECT u.branch_id INTO v_branch_old
      FROM public.instructors i
      JOIN public.users u ON u.id = i.user_id
      WHERE i.id = OLD.instructor_id;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND EXISTS (
    SELECT 1
    FROM public.cash_closings c
    WHERE c.date = OLD.date
      AND c.branch_id IS NOT DISTINCT FROM v_branch_old
      AND c.status = 'closed'
  ) THEN
    RAISE EXCEPTION 'CAJA_CERRADA' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cash_closings c
    WHERE c.date = NEW.date
      AND c.branch_id IS NOT DISTINCT FROM v_branch_new
      AND c.status = 'closed'
  ) THEN
    RAISE EXCEPTION 'CAJA_CERRADA' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_egreso_en_caja_cerrada() FROM PUBLIC, anon, authenticated;

-- 2. Registrar un ajuste sobre un cierre --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_ajuste_cuadratura(
  p_cuadratura_id INT,
  p_tipo          TEXT,
  p_monto         INT,
  p_motivo        TEXT,
  p_categoria     TEXT DEFAULT NULL,
  p_vehiculo_id   INT  DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fecha      DATE;
  v_branch     INT;
  v_status     TEXT;
  v_motivo     TEXT := btrim(COALESCE(p_motivo, ''));
  v_user       INT  := public.auth_user_id();
  v_expense_id INT;
  v_ajuste_id  INT;
BEGIN
  IF public.auth_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede registrar ajustes de caja.' USING ERRCODE = '42501';
  END IF;

  IF p_tipo NOT IN ('gasto_olvidado', 'correccion_manual') THEN
    RAISE EXCEPTION 'Tipo de ajuste inválido.' USING ERRCODE = 'P0001';
  END IF;
  IF p_monto IS NULL OR p_monto = 0 THEN
    RAISE EXCEPTION 'Indica el monto del ajuste.' USING ERRCODE = 'P0001';
  END IF;
  IF v_motivo = '' THEN
    RAISE EXCEPTION 'Indica el motivo del ajuste.' USING ERRCODE = 'P0001';
  END IF;

  SELECT c.date, c.branch_id, c.status INTO v_fecha, v_branch, v_status
  FROM public.cash_closings c
  WHERE c.id = p_cuadratura_id;
  IF NOT FOUND OR v_status IS DISTINCT FROM 'closed' THEN
    RAISE EXCEPTION 'Solo se pueden registrar ajustes sobre cuadraturas cerradas.' USING ERRCODE = 'P0001';
  END IF;

  -- Gasto olvidado: el gasto real con la fecha y la sede del CIERRE (spec 0002-i, AC2).
  IF p_tipo = 'gasto_olvidado' THEN
    PERFORM set_config('app.ajuste_cuadratura', 'on', true);
    INSERT INTO public.expenses (date, amount, description, category, vehicle_id, branch_id, registered_by)
    VALUES (v_fecha, abs(p_monto), v_motivo, p_categoria, p_vehiculo_id, v_branch, v_user)
    RETURNING id INTO v_expense_id;
    PERFORM set_config('app.ajuste_cuadratura', '', true);
  END IF;

  INSERT INTO public.cuadratura_adjustments (cuadratura_id, tipo, monto, motivo, expense_id, registered_by)
  VALUES (p_cuadratura_id, p_tipo, p_monto, v_motivo, v_expense_id, v_user)
  RETURNING id INTO v_ajuste_id;

  RETURN v_ajuste_id;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_ajuste_cuadratura(INT, TEXT, INT, TEXT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_ajuste_cuadratura(INT, TEXT, INT, TEXT, TEXT, INT) TO authenticated;
