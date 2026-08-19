-- Spec 0010-m (Ley 21.719, Art. 16) — consentimiento reforzado del test psicométrico EPQ.
-- Agrega 'test_psicologico' al CHECK de consents.consent_type (dato de salud psíquica, Art. 2).

ALTER TABLE consents DROP CONSTRAINT IF EXISTS consents_consent_type_check;

ALTER TABLE consents ADD CONSTRAINT consents_consent_type_check
  CHECK (consent_type IN ('matricula_datos', 'certificado_medico', 'preinscripcion', 'test_psicologico'));
