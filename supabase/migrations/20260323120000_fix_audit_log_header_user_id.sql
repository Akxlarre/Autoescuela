-- ============================================================================
-- Fix audit_log: resolver user_id desde header HTTP x-audit-user-id (RF-009)
-- ============================================================================
-- Problema raíz:
--   Las Edge Functions usan SERVICE_ROLE_KEY para operar en BD.
--   El service role no tiene sesión de usuario → auth.uid() = NULL en trigger.
--   La migración 20260323100000 no resolvió este caso.
--
-- Solución:
--   Las Edge Functions crean un cliente con header 'x-audit-user-id: <users.id>'
--   antes de operaciones auditables. PostgREST expone todos los headers HTTP de
--   la request como JSON en current_setting('request.headers').
--   El trigger lee ese header primero y, si no existe, cae al fallback auth.uid().
--
-- Prioridad de resolución del user_id:
--   1. Header 'x-audit-user-id' (Edge Functions con service role)
--   2. auth.uid() → users.id  (llamadas directas con JWT del usuario)
--   3. NULL                   (service role sin header — operaciones internas)
-- ============================================================================

CREATE OR REPLACE FUNCTION log_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id      INT;
  v_headers_raw  TEXT;
  v_header_id    TEXT;
BEGIN
  -- 1. Intentar leer desde header HTTP personalizado (Edge Functions)
  v_headers_raw := current_setting('request.headers', true);
  IF v_headers_raw IS NOT NULL AND v_headers_raw <> '' THEN
    BEGIN
      v_header_id := (v_headers_raw::json)->>'x-audit-user-id';
      IF v_header_id IS NOT NULL AND v_header_id <> '' THEN
        v_user_id := v_header_id::INT;
      END IF;
    EXCEPTION WHEN others THEN
      -- JSON malformado — ignorar y continuar con fallback
      NULL;
    END;
  END IF;

  -- 2. Fallback: resolver desde auth.uid() (llamadas con JWT del usuario)
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM public.users
    WHERE supabase_uid = auth.uid();
  END IF;

  INSERT INTO public.audit_log (user_id, action, entity, entity_id, detail, created_at)
  VALUES (
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'Registro creado'
      WHEN TG_OP = 'UPDATE' THEN 'Registro actualizado'
      WHEN TG_OP = 'DELETE' THEN 'Registro eliminado'
    END,
    NOW()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

COMMENT ON FUNCTION log_change() IS
  'Trigger de auditoría. Resuelve user_id en orden: (1) header x-audit-user-id [Edge Functions], (2) auth.uid() [JWT directo], (3) NULL [service role interno].';
