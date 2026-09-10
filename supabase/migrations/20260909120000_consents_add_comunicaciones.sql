-- Spec 0040-b (Ley 21.719) — finalidades de consentimiento para comunicaciones al alumno.
-- Mismo patrón que 20260818130000 (spec 0010-m): drop + recreate del CHECK.
--
-- Las dos finalidades NO son simétricas (resuelto contra el texto oficial, ver spec.md §2/§9):
--   - comunicaciones_operativas   → Art. 13 c) ejecución del contrato. Se INFORMA, no se consiente.
--     Pedirlo como checkbox de aceptar/rechazar sería, en rigor, contrario al Art. 12 inciso 5°
--     (presume no libremente otorgado el consentimiento recabado para algo ya necesario para el
--     contrato). Por eso siempre se persiste con granted=true — es un acuse de información, no una
--     elección del titular.
--   - comunicaciones_promocionales → Art. 12, consentimiento real: libre, específico, previo,
--     revocable sin efecto retroactivo. Tiene su propio derecho de oposición (Art. 8 letra b,
--     "fines de mercadotecnia o marketing directo").

ALTER TABLE consents DROP CONSTRAINT IF EXISTS consents_consent_type_check;

ALTER TABLE consents ADD CONSTRAINT consents_consent_type_check
  CHECK (consent_type IN (
    'matricula_datos',
    'certificado_medico',
    'preinscripcion',
    'test_psicologico',
    'comunicaciones_operativas',
    'comunicaciones_promocionales'
  ));

-- Art. 12: "Los medios utilizados para el otorgamiento o la revocación del consentimiento deben
-- ser expeditos, fidedignos, gratuitos y estar permanentemente disponibles para el titular."
-- Hoy solo un admin puede escribir revoked_at (update_consents_revocation) — eso no satisface ese
-- estándar para un consentimiento que recién se está creando. Esta policy le da al propio titular
-- un medio permanentemente disponible, acotado a SU fila y SOLO a la finalidad promocional.
--
-- Acotada a comunicaciones_promocionales a propósito: las demás finalidades (matricula_datos,
-- certificado_medico, preinscripcion, test_psicologico, comunicaciones_operativas) no nacieron con
-- ese requisito legal — no son consentimientos de marketing — y ampliarles la revocación
-- self-service sin analizar cada una por separado sería scope creep (ver spec.md, Out of scope).
--
-- La policy NO restringe columnas (RLS no puede hacerlo): el acotamiento a revoked_at lo sigue
-- haciendo trg_consents_append_only, que lanza excepción ante cualquier UPDATE de otra columna
-- (mismo reparto de responsabilidades que ya usa update_consents_revocation para admin).
DROP POLICY IF EXISTS update_consents_self_revoke_promocional ON public.consents;
CREATE POLICY update_consents_self_revoke_promocional ON public.consents
  FOR UPDATE
  USING (user_id = auth_user_id() AND consent_type = 'comunicaciones_promocionales')
  WITH CHECK (user_id = auth_user_id() AND consent_type = 'comunicaciones_promocionales');
