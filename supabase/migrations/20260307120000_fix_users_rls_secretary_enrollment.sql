-- ============================================================================
-- FIX: Políticas RLS para tabla users — permitir INSERT/UPDATE a secretaria
-- ============================================================================
-- Problema: insert_users y update_users solo permitían rol 'admin'.
-- La secretaria necesita crear/actualizar usuarios con rol 'student'
-- durante el proceso de matrícula.
-- ============================================================================

-- INSERT: admin puede insertar cualquier usuario.
-- secretary puede insertar usuarios con rol 'student' (no admin) en su sede.
DROP POLICY IF EXISTS insert_users ON users;

CREATE POLICY insert_users ON users
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'secretary'
      AND branch_visible(branch_id)
      AND (role_id IS NULL OR role_id = (SELECT id FROM roles WHERE name = 'student'))
    )
  );

-- UPDATE: admin puede actualizar cualquier usuario.
-- secretary puede actualizar usuarios no-admin dentro de su sede.
DROP POLICY IF EXISTS update_users ON users;

CREATE POLICY update_users ON users
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'secretary'
      AND branch_visible(branch_id)
      AND (role_id IS NULL OR role_id != (SELECT id FROM roles WHERE name = 'admin'))
    )
  );
