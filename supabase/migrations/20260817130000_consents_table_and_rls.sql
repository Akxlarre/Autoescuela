-- ============================================================================
-- Spec 0009-m — Tabla `consents`: registro de consentimiento (Ley 21.719)
--
-- La Ley 21.719 (vigencia 01-12-2026) pone la CARGA DE LA PRUEBA del
-- consentimiento en el responsable (Art. 12). Esta tabla es esa prueba: ante una
-- fiscalización de la Agencia, es lo que se muestra.
--
-- Tres propiedades que NO son negociables y por eso viven en la base y no en la app:
--   1. APPEND-ONLY  — un consentimiento otorgado no se edita ni se borra jamás.
--                     Solo se admite marcar `revoked_at` (Art. 12: revocación).
--   2. IP SERVER-SIDE — la IP la escribe el servidor, nunca el cliente. Una IP que
--                     el navegador puede elegir no prueba nada.
--   3. SE REGISTRA LA NEGATIVA — `granted = false` es una fila, no una ausencia de
--                     fila. "No hay registro" y "dijo que no" son cosas distintas.
--
-- Origen: auditoría `.compliance/` corrida 1 · spec `0009-m-consentimiento-ley-21719`.
-- ============================================================================


-- ── T1.2 · IP del cliente, resuelta en el servidor ──────────────────────────
--
-- PostgREST expone los headers de la request como JSON en `request.headers`.
-- Mismo mecanismo que ya usa el trigger de auditoría para leer 'x-audit-user-id'
-- (ver 20260801140000_audit_log_restore_header_user_id.sql:74).
--
-- ⚠️ `audit_log.ip` y `digital_contracts.signature_ip` son columnas declaradas
-- desde el día uno que NADIE escribe nunca — no había mecanismo que reutilizar,
-- hubo que construirlo. Esta función las deja a un fix de distancia.

CREATE OR REPLACE FUNCTION public.request_client_ip()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_headers_raw TEXT;
  v_fwd         TEXT;
BEGIN
  v_headers_raw := current_setting('request.headers', true);
  IF v_headers_raw IS NULL OR v_headers_raw = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    -- 'x-forwarded-for' puede traer una cadena de proxies: "cliente, proxy1, proxy2".
    -- El primero es el cliente real.
    v_fwd := (v_headers_raw::json)->>'x-forwarded-for';
    IF v_fwd IS NOT NULL AND v_fwd <> '' THEN
      RETURN NULLIF(btrim(split_part(v_fwd, ',', 1)), '');
    END IF;
    RETURN NULLIF(btrim(COALESCE((v_headers_raw::json)->>'x-real-ip', '')), '');
  EXCEPTION WHEN OTHERS THEN
    -- JSON malformado: la IP se pierde, pero el consentimiento NO se cae.
    -- Una matrícula sin registro es peor que un registro sin IP.
    RETURN NULL;
  END;
END $$;

COMMENT ON FUNCTION public.request_client_ip() IS
  'Spec 0009-m: IP del cliente leída de los headers de la request (x-forwarded-for). '
  'Devuelve NULL en vez de fallar. Usada por el trigger de `consents`.';


