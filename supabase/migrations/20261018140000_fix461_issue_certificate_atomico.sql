-- ============================================================================
-- fix-461-m: emisión atómica del registro de certificado (folio sin choques ni duplicados)
-- ============================================================================
-- Antes, generate-certificate-b-pdf y generate-certificate-professional-pdf hacían "buscar
-- existente → leer max(folio) → +1 → insertar" sin transacción ni lock:
--   · dos alumnos a la vez → mismo folio → choque con certificates_folio_key; el error se ignoraba
--     y quedaba un PDF "Generado" sin registro (el correo después fallaba);
--   · la misma matrícula dos veces a la vez → dos certificados ((enrollment_id, type) no era único).
--
-- Cambio:
--   1. Índice único (enrollment_id, type): a lo sumo un certificado por matrícula y tipo
--      (verificado 2026-10-18: no hay duplicados).
--   2. issue_certificate(...): bajo pg_advisory_xact_lock (una emisión a la vez, todo el sistema —
--      el folio es global) devuelve el certificado existente o inserta uno nuevo con max(folio)+1.
--      issued_date = chile_today() (fecha de negocio de Chile, dates.md).
--      SECURITY DEFINER + search_path=''; solo service_role la ejecuta (la llaman las edge
--      functions con la clave de servicio, después de validar staff y sede).
--
-- Idempotente: CREATE UNIQUE INDEX IF NOT EXISTS + CREATE OR REPLACE.
-- Rollback: DROP FUNCTION public.issue_certificate(int, int, text, int);
--           DROP INDEX public.certificates_enrollment_type_key;
-- Verificación: supabase/tests/rls/fix-461-m-issue-certificate.sql
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS certificates_enrollment_type_key
  ON public.certificates (enrollment_id, type);

CREATE OR REPLACE FUNCTION public.issue_certificate(
  p_enrollment_id INT,
  p_student_id    INT,
  p_type          TEXT,
  p_issued_by     INT
)
RETURNS TABLE (id INT, folio INT, created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id    INT;
  v_folio INT;
BEGIN
  -- Serializa la emisión: el folio es global y se calcula como max+1.
  PERFORM pg_advisory_xact_lock(hashtext('public.certificates.folio'));

  SELECT c.id, c.folio INTO v_id, v_folio
    FROM public.certificates c
   WHERE c.enrollment_id = p_enrollment_id AND c.type = p_type;

  IF FOUND THEN
    RETURN QUERY SELECT v_id, v_folio, false;
    RETURN;
  END IF;

  SELECT COALESCE(MAX(c.folio), 0) + 1 INTO v_folio FROM public.certificates c;

  INSERT INTO public.certificates (folio, enrollment_id, student_id, type, status, issued_date, issued_by)
  VALUES (v_folio, p_enrollment_id, p_student_id, p_type, 'issued', public.chile_today(), p_issued_by)
  RETURNING certificates.id INTO v_id;

  RETURN QUERY SELECT v_id, v_folio, true;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_certificate(INT, INT, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_certificate(INT, INT, TEXT, INT) TO service_role;
