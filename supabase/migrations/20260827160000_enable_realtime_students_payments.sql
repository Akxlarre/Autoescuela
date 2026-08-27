-- fix-227-m — El dashboard no refresca "Clases Actuales" / KPIs vía Realtime.
--
-- Causa raíz: `DashboardFacade.setupRealtime()` registra TRES bindings
-- `postgres_changes` en un solo canal (`students`, `class_b_sessions`, `payments`).
-- Sólo `class_b_sessions` estaba en la publicación `supabase_realtime`
-- (20260315100000). Cuando un canal Realtime tiene un binding a una tabla que NO
-- está en la publicación, el servidor falla ese binding y el canal deja de
-- entregar eventos para TODOS sus bindings — incluido `class_b_sessions` — aunque
-- el cliente reporte `SUBSCRIBED`. Verificado con Playwright contra la BD real:
--   - canal con [users, class_b_sessions, tasks] (los 3 en la publicación) → recibe UPDATE de class_b_sessions
--   - canal con [students, class_b_sessions, payments] → 0 eventos
--
-- Fix: agregar `students` y `payments` a la publicación para que los 3 bindings
-- del canal del dashboard sean válidos. No se toca el código del Facade.
--
-- Idempotente: cada tabla se añade sólo si aún no está en la publicación.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'students'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
END $$;
