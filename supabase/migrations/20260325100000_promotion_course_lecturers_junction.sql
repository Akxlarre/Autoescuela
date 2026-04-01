-- ============================================================================
-- MIGRACIÓN: Reemplazar lecturer_id en promotion_courses por tabla intersección
-- Motivo: Un curso de promoción puede tener múltiples relatores (teoría/práctica).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Crear tabla intersección promotion_course_lecturers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promotion_course_lecturers (
  id                   SERIAL PRIMARY KEY,
  promotion_course_id  INT  NOT NULL REFERENCES promotion_courses(id) ON DELETE CASCADE,
  lecturer_id          INT  NOT NULL REFERENCES lecturers(id) ON DELETE RESTRICT,
  role                 TEXT CHECK (role IN ('theory', 'practice', 'both')),
  created_at           TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(promotion_course_id, lecturer_id)
);

COMMENT ON TABLE promotion_course_lecturers IS
  'Relación N:M entre cursos de promoción y relatores. Un curso puede tener '
  'múltiples relatores con rol opcional (theory|practice|both).';

-- ----------------------------------------------------------------------------
-- 2. Migrar datos existentes: los lecturer_id actuales pasan a la nueva tabla
--    con role = NULL (no se asume teoría ni práctica, la asignación fue previa)
-- ----------------------------------------------------------------------------
INSERT INTO promotion_course_lecturers (promotion_course_id, lecturer_id, role)
SELECT id, lecturer_id, NULL
FROM promotion_courses
WHERE lecturer_id IS NOT NULL
ON CONFLICT (promotion_course_id, lecturer_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Eliminar la columna lecturer_id de promotion_courses
-- ----------------------------------------------------------------------------
ALTER TABLE promotion_courses DROP COLUMN IF EXISTS lecturer_id;

-- ----------------------------------------------------------------------------
-- 4. RLS para promotion_course_lecturers
--    Mismas políticas que promotion_courses: admin/sec CRUD, resto SELECT
-- ----------------------------------------------------------------------------
ALTER TABLE promotion_course_lecturers ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_promotion_course_lecturers ON promotion_course_lecturers
  FOR SELECT USING (true);

CREATE POLICY insert_promotion_course_lecturers ON promotion_course_lecturers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid()
        AND r.name IN ('admin', 'secretary')
    )
  );

CREATE POLICY update_promotion_course_lecturers ON promotion_course_lecturers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid()
        AND r.name IN ('admin', 'secretary')
    )
  );

CREATE POLICY delete_promotion_course_lecturers ON promotion_course_lecturers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid()
        AND r.name = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 5. Índices
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pcl_promotion_course
  ON promotion_course_lecturers(promotion_course_id);

CREATE INDEX IF NOT EXISTS idx_pcl_lecturer
  ON promotion_course_lecturers(lecturer_id);
