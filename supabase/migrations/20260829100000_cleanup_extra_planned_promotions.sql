-- ============================================================================
-- fix-228-m: limpia las 3 promociones planificadas de más creadas por la race
-- condition de auto-create-next-promotions (colchón esperado: 278, 279 —
-- sobraban 280, 281, 282, ids 17/18/19 en professional_promotions).
--
-- Idempotente: todos los DELETE son por id explícito, correr dos veces no
-- tiene efecto adicional. Orden bottom-up para respetar FKs (NO ACTION, sin
-- CASCADE): sesiones -> class_book -> promotion_courses -> promotion.
-- Verificado antes de escribir esta migración: 0 enrollments, 0
-- promotion_course_lecturers, 0 professional_weekly_signatures, 0
-- license_validations referencian estos promotion_courses (57-68).
-- ============================================================================

DELETE FROM professional_theory_sessions
WHERE promotion_course_id IN (
  SELECT id FROM promotion_courses WHERE promotion_id IN (17, 18, 19)
);

DELETE FROM professional_practice_sessions
WHERE promotion_course_id IN (
  SELECT id FROM promotion_courses WHERE promotion_id IN (17, 18, 19)
);

DELETE FROM class_book
WHERE promotion_course_id IN (
  SELECT id FROM promotion_courses WHERE promotion_id IN (17, 18, 19)
);

DELETE FROM promotion_courses WHERE promotion_id IN (17, 18, 19);

DELETE FROM professional_promotions WHERE id IN (17, 18, 19);
