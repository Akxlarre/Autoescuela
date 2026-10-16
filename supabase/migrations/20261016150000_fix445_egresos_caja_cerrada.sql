-- ============================================================================
-- fix-445-m — Un gasto o un anticipo no se registra ni se mueve a un día con caja cerrada
-- ============================================================================
-- El cierre de caja guarda totales congelados (DG-065). fix-044-i protegió los egresos de un día
-- cerrado solo contra el borrado (BEFORE DELETE) y fix-051-i agregó el candado de inserción solo
-- para payments. Un gasto o un anticipo se podía registrar con la fecha de un día cerrado (el
-- formulario de Anticipos deja elegir la fecha) o cambiar de monto/fecha después del cierre, y el
-- cierre dejaba de cuadrar.
--
-- guard_egreso_en_caja_cerrada(), BEFORE INSERT OR UPDATE en expenses e instructor_advances:
--   - INSERT: rechaza si el día y la sede del egreso tienen caja cerrada;
--   - UPDATE: solo si cambia una columna que mueve la caja (lección de fix-444-m): fecha, monto,
--     sede o instructor, medio de pago. Marcar anticipos como descontados/pendientes en
--     Liquidaciones (status, deducted_on) o editar la descripción sigue funcionando. Revisa el día
--     de antes y el de después.
--   - Sin sesión (service role, mantenimiento) no aplica, igual que guard_pago_en_caja_cerrada.
-- Sede: la del gasto; la de un anticipo es la del usuario del instructor (mismo criterio que
-- guard_movimiento_caja_cerrada). Token CAJA_CERRADA: toFriendlyDbMessage() ya lo traduce.
-- SECURITY DEFINER: la secretaria solo lee cierres de los últimos 2 días por RLS.
-- Función de trigger: no necesita GRANT EXECUTE (DG-104).
-- Idempotente. Al aplicarla con la app en uso: SET lock_timeout = '5s' y reintentar (DG-107).
-- ============================================================================

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

  -- Día y sede tal como estaban (UPDATE).
  IF TG_OP = 'UPDATE' AND EXISTS (
    SELECT 1
    FROM public.cash_closings c
    WHERE c.date = OLD.date
      AND c.branch_id IS NOT DISTINCT FROM v_branch_old
      AND c.status = 'closed'
  ) THEN
    RAISE EXCEPTION 'CAJA_CERRADA' USING ERRCODE = 'P0001';
  END IF;

  -- Día y sede nuevos (INSERT, UPDATE).
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

DROP TRIGGER IF EXISTS trg_expenses_insert_update_caja_cerrada ON public.expenses;
CREATE TRIGGER trg_expenses_insert_update_caja_cerrada
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.guard_egreso_en_caja_cerrada();

DROP TRIGGER IF EXISTS trg_instructor_advances_insert_update_caja_cerrada ON public.instructor_advances;
CREATE TRIGGER trg_instructor_advances_insert_update_caja_cerrada
  BEFORE INSERT OR UPDATE ON public.instructor_advances
  FOR EACH ROW EXECUTE FUNCTION public.guard_egreso_en_caja_cerrada();
