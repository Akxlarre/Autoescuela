-- ============================================================================
-- fix-371-m — Una inasistencia Clase B solo se registra cuando la hora de la clase ya pasó
-- ============================================================================
-- "Ausente solo después de la hora" existía solo en la pantalla. Una llamada directa (o un reloj
-- de PC adelantado) marcaba ausente una clase futura y, con la cancelación automática activa,
-- disparaba la penalización (RF-053). El cron nocturno también marcaba no_show las clases de hoy
-- posteriores a su hora de ejecución.
--
-- Dos triggers BEFORE. 'excused' (justificar) no se valida. Idempotente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_early_class_b_no_show()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'no_show'
     AND NEW.scheduled_at IS NOT NULL
     AND NEW.scheduled_at > now() THEN
    RAISE EXCEPTION 'No se puede registrar la inasistencia: la clase todavía no empieza.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_early_class_b_no_show ON public.class_b_sessions;
CREATE TRIGGER trg_prevent_early_class_b_no_show
  BEFORE INSERT OR UPDATE OF status, scheduled_at ON public.class_b_sessions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_early_class_b_no_show();


CREATE OR REPLACE FUNCTION public.prevent_early_class_b_absence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  -- lee la hora de la sesión aunque la RLS de quien escribe no la muestre
SET search_path = ''
AS $$
DECLARE
  v_scheduled_at timestamptz;
BEGIN
  IF NEW.status IN ('absent', 'no_show') THEN
    SELECT cs.scheduled_at INTO v_scheduled_at
    FROM public.class_b_sessions cs
    WHERE cs.id = NEW.class_b_session_id;

    IF v_scheduled_at IS NOT NULL AND v_scheduled_at > now() THEN
      RAISE EXCEPTION 'No se puede registrar la inasistencia: la clase todavía no empieza.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_early_class_b_absence() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_early_class_b_absence ON public.class_b_practice_attendance;
CREATE TRIGGER trg_prevent_early_class_b_absence
  BEFORE INSERT OR UPDATE OF status ON public.class_b_practice_attendance
  FOR EACH ROW EXECUTE FUNCTION public.prevent_early_class_b_absence();
