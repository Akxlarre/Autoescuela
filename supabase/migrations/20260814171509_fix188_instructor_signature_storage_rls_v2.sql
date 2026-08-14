-- ============================================================
-- Fix-188-m v2: la policy de 20260814165925 seguia dando 403.
--
-- Causa: usaba public.auth_instructor_id() (SECURITY DEFINER, SET search_path='')
-- dentro del contexto de RLS de storage.objects. La migracion 20260310130000 ya
-- documento que auth_user_role() puede retornar NULL silenciosamente en ese
-- contexto y por eso todas las demas policies de este bucket usan subquery
-- directa en vez de los helpers — esta policy nueva era la unica excepcion.
--
-- Solucion: reemplazar auth_instructor_id() por el mismo patron de subquery
-- directa (join class_b_sessions -> instructors -> users por supabase_uid).
-- ============================================================

DROP POLICY IF EXISTS "documents_auth_insert" ON storage.objects;
CREATE POLICY "documents_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (
      EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.roles r ON r.id = u.role_id
        WHERE u.supabase_uid = auth.uid()
          AND r.name IN ('secretary', 'admin')
      )
      OR (
        name LIKE 'sessions/%'
        AND EXISTS (
          SELECT 1
          FROM public.class_b_sessions cb
          JOIN public.instructors i ON i.id = cb.instructor_id
          JOIN public.users u ON u.id = i.user_id
          WHERE cb.id = ((storage.foldername(name))[2])::int
            AND u.supabase_uid = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "documents_auth_update" ON storage.objects;
CREATE POLICY "documents_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.roles r ON r.id = u.role_id
        WHERE u.supabase_uid = auth.uid()
          AND r.name IN ('secretary', 'admin')
      )
      OR (
        name LIKE 'sessions/%'
        AND EXISTS (
          SELECT 1
          FROM public.class_b_sessions cb
          JOIN public.instructors i ON i.id = cb.instructor_id
          JOIN public.users u ON u.id = i.user_id
          WHERE cb.id = ((storage.foldername(name))[2])::int
            AND u.supabase_uid = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (
      EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.roles r ON r.id = u.role_id
        WHERE u.supabase_uid = auth.uid()
          AND r.name IN ('secretary', 'admin')
      )
      OR (
        name LIKE 'sessions/%'
        AND EXISTS (
          SELECT 1
          FROM public.class_b_sessions cb
          JOIN public.instructors i ON i.id = cb.instructor_id
          JOIN public.users u ON u.id = i.user_id
          WHERE cb.id = ((storage.foldername(name))[2])::int
            AND u.supabase_uid = auth.uid()
        )
      )
    )
  );
