-- ============================================================================
-- Spec 0001: Sistema de tareas y observaciones multi-rol
-- Crea tabla tasks + task_replies, migra secretary_observations y la dropea.
-- ============================================================================
-- Decisiones de diseño (ver specs/0001/plan.md §8):
--   R1: Seed legacy salta filas sin admin en la sede (sin datos reales en prod).
--   R2: to_role es snapshot de display — sin trigger de validación.
--       Los permisos reales se basan en to_user_id (FK).
--   R3: Dos canales Realtime separados (tasks-sent / tasks-received) — implementado en TasksFacade.
-- ============================================================================


-- ############################################################################
-- PARTE 1: TABLA PRINCIPAL — tasks
-- ############################################################################

CREATE TABLE IF NOT EXISTS tasks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INT         NOT NULL REFERENCES branches(id),
  from_user_id  INT         NOT NULL REFERENCES users(id),
  from_role     TEXT        NOT NULL CHECK (from_role IN ('admin', 'secretary')),
  to_user_id    INT         NOT NULL REFERENCES users(id),
  to_role       TEXT        NOT NULL CHECK (to_role IN ('admin', 'secretary', 'instructor')),
  type          TEXT        NOT NULL CHECK (type IN ('task', 'observation', 'question')),
  subject       TEXT        NOT NULL,
  body          TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'in_progress', 'completed', 'seen')),
  due_date      TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  seen_at       TIMESTAMPTZ,
  seen_by       INT         REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,

  -- Solo type='task' puede tener due_date (AC4)
  CONSTRAINT due_date_only_for_tasks
    CHECK (type = 'task' OR due_date IS NULL),

  -- Matriz de roles permitidos (AC-E1)
  -- admin → {secretary, instructor} | secretary → {admin, instructor}
  -- Bloqueado: secretary→secretary, instructor→cualquiera
  CONSTRAINT role_matrix CHECK (
    (from_role = 'admin'     AND to_role IN ('secretary', 'instructor')) OR
    (from_role = 'secretary' AND to_role IN ('admin', 'instructor'))
  )
);

COMMENT ON TABLE tasks IS
  'Canal estructurado de comunicación multi-rol: admin↔secretary, secretary→instructor. '
  'Reemplaza secretary_observations. Spec 0001.';


-- ############################################################################
-- PARTE 2: TABLA DE HILOS — task_replies
-- ############################################################################

CREATE TABLE IF NOT EXISTS task_replies (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_user_id  INT         NOT NULL REFERENCES users(id),
  body          TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE task_replies IS
  'Respuestas en hilos type=question. Inmutables. Bloqueadas si task.status=completed (AC9).';


-- ############################################################################
-- PARTE 3: ÍNDICES
-- ############################################################################

-- Bandeja del destinatario por estado (query más frecuente)
CREATE INDEX IF NOT EXISTS idx_tasks_to_user_status
  ON tasks(to_user_id, status)
  WHERE deleted_at IS NULL;

-- Bandeja del emisor por estado
CREATE INDEX IF NOT EXISTS idx_tasks_from_user_status
  ON tasks(from_user_id, status)
  WHERE deleted_at IS NULL;

-- Admin multi-sede: filtro por branch + estado
CREATE INDEX IF NOT EXISTS idx_tasks_branch_status
  ON tasks(branch_id, status)
  WHERE deleted_at IS NULL;

-- Tareas vencidas (due_date en el pasado)
CREATE INDEX IF NOT EXISTS idx_tasks_due_date
  ON tasks(due_date)
  WHERE deleted_at IS NULL AND type = 'task';

-- Hilo cronológico (carga de replies de una tarea)
CREATE INDEX IF NOT EXISTS idx_task_replies_task
  ON task_replies(task_id, created_at);


-- ############################################################################
-- PARTE 4: TRIGGER updated_at
-- ############################################################################

CREATE OR REPLACE FUNCTION tasks_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_set_updated_at();


-- ############################################################################
-- PARTE 5: ROW LEVEL SECURITY
-- ############################################################################

ALTER TABLE tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_replies ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas previas (idempotencia)
DROP POLICY IF EXISTS tasks_select   ON tasks;
DROP POLICY IF EXISTS tasks_insert   ON tasks;
DROP POLICY IF EXISTS tasks_update   ON tasks;
DROP POLICY IF EXISTS tasks_delete   ON tasks;
DROP POLICY IF EXISTS task_replies_select ON task_replies;
DROP POLICY IF EXISTS task_replies_insert ON task_replies;
DROP POLICY IF EXISTS task_replies_delete ON task_replies;


-- ============================================================================
-- TASKS — SELECT
-- Admin: ve todas las tasks de sus sede(s) accesibles (branch_visible).
-- Secretary: ve solo tasks donde es emisora o destinataria (sin visibilidad cruzada entre secretarias).
-- Instructor: ve solo tasks dirigidas a él.
-- ============================================================================
CREATE POLICY tasks_select ON tasks
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      (auth_user_role() = 'admin'     AND branch_visible(branch_id))
      OR
      (auth_user_role() = 'secretary' AND (from_user_id = auth_user_id() OR to_user_id = auth_user_id()))
      OR
      (auth_user_role() = 'instructor' AND to_user_id = auth_user_id())
    )
  );


