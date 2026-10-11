-- ============================================================================
-- fix-376-m — Un vehículo no puede estar en dos clases Clase B en curso
-- ============================================================================
-- prevent_concurrent_in_progress_class_b_sessions() (spec 0001-i) solo impedía dos clases en
-- curso del mismo instructor. Una clase que quedó 'in_progress' sin finalizar dejaba iniciar otra
-- con el mismo vehículo. Se agrega el chequeo por vehículo (NEW.vehicle_id: cubre también el
-- cambio de vehículo en el mismo UPDATE que inicia la clase). Mensaje con la fecha y hora de la
-- clase que lo ocupa, en hora de Chile. Idempotente (CREATE OR REPLACE; el trigger no cambia).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_concurrent_in_progress_class_b_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_busy_at timestamptz;
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    IF EXISTS (
      SELECT 1 FROM class_b_sessions
      WHERE instructor_id = NEW.instructor_id
        AND status = 'in_progress'
        AND id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'El instructor ya tiene una clase en curso. Debe cerrarla antes de iniciar otra.'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT scheduled_at INTO v_busy_at
    FROM class_b_sessions
    WHERE vehicle_id = NEW.vehicle_id
      AND status = 'in_progress'
      AND id <> NEW.id
    ORDER BY scheduled_at
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'El vehículo está en una clase en curso (%); finalízala antes.',
        to_char(v_busy_at AT TIME ZONE 'America/Santiago', 'DD-MM, HH24:MI')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
