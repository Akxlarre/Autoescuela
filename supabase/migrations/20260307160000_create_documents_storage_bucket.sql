-- ============================================================
-- Migration: Create 'documents' storage bucket + RLS policies
-- Purpose:   Permite a secretarias subir documentos de alumnos
--            durante el proceso de matrícula.
-- Requiere:  auth_user_role() definida en 10_rls_policies.sql
-- ============================================================

-- 1. Crear el bucket si no existe
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
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. RLS Policies para storage.objects (bucket: documents)
-- ============================================================

-- Lectura pública (URLs directas accesibles sin auth)
DROP POLICY IF EXISTS "documents_public_read" ON storage.objects;
CREATE POLICY "documents_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

-- Subida: secretaria o admin
DROP POLICY IF EXISTS "documents_auth_insert" ON storage.objects;
CREATE POLICY "documents_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND auth_user_role() IN ('secretary', 'admin')
  );

-- Actualización (upsert): secretaria o admin
DROP POLICY IF EXISTS "documents_auth_update" ON storage.objects;
CREATE POLICY "documents_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND auth_user_role() IN ('secretary', 'admin')
  );

-- Eliminación: solo admin
DROP POLICY IF EXISTS "documents_admin_delete" ON storage.objects;
CREATE POLICY "documents_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND auth_user_role() = 'admin'
  );
