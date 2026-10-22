-- ============================================================================
-- fix-483-m: el certificado Profesional menciona la licencia convalidada.
--
-- La frase sale de un campo nuevo de la plantilla `certificate_professional`
-- ("Convalidación", clave `convalidacion`), editable en Plantillas. Esta migración
-- solo agrega el texto inicial a las filas que todavía no tienen la clave: sin ella,
-- el editor mostraría el campo vacío y al publicar se perdería la mención.
--
-- Idempotente: no pisa un texto que ya se haya editado.
-- Rollback: UPDATE public.document_templates SET content = content - 'convalidacion'
--           WHERE document_type = 'certificate_professional';
-- ============================================================================

UPDATE public.document_templates
   SET content = content || jsonb_build_object(
         'convalidacion', 'con convalidación de Clase {{claseConvalidada}}'
       )
 WHERE document_type = 'certificate_professional'
   AND NOT (content ? 'convalidacion');
