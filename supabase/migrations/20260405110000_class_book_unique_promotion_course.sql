-- ============================================================================
-- Migración: UNIQUE constraint en class_book.promotion_course_id
-- ============================================================================
-- Contexto: La Edge Function generate-class-book-pdf usa upsert con
-- onConflict: 'promotion_course_id'. Sin esta constraint el upsert falla.
-- ============================================================================

ALTER TABLE class_book
  DROP CONSTRAINT IF EXISTS class_book_promotion_course_id_key;

ALTER TABLE class_book
  ADD CONSTRAINT class_book_promotion_course_id_key UNIQUE (promotion_course_id);
