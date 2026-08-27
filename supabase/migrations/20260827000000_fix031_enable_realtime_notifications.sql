-- ============================================================================
-- fix-031-i — notifications no estaba en la publicación supabase_realtime
--
-- Contexto:
--  - NotificationsFacade.subscribeRealtime() ya está correctamente implementado:
--    se suscribe a postgres_changes INSERT sobre `notifications` con filtro
--    recipient_id=eq.{dbId}. El código cliente no tenía ningún error.
--  - El problema vivía en la BD: `notifications` nunca fue agregada a la
--    publicación `supabase_realtime` (solo `users`, `tasks` y `class_b_sessions`
--    lo estaban — ver 20260625120000_enable_realtime_users.sql,
--    20260518000000_create_tasks_and_migrate_observations.sql,
--    20260315100000_enable_realtime_class_b_sessions.sql). Sin estar en esa
--    publicación, Postgres nunca emite el evento — la suscripción del cliente
--    es válida y no lanza error, simplemente nunca recibe nada.
--  - Verificado en vivo (UAT 2026-08-27): insert real en `notifications` desde
--    otra sesión no llegó al panel abierto; un reload manual sí mostró la
--    notificación nueva — confirma que es un problema de transporte Realtime,
--    no de lógica de negocio ni del fetch inicial.
--
-- Idempotente: el DO block solo añade la tabla si no está ya en la publicación.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
