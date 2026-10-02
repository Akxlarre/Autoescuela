-- ============================================================================
-- fix-178-b: Storage — aislamiento por sede en `documents` y `website-public`
-- ============================================================================
-- Contexto (ASG-i-046, confirmado contra la BD remota el 2026-10-01): las policies de
-- storage.objects solo miraban el rol. Una secretaria de la sede 1 leía 213 objetos que no eran
-- de su sede (cédulas, contratos, certificados, licencias), podía subir/sobrescribir archivos en
-- rutas de la otra sede y mover un archivo propio a una ruta ajena. Además, cualquiera SIN
-- sesión podía subir archivos a website-public/seeds/ (policy TO public sin condición).
--
-- La sede ya está codificada en la ruta; esta migración la cruza con la del usuario:
--   students|contracts|certificates|certificates_prof|student-licenses/<enrollment_id>/…
--   sessions/<class_b_session_id>/…            → sede de su matrícula
--   instructor-docs/<instructor_id>/…          → sede del usuario del instructor, o "ambas sedes"
--   class-books/<promotion_course_id>/…        → sede de la promoción
--   website-assets/branch-<id>/…               → literal
--   school-docs/… · templates/… · vehicle-docs/… → sin sede en la ruta (sin cambio para la secretaria)
--   cualquier otro prefijo                      → DENEGADO a la secretaria (lista blanca)
--
-- Solo cambia la cláusula de la secretaria. Sin cambios: admin (todo), instructor (sessions/ de sus
-- clases), alumno (sus certificados), anon del wizard público (public-uploads/carnet/), DELETE
-- solo admin, lectura pública de website-public.
--
-- Patrón de rendimiento igual que spec 0047-b (DG-016/DG-098): rol y sede como InitPlan
-- ((SELECT public.auth_user_role()), (SELECT public.auth_user_branch_id())) y pertenencia con
-- IN (subquery) no correlacionado — una evaluación por query, ninguna función por fila.
--
-- UPDATE declara el mismo predicado en USING y WITH CHECK: no se puede tocar un objeto ajeno ni
-- renombrar uno propio hacia una ruta de la otra sede.
--
-- Rollback: recrear las policies anteriores (snapshot en
-- specs/fixes/fix-178-b-storage-aislamiento-por-sede/fix.md §Rollback).
-- Idempotente: DROP POLICY IF EXISTS + CREATE POLICY.
-- Verificación: supabase/tests/rls/fix-178-b-storage-por-sede.sql
-- ============================================================================


