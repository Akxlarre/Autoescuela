-- Migration: Permite a alumnos leer sus propios certificados y carnets desde storage
--
-- Problema: La política `documents_authenticated_read` solo permite SELECT
-- a roles admin/secretary. Los alumnos no pueden llamar createSignedUrl,
-- por lo que la descarga del certificado en el portal falla silenciosamente.
--
-- Solución: Política de lectura granular que permite al alumno acceder SOLO
-- a los paths almacenados en las columnas de su matrícula activa (no a otros
-- certificados), usando un JOIN directo a enrollments para máxima seguridad.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "documents_student_own_certificate_read" ON storage.objects;

CREATE POLICY "documents_student_own_certificate_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1
      FROM public.enrollments en
      JOIN public.students st ON st.id = en.student_id
      JOIN public.users u ON u.id = st.user_id
      WHERE u.supabase_uid = auth.uid()
        AND (
          en.certificate_b_pdf_url            = storage.objects.name
          OR en.certificate_professional_pdf_url = storage.objects.name
          OR en.license_pdf_url                = storage.objects.name
        )
    )
  );
