-- ============================================================================
-- fix-460-m: certificate_enabled refleja la regla real (clases completadas ≥ las del curso)
-- ============================================================================
-- Antes: trg_enable_certificate_b (AFTER UPDATE OF status … WHEN status='completed' AND
-- class_number=12) prendía `enrollments.certificate_enabled` al completar la clase NÚMERO 12, sin
-- contar las demás, y nada lo apagaba. En dev, por sede, 70 matrículas tenían el flag y solo 8
-- cumplían (las otras con 1–9/12).
--
-- Regla (fix-262-m, spec 0006-m — la misma de generate-certificate-b-pdf y del botón "Generar"):
--   clases class_b_sessions con status='completed' ≥ round(courses.practical_hours * 60 / 45),
--   12 si el curso no tiene practical_hours.
--
-- Cambio:
--   1. recalc_class_b_certificate_enabled(enrollment_id): calcula la regla y escribe SOLO si el
--      valor cambia (no toca updated_at ni deja ruido en el audit log de enrollments).
--      SECURITY DEFINER + search_path='': es un campo derivado; quien cambia el estado de una clase
--      (instructor, secretaria) no necesita permiso de UPDATE sobre enrollments para mantenerlo.
--   2. verify_class_b_certificate_enablement() (función del trigger) la llama con la matrícula
--      afectada (OLD en DELETE, NEW en el resto; ambas si la clase cambió de matrícula).
--   3. trg_enable_certificate_b pasa a AFTER INSERT OR UPDATE OF status, enrollment_id OR DELETE,
--      sin WHEN: el flag sube y baja con cualquier cambio.
--   4. Backfill de todas las matrículas license_group='class_b'.
--
-- Lectores del flag: alerta "listos para certificar" (dashboard-alerts.facade.ts), dashboard
-- ejecutivo (executive_dashboard_rpcs) y portal del alumno (student-home.facade.ts).
--
-- Idempotente: CREATE OR REPLACE + DROP TRIGGER IF EXISTS; el backfill solo escribe diferencias.
-- Rollback: recrear la función de 20260412000001 y el trigger original de 20260301000008 (T7).
-- Verificación: supabase/tests/rls/fix-460-m-certificate-enabled.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalc_class_b_certificate_enabled(p_enrollment_id INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_required  INT;
  v_completed INT;
BEGIN
  SELECT COALESCE(NULLIF(ROUND(c.practical_hours * 60 / 45)::INT, 0), 12)
    INTO v_required
    FROM public.enrollments e
    JOIN public.courses c ON c.id = e.course_id
   WHERE e.id = p_enrollment_id
     AND e.license_group = 'class_b';

  IF NOT FOUND THEN
    RETURN; -- no es Clase B (o no existe): el flag no aplica
  END IF;

  SELECT COUNT(*) INTO v_completed
    FROM public.class_b_sessions s
   WHERE s.enrollment_id = p_enrollment_id
     AND s.status = 'completed';

  UPDATE public.enrollments
     SET certificate_enabled = (v_completed >= v_required),
         updated_at          = NOW()
   WHERE id = p_enrollment_id
     AND certificate_enabled IS DISTINCT FROM (v_completed >= v_required);
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_class_b_certificate_enabled(INT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_class_b_certificate_enablement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.recalc_class_b_certificate_enabled(OLD.enrollment_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE')
     AND (TG_OP = 'INSERT' OR NEW.enrollment_id IS DISTINCT FROM OLD.enrollment_id) THEN
    PERFORM public.recalc_class_b_certificate_enabled(NEW.enrollment_id);
  END IF;
  RETURN NULL; -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS trg_enable_certificate_b ON public.class_b_sessions;
CREATE TRIGGER trg_enable_certificate_b
  AFTER INSERT OR UPDATE OF status, enrollment_id OR DELETE ON public.class_b_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.verify_class_b_certificate_enablement();

-- Backfill: recalcula todas las matrículas Clase B (solo escribe las que difieren).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.enrollments WHERE license_group = 'class_b' LOOP
    PERFORM public.recalc_class_b_certificate_enabled(r.id);
  END LOOP;
END
$$;
