-- ============================================================
-- Fix: Storage RLS para bucket 'documents'
-- Problema: POST 400 al subir HVC, cédula y licencia.
--   1. ON CONFLICT DO NOTHING no actualizaba allowed_mime_types si el bucket ya existía.
--   2. UPDATE policy sin WITH CHECK → Supabase rechaza upsert cuando el archivo ya existe.
--   3. auth_user_role() puede retornar NULL en el contexto del schema storage.
-- Solución: DO UPDATE para forzar settings del bucket + policies con subquery directa.
-- ============================================================

-- 1. Upsert del bucket forzando configuración correcta
-- NOTA: public se omite del DO UPDATE para no revertir 20260413000001_secure_documents_bucket.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760,   -- 10 MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- 2. RLS Policies — reemplazar con subquery directa
--    Evitamos auth_user_role() en el contexto de storage porque
--    SECURITY DEFINER + SET search_path='' puede fallar silenciosamente.
-- ============================================================

-- Lectura pública (sin cambios, bucket es public:true)
DROP POLICY IF EXISTS "documents_public_read" ON storage.objects;
CREATE POLICY "documents_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

-- INSERT: secretaria o admin (subquery directa)
DROP POLICY IF EXISTS "documents_auth_insert" ON storage.objects;
CREATE POLICY "documents_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid()
        AND r.name IN ('secretary', 'admin')
    )
  );

-- UPDATE: secretaria o admin — con USING + WITH CHECK para soportar upsert
DROP POLICY IF EXISTS "documents_auth_update" ON storage.objects;
CREATE POLICY "documents_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid()
        AND r.name IN ('secretary', 'admin')
    )
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid()
        AND r.name IN ('secretary', 'admin')
    )
  );

-- DELETE: solo admin
DROP POLICY IF EXISTS "documents_admin_delete" ON storage.objects;
CREATE POLICY "documents_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid()
        AND r.name = 'admin'
    )
  );

-- ============================================================
-- 3. Garantizar EXECUTE en helpers para el rol authenticated
--    (por si acaso no estaban otorgados explícitamente)
-- ============================================================
GRANT EXECUTE ON FUNCTION public.auth_user_role()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_id()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_branch_id() TO authenticated;
