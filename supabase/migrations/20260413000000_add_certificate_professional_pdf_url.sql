-- ============================================================================
-- Agrega columna para almacenar el path relativo del PDF de certificado
-- de Clase Profesional en el bucket 'documents'.
-- Análogo a certificate_b_pdf_url para Clase B.
-- ============================================================================

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS certificate_professional_pdf_url TEXT;