-- ── documents: lectura ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS documents_authenticated_read ON storage.objects;
CREATE POLICY documents_authenticated_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      (SELECT public.auth_user_role()) = 'admin'
      OR (
        (SELECT public.auth_user_role()) = 'secretary'
        AND (
          (SELECT public.auth_can_access_both_branches())
          OR (storage.foldername(name))[1] IN ('school-docs', 'templates', 'vehicle-docs')
          OR ((storage.foldername(name))[1] IN ('students', 'contracts', 'certificates', 'certificates_prof', 'student-licenses')
              AND (storage.foldername(name))[2] IN (
                    SELECT e.id::text FROM public.enrollments e
                     WHERE e.branch_id IS NULL OR e.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'sessions'
              AND (storage.foldername(name))[2] IN (
                    SELECT cb.id::text FROM public.class_b_sessions cb
                      JOIN public.enrollments e ON e.id = cb.enrollment_id
                     WHERE e.branch_id IS NULL OR e.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'instructor-docs'
              AND (storage.foldername(name))[2] IN (
                    SELECT i.id::text FROM public.instructors i
                      JOIN public.users u ON u.id = i.user_id
                     WHERE i.both_branches OR u.branch_id IS NULL
                        OR u.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'class-books'
              AND (storage.foldername(name))[2] IN (
                    SELECT pc.id::text FROM public.promotion_courses pc
                      JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                     WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'website-assets'
              AND (storage.foldername(name))[2] = 'branch-' || (SELECT public.auth_user_branch_id())::text)
        )
      )
    )
  );


-- ── documents: escritura (INSERT / UPDATE) ──────────────────────────────────
-- Mismo alcance que la lectura para la secretaria + cláusula del instructor (sessions/ de sus
-- clases) copiada sin cambios de la policy anterior.

DROP POLICY IF EXISTS documents_auth_insert ON storage.objects;
CREATE POLICY documents_auth_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (
      (SELECT public.auth_user_role()) = 'admin'
      OR (
        (SELECT public.auth_user_role()) = 'secretary'
        AND (
          (SELECT public.auth_can_access_both_branches())
          OR (storage.foldername(name))[1] IN ('school-docs', 'templates', 'vehicle-docs')
          OR ((storage.foldername(name))[1] IN ('students', 'contracts', 'certificates', 'certificates_prof', 'student-licenses')
              AND (storage.foldername(name))[2] IN (
                    SELECT e.id::text FROM public.enrollments e
                     WHERE e.branch_id IS NULL OR e.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'sessions'
              AND (storage.foldername(name))[2] IN (
                    SELECT cb.id::text FROM public.class_b_sessions cb
                      JOIN public.enrollments e ON e.id = cb.enrollment_id
                     WHERE e.branch_id IS NULL OR e.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'instructor-docs'
              AND (storage.foldername(name))[2] IN (
                    SELECT i.id::text FROM public.instructors i
                      JOIN public.users u ON u.id = i.user_id
                     WHERE i.both_branches OR u.branch_id IS NULL
                        OR u.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'class-books'
              AND (storage.foldername(name))[2] IN (
                    SELECT pc.id::text FROM public.promotion_courses pc
                      JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                     WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'website-assets'
              AND (storage.foldername(name))[2] = 'branch-' || (SELECT public.auth_user_branch_id())::text)
        )
      )
      OR (
        name LIKE 'sessions/%'
        AND EXISTS (
          SELECT 1 FROM public.class_b_sessions cb
            JOIN public.instructors i ON i.id = cb.instructor_id
            JOIN public.users u ON u.id = i.user_id
           WHERE cb.id = ((storage.foldername(objects.name))[2])::integer
             AND u.supabase_uid = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS documents_auth_update ON storage.objects;
CREATE POLICY documents_auth_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      (SELECT public.auth_user_role()) = 'admin'
      OR (
        (SELECT public.auth_user_role()) = 'secretary'
        AND (
          (SELECT public.auth_can_access_both_branches())
          OR (storage.foldername(name))[1] IN ('school-docs', 'templates', 'vehicle-docs')
          OR ((storage.foldername(name))[1] IN ('students', 'contracts', 'certificates', 'certificates_prof', 'student-licenses')
              AND (storage.foldername(name))[2] IN (
                    SELECT e.id::text FROM public.enrollments e
                     WHERE e.branch_id IS NULL OR e.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'sessions'
              AND (storage.foldername(name))[2] IN (
                    SELECT cb.id::text FROM public.class_b_sessions cb
                      JOIN public.enrollments e ON e.id = cb.enrollment_id
                     WHERE e.branch_id IS NULL OR e.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'instructor-docs'
              AND (storage.foldername(name))[2] IN (
                    SELECT i.id::text FROM public.instructors i
                      JOIN public.users u ON u.id = i.user_id
                     WHERE i.both_branches OR u.branch_id IS NULL
                        OR u.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'class-books'
              AND (storage.foldername(name))[2] IN (
                    SELECT pc.id::text FROM public.promotion_courses pc
                      JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                     WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'website-assets'
              AND (storage.foldername(name))[2] = 'branch-' || (SELECT public.auth_user_branch_id())::text)
        )
      )
      OR (
        name LIKE 'sessions/%'
        AND EXISTS (
          SELECT 1 FROM public.class_b_sessions cb
            JOIN public.instructors i ON i.id = cb.instructor_id
            JOIN public.users u ON u.id = i.user_id
           WHERE cb.id = ((storage.foldername(objects.name))[2])::integer
             AND u.supabase_uid = auth.uid())
      )
    )
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (
      (SELECT public.auth_user_role()) = 'admin'
      OR (
        (SELECT public.auth_user_role()) = 'secretary'
        AND (
          (SELECT public.auth_can_access_both_branches())
          OR (storage.foldername(name))[1] IN ('school-docs', 'templates', 'vehicle-docs')
          OR ((storage.foldername(name))[1] IN ('students', 'contracts', 'certificates', 'certificates_prof', 'student-licenses')
              AND (storage.foldername(name))[2] IN (
                    SELECT e.id::text FROM public.enrollments e
                     WHERE e.branch_id IS NULL OR e.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'sessions'
              AND (storage.foldername(name))[2] IN (
                    SELECT cb.id::text FROM public.class_b_sessions cb
                      JOIN public.enrollments e ON e.id = cb.enrollment_id
                     WHERE e.branch_id IS NULL OR e.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'instructor-docs'
              AND (storage.foldername(name))[2] IN (
                    SELECT i.id::text FROM public.instructors i
                      JOIN public.users u ON u.id = i.user_id
                     WHERE i.both_branches OR u.branch_id IS NULL
                        OR u.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'class-books'
              AND (storage.foldername(name))[2] IN (
                    SELECT pc.id::text FROM public.promotion_courses pc
                      JOIN public.professional_promotions pp ON pp.id = pc.promotion_id
                     WHERE pp.branch_id IS NULL OR pp.branch_id = (SELECT public.auth_user_branch_id())))
          OR ((storage.foldername(name))[1] = 'website-assets'
              AND (storage.foldername(name))[2] = 'branch-' || (SELECT public.auth_user_branch_id())::text)
        )
      )
      OR (
        name LIKE 'sessions/%'
        AND EXISTS (
          SELECT 1 FROM public.class_b_sessions cb
            JOIN public.instructors i ON i.id = cb.instructor_id
            JOIN public.users u ON u.id = i.user_id
           WHERE cb.id = ((storage.foldername(objects.name))[2])::integer
             AND u.supabase_uid = auth.uid())
      )
    )
  );


-- ── website-public: sin subida anónima + secretaria solo en su sede ──────────
-- La lectura pública (website_public_select) y el DELETE solo admin no cambian.

DROP POLICY IF EXISTS website_public_seed_insert ON storage.objects;

DROP POLICY IF EXISTS website_public_insert ON storage.objects;
CREATE POLICY website_public_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'website-public'
    AND (
      (SELECT public.auth_user_role()) = 'admin'
      OR ((SELECT public.auth_user_role()) = 'secretary'
          AND ((SELECT public.auth_can_access_both_branches())
               OR ((storage.foldername(name))[1] = 'website-assets'
                   AND (storage.foldername(name))[2] = 'branch-' || (SELECT public.auth_user_branch_id())::text)))
    )
  );

DROP POLICY IF EXISTS website_public_update ON storage.objects;
CREATE POLICY website_public_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'website-public'
    AND (
      (SELECT public.auth_user_role()) = 'admin'
      OR ((SELECT public.auth_user_role()) = 'secretary'
          AND ((SELECT public.auth_can_access_both_branches())
               OR ((storage.foldername(name))[1] = 'website-assets'
                   AND (storage.foldername(name))[2] = 'branch-' || (SELECT public.auth_user_branch_id())::text)))
    )
  )
  WITH CHECK (
    bucket_id = 'website-public'
    AND (
      (SELECT public.auth_user_role()) = 'admin'
      OR ((SELECT public.auth_user_role()) = 'secretary'
          AND ((SELECT public.auth_can_access_both_branches())
               OR ((storage.foldername(name))[1] = 'website-assets'
                   AND (storage.foldername(name))[2] = 'branch-' || (SELECT public.auth_user_branch_id())::text)))
    )
  );
