-- ============================================================
-- Migration: Agrega certificate_b_pdf_url a enrollments
-- Purpose:   Persiste la URL del certificado PDF generado para
--            alumnos Clase B. Permite saber si ya fue generado
--            sin depender de la tabla certificates (que requiere
--            folio de lote Casa de Moneda).
-- ============================================================

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS certificate_b_pdf_url TEXT;
