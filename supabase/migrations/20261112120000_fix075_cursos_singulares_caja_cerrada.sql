-- ============================================================================
-- fix-075-i — Cursos singulares: un cobro no entra, cambia ni se borra en un día con caja cerrada
-- ============================================================================
-- Testing de Contabilidad (fix-073-i, D19/S17): payments, expenses, instructor_advances y
-- special_service_sales ya tenían candado de caja cerrada (fix-051-i, fix-445-m, fix-432-m);
-- standalone_course_enrollments no. Inscribir pagando $280.000 en efectivo después del cierre
-- funcionó, y la Caja Diaria quedó con más efectivo que el cierre congelado (DG-065).
--
-- Regla: si la caja de la sede del curso está 'closed' el día del cobro, se rechaza
--   · inscribir pagando, o marcar cobrada una inscripción, con un cobro de ese día,
--   · revertir, cambiar o borrar un cobro de ese día.
-- Día = chile_date(paid_at) y sede = standalone_courses.branch_id: lo mismo con que la Caja
-- suma el cobro. Inscribir con pago pendiente (sin plata) y los UPDATE que no tocan el cobro
-- (certificate_id, etc.) no se bloquean.
--
-- SECURITY DEFINER: la secretaria solo ve cierres de los últimos 2 días por RLS; sin esto el
-- chequeo no vería los más viejos. Función de trigger: no necesita GRANT EXECUTE (DG-104).
-- Mensaje en español con SQLSTATE P0001: ErrorSanitizerService lo muestra tal cual.
-- Idempotente. Aplicada a mano por Ignacio el 2026-11-12; este archivo la deja en el repo.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_cobro_curso_singular_caja_cerrada()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_branch_old INT;
  v_branch_new INT;
  v_mueve_dinero BOOLEAN;
BEGIN
  -- Un UPDATE que no toca el cobro (p. ej. certificate_id) no se bloquea.
  v_mueve_dinero := TG_OP <> 'UPDATE' OR (
    OLD.payment_status IS DISTINCT FROM NEW.payment_status
    OR OLD.amount_paid IS DISTINCT FROM NEW.amount_paid
    OR OLD.paid_at IS DISTINCT FROM NEW.paid_at
    OR OLD.payment_method IS DISTINCT FROM NEW.payment_method
  );
  IF NOT v_mueve_dinero THEN RETURN NEW; END IF;

  -- Cobro tal como estaba (revertir, cambiar o borrar uno de un día cerrado).
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.payment_status = 'paid' AND OLD.paid_at IS NOT NULL THEN
    SELECT sc.branch_id INTO v_branch_old FROM public.standalone_courses sc WHERE sc.id = OLD.standalone_course_id;
    IF EXISTS (SELECT 1 FROM public.cash_closings c
               WHERE c.date = public.chile_date(OLD.paid_at)
                 AND c.branch_id IS NOT DISTINCT FROM v_branch_old AND c.status = 'closed') THEN
      RAISE EXCEPTION 'La caja del % ya está cerrada: no se puede modificar un cobro de ese día.',
        to_char(public.chile_date(OLD.paid_at), 'DD-MM-YYYY') USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Cobro nuevo (inscribir pagando o marcar cobrado).
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.payment_status = 'paid' AND NEW.paid_at IS NOT NULL THEN
    SELECT sc.branch_id INTO v_branch_new FROM public.standalone_courses sc WHERE sc.id = NEW.standalone_course_id;
    IF EXISTS (SELECT 1 FROM public.cash_closings c
               WHERE c.date = public.chile_date(NEW.paid_at)
                 AND c.branch_id IS NOT DISTINCT FROM v_branch_new AND c.status = 'closed') THEN
      RAISE EXCEPTION 'La caja del % ya está cerrada: no se puede registrar un cobro con esa fecha.',
        to_char(public.chile_date(NEW.paid_at), 'DD-MM-YYYY') USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_cobro_curso_singular_caja_cerrada() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_standalone_course_enrollments_caja_cerrada ON public.standalone_course_enrollments;
CREATE TRIGGER trg_standalone_course_enrollments_caja_cerrada
  BEFORE INSERT OR UPDATE OR DELETE ON public.standalone_course_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.guard_cobro_curso_singular_caja_cerrada();
