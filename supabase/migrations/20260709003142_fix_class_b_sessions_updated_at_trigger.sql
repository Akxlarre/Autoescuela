-- class_b_sessions tiene columna updated_at pero ningún trigger la refresca en UPDATE.
-- Reutiliza public.set_updated_at() (ya usado por professional_promotions y website_config).

CREATE OR REPLACE TRIGGER trg_class_b_sessions_updated_at
  BEFORE UPDATE ON public.class_b_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
