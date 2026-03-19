-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260317100000_public_enrollment_slot_holds.sql
-- Infraestructura para pago online (Transbank) en matrícula pública:
--   slot_holds       → reserva temporal de horarios (TTL 20 min)
--   payment_attempts → idempotencia de pagos por session_token
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- slot_holds
-- Almacena reservas temporales de slots durante el wizard de matrícula pública.
-- Impide que otro alumno tome el mismo horario mientras el primero completa el
-- pago en Webpay. La Edge Function crea los holds al confirmar el paso de
-- horario y los libera cuando el pago se confirma o el usuario retrocede.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.slot_holds (
  id            serial      PRIMARY KEY,
  session_token text        NOT NULL,
  instructor_id integer     NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  slot_start    timestamptz NOT NULL,
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '20 minutes'),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Búsqueda rápida por sesión (liberar todos los holds de una sesión)
CREATE INDEX IF NOT EXISTS idx_slot_holds_session
  ON public.slot_holds (session_token);

-- Verificación de colisiones por instructor + slot
CREATE INDEX IF NOT EXISTS idx_slot_holds_slot_lookup
  ON public.slot_holds (instructor_id, slot_start, expires_at);

-- RLS activo sin políticas → solo service role (Edge Function) puede escribir
ALTER TABLE public.slot_holds ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════════════
-- payment_attempts
-- Registro de intentos de pago para garantizar idempotencia.
-- session_token vincula al navegador del alumno (almacenado en localStorage).
-- Cuando se integre Transbank: transbank_token almacena el token de la
-- transacción y status refleja el resultado retornado por la API de Webpay.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id              serial      PRIMARY KEY,
  session_token   text        NOT NULL UNIQUE,
  status          text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'failed')),
  draft_snapshot  jsonb       NOT NULL DEFAULT '{}',
  enrollment_id   integer     REFERENCES public.enrollments(id) ON DELETE SET NULL,
  transbank_token text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '2 hours')
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_session
  ON public.payment_attempts (session_token);

-- Índice parcial para búsqueda por token de Transbank (futuro)
CREATE INDEX IF NOT EXISTS idx_payment_attempts_transbank
  ON public.payment_attempts (transbank_token)
  WHERE transbank_token IS NOT NULL;

-- RLS activo sin políticas → solo service role (Edge Function) puede escribir
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════════════
-- Función de limpieza
-- Libera holds y marca attempts expirados. Invocable desde cleanup_expired_drafts
-- o pg_cron independiente.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cleanup_expired_public_enrollment()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- Liberar holds cuyo TTL venció
  DELETE FROM public.slot_holds WHERE expires_at < now();

  -- Marcar payment_attempts pendientes vencidos como fallidos
  UPDATE public.payment_attempts
  SET    status = 'failed'
  WHERE  expires_at < now()
    AND  status = 'pending';
$$;
