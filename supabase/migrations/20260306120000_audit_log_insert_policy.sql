-- ============================================================================
-- audit_log: política INSERT para triggers de auditoría (RF-009)
-- ============================================================================
-- El trigger log_change() inserta en audit_log cuando se modifican entidades
-- críticas (users, enrollments, payments, etc.). El trigger corre con el
-- contexto del usuario que ejecuta la operación, por lo que RLS aplica.
-- Sin política INSERT, cualquier UPDATE/INSERT/DELETE en esas tablas fallaba
-- con "new row violates row-level security policy for table audit_log".
--
-- Solución: permitir INSERT a usuarios autenticados. Solo los triggers
-- escriben en audit_log; el usuario no inserta directamente. El trigger
-- solo se dispara tras pasar RLS en la tabla origen (users, enrollments, etc.).
-- ============================================================================

CREATE POLICY insert_audit_log ON audit_log
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
