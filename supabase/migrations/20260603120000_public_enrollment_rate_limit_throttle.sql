-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260603120000_public_enrollment_rate_limit_throttle.sql
-- Spec 0010 — Hardening de seguridad del flujo de inscripción público.
--
-- Rate-limiting server-side (cero dependencias externas) para las acciones de
-- mutación de la Edge Function `public-enrollment`. La EF (service_role) registra
-- cada request por (ip, action) y cuenta los de la ventana deslizante; sobre el
-- umbral responde 429. Defensa en capas junto al honeypot del formulario.
-- Hallazgo S1 de docs/auditoria-seguridad-flujo-inscripcion-online.md.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- public_enrollment_throttle
-- Una fila por request de mutación. El conteo por (ip, action) dentro de la
-- ventana determina si se aplica rate-limit. Solo la Edge Function (service_role)
-- escribe/lee — RLS activa sin políticas bloquea anon/authenticated por completo.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.public_enrollment_throttle (
  id         bigserial   PRIMARY KEY,
  ip         text        NOT NULL,
  action     text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Conteo rápido por (ip, action) dentro de la ventana deslizante
CREATE INDEX IF NOT EXISTS idx_pe_throttle_lookup
  ON public.public_enrollment_throttle (ip, action, created_at);

-- RLS activo SIN políticas → solo service role (Edge Function) accede
ALTER TABLE public.public_enrollment_throttle ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════════════
-- Función de limpieza
-- Borra filas fuera de cualquier ventana razonable (> 1 día). Invocable desde
-- pg_cron o junto a cleanup_expired_public_enrollment().
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cleanup_public_enrollment_throttle()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.public_enrollment_throttle
  WHERE created_at < now() - interval '1 day';
$$;