-- ── T1.3 · Tabla ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.consents (
  id             BIGSERIAL PRIMARY KEY,

  -- Titular. `user_id` es NULL mientras el lead de preinscripción todavía no tiene
  -- cuenta; `subject_rut` es el fallback que permite identificarlo igual.
  user_id        INT REFERENCES public.users(id),
  subject_rut    TEXT,

  enrollment_id  INT REFERENCES public.enrollments(id),

  -- ANTE QUÉ RESPONSABLE se otorgó. NOT NULL a propósito: las dos sedes son dos
  -- sociedades distintas que responden por separado ante la Agencia, y un registro
  -- de preinscripción no tiene `enrollment_id` del cual derivarlo.
  branch_id      INT NOT NULL REFERENCES public.branches(id),

  consent_type   TEXT NOT NULL
                 CHECK (consent_type IN ('matricula_datos', 'certificado_medico', 'preinscripcion')),

  -- false = el titular dijo que NO. Se registra igual (AC-E1).
  granted        BOOLEAN NOT NULL,
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Única columna actualizable de toda la tabla (ver trigger de append-only).
  revoked_at     TIMESTAMPTZ,

  -- La escribe el trigger. Lo que mande el cliente en esta columna se ignora.
  ip             TEXT,

  policy_version TEXT NOT NULL,
  -- Sin 'papel': se evaluó y el negocio confirmó (17-08-2026) que NUNCA se digita una
  -- matrícula tomada en ficha física. Un valor de enum que nadie puede producir es una
  -- rama muerta que el próximo lector interpretará como caso real.
  source         TEXT NOT NULL CHECK (source IN ('public', 'secretaria')),

  -- Cuando el titular es menor de edad, el consentimiento lo otorga su representante legal (AC7).
  -- NO se guardan su nombre ni su RUT: la autorización notarial ya está en el expediente
  -- (`student_documents.type = 'autorizacion_notarial'`, obligatoria para menores), está firmada
  -- ante notario y lo identifica mejor que un campo tipeado en un formulario. Guardar además su
  -- RUT sería recolectar el dato personal de un tercero ya acreditado por otra vía.
  granted_by_representative BOOLEAN NOT NULL DEFAULT false,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un consentimiento sin titular identificable no sirve como prueba de nada.
  CONSTRAINT consents_subject_identifiable
    CHECK (user_id IS NOT NULL OR subject_rut IS NOT NULL)
);

COMMENT ON TABLE public.consents IS
  'Spec 0009-m (Ley 21.719 Art. 12/14 ter/16). APPEND-ONLY: sin policy de DELETE en '
  'ningún rol y con trigger que bloquea todo UPDATE que no sea `revoked_at`. '
  'El rol `anon` NO tiene ninguna policy A PROPÓSITO: el flujo público de inscripción '
  'nunca habla con PostgREST, escribe a través de la Edge Function `public-enrollment` '
  'con `service_role`. Si algún día un INSERT anónimo falla acá, la respuesta es pasarlo '
  'por la Edge Function, no abrir la tabla.';

COMMENT ON COLUMN public.consents.granted IS
  'false = negativa expresa del titular. Se registra como fila (AC-E1): "no hay registro" '
  'y "dijo que no" son hechos distintos ante una fiscalización.';
COMMENT ON COLUMN public.consents.ip IS
  'La escribe trg_consents_set_ip. Un valor enviado por el cliente autenticado se descarta.';
COMMENT ON COLUMN public.consents.granted_by_representative IS
  'true = lo otorgó el representante legal de un menor. Su identidad consta en la autorización '
  'notarial del expediente, no acá (minimización: no se recolecta el RUT de un tercero ya acreditado).';
COMMENT ON COLUMN public.consents.policy_version IS
  'Versión de la política vigente AL MOMENTO de otorgarse (AC-E4). Constante en código: '
  'PRIVACY_POLICY_VERSION en core/models/ui/privacy-policy.model.ts.';

