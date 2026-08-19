-- ============================================================================
-- Spec 0009-m — Reconciliar `consents` con la forma vigente
--
-- POR QUÉ EXISTE ESTA MIGRACIÓN:
--
-- `20260817130000_consents_table_and_rls.sql` crea la tabla con
-- `CREATE TABLE IF NOT EXISTS`. Eso es idempotente solo si la tabla NO existe:
-- si ya existe con OTRA forma, el CREATE se salta entero y ningún cambio de
-- columna se aplica. En ese escenario la migración falla más abajo, en el
-- `COMMENT ON COLUMN ... granted_by_representative`, porque la columna nunca se creó.
--
-- Es lo que pasó en el entorno de nube (18-08-2026): tenía aplicada la versión
-- PREVIA al cambio de `representative_name`/`representative_rut` por el booleano
-- `granted_by_representative`, y re-pegar la migración devolvía:
--     ERROR 42703: column "granted_by_representative" of relation "public.consents" does not exist
--
-- La idempotencia de la migración original se había verificado re-aplicándola sobre una
-- tabla que YA tenía la forma nueva — el caso "existe con forma vieja" nunca se probó.
--
-- Esta migración es segura en los DOS casos:
--   (a) tabla con la forma vieja  → la reconcilia
--   (b) tabla ya con la forma nueva → no-op
--
-- No se edita la migración original a propósito: ya fue aplicada en varios
-- entornos, y reescribir una migración aplicada es lo que vuelve ilegible la
-- historia del esquema (mismo criterio que `fix-190`).
-- ============================================================================

-- ── 0. RLS ──────────────────────────────────────────────────────────────────
-- Idempotente y defensivo: la tabla ya la tiene activa desde la migración original,
-- pero si alguien corre este archivo suelto en un entorno desalineado, conviene que
-- la reafirme antes de tocar nada. Nunca dejar `consents` sin RLS ni un instante.

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

-- ── 1. Columna nueva ────────────────────────────────────────────────────────

ALTER TABLE public.consents
  ADD COLUMN IF NOT EXISTS granted_by_representative BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.consents.granted_by_representative IS
  'true = lo otorgó el representante legal de un titular menor de edad. Su identidad NO se '
  'guarda acá: consta en la autorización notarial del expediente, que es documento obligatorio '
  'para menores y está firmada ante notario — mejor prueba que dos campos tipeados, y evita '
  'recolectar el dato personal de un tercero ya acreditado por otra vía (minimización).';

-- ── 2. Migrar lo que hubiera en las columnas viejas ─────────────────────────
--
-- El trigger de append-only bloquea cualquier UPDATE que no sea `revoked_at`, así que
-- hay que desactivarlo para esta corrección de esquema y volver a dejarlo activo.
-- Se hace dentro de un bloque condicional: si las columnas viejas no existen
-- (entorno ya migrado), no se toca nada.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consents'
      AND column_name = 'representative_name'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_consents_append_only'
        AND tgrelid = 'public.consents'::regclass
    ) THEN
      ALTER TABLE public.consents DISABLE TRIGGER trg_consents_append_only;
    END IF;

    -- Un consentimiento que tenía nombre de representante fue otorgado por él.
    UPDATE public.consents
    SET granted_by_representative = true
    WHERE representative_name IS NOT NULL AND representative_name <> '';

    IF EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_consents_append_only'
        AND tgrelid = 'public.consents'::regclass
    ) THEN
      ALTER TABLE public.consents ENABLE TRIGGER trg_consents_append_only;
    END IF;

    RAISE NOTICE 'spec 0009-m: datos de representante migrados al booleano';
  END IF;
END $$;

ALTER TABLE public.consents DROP COLUMN IF EXISTS representative_name;
ALTER TABLE public.consents DROP COLUMN IF EXISTS representative_rut;

-- ── 3. `source` sin 'papel' ─────────────────────────────────────────────────
--
-- El negocio confirmó (17-08-2026) que **nunca** se digita una matrícula tomada en
-- ficha física, así que `papel` era una opción muerta. Un CHECK con valores que no se
-- usan invita a que alguien los use por error.

ALTER TABLE public.consents DROP CONSTRAINT IF EXISTS consents_source_check;
ALTER TABLE public.consents
  ADD CONSTRAINT consents_source_check CHECK (source IN ('public', 'secretaria'));

-- ── 4. Verificación ─────────────────────────────────────────────────────────

DO $$
DECLARE
  v_bad INT;
BEGIN
  SELECT COUNT(*) INTO v_bad
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'consents'
    AND column_name IN ('representative_name', 'representative_rut');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'spec 0009-m: sobreviven % columna(s) de representante', v_bad;
  END IF;

  SELECT COUNT(*) INTO v_bad
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'consents'
    AND column_name = 'granted_by_representative';
  IF v_bad <> 1 THEN
    RAISE EXCEPTION 'spec 0009-m: falta granted_by_representative';
  END IF;

  IF pg_get_constraintdef(
       (SELECT oid FROM pg_constraint WHERE conname = 'consents_source_check')
     ) LIKE '%papel%' THEN
    RAISE EXCEPTION 'spec 0009-m: el CHECK de source todavía admite ''papel''';
  END IF;

  SELECT COUNT(*) INTO v_bad
  FROM pg_class WHERE oid = 'public.consents'::regclass AND NOT relrowsecurity;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'spec 0009-m: consents quedó sin ROW LEVEL SECURITY';
  END IF;

  RAISE NOTICE 'spec 0009-m: consents reconciliada con la forma vigente';
END $$;
