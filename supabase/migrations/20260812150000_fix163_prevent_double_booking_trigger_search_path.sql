-- Fix-163-m: el cron mark-end-of-day-class-b-absences fallaba desde fix-152 (20260811110000).
--
-- prevent_double_booking_class_b_sessions() (trigger agregado en fix-152) no declaraba su
-- propio search_path y referenciaba class_b_sessions sin calificar. Un trigger sin
-- SET search_path propio hereda el search_path de quien lo disparó — y
-- mark_end_of_day_class_b_absences() corre con SET search_path = '' (SECURITY DEFINER).
-- Su UPDATE public.class_b_sessions SET status='no_show' dispara el trigger, que hereda ese
-- search_path vacío, y "class_b_sessions" sin prefijo deja de resolver → 'relation
-- "class_b_sessions" does not exist', capturado por el EXCEPTION WHEN OTHERS de la función
-- (el cron "corre" pero nunca marca nada). Mismo patrón que 20260809100000_fix145 ya corrigió
-- en otra función dos días antes; no se replicó acá.

-- 1. Recrear el trigger function con search_path fijo y tabla calificada.
CREATE OR REPLACE FUNCTION public.prevent_double_booking_class_b_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'cancelled' OR NEW.scheduled_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.class_b_sessions cb
    WHERE cb.instructor_id = NEW.instructor_id
      AND cb.id <> NEW.id
      AND cb.status NOT IN ('cancelled')
      AND cb.scheduled_at IS NOT NULL
      AND NEW.scheduled_at < (cb.scheduled_at + (cb.duration_min * INTERVAL '1 minute'))
      AND cb.scheduled_at < (NEW.scheduled_at + (COALESCE(NEW.duration_min, 45) * INTERVAL '1 minute'))
  ) THEN
    RAISE EXCEPTION 'El instructor ya tiene una clase agendada que se solapa con este horario.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.prevent_double_booking_class_b_sessions() IS
  'Fix-152: bloquea doble-agendado del mismo instructor con horarios solapados en class_b_sessions. '
  'Fix-163: agrega SET search_path = '''' y califica public.class_b_sessions — sin esto, el trigger '
  'fallaba con "relation does not exist" cuando lo disparaba un UPDATE hecho dentro de una función '
  'SECURITY DEFINER con search_path vacío (mark_end_of_day_class_b_absences).';

-- El trigger ya apunta a esta función por nombre; CREATE OR REPLACE no requiere recrearlo.
