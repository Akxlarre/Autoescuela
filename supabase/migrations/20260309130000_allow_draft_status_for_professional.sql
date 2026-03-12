-- Migración: Permitir status 'draft' para matrículas de Clase Profesional
-- El wizard de matrícula usa draft como estado intermedio antes de confirmar,
-- independiente del tipo de curso.

CREATE OR REPLACE FUNCTION trg_enrollment_validation_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT type INTO v_type FROM public.courses WHERE id = NEW.course_id;

  -- Clase B no puede tener promotion_course_id
  IF v_type = 'class_b' AND NEW.promotion_course_id IS NOT NULL THEN
    RAISE EXCEPTION 'Matrícula Clase B no puede tener promotion_course_id';
  END IF;

  -- Profesional debe ser presencial
  IF v_type = 'professional' AND NEW.registration_channel = 'online' THEN
    RAISE EXCEPTION 'Matrícula Profesional debe ser presencial (in_person)';
  END IF;

  -- SENCE debe ser presencial
  IF NEW.sence_code_id IS NOT NULL AND NEW.registration_channel = 'online' THEN
    RAISE EXCEPTION 'Matrícula SENCE debe ser presencial (in_person)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';
