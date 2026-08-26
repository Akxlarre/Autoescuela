-- Amplía la policy de SELECT de audit_log: además del admin (acceso total), cualquier
-- usuario autenticado puede leer las filas donde él mismo es el actor (user_id = su propio
-- users.id). Antes solo el admin podía leer audit_log bajo cualquier circunstancia — la
-- secretaria nunca veía sus propias acciones en el widget "Actividad reciente" del dashboard,
-- aunque el trigger log_change() sí las registraba (solo excluye explícitamente al actor
-- admin, no a secretaria/instructor). Ver fix-224-m-secretaria-lee-sus-propias-acciones-audit-log.
--
-- Decisión explícita del dueño de negocio: "se puede ampliar la política para que la secretaria
-- vea solo sus propias acciones como mínimo" — no se amplía a "todas las acciones de su sede",
-- solo a las que ella misma generó.

DROP POLICY IF EXISTS select_audit_log ON audit_log;

CREATE POLICY select_audit_log ON audit_log
  FOR SELECT USING (auth_user_role() = 'admin' OR user_id = auth_user_id());
