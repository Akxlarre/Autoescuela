-- ============================================================
-- Migration: Permitir uploads anónimos de foto carnet (ruta temporal)
--
-- Propósito: El flujo de matrícula pública (sin auth) necesita subir la
--   foto de carnet antes de que exista un enrollment_id. Se usa una ruta
--   temporal en el bucket 'documents' bajo el prefijo public-uploads/carnet/.
--
-- Flujo de 2 etapas:
--   1. Cliente anónimo sube → documents/public-uploads/carnet/{sessionToken}
--   2. Edge Function (service role) mueve → documents/students/{enrollmentId}/id_photo
--      y registra en student_documents (tipo: id_photo, status: approved).
--
-- La Edge Function limpia la ruta temporal con storage.move() (destruye el origen).
-- ============================================================

-- INSERT: usuario anónimo puede subir solo dentro de public-uploads/carnet/
DROP POLICY IF EXISTS "documents_anon_carnet_insert" ON storage.objects;
CREATE POLICY "documents_anon_carnet_insert"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'documents'
    AND name LIKE 'public-uploads/carnet/%'
  );

-- UPDATE: necesario para que upload({ upsert: true }) funcione si el archivo ya existe
-- (ej: el usuario reemplaza la foto antes de confirmar el horario)
DROP POLICY IF EXISTS "documents_anon_carnet_update" ON storage.objects;
CREATE POLICY "documents_anon_carnet_update"
  ON storage.objects FOR UPDATE
  TO anon
  USING (
    bucket_id = 'documents'
    AND name LIKE 'public-uploads/carnet/%'
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND name LIKE 'public-uploads/carnet/%'
  );
