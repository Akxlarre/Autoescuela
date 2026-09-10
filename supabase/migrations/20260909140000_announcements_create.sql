-- ============================================================================
-- Spec 0041-b — Comunicado global a alumnos (1:N, email + in-app)
--
-- Crea las dos tablas del comunicado saliente:
--   announcements            → el comunicado (qué se dijo, quién lo mandó, a qué segmento)
--   announcement_recipients  → una fila por destinatario (a quién llegó y si llegó)
--
-- Ambas son el registro auditable que hoy no existe: la comunicación masiva al alumno
-- ocurre fuera del sistema (lista de difusión de WhatsApp) y no deja rastro de qué se
-- comunicó ni a quién. Ver indices/NOTIFICATIONS-MAP.md §9.3.
-- ============================================================================

-- ── Tablas ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS announcements (
  id                  BIGSERIAL PRIMARY KEY,
  subject             TEXT NOT NULL,
  body                TEXT NOT NULL,
  kind                TEXT NOT NULL CHECK (kind IN ('operativo', 'promocional')),
  -- NULL = comunicado multi-sede (solo admin). Ver política insert_announcements:
  -- una secretaria NO puede escribir NULL acá.
  branch_id           INT REFERENCES branches(id),
  -- Qué se pidió al segmentar (auditoría): la lista final la resuelve el servidor
  -- al enviar, no se guarda el resultado del preview del cliente.
  segment_filters     JSONB NOT NULL DEFAULT '{}',
  sent_by             INT NOT NULL REFERENCES users(id),
  sent_at             TIMESTAMPTZ,
  recipients_total    INT NOT NULL DEFAULT 0,
  email_ok_count      INT NOT NULL DEFAULT 0,
  email_failed_count  INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_recipients (
  id               BIGSERIAL PRIMARY KEY,
  announcement_id  BIGINT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id          INT NOT NULL REFERENCES users(id),
  -- Snapshot del email al momento del envío. NULL = el alumno no tenía email
  -- registrado; igual recibe la notificación in-app (spec 0041-b AC-E2).
  email            TEXT,
  email_sent_ok    BOOLEAN NOT NULL DEFAULT false,
  send_error       TEXT,
  notification_id  INT REFERENCES notifications(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- El envío se orquesta en varios lotes; reintentar uno no debe duplicar
  -- destinatarios ni correos.
  CONSTRAINT announcement_recipients_unique_per_user UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcements_branch_sent
  ON announcements (branch_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcement_recipients_user
  ON announcement_recipients (user_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_recipients ENABLE ROW LEVEL SECURITY;

-- announcements ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS select_announcements ON announcements;
CREATE POLICY select_announcements ON announcements
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary' AND branch_visible(branch_id))
  );

-- `branch_visible(NULL)` devuelve TRUE, así que NO sirve para el WITH CHECK del
-- INSERT: dejaría a una secretaria crear un comunicado multi-sede (branch_id NULL)
-- y alcanzar alumnos de otra sede. Acá el check es explícito.
DROP POLICY IF EXISTS insert_announcements ON announcements;
CREATE POLICY insert_announcements ON announcements
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'secretary'
      AND branch_id IS NOT NULL
      AND branch_id = auth_user_branch_id()
    )
  );

-- UPDATE existe solo para cerrar contadores y `sent_at` al terminar el envío.
DROP POLICY IF EXISTS update_announcements ON announcements;
CREATE POLICY update_announcements ON announcements
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'secretary'
      AND branch_id IS NOT NULL
      AND branch_id = auth_user_branch_id()
    )
  );

-- Sin policy DELETE en ningún rol, a propósito: un comunicado enviado es el
-- registro de qué se le dijo al alumno. No se borra.

-- announcement_recipients ────────────────────────────────────────────────────

DROP POLICY IF EXISTS select_announcement_recipients ON announcement_recipients;
CREATE POLICY select_announcement_recipients ON announcement_recipients
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (
      auth_user_role() = 'secretary'
      AND announcement_id IN (
        SELECT id FROM announcements WHERE branch_visible(branch_id)
      )
    )
  );

-- Sin INSERT/UPDATE/DELETE para ningún rol de cliente: estas filas las escribe
-- únicamente la Edge Function `send-announcement` con service_role. Si algún día
-- un INSERT desde el cliente falla acá, la respuesta es pasarlo por la Edge
-- Function, no abrir la tabla (mismo criterio que `consents`, spec 0009-m).

-- El alumno no tiene ninguna policy en ninguna de las dos tablas: ve el
-- comunicado a través de `notifications`, no de acá.
