-- Fix: Política UPDATE de digital_contracts debe incluir secretary.
-- El upsert (INSERT ... ON CONFLICT DO UPDATE) generado por Supabase
-- verifica la política UPDATE (USING) incluso en el path de INSERT,
-- bloqueando a la secretaria con error 42501.

DROP POLICY IF EXISTS update_digital_contracts ON public.digital_contracts;

CREATE POLICY update_digital_contracts ON public.digital_contracts
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));
