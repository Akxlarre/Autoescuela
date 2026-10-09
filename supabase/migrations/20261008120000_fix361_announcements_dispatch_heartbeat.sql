-- ============================================================================
-- fix-361-m — Un comunicado a más de 200 alumnos nunca terminaba
--
-- Agrega `announcements.dispatch_heartbeat_at`: la última vez que alguien (el cron o el
-- navegador de la secretaria) avanzó un lote de ese comunicado.
--
-- POR QUÉ HACE FALTA: el rescate de comunicados trabados en 'enviando' decidía con
-- `scheduled_for`, que dice cuándo DEBÍA salir, no si alguien lo sigue enviando. Eso:
--   - no sirve para el envío inmediato (`scheduled_for` es NULL), que por eso no tenía
--     rescate: si se cerraba la pestaña a mitad, quedaba a medias para siempre;
--   - podía rescatar un envío que seguía vivo, solo porque se programó hace rato.
-- Con el latido, "trabado" significa "nadie avanzó un lote en 30 minutos".
--
-- Sin backfill: un NULL se trata como "sin latido" y el dispatcher cae al criterio
-- anterior (`scheduled_for`, o `created_at` para los inmediatos).
-- ============================================================================

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS dispatch_heartbeat_at TIMESTAMPTZ;
