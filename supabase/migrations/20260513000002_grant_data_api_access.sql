-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260513000002_grant_data_api_access.sql
--
-- A partir del 30 de Mayo 2026, Supabase dejará de exponer tablas del schema
-- public a la Data API por defecto en proyectos nuevos.
-- A partir del 30 de Octubre 2026 aplica también a proyectos existentes.
--
-- Referencia oficial: https://github.com/orgs/supabase/discussions/45329
--
-- Este script añade los GRANTs explícitos necesarios para que supabase-js
-- (PostgREST) continúe accediendo a las tablas. RLS sigue siendo la capa de
-- seguridad real — estos GRANTs solo habilitan el acceso a nivel de objeto.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. USAGE en el schema (prerrequisito para que PostgREST vea las tablas)
-- ══════════════════════════════════════════════════════════════════════════════
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. TABLAS — rol authenticated (usuarios logueados de la app)
--
-- CRUD completo. La seguridad de filas la controlan las policies RLS.
-- Este GRANT solo permite que PostgREST alcance la tabla.
-- ══════════════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. TABLAS — rol service_role (Edge Functions y llamadas server-side)
--
-- service_role bypasea RLS por diseño de Supabase, pero sigue necesitando
-- el GRANT explícito a nivel de objeto para que PostgREST lo exponga.
-- ══════════════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. TABLAS — rol anon (usuarios no autenticados)
--
-- Solo las tablas con políticas RLS FOR anon activas:
--   · branches  → el formulario de matrícula pública lista las sedes
--   · courses   → el formulario de matrícula pública lista los cursos
-- slot_holds y payment_attempts son accedidas por Edge Functions (service_role),
-- no directamente por el cliente anon.
-- ══════════════════════════════════════════════════════════════════════════════
GRANT SELECT ON TABLE public.branches TO anon;
GRANT SELECT ON TABLE public.courses  TO anon;

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. SEQUENCES — necesarias para INSERT en tablas con columnas serial/bigserial
-- ══════════════════════════════════════════════════════════════════════════════
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. FUNCIONES RPC
-- ══════════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. DEFAULT PRIVILEGES — cubre objetos creados en migraciones FUTURAS
--    FOR ROLE postgres porque las migraciones se ejecutan como ese rol.
--    Sin esto, cada nueva tabla/secuencia requeriría su propio GRANT.
-- ══════════════════════════════════════════════════════════════════════════════
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
