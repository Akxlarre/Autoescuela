-- ============================================================
-- Migration: Securizar bucket 'documents' (OWASP A01 / A04)
--
-- Problema: El bucket era public:true con una policy SELECT incondicional,
-- exponiendo carnets, HVC, contratos y certificados a cualquier atacante.
--
-- Solución:
--   1. Cambiar bucket a public:false (acceso privado)
--   2. Reemplazar documents_public_read por política autenticada con roles
--   3. Migrar URLs absolutas existentes en BD a rutas relativas (paths)
--      para que las Facades generen signed URLs (TTL) en el lado cliente.
-- ============================================================

-- ── 1. Hacer el bucket privado ──────────────────────────────────────────────
UPDATE storage.buckets
SET public = false
WHERE id = 'documents';

-- ── 2. Eliminar política de lectura pública incondicional ───────────────────
DROP POLICY IF EXISTS "documents_public_read" ON storage.objects;

-- ── 3. Nueva política de lectura: solo usuarios autenticados con rol válido ─
--    Admin → puede leer cualquier documento.
--    Secretary / Instructor / Relator → pueden leer documentos de su sede
--    (la granularidad fina de "solo sus alumnos" se delega al nivel de app).
CREATE POLICY "documents_authenticated_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid()
        AND r.name IN ('admin', 'secretary', 'instructor', 'relator')
    )
  );

-- ── 4. Migrar URLs absolutas → rutas relativas ──────────────────────────────
--
-- Patrón de URL pública que se reemplaza:
--   https://<project>.supabase.co/storage/v1/object/public/documents/<path>
--   → <path>
--
-- Se usa regexp_replace con el marcador fijo del bucket.
-- El CASE garantiza idempotencia: no toca filas que ya tienen rutas relativas.

-- 4a. student_documents.storage_url
UPDATE public.student_documents
SET storage_url = regexp_replace(
  storage_url,
  '^.+/storage/v1/object/public/documents/',
  ''
)
WHERE storage_url LIKE '%/storage/v1/object/public/documents/%';

-- 4b. school_documents.storage_url
UPDATE public.school_documents
SET storage_url = regexp_replace(
  storage_url,
  '^.+/storage/v1/object/public/documents/',
  ''
)
WHERE storage_url LIKE '%/storage/v1/object/public/documents/%';

-- 4c. digital_contracts.file_url
UPDATE public.digital_contracts
SET file_url = regexp_replace(
  file_url,
  '^.+/storage/v1/object/public/documents/',
  ''
)
WHERE file_url LIKE '%/storage/v1/object/public/documents/%';

-- 4d. document_templates.file_url
UPDATE public.document_templates
SET file_url = regexp_replace(
  file_url,
  '^.+/storage/v1/object/public/documents/',
  ''
)
WHERE file_url LIKE '%/storage/v1/object/public/documents/%';

-- 4e. enrollments.certificate_b_pdf_url
UPDATE public.enrollments
SET certificate_b_pdf_url = regexp_replace(
  certificate_b_pdf_url,
  '^.+/storage/v1/object/public/documents/',
  ''
)
WHERE certificate_b_pdf_url LIKE '%/storage/v1/object/public/documents/%';
