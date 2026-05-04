-- ============================================================
-- Migration: Agrega license_pdf_url a enrollments
-- Purpose:   Persiste la ruta del carnet PDF (Clase B) generado
--            para el alumno, en el bucket 'documents' carpeta
--            'student-licenses/'. Permite saber si ya fue
--            generado sin re-invocar la Edge Function.
-- ============================================================

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS license_pdf_url TEXT;
