-- ============================================================================
-- Spec 0042-b — Programación de comunicados (y vínculo con plantillas)
--
-- Agrega a `announcements` la capacidad de quedar agendado para el futuro, y el
-- estado explícito que eso vuelve necesario.
--
-- POR QUÉ UN `status` Y NO SEGUIR INFIRIENDO DE `sent_at`:
-- el v1 (spec 0041-b) deducía el estado de si `sent_at` era NULL. Con envíos
-- diferidos eso ya no alcanza — "todavía no salió" pasa a significar tres cosas
-- distintas (programado, en curso, cancelado). Además el estado es el CANDADO que
-- impide el doble envío: el dispatcher toma cada comunicado con
--
--   UPDATE announcements SET status='enviando'
--    WHERE id = $1 AND status = 'programado' RETURNING id
--
-- Si dos corridas del cron se solapan, la segunda no recibe fila y no hace nada.
-- La exclusión mutua la resuelve la base, no la lógica de aplicación.
-- ============================================================================

-- ── Columnas ────────────────────────────────────────────────────────────────

ALTER TABLE announcements
  -- NULL = envío inmediato (todo el comportamiento del v1).
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  -- DEFAULT 'enviado' para que las filas existentes queden correctas sin backfill
  -- (hoy hay 0, pero la migración tiene que ser correcta igual).
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'enviado',
  -- De qué plantilla salió, para saber cuáles se usan de verdad. ON DELETE SET NULL:
  -- borrar una plantilla no puede borrar el registro de lo que ya se comunicó.
  ADD COLUMN IF NOT EXISTS template_id INT REFERENCES notification_templates(id) ON DELETE SET NULL;

-- Los comunicados del v1 que alcanzaron a salir quedan como enviados; los que
-- quedaron a medias, también (no había forma de programarlos, así que no hay
-- 'programado' legítimo previo a esta migración).
UPDATE announcements SET status = 'enviado' WHERE status IS DISTINCT FROM 'enviado';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'announcements_status_check'
  ) THEN
    ALTER TABLE announcements
      ADD CONSTRAINT announcements_status_check
      CHECK (status IN ('programado', 'enviando', 'enviado', 'cancelado'));
  END IF;
END $$;

-- Índice PARCIAL a propósito: el dispatcher corre 96 veces al día y casi siempre
-- no hay nada pendiente. Indexando solo las filas 'programado', la consulta en
-- vacío recorre un índice vacío en vez de la tabla entera de comunicados.
CREATE INDEX IF NOT EXISTS idx_announcements_pending_dispatch
  ON announcements (scheduled_for)
  WHERE status = 'programado';

-- ── Cron: despacho de lo programado ─────────────────────────────────────────
--
-- Mismo patrón que el job `auto-create-next-promotions`, ya en uso en este
-- proyecto: la URL y la service_role_key se leen del vault, nunca se hardcodean.
--
-- Cada 15 minutos: granularidad suficiente para un aviso institucional. La UI
-- comunica esa granularidad en vez de prometer precisión al minuto.

SELECT cron.unschedule('dispatch-scheduled-announcements')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'dispatch-scheduled-announcements'
);

SELECT cron.schedule(
  'dispatch-scheduled-announcements',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/dispatch-scheduled-announcements',
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
