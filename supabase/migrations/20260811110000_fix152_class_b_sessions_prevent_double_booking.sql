-- Fix 152-m: doble-agendado del mismo instructor sin constraint atómica en BD.
-- Hoy la única protección es v_class_b_schedule_availability filtrando slots
-- ocupados AL LEER — dos secretarias agendando casi simultáneo pueden generar
-- dos class_b_sessions activas con el mismo instructor en horarios solapados.
-- Replica el patrón de trg_prevent_concurrent_in_progress (exclusión mutua de
-- 'in_progress') pero a nivel de solape de horario para cualquier status activo
-- ('cancelled' es el único status que la vista de disponibilidad excluye, ver
-- 20260307130000_fix_schedule_availability_tz_and_constraints.sql:111).

CREATE OR REPLACE FUNCTION prevent_double_booking_class_b_sessions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' OR NEW.scheduled_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM class_b_sessions cb
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_double_booking ON class_b_sessions;

CREATE TRIGGER trg_prevent_double_booking
  BEFORE INSERT OR UPDATE OF instructor_id, scheduled_at, duration_min, status
  ON class_b_sessions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_double_booking_class_b_sessions();
