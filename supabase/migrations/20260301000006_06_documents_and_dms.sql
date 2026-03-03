-- ============================================================================
-- 06 — Documentos del Alumno, Contratos Digitales y DMS (RF-082, RF-083)
-- ============================================================================
-- Depende de: 01 (users, branches, students), 02 (enrollments)
-- ============================================================================

-- ============================================================================
-- STUDENT_DOCUMENTS — Documentos del expediente del alumno (RF-082)
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_documents (
  id                  SERIAL PRIMARY KEY,
  enrollment_id       INT    NOT NULL REFERENCES enrollments(id),
  type                TEXT,
    -- Clase B: 'id_photo', 'notarial_authorization'
    -- Profesional: 'national_id', 'driver_license', 'driver_record' (HVC, BLOQUEANTE),
    --              'psychological_exam', 'background_certificate'
  file_name           TEXT   NOT NULL,
  storage_url         TEXT   NOT NULL,
  status              TEXT,                  -- 'pending' | 'approved' | 'rejected' | 'pending_review'
  document_issue_date DATE,                  -- RF-082.3: para verificar antigüedad HVC
  notes               TEXT,
  uploaded_at         TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by         INT    REFERENCES users(id),
  reviewed_at         TIMESTAMPTZ
);

COMMENT ON TABLE student_documents IS 'Documentos del expediente digital del alumno: foto, cédula, HVC, cert. médico (RF-082)';

-- ============================================================================
-- DIGITAL_CONTRACTS — Contrato aceptado digitalmente (RF-083)
-- ============================================================================
-- El contrato firmado aparece en el DMS como tipo 'contract' via v_dms_student_documents.
CREATE TABLE IF NOT EXISTS digital_contracts (
  id              SERIAL PRIMARY KEY,
  enrollment_id   INT    NOT NULL UNIQUE REFERENCES enrollments(id),
  student_id      INT    NOT NULL REFERENCES students(id),
  content_hash    TEXT,                      -- hash del contrato firmado
  signature_ip    TEXT,
  accepted_at     TIMESTAMPTZ,
  -- DMS: PDF del contrato firmado
  file_name       TEXT,                      -- "Contrato_Maria_Gonzalez_2026.pdf"
  file_url        TEXT                       -- URL al PDF; NULL hasta que se genera
);

COMMENT ON TABLE digital_contracts IS 'Contrato digital firmado por el alumno, con PDF para el DMS (RF-083)';

-- ============================================================================
-- SCHOOL_DOCUMENTS — Documentos institucionales (DMS)
-- ============================================================================
-- Solo Admin puede eliminar; Secretaria puede subir y visualizar.
CREATE TABLE IF NOT EXISTS school_documents (
  id              SERIAL PRIMARY KEY,
  type            TEXT   NOT NULL,
    -- 'factura_folios' | 'resolucion_mtt' | 'decreto' | 'otro'
  file_name       TEXT   NOT NULL,
  storage_url     TEXT   NOT NULL,
  description     TEXT,
  branch_id       INT    REFERENCES branches(id),  -- NULL = ambas sedes
  uploaded_by     INT    REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE school_documents IS 'Documentos institucionales: facturas folios, resoluciones MTT, decretos. Solo Admin elimina.';

-- ============================================================================
-- DOCUMENT_TEMPLATES — Plantillas descargables del DMS
-- ============================================================================
-- Solo Admin puede crear/editar/eliminar. Todos los roles pueden descargar.
CREATE TABLE IF NOT EXISTS document_templates (
  id              SERIAL PRIMARY KEY,
  name            TEXT   NOT NULL,           -- "Contrato Matrícula Clase B" etc.
  description     TEXT,
  category        TEXT   NOT NULL,
    -- 'clase_b' | 'clase_profesional' | 'general' | 'administrativo'
  format          TEXT   NOT NULL,           -- 'pdf' | 'docx' | 'xlsx'
  version         TEXT,                      -- "v3.2", "v1.4 (MTT 2024)"
  file_url        TEXT   NOT NULL,
  download_count  INTEGER DEFAULT 0,
  active          BOOLEAN DEFAULT true,
  updated_by      INT    REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE document_templates IS 'Plantillas descargables del DMS: contratos, formularios MTT, comprobantes. Solo Admin gestiona.';