CREATE INDEX IF NOT EXISTS idx_consents_user        ON public.consents(user_id);
CREATE INDEX IF NOT EXISTS idx_consents_enrollment  ON public.consents(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_consents_subject_rut ON public.consents(subject_rut);


-- ── T1.4 · La IP la pone el servidor ────────────────────────────────────────
--
-- Hay DOS caminos de escritura y la IP correcta viene de fuentes distintas:
--
--   (a) FLUJO PÚBLICO — la fila la inserta la Edge Function `public-enrollment`
--       con `service_role`. Ahí `request.headers` trae la IP del runtime de la
--       Edge Function, NO la del alumno. La IP buena es la que la EF calculó con
--       su propio getClientIp(req) y manda en el payload → se respeta.
--
--   (b) FLUJO AUTENTICADO — el navegador de la secretaria habla con PostgREST
--       directo. Ahí `x-forwarded-for` SÍ es el cliente real → se impone sobre
--       cualquier valor que venga en el body (que sería auto-declarado).
--
-- Confundir estos dos casos es el error fácil de esta spec: usar siempre el header
-- guarda la IP de un datacenter de Supabase para todas las matrículas online.

-- ⚠️ SECURITY INVOKER (no DEFINER) A PROPÓSITO: dentro de una función SECURITY
-- DEFINER, `current_user` es el DUEÑO de la función (postgres), no el rol que
-- ejecuta el INSERT — la rama de service_role no se tomaría nunca y toda matrícula
-- online guardaría la IP del runtime. Verificado empíricamente: con DEFINER, el
-- caso (a) guardaba 10.99.99.99 en vez del 190.44.7.12 del payload.
-- No necesita privilegios elevados: request_client_ip() ya es DEFINER por su cuenta.

CREATE OR REPLACE FUNCTION public.trg_consents_set_ip_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user = 'service_role' THEN
    -- (a) La EF ya resolvió la IP del alumno. Solo se completa si no vino.
    NEW.ip := COALESCE(NEW.ip, public.request_client_ip());
  ELSE
    -- (b) El header manda; el cliente no elige su propia IP.
    NEW.ip := COALESCE(public.request_client_ip(), NEW.ip);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_consents_set_ip ON public.consents;
CREATE TRIGGER trg_consents_set_ip
  BEFORE INSERT ON public.consents
  FOR EACH ROW EXECUTE FUNCTION public.trg_consents_set_ip_fn();


-- ── T1.5 · Append-only ──────────────────────────────────────────────────────
--
-- RLS no sabe restringir POR COLUMNA: una policy de UPDATE permite actualizar
-- cualquier campo de la fila. El candado real tiene que ser un trigger.

CREATE OR REPLACE FUNCTION public.trg_consents_append_only_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (to_jsonb(OLD) - 'revoked_at') IS DISTINCT FROM (to_jsonb(NEW) - 'revoked_at') THEN
    RAISE EXCEPTION
      'consents es append-only (Ley 21.719, spec 0009-m): solo se puede actualizar revoked_at. '
      'Un consentimiento otorgado es prueba legal y no se edita ni se borra — para dejar sin '
      'efecto uno vigente, marcar revoked_at; para corregir un dato, insertar una fila nueva.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_consents_append_only ON public.consents;
CREATE TRIGGER trg_consents_append_only
  BEFORE UPDATE ON public.consents
  FOR EACH ROW EXECUTE FUNCTION public.trg_consents_append_only_fn();


-- ── T1.6 · RLS ──────────────────────────────────────────────────────────────

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

-- SELECT: solo quien tiene que acreditar el consentimiento ante la Agencia.
DROP POLICY IF EXISTS select_consents ON public.consents;
CREATE POLICY select_consents ON public.consents
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));

-- INSERT: mismo criterio que insert_audit_log — cualquier sesión autenticada.
-- El flujo de secretaría escribe por acá.
DROP POLICY IF EXISTS insert_consents ON public.consents;
CREATE POLICY insert_consents ON public.consents
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- UPDATE: solo admin, y el trigger de arriba lo acota a `revoked_at`.
DROP POLICY IF EXISTS update_consents_revocation ON public.consents;
CREATE POLICY update_consents_revocation ON public.consents
  FOR UPDATE USING (auth_user_role() = 'admin');

-- DELETE: ninguna policy, en ningún rol. Sin policy, RLS deniega. Es deliberado.

-- `anon` sin policy = denegado por RLS. Se revoca además el GRANT por defecto para
-- que ni siquiera dependa de que la RLS esté activa (defensa en profundidad).
REVOKE ALL ON public.consents FROM anon;


-- ── Verificación ────────────────────────────────────────────────────────────
--
-- Mismo criterio que fix-190-m: el harness de tests del proyecto es unitario con
-- mocks y no consulta la base, así que las invariantes estructurales se afirman acá.

DO $$
DECLARE
  v_bad INT;
BEGIN
  -- No debe existir NINGUNA policy de DELETE sobre consents (AC6).
  SELECT COUNT(*) INTO v_bad
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'consents' AND cmd = 'DELETE';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'spec 0009-m: consents tiene % policy(s) de DELETE — debe ser append-only', v_bad;
  END IF;

  -- `anon` no debe tener ninguna policy (decidido 2026-08-17).
  SELECT COUNT(*) INTO v_bad
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'consents' AND 'anon' = ANY(roles);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'spec 0009-m: consents expuesta a anon — el flujo público escribe vía Edge Function';
  END IF;

  -- RLS activa.
  SELECT COUNT(*) INTO v_bad
  FROM pg_class WHERE oid = 'public.consents'::regclass AND NOT relrowsecurity;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'spec 0009-m: consents sin ROW LEVEL SECURITY';
  END IF;

  RAISE NOTICE 'spec 0009-m: consents creada — append-only, sin anon, RLS activa';
END $$;
