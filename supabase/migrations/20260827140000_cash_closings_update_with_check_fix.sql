-- Spec 0012-m: fix real encontrado en QA manual (Playwright) tras aplicar 20260827120000.
--
-- `CREATE POLICY update_cash_closings ... FOR UPDATE USING (...)` sin un WITH CHECK explícito
-- hace que Postgres reuse el mismo USING para validar también la fila NUEVA (post-UPDATE), no
-- solo la vieja. La policy original exigía `status = 'draft'` en el USING para que la
-- secretaria pudiera tocar su propio borrador — pero al no declarar WITH CHECK, esa misma
-- condición se aplicaba a la fila resultante, así que `cerrarCaja()` (que hace UPDATE
-- status: 'draft' → 'closed') quedaba bloqueado por su propia policy: 403 real, reproducido
-- en el navegador con Playwright al intentar cerrar una caja con un borrador existente.
--
-- Fix: USING sigue exigiendo que la fila VIEJA sea 'draft' (una secretaria nunca puede tocar
-- una fila ya 'closed'); WITH CHECK solo valida la sede de la fila NUEVA, sin repetir la
-- restricción de status — así el UPDATE que transiciona draft→closed pasa.
DROP POLICY IF EXISTS update_cash_closings ON cash_closings;
CREATE POLICY update_cash_closings ON cash_closings
  FOR UPDATE
  USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND status = 'draft' AND branch_visible(branch_id))
  )
  WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );
