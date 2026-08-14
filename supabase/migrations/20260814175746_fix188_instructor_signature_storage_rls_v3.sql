-- ============================================================
-- Fix-188-m v3: seguia dando 403 (RLS) en el upsert de firmas pese a que
-- documents_auth_insert/documents_auth_update (v2) ya cubrian al instructor.
--
-- Causa: nunca existio una policy SELECT para instructor sobre el bucket
-- 'documents' (documents_authenticated_read solo cubre admin/secretary; la
-- otra SELECT existente es solo para que el alumno vea su propio certificado).
-- El upload() con upsert:true de Supabase Storage ejecuta un
-- INSERT ... ON CONFLICT (name, bucket_id) DO UPDATE ... RETURNING *, y sin
-- visibilidad SELECT de la fila resultante el Storage API termina
-- reportando el mismo error generico de RLS aunque el INSERT/UPDATE en si
-- ya este permitido.
--
-- Solucion: agregar una policy SELECT para instructor, acotada igual que
-- las de insert/update (v2) a objetos bajo 'sessions/{id}/...' de sus
-- propias clases.
-- ============================================================

DROP POLICY IF EXISTS "documents_instructor_own_session_read" ON storage.objects;
CREATE POLICY "documents_instructor_own_session_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND name LIKE 'sessions/%'
    AND EXISTS (
      SELECT 1
      FROM public.class_b_sessions cb
      JOIN public.instructors i ON i.id = cb.instructor_id
      JOIN public.users u ON u.id = i.user_id
      WHERE cb.id = ((storage.foldername(name))[2])::int
        AND u.supabase_uid = auth.uid()
    )
  );
