-- ============================================================================
-- Spec 0013-m: eliminar notificaciones (individual/todas) + drawer "Ver todas"
-- con historial completo.
--
-- Agrega soft-delete a `notifications` vía `deleted_at`. Se eligió soft-delete
-- (en vez de DELETE físico) porque el drawer de historial completo debe poder
-- listar tanto las notificaciones activas como las eliminadas.
--
-- No se toca RLS: `update_notifications` (UPDATE, recipient_id = auth_user_id())
-- y `select_notifications` (SELECT, misma condición) ya cubren "propia fila"
-- sin distinguir `deleted_at` — alcanzan tanto para el soft-delete individual
-- como para que el drawer lea el historial completo (activas + eliminadas).
-- ============================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL DEFAULT NULL;

-- Acelera el filtro `deleted_at IS NULL` que aplica loadNotifications()
-- (panel + badge + página de instructor) en cada carga.
CREATE INDEX IF NOT EXISTS idx_notifications_not_deleted
  ON notifications (recipient_id, created_at DESC)
  WHERE deleted_at IS NULL;
