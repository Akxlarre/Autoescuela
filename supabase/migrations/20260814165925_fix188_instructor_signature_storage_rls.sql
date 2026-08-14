-- ============================================================
-- Fix-188-m: Instructor no puede finalizar clase con firmas
--
-- Problema: documents_auth_insert / documents_auth_update (bucket 'documents')
-- solo permiten INSERT/UPDATE a secretary/admin. InstructorClasesFacade.uploadSignature()
-- sube las firmas de alumno/instructor a 'sessions/{sessionId}/signature_*.png' al
-- finalizar una clase, y el instructor recibe 403 (RLS) al no estar contemplado.
--
-- Solución: agregar el rol instructor a ambas policies, acotado a objetos bajo
-- 'sessions/{sessionId}/...' donde esa sesión le pertenezca (class_b_sessions.instructor_id
-- = auth_instructor_id()). No se le da acceso de escritura al resto del bucket.
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
          WHERE cb.id = ((storage.foldername(name))[2])::int
            AND cb.instructor_id = public.auth_instructor_id()
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
          WHERE cb.id = ((storage.foldername(name))[2])::int
            AND cb.instructor_id = public.auth_instructor_id()
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
          WHERE cb.id = ((storage.foldername(name))[2])::int
            AND cb.instructor_id = public.auth_instructor_id()
        )
      )
    )
  );