-- ============================================================================
-- TASKS — INSERT
-- Admin: crea como from_role='admin', para secretary/instructor de su(s) sede(s).
--        branch_id de la task debe coincidir con branch_id del destinatario.
-- Secretary: crea como from_role='secretary', para admin/instructor de su sede.
--        Instructor: bloqueado (no puede insertar en tasks).
-- ============================================================================
CREATE POLICY tasks_insert ON tasks
  FOR INSERT WITH CHECK (
    (
      -- Admin crea tasks en sus sedes accesibles
      auth_user_role() = 'admin'
      AND from_user_id = auth_user_id()
      AND from_role = 'admin'
      AND to_role IN ('secretary', 'instructor')
      AND branch_visible(branch_id)
      AND branch_id = (SELECT branch_id FROM users WHERE id = to_user_id)
    )
    OR
    (
      -- Secretary crea tasks solo en su propia sede
      auth_user_role() = 'secretary'
      AND from_user_id = auth_user_id()
      AND from_role = 'secretary'
      AND to_role IN ('admin', 'instructor')
      AND branch_id = auth_user_branch_id()
      AND branch_id = (SELECT branch_id FROM users WHERE id = to_user_id)
    )
  );


-- ============================================================================
-- TASKS — UPDATE
-- Admin: puede actualizar cualquier task de sus sedes (body, status, seen, deleted_at).
-- Secretary: puede actualizar tasks donde es emisora o destinataria.
-- Instructor: puede actualizar tasks donde es destinatario (solo status — regla de negocio en facade).
-- Nota: AC-E2 (solo emisor puede editar subject/body si status='pending') se aplica en la facade,
--       no en RLS (RLS no puede restringir columnas individuales).
-- ============================================================================
CREATE POLICY tasks_update ON tasks
  FOR UPDATE USING (
    deleted_at IS NULL
    AND (
      (auth_user_role() = 'admin'     AND branch_visible(branch_id))
      OR (auth_user_role() = 'secretary' AND (from_user_id = auth_user_id() OR to_user_id = auth_user_id()))
      OR (auth_user_role() = 'instructor' AND to_user_id = auth_user_id())
    )
  );


-- ============================================================================
-- TASKS — DELETE (hard delete — solo admin para limpieza operacional)
-- El soft delete (deleted_at) se ejecuta vía UPDATE, cubierto por tasks_update.
-- ============================================================================
CREATE POLICY tasks_delete ON tasks
  FOR DELETE USING (auth_user_role() = 'admin' AND branch_visible(branch_id));


-- ============================================================================
-- TASK_REPLIES — SELECT
-- Puede leer los replies quien puede leer la task padre.
-- ============================================================================
CREATE POLICY task_replies_select ON task_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id
        AND t.deleted_at IS NULL
        AND (
          (auth_user_role() = 'admin'      AND branch_visible(t.branch_id))
          OR (auth_user_role() = 'secretary' AND (t.from_user_id = auth_user_id() OR t.to_user_id = auth_user_id()))
          OR (auth_user_role() = 'instructor' AND t.to_user_id = auth_user_id())
        )
    )
  );


