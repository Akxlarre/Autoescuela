-- Agrega columna updated_at a professional_promotions con trigger de auto-actualización.

ALTER TABLE public.professional_promotions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Reutilizar el trigger genérico set_updated_at si existe, o crear la función.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
  ) THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.set_updated_at()
      RETURNS TRIGGER LANGUAGE plpgsql AS '
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      ';
    $func$;
  END IF;
END;
$$;

CREATE OR REPLACE TRIGGER trg_professional_promotions_updated_at
  BEFORE UPDATE ON public.professional_promotions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
