-- ============================================================
-- Migration: Create 'website-public' storage bucket + RLS policies
-- Purpose:   Permite a la landing page pública y al cPanel de Angular
--            cargar logos e imágenes OG de forma pública sin firmar,
--            mientras que admins/secretarias pueden modificarlos.
-- ============================================================

-- 1. Crear el bucket público si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'website-public',
  'website-public',
  true,
  52428800,   -- 50 MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

-- ============================================================
-- 2. RLS Policies para storage.objects (bucket: website-public)
-- ============================================================

-- 2a. Lectura pública (SELECT) para todos (anónimos y autenticados)
DROP POLICY IF EXISTS "website_public_select" ON storage.objects;
CREATE POLICY "website_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'website-public');

-- 2b. Inserción (INSERT) para administradores y secretarias
DROP POLICY IF EXISTS "website_public_insert" ON storage.objects;
CREATE POLICY "website_public_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'website-public'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid()
        AND r.name IN ('admin', 'secretary')
    )
  );

-- 2c. Subida Semilla Temporal (INSERT) para anónimos (solo en la subcarpeta 'seeds/')
-- Esto permite que nuestro script autónomo local suba los assets por defecto sin autenticación.
DROP POLICY IF EXISTS "website_public_seed_insert" ON storage.objects;
CREATE POLICY "website_public_seed_insert"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (
    bucket_id = 'website-public'
    AND (position('seeds/' in name) = 1)
  );

-- 2d. Actualización (UPDATE) para administradores y secretarias
DROP POLICY IF EXISTS "website_public_update" ON storage.objects;
CREATE POLICY "website_public_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'website-public'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid()
        AND r.name IN ('admin', 'secretary')
    )
  );

-- 2e. Eliminación (DELETE) solo para administradores
DROP POLICY IF EXISTS "website_public_delete" ON storage.objects;
CREATE POLICY "website_public_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'website-public'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.supabase_uid = auth.uid()
        AND r.name = 'admin'
    )
  );
