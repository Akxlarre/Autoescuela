-- ============================================================================
-- Agregar trigger de auditoría a tablas faltantes relacionadas a inscripciones
-- y ventas (RF-009)
-- ============================================================================
-- Tablas nuevas (idempotente via DROP IF EXISTS + CREATE):
--   professional_pre_registrations
--   standalone_course_enrollments
--   special_service_sales
-- ============================================================================

-- Módulo: Matrícula (Preinscripciones)
DROP TRIGGER IF EXISTS trg_audit_professional_pre_registrations ON professional_pre_registrations;
CREATE TRIGGER trg_audit_professional_pre_registrations
  AFTER INSERT OR UPDATE OR DELETE ON professional_pre_registrations
  FOR EACH ROW EXECUTE FUNCTION log_change();

-- Módulo: Finanzas (Cursos Singulares)
DROP TRIGGER IF EXISTS trg_audit_standalone_course_enrollments ON standalone_course_enrollments;
CREATE TRIGGER trg_audit_standalone_course_enrollments
  AFTER INSERT OR UPDATE OR DELETE ON standalone_course_enrollments
  FOR EACH ROW EXECUTE FUNCTION log_change();

-- Módulo: Finanzas (Servicios Especiales)
DROP TRIGGER IF EXISTS trg_audit_special_service_sales ON special_service_sales;
CREATE TRIGGER trg_audit_special_service_sales
  AFTER INSERT OR UPDATE OR DELETE ON special_service_sales
  FOR EACH ROW EXECUTE FUNCTION log_change();
