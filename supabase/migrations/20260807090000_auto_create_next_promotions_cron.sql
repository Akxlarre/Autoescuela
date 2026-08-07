-- ============================================================================
-- pg_cron + pg_net: invoca la Edge Function `auto-create-next-promotions`
--
-- Garantiza que siempre exista un colchón de 1 promoción `in_progress` + 2
-- `planned` (branch_id=2) hacia adelante. Toda la lógica de negocio (cuántas
-- faltan, cadencia de 14 días, end_date con recuperación de feriados,
-- promotion_courses/class_book) vive en la Edge Function — este job solo la
-- dispara vía HTTP.
--
-- Corre DESPUÉS de auto_transition_promotion_status() en el mismo horario
-- (0 6 * * *) para que el conteo de `in_progress` ya refleje la transición
-- planned→in_progress del día antes de calcular el colchón.
--
-- Secrets: `project_url` y `service_role_key` se leen desde Supabase Vault
-- (`vault.decrypted_secrets`), NUNCA hardcodeados aquí. Deben crearse antes
-- de que el job dispare por primera vez, ej.:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');
-- ============================================================================

-- pg_net no viene habilitado por defecto en un entorno local nuevo
-- (`supabase start` / `supabase db reset`) — idempotente, no-op en remoto.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('auto-create-next-promotions')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'auto-create-next-promotions'
  );

SELECT cron.schedule(
  'auto-create-next-promotions',
  '0 6 * * *',   -- diariamente a las 06:00 UTC (≈ 03:00 CLT verano), después de
                 -- auto-transition-promotion-status (mismo horario, mismo job de pg_cron)
  $$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/auto-create-next-promotions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'
      )
    ),
    body    := '{}'::jsonb
  );
  $$
);
