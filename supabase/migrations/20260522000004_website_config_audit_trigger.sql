-- Migración para asegurar el trigger de auditoría de website_config
-- Asegura que cada cambio (INSERT, UPDATE, DELETE) en website_config se registre en audit_log en español.

DROP TRIGGER IF EXISTS trg_audit_website_config ON public.website_config;
CREATE TRIGGER trg_audit_website_config
  AFTER INSERT OR UPDATE OR DELETE ON public.website_config
  FOR EACH ROW EXECUTE FUNCTION log_change();
