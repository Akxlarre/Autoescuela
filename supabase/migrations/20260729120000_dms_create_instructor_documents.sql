-- ============================================================================
-- Spec 0003-m — Repositorio de documentos: sección Instructores
--
-- Tabla nueva `instructor_documents`, análoga a `school_documents`/`student_documents`
-- (mismo patrón: storage_url = path relativo al bucket `documents`, NOT NULL).
-- Sin columna `branch_id` propia — se deriva vía join a `instructors.user_id → users.branch_id`,
-- mismo patrón ya usado por `select_instructors` (20260624120000) y `select_students`.
-- Idempotente: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS instructor_documents (
  id              SERIAL PRIMARY KEY,
  instructor_id   INT    NOT NULL REFERENCES instructors(id),
  type            TEXT   NOT NULL,
    -- 'certificado_antecedentes' | 'certificado_ensenanza_media' |
    -- 'certificado_curso_transito_mecanica' | 'hoja_vida_conductor' |
    -- 'credencial_semep' | 'licencia_clase_b' | 'certificado_curso_instructor_teorico'
  file_name       TEXT   NOT NULL,
  storage_url     TEXT   NOT NULL,
  status          TEXT   NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  uploaded_by     INT    REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE instructor_documents IS 'Documentos del expediente del instructor (Clase B): antecedentes, HVC, credencial SEMEP, licencia, etc. (spec 0003-m)';

ALTER TABLE instructor_documents ENABLE ROW LEVEL SECURITY;

-- ---------- instructor_documents ----------
-- Admin: CRUD sin filtro de sede | Secretary: CRU solo instructores de su sede (branch_visible
-- sobre la sede del user dueño del instructor, honra can_access_both_branches) | DELETE: solo admin
DROP POLICY IF EXISTS select_instructor_documents ON instructor_documents;
CREATE POLICY select_instructor_documents ON instructor_documents
  FOR SELECT USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND branch_visible((
          SELECT u.branch_id
          FROM instructors i
          JOIN users u ON u.id = i.user_id
          WHERE i.id = instructor_documents.instructor_id
        )))
  );

DROP POLICY IF EXISTS insert_instructor_documents ON instructor_documents;
CREATE POLICY insert_instructor_documents ON instructor_documents
  FOR INSERT WITH CHECK (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND branch_visible((
          SELECT u.branch_id
          FROM instructors i
          JOIN users u ON u.id = i.user_id
          WHERE i.id = instructor_documents.instructor_id
        )))
  );

DROP POLICY IF EXISTS update_instructor_documents ON instructor_documents;
CREATE POLICY update_instructor_documents ON instructor_documents
  FOR UPDATE USING (
    auth_user_role() = 'admin'
    OR (auth_user_role() = 'secretary'
        AND branch_visible((
          SELECT u.branch_id
          FROM instructors i
          JOIN users u ON u.id = i.user_id
          WHERE i.id = instructor_documents.instructor_id
        )))
  );

DROP POLICY IF EXISTS delete_instructor_documents ON instructor_documents;
CREATE POLICY delete_instructor_documents ON instructor_documents
  FOR DELETE USING (auth_user_role() = 'admin');
