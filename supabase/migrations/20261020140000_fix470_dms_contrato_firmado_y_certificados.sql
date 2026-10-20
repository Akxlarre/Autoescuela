-- fix-470-m (S24 del checklist 033, ASG-i-033): el DMS muestra el contrato firmado de una matrícula
-- online y los certificados emitidos.
--
-- v_dms_student_documents leía digital_contracts.file_url, que en una matrícula online es el
-- contrato generado SIN firma: el escaneo firmado se sube después desde la ficha a
-- digital_contracts.signed_contract_url (20260501000002) y la vista nunca lo leyó. Tampoco
-- mostraba enrollments.certificate_b_pdf_url / certificate_professional_pdf_url.
--
-- Cambio: dos fuentes más, con source = 'enrollment_file' (filas sin registro propio que el DMS
-- pueda borrar: el contrato firmado se gestiona en la ficha y el certificado en Certificación).
-- - Contrato firmado: solo si signed_contract_url es distinto de file_url (en la presencial son
--   el mismo archivo y basta la fila del contrato).
-- - Certificados: fechados con la emisión más reciente de ese tipo en `certificates`.
-- Las cuatro fuentes existentes no cambian (definición copiada de la vista viva al 2026-10-20).
--
-- security_invoker se mantiene: cada fila la filtra la RLS de su tabla de origen.
-- Idempotente: CREATE OR REPLACE VIEW (mismas columnas, mismo orden).
-- Rollback: recrear la vista sin los dos últimos UNION ALL.

CREATE OR REPLACE VIEW public.v_dms_student_documents AS
  SELECT sd.id::text AS id,
    'student_document'::text AS source,
    e.student_id,
    sd.enrollment_id,
    sd.type,
    sd.file_name,
    sd.storage_url AS file_url,
    sd.status,
    sd.uploaded_at AS document_at,
    sd.reviewed_by AS managed_by
   FROM public.student_documents sd
     JOIN public.enrollments e ON e.id = sd.enrollment_id
UNION ALL
  SELECT dc.id::text AS id,
    'digital_contract'::text AS source,
    e.student_id,
    dc.enrollment_id,
    'contract'::text AS type,
    dc.file_name,
    dc.file_url,
    CASE WHEN dc.file_url IS NOT NULL THEN 'approved'::text ELSE 'pending'::text END AS status,
    dc.accepted_at AS document_at,
    NULL::integer AS managed_by
   FROM public.digital_contracts dc
     JOIN public.enrollments e ON e.id = dc.enrollment_id
  WHERE dc.file_url IS NOT NULL
UNION ALL
  SELECT 'lic-init-'::text || e.id::text AS id,
    'enrollment_license'::text AS source,
    e.student_id,
    e.id AS enrollment_id,
    'carnet_inicial'::text AS type,
    'Carnet Inicial.pdf'::text AS file_name,
    e.license_initial_url AS file_url,
    'approved'::text AS status,
    e.created_at AS document_at,
    NULL::integer AS managed_by
   FROM public.enrollments e
  WHERE e.license_initial_url IS NOT NULL
UNION ALL
  SELECT 'lic-full-'::text || e.id::text AS id,
    'enrollment_license'::text AS source,
    e.student_id,
    e.id AS enrollment_id,
    'carnet_completo'::text AS type,
    'Carnet Completo.pdf'::text AS file_name,
    e.license_full_url AS file_url,
    'approved'::text AS status,
    e.created_at AS document_at,
    NULL::integer AS managed_by
   FROM public.enrollments e
  WHERE e.license_full_url IS NOT NULL
UNION ALL
  -- fix-470-m: escaneo firmado de una matrícula online.
  SELECT 'dc-signed-'::text || dc.id::text AS id,
    'enrollment_file'::text AS source,
    e.student_id,
    dc.enrollment_id,
    'contract_signed'::text AS type,
    'Contrato firmado.pdf'::text AS file_name,
    dc.signed_contract_url AS file_url,
    'approved'::text AS status,
    COALESCE(dc.accepted_at, e.created_at) AS document_at,
    NULL::integer AS managed_by
   FROM public.digital_contracts dc
     JOIN public.enrollments e ON e.id = dc.enrollment_id
  WHERE dc.signed_contract_url IS NOT NULL
    AND dc.signed_contract_url IS DISTINCT FROM dc.file_url
UNION ALL
  -- fix-470-m: certificado Clase B emitido.
  SELECT 'cert-b-'::text || e.id::text AS id,
    'enrollment_file'::text AS source,
    e.student_id,
    e.id AS enrollment_id,
    'certificado_b'::text AS type,
    'Certificado Clase B.pdf'::text AS file_name,
    e.certificate_b_pdf_url AS file_url,
    'approved'::text AS status,
    COALESCE(
      (SELECT max(c.created_at) FROM public.certificates c
        WHERE c.enrollment_id = e.id AND c.type = 'class_b'),
      e.created_at
    ) AS document_at,
    NULL::integer AS managed_by
   FROM public.enrollments e
  WHERE e.certificate_b_pdf_url IS NOT NULL
UNION ALL
  -- fix-470-m: certificado Profesional emitido.
  SELECT 'cert-prof-'::text || e.id::text AS id,
    'enrollment_file'::text AS source,
    e.student_id,
    e.id AS enrollment_id,
    'certificado_profesional'::text AS type,
    'Certificado Profesional.pdf'::text AS file_name,
    e.certificate_professional_pdf_url AS file_url,
    'approved'::text AS status,
    COALESCE(
      (SELECT max(c.created_at) FROM public.certificates c
        WHERE c.enrollment_id = e.id AND c.type = 'professional'),
      e.created_at
    ) AS document_at,
    NULL::integer AS managed_by
   FROM public.enrollments e
  WHERE e.certificate_professional_pdf_url IS NOT NULL;

ALTER VIEW public.v_dms_student_documents SET (security_invoker = true);
