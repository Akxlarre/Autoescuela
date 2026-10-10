-- fix-218-b: toda columna de una tabla auditada (trigger log_change) tiene etiqueta en español
-- en audit_humanize_column(); ninguna cae al fallback initcap (que dejaba "Phone", "Email"…).
--
-- Excepciones: columnas que la auditoría no muestra (id, created_at, updated_at) y las que se
-- traducen igual que el fallback ('folio' → 'Folio', 'horario' → 'Horario').
--
-- Solo lectura. Correr: node <scratchpad>/sql.mjs supabase/tests/audit/fix-218-b-etiquetas-auditoria.sql
DO $$
DECLARE
  v_faltantes text;
BEGIN
  -- 1. Las del hallazgo (grupo 1 manual de ASG-i-034).
  IF public.audit_humanize_column('phone') <> 'Teléfono' THEN
    RAISE EXCEPTION 'phone sigue sin traducir: %', public.audit_humanize_column('phone');
  END IF;
  IF public.audit_humanize_column('email') <> 'Correo' THEN
    RAISE EXCEPTION 'email sigue sin traducir: %', public.audit_humanize_column('email');
  END IF;

  -- 2. Barrido: ninguna columna auditada cae al fallback.
  SELECT string_agg(c.table_name || '.' || c.column_name, ', ' ORDER BY c.table_name, c.column_name)
    INTO v_faltantes
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name IN (
       SELECT DISTINCT t.event_object_table
         FROM information_schema.triggers t
        WHERE t.trigger_schema = 'public'
          AND t.action_statement ILIKE '%log_change%'
     )
     AND c.column_name NOT IN ('id', 'created_at', 'updated_at', 'folio', 'horario')
     AND public.audit_humanize_column(c.column_name) = initcap(replace(c.column_name, '_', ' '));

  IF v_faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'Columnas auditadas sin etiqueta en español: %', v_faltantes;
  END IF;

  RAISE NOTICE 'fix-218-b OK: todas las columnas auditadas tienen etiqueta';
END;
$$;

SELECT 'fix-218-b OK' AS resultado;
