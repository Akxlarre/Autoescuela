-- ============================================================================
-- Spec 0017 — Secretaria multi-sede (grant del admin)
-- Fase 4 / T4.1 — Habilitar Supabase Realtime en `users` (AC-E3: grant en caliente).
--
-- Contexto:
--  - AuthFacade se suscribe por Realtime a su propia fila de `users`
--    (filtro id=eq.{dbId}) para reflejar otorgar/revocar el grant
--    `can_access_both_branches` SIN re-login.
--  - Para que esos eventos lleguen, `users` debe estar en la publicación
--    `supabase_realtime` (igual que `notifications`, `class_b_sessions`).
--  - Realtime respeta RLS: cada cliente solo recibe cambios de filas que su
--    política SELECT le permite ver; el filtro id=eq.{dbId} acota a su propia fila.
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
      AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
END $$;
