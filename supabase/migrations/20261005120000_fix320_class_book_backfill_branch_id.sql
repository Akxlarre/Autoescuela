-- Fix 320-m: generate-class-book-pdf pedía la sede sin su id (branches(name, address)), así que
-- su upsert escribía class_book.branch_id = NULL cada vez que se generaba el PDF, aun si el libro
-- ya tenía sede. La función ya pide branches(id, name, address); esta migración rellena las filas
-- que quedaron con la sede en NULL.
--
-- La sede del libro es la de su promoción (promotion_courses → professional_promotions).
-- Idempotente: solo toca filas con branch_id NULL cuya promoción sí tiene sede.

UPDATE public.class_book cb
SET    branch_id  = pp.branch_id,
       updated_at = NOW()
FROM   public.promotion_courses pc
JOIN   public.professional_promotions pp ON pp.id = pc.promotion_id
WHERE  pc.id = cb.promotion_course_id
  AND  cb.branch_id IS NULL
  AND  pp.branch_id IS NOT NULL;
