-- ============================================================================
-- Fix audit_log: capturar user_id en trigger log_change() (RF-009)
-- ============================================================================
-- Problema: log_change() insertaba en audit_log SIN user_id (campo siempre NULL),
-- lo que impedía filtrar logs por secretaria en la vista de Auditoría.
--
-- Solución: reemplazar la función para que resuelva el user_id de la tabla
-- `users` a partir del UUID de Supabase Auth (`auth.uid()`).
--
-- SECURITY DEFINER: necesario para que auth.uid() sea accesible desde el
-- contexto del trigger (que corre con el usuario que ejecutó la operación).
-- SET search_path = '': evita search_path injection.
-- ============================================================================

CREATE OR REPLACE FUNCTION log_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id INT;
BEGIN
  -- Resolver INT user_id desde el UUID de auth (puede ser NULL si la operación
  -- la ejecuta el service role o una función anónima sin sesión activa).
  SELECT id INTO v_user_id
  FROM public.users
  WHERE supabase_uid = auth.uid();

  INSERT INTO public.audit_log (user_id, action, entity, entity_id, detail, created_at)
  VALUES (
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
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
  'Trigger de auditoría: registra INSERT/UPDATE/DELETE en audit_log con user_id resuelto desde auth.uid(). SECURITY DEFINER para acceder a auth schema.';
