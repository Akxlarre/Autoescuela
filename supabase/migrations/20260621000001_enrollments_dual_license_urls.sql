-- ============================================================
-- Migration: Carnet Clase B dual (6 / 12 clases)  [fix-019]
-- Purpose:   Persistir por separado las dos variantes del carnet:
--              - license_initial_url → carnet de 6 clases (amarillo)
--              - license_full_url    → carnet de 12 clases (verde)
--            Antes existía una sola columna license_pdf_url que ya
--            no alcanza porque ambos carnets coexisten y se reimprimen
--            de forma independiente.
--            Backfill: el license_pdf_url emitido hasta hoy era, en la
--            práctica, el carnet inicial → se copia a license_initial_url.
-- Idempotente: ADD COLUMN IF NOT EXISTS + UPDATE condicional.
-- ============================================================

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS license_initial_url TEXT,
  ADD COLUMN IF NOT EXISTS license_full_url    TEXT;

-- Backfill desde la columna legacy (solo si aplica y no se hizo antes).
UPDATE enrollments
   SET license_initial_url = license_pdf_url
 WHERE license_pdf_url IS NOT NULL
   AND license_initial_url IS NULL;

COMMENT ON COLUMN enrollments.license_initial_url IS
  'Ruta en bucket documents del carnet Clase B de 6 clases (fondo amarillo). fix-019';
COMMENT ON COLUMN enrollments.license_full_url IS
  'Ruta en bucket documents del carnet Clase B de 12 clases (fondo verde). fix-019';
