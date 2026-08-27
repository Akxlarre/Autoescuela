-- Spec 0012-m: persistir borrador de Arqueo y Cierre de Caja.
--
-- 1) Constraint único para permitir upsert seguro por (date, branch_id). branch_id es
--    nullable (admin "todas las sedes") — un índice único simple no trata NULL como valores
--    iguales, y PostgREST/supabase-js exige que `onConflict` apunte a columnas reales (no a
--    una expresión como COALESCE), así que se normaliza en una columna generada no-nula
--    (`branch_id_key`, centinela -1 para NULL) sobre la que sí se puede declarar el UNIQUE
--    y usarla directo en `onConflict: 'date,branch_id_key'` desde el cliente.
ALTER TABLE cash_closings
  ADD COLUMN IF NOT EXISTS branch_id_key INT
  GENERATED ALWAYS AS (COALESCE(branch_id, -1)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cash_closings_date_branch
  ON cash_closings (date, branch_id_key);

-- 2) Ampliar UPDATE: admin sigue con acceso total; secretary puede actualizar SOLO filas
--    status='draft' de su propia sede — nunca una fila ya 'closed'. Antes bloqueado por
--    completo para secretary (solo admin podía hacer UPDATE), lo que impedía persistir un
--    borrador de arqueo antes del cierre final.
DROP POLICY IF EXISTS update_cash_closings ON cash_closings;
CREATE POLICY update_cash_closings ON cash_closings
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND status = 'draft' AND branch_visible(branch_id))
  );