-- ============================================================================
-- TASK_REPLIES — INSERT
-- Admin/Secretary: pueden responder en tasks donde son participantes (from o to).
-- Instructor: solo puede insertar replies en hilos type='question' donde es destinatario (AC8).
-- Nadie puede responder en un hilo completado (AC9).
-- ============================================================================
CREATE POLICY task_replies_insert ON task_replies
  FOR INSERT WITH CHECK (
    from_user_id = auth_user_id()
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id
        AND t.deleted_at IS NULL
        AND t.status != 'completed'  -- AC9: hilo cerrado = readonly
        AND (
          (
            auth_user_role() IN ('admin', 'secretary')
            AND (t.from_user_id = auth_user_id() OR t.to_user_id = auth_user_id())
          )
          OR
          (
            auth_user_role() = 'instructor'
            AND t.type = 'question'
            AND t.to_user_id = auth_user_id()
          )
        )
    )
  );


-- ============================================================================
-- TASK_REPLIES — DELETE (solo admin para limpieza; replies son inmutables por diseño)
-- ============================================================================
CREATE POLICY task_replies_delete ON task_replies
  FOR DELETE USING (auth_user_role() = 'admin');


-- ############################################################################
-- PARTE 6: REALTIME
-- Dos canales en la facade: tasks-sent (from_user_id) y tasks-received (to_user_id).
-- Registramos la tabla en la publicación Realtime de Supabase.
-- ############################################################################

ALTER PUBLICATION supabase_realtime ADD TABLE tasks;


-- ############################################################################
-- PARTE 7: SEED LEGACY (secretary_observations → tasks)
-- Decisión R1: se saltean filas donde la sede no tiene admin registrado.
-- Confirmado sin datos reales en producción — el stub estaba vacío.
-- ############################################################################

INSERT INTO tasks (
  branch_id,
  from_user_id,
  from_role,
  to_user_id,
  to_role,
  type,
  subject,
  body,
  status,
  due_date,
  seen_by,
  seen_at,
  created_at,
  updated_at
)
SELECT
  u_sender.branch_id,
  so.created_by,
  'secretary',
  -- Buscar el primer admin de la misma sede que la secretaria (R1: saltar si no hay)
  (
    SELECT u_admin.id
    FROM users u_admin
    JOIN roles r ON r.id = u_admin.role_id
    WHERE u_admin.branch_id = u_sender.branch_id
      AND r.name = 'admin'
    ORDER BY u_admin.id
    LIMIT 1
  ),
  'admin',
  -- Mapeo de tipos: reminder/urgent → task; observation → observation
  CASE
    WHEN so.type IN ('reminder', 'urgent') THEN 'task'
    ELSE 'observation'
  END,
  -- subject = primeros 80 chars del mensaje
  LEFT(so.message, 80),
  so.message,
  -- Mapeo de estados
  CASE so.status
    WHEN 'resolved' THEN 'completed'
    WHEN 'seen'     THEN 'seen'
    ELSE                 'pending'
  END,
  -- due_date (DATE → TIMESTAMPTZ, solo si type era reminder/urgent)
  CASE WHEN so.type IN ('reminder', 'urgent') THEN so.due_date::TIMESTAMPTZ ELSE NULL END,
  so.seen_by,
  so.seen_at,
  so.created_at,
  so.created_at
FROM secretary_observations so
JOIN users u_sender ON u_sender.id = so.created_by
-- R1: solo migrar si existe al menos un admin en la sede
WHERE EXISTS (
  SELECT 1
  FROM users u_admin
  JOIN roles r ON r.id = u_admin.role_id
  WHERE u_admin.branch_id = u_sender.branch_id
    AND r.name = 'admin'
);

-- Nota: admin_reply no se migra como task_reply porque requeriría mapear
-- IDs originales a los nuevos UUIDs. Confirmado sin datos reales — omitido.


-- ############################################################################
-- PARTE 8: DROP legacy
-- CASCADE elimina las policies y foreign keys dependientes de la tabla.
-- ############################################################################

DROP TABLE IF EXISTS secretary_observations CASCADE;
