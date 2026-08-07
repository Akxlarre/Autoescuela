-- Exclusion mutua: un instructor no puede tener 2+ class_b_sessions en_progress
-- al mismo tiempo. Cubre ambos puntos de entrada (InstructorClasesFacade y
-- AsistenciaClaseBFacade) porque corre a nivel de BD, no de cliente.
-- Spec 0001-i-ciclo-vida-clase-exclusion-cierre (AC1, AC-E1).

CREATE OR REPLACE FUNCTION prevent_concurrent_in_progress_class_b_sessions()
RETURNS TRIGGER AS $$
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_concurrent_in_progress ON class_b_sessions;

CREATE TRIGGER trg_prevent_concurrent_in_progress
  BEFORE UPDATE ON class_b_sessions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_concurrent_in_progress_class_b_sessions();
