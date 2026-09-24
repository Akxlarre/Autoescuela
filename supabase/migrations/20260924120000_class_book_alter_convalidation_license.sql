-- ============================================================================
-- Migración: class_book.convalidation_license (spec 0018-m)
-- ============================================================================
-- Contexto: los libros de convalidación (Conv. A-3 / Conv. A-4) se arman al vuelo desde su
-- curso madre (A5 / A2) y NO tienen promotion_course propio (spec 0018-m, opción B). Cada uno
-- necesita su propio Código SENCE, así que class_book pasa de "una fila por promotion_course"
-- a "una fila por (promotion_course, libro)":
--   convalidation_license = NULL  → libro normal del curso (todas las filas existentes)
--   convalidation_license = 'A3'  → libro Conv. A-3 (colgado del curso A5)
--   convalidation_license = 'A4'  → libro Conv. A-4 (colgado del curso A2)
--
-- NULLS NOT DISTINCT (PG15+; el proyecto usa PG17): sigue habiendo a lo sumo UNA fila de
-- libro normal por curso, igual que con la constraint anterior.
--
-- La Edge Function generate-class-book-pdf hace upsert con
-- onConflict: 'promotion_course_id,convalidation_license' (antes 'promotion_course_id').
-- RLS sin cambios: las policies existentes de class_book (admin/secretaria) cubren las filas
-- nuevas.
-- ============================================================================

ALTER TABLE class_book
  ADD COLUMN IF NOT EXISTS convalidation_license TEXT;

ALTER TABLE class_book
  DROP CONSTRAINT IF EXISTS class_book_convalidation_license_check;

ALTER TABLE class_book
  ADD CONSTRAINT class_book_convalidation_license_check
  CHECK (convalidation_license IS NULL OR convalidation_license IN ('A3', 'A4'));

ALTER TABLE class_book
  DROP CONSTRAINT IF EXISTS class_book_promotion_course_id_key;

ALTER TABLE class_book
  DROP CONSTRAINT IF EXISTS class_book_promotion_course_conv_key;

ALTER TABLE class_book
  ADD CONSTRAINT class_book_promotion_course_conv_key
  UNIQUE NULLS NOT DISTINCT (promotion_course_id, convalidation_license);

COMMENT ON COLUMN class_book.convalidation_license IS
  'NULL = libro normal del curso. A3/A4 = libro de convalidación (spec 0018-m), colgado del curso madre (A5/A2) vía promotion_course_id.';
