-- ============================================================
-- Migration: Re-establecer RLS anónimo para upload de foto carnet
--
-- Problema: La migración 20260413000001_secure_documents_bucket.sql
--   cambió el bucket 'documents' a public:false y renovó las políticas
--   de lectura. Las políticas anónimas de INSERT/UPDATE para la ruta
--   temporal de carnet (creadas en 20260317140000) pueden haberse
--   perdido tras un db reset / push o no haberse aplicado en el
--   entorno actual, causando 403 "new row violates row-level security".
--
-- Solución: Re-crear las políticas con CHECK más estricto:
--   - LIKE 'public-uploads/carnet/%' → regex que además valida que
--     el segmento del token no contenga '/' ni '..' (solo [0-9a-zA-Z-])
--   - No se agrega política SELECT: el cliente usa blob URLs locales,
--     nunca necesita leer desde Storage.
--   - No afecta otras rutas del bucket ni las políticas de autenticados.
--
-- Superficie de ataque:
--   • Anon puede subir SOLO a documents/public-uploads/carnet/{token}
--   • Token debe coincidir con /^[0-9a-zA-Z-]+$/ (UUID o fallback timestamp-random)
--   • La Edge Function valida el path antes de moverlo (defensa en profundidad)
--   • Archivos temporales se sobreescriben con el enrollment_id del alumno al confirmar
-- ============================================================

-- ── INSERT: usuario anónimo puede subir foto carnet a la ruta temporal ─────────
DROP POLICY IF EXISTS "documents_anon_carnet_insert" ON storage.objects;
CREATE POLICY "documents_anon_carnet_insert"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'documents'
    -- Prefijo correcto + token formado solo por caracteres seguros (sin / ni ..)
    AND name ~ '^public-uploads/carnet/[0-9a-zA-Z\-]+$'
  );

-- ── UPDATE: necesario para upsert:true cuando el usuario reemplaza la foto ─────
DROP POLICY IF EXISTS "documents_anon_carnet_update" ON storage.objects;
CREATE POLICY "documents_anon_carnet_update"
  ON storage.objects FOR UPDATE
  TO anon
  USING  (bucket_id = 'documents' AND name ~ '^public-uploads/carnet/[0-9a-zA-Z\-]+$')
  WITH CHECK (bucket_id = 'documents' AND name ~ '^public-uploads/carnet/[0-9a-zA-Z\-]+$');
