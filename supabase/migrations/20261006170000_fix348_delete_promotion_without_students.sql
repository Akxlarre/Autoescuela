-- ============================================================================
-- fix-348-m: delete_promotion_without_students — eliminar una promoción creada por error.
-- ============================================================================
-- Decisión D20 (Matías, 2026-10-06): "Cancelada" se reemplaza por "Eliminar". Una promoción
-- cancelada seguía ocupando su lunes (UNIQUE branch_id + start_date) y su número (code UNIQUE)
-- para siempre; si su fecha era de la cadencia, además corría a la automática.
--
-- Por qué una función y no un DELETE desde la app: professional_theory_sessions,
-- professional_practice_sessions y class_book referencian promotion_courses SIN ON DELETE CASCADE
-- (solo promotion_course_lecturers y professional_weekly_signatures lo tienen), y promotion_courses
-- referencia professional_promotions igual. Borrar a mano desde el cliente son 5 sentencias sin
-- transacción: un corte a mitad deja una promoción sin cursos.
--
-- Reglas:
--   · Solo admin. Desde el SQL Editor (sin sesión: auth.uid() nulo) también pasa, para poder
--     probarla; anon no tiene EXECUTE, así que "sin sesión" nunca es un usuario de la app.
--   · Solo promociones planificadas o canceladas (no partieron). En curso o finalizada: no.
--   · Sin matrículas. Los borradores del wizard que la tenían elegida no cuentan como alumnos:
--     quedan sin promoción (el paso 2 la vuelve a pedir).
--   · Si existiera asistencia, maquinaria o registros biométricos colgando de sus sesiones, el
--     DELETE falla por FK y se revierte todo: esa promoción no estaba vacía.
--
-- Los mensajes llevan un marcador (promotion_not_found, promotion_not_deletable,
-- promotion_has_enrollments) que la app traduce en promotionWriteErrorMessage
-- (src/app/core/utils/promotion-code.utils.ts).
--
-- SET search_path = '' (DG-058): todas las tablas van calificadas con public.
-- Idempotente: CREATE OR REPLACE + REVOKE/GRANT.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_promotion_without_students(p_promotion_id INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status TEXT;
  v_courses INT[];
  v_enrollments INT;
BEGIN
  IF auth.uid() IS NOT NULL AND COALESCE(public.auth_user_role(), '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede eliminar una promoción'
      USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status
    FROM public.professional_promotions
   WHERE id = p_promotion_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'promotion_not_found: la promoción % no existe', p_promotion_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status NOT IN ('planned', 'cancelled') THEN
    RAISE EXCEPTION 'promotion_not_deletable: la promoción % está en estado %', p_promotion_id, v_status
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(array_agg(id), '{}') INTO v_courses
    FROM public.promotion_courses
   WHERE promotion_id = p_promotion_id;

  SELECT count(*) INTO v_enrollments
    FROM public.enrollments
   WHERE promotion_course_id = ANY (v_courses)
     AND status <> 'draft';

  IF v_enrollments > 0 THEN
    RAISE EXCEPTION 'promotion_has_enrollments: la promoción % tiene % matrícula(s)', p_promotion_id, v_enrollments
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.enrollments
     SET promotion_course_id = NULL
   WHERE promotion_course_id = ANY (v_courses)
     AND status = 'draft';

  DELETE FROM public.professional_theory_sessions   WHERE promotion_course_id = ANY (v_courses);
  DELETE FROM public.professional_practice_sessions WHERE promotion_course_id = ANY (v_courses);
  DELETE FROM public.class_book                     WHERE promotion_course_id = ANY (v_courses);
  DELETE FROM public.promotion_courses              WHERE promotion_id = p_promotion_id;
  DELETE FROM public.professional_promotions        WHERE id = p_promotion_id;
END;
$$;

COMMENT ON FUNCTION public.delete_promotion_without_students(INT) IS
  'fix-348-m (D20): elimina una promoción planificada o cancelada sin matrículas, con sus cursos, sesiones, relatores y libros, liberando su lunes y su número. Solo admin. Reemplaza a "cancelar" en la app.';

REVOKE EXECUTE ON FUNCTION public.delete_promotion_without_students(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_promotion_without_students(INT) TO authenticated, service_role;
