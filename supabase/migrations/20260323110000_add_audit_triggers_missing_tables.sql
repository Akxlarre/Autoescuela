-- ============================================================================
-- Ampliar cobertura de auditoría a tablas donde secretarias operan
-- frecuentemente pero carecían de trigger log_change() (RF-009)
-- ============================================================================
-- Tablas cubiertas previamente:
--   enrollments, payments, users, class_b_sessions,
--   class_b_theory_sessions, promotion_courses,
--   professional_theory_sessions, professional_practice_sessions,
--   professional_module_grades, class_book
--
-- Tablas nuevas (idempotente via DROP IF EXISTS + CREATE):
--   students              → módulo Alumnos
--   student_documents     → módulo Alumnos
--   certificates          → módulo Certificación
--   vehicles              → módulo Flota
--   vehicle_documents     → módulo Flota
--   maintenance_records   → módulo Flota
-- ============================================================================

-- Módulo: Alumnos
DROP TRIGGER IF EXISTS trg_audit_students ON students;
CREATE TRIGGER trg_audit_students
  AFTER INSERT OR UPDATE OR DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION log_change();

DROP TRIGGER IF EXISTS trg_audit_student_documents ON student_documents;
CREATE TRIGGER trg_audit_student_documents
  AFTER INSERT OR UPDATE OR DELETE ON student_documents
  FOR EACH ROW EXECUTE FUNCTION log_change();

-- Módulo: Certificación
DROP TRIGGER IF EXISTS trg_audit_certificates ON certificates;
CREATE TRIGGER trg_audit_certificates
  AFTER INSERT OR UPDATE OR DELETE ON certificates
  FOR EACH ROW EXECUTE FUNCTION log_change();

-- Módulo: Flota
DROP TRIGGER IF EXISTS trg_audit_vehicles ON vehicles;
CREATE TRIGGER trg_audit_vehicles
  AFTER INSERT OR UPDATE OR DELETE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION log_change();

DROP TRIGGER IF EXISTS trg_audit_vehicle_documents ON vehicle_documents;
CREATE TRIGGER trg_audit_vehicle_documents
  AFTER INSERT OR UPDATE OR DELETE ON vehicle_documents
  FOR EACH ROW EXECUTE FUNCTION log_change();

DROP TRIGGER IF EXISTS trg_audit_maintenance_records ON maintenance_records;
CREATE TRIGGER trg_audit_maintenance_records
  AFTER INSERT OR UPDATE OR DELETE ON maintenance_records
  FOR EACH ROW EXECUTE FUNCTION log_change();
