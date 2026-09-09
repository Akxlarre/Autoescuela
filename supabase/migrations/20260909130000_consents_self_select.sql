-- Spec 0040-b (Ley 21.719) — hallazgo durante T3.4: la RLS de `consents` solo permitía
-- SELECT a admin/secretaria (select_consents, 20260817130000). El titular (alumno) no podía
-- ni siquiera VER sus propios consentimientos, lo que bloquea por completo AC7 (portal
-- alumno). Sin esta policy, `ConsentsFacade.loadByUser()` devuelve lista vacía para
-- cualquier alumno autenticado — no es un error visible, es un falso "no tienes registros".
--
-- A diferencia de la policy de auto-revocación (acotada a comunicaciones_promocionales,
-- 20260909120000), esta SELECT no se restringe por consent_type: leer los propios datos es
-- un derecho de acceso general (Art. 14 ter / ARCO), no algo específico de esta spec — y el
-- riesgo de "ver" es incomparable al de "revocar". Coexiste con select_consents (admin/
-- secretaria): Postgres combina múltiples policies SELECT con OR.
DROP POLICY IF EXISTS select_consents_self ON public.consents;
CREATE POLICY select_consents_self ON public.consents
  FOR SELECT
  USING (user_id = auth_user_id());
