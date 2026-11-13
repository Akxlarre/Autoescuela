-- ============================================================================
-- spec 0061-b: correos por escuela (remitente, respuesta y marca)
-- ============================================================================
-- Las dos escuelas son razones sociales distintas y hasta ahora todo correo salía con un solo
-- remitente global. Desde aquí:
--   1. branches.email_sender_name / email_sender_address: remitente visible y dirección de envío
--      de cada escuela. Los edita el admin (policy update_branches existente: solo admin).
--      branches.email pasa a ser el correo de RESPUESTA (la única fuente del contacto, AC13) y
--      branches.phone el teléfono del pie. Ambas columnas ya existían.
--   2. CHECK de dominio: la dirección de envío solo puede ser de gestordeautoescuelas.cl, el único
--      dominio con SPF/DKIM/DMARC configurados (AC-E6). La respuesta puede ser de cualquier dominio.
--   3. Seed: remitente = nombre de la escuela, dirección = <slug>@gestordeautoescuelas.cl (las
--      casillas creadas en cPanel el 2026-11-12). Solo donde está vacío.
--   4. branches.email se llena con website_config.contact.email solo si está vacío. Al 2026-11-12
--      ya coinciden en las dos escuelas: no cambia nada hoy; queda para una escuela nueva.
--   5. announcement_recipients.branch_id: un destinatario por (alumno, escuela). Un comunicado de
--      todas las escuelas se envía una vez por escuela, con su marca y su consentimiento (AC-E5).
-- Datos existentes al 2026-11-12: 0 announcements y 0 announcement_recipients, sin backfill real.
-- Idempotente.
-- ============================================================================

-- ── 1. Remitente por escuela ────────────────────────────────────────────────────────────────
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS email_sender_name    TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS email_sender_address TEXT;

COMMENT ON COLUMN public.branches.email_sender_name IS
  'Nombre visible del remitente de los correos de la escuela (spec 0061-b). NULL = branches.name.';
COMMENT ON COLUMN public.branches.email_sender_address IS
  'Dirección de envío de la escuela, siempre @gestordeautoescuelas.cl (spec 0061-b, AC-E6). '
  'NULL = sale desde la dirección neutra de la plataforma con el nombre de la escuela (AC-E2).';
COMMENT ON COLUMN public.branches.email IS
  'Correo de contacto de la escuela: dirección de respuesta de todos sus correos y correo del pie '
  '(spec 0061-b, AC2/AC13). Única fuente del contacto en los correos.';

-- ── 2. Solo el dominio autenticado ──────────────────────────────────────────────────────────
ALTER TABLE public.branches DROP CONSTRAINT IF EXISTS branches_email_sender_domain_chk;
ALTER TABLE public.branches ADD CONSTRAINT branches_email_sender_domain_chk
  CHECK (
    email_sender_address IS NULL
    OR lower(email_sender_address) ~ '^[a-z0-9._%+-]+@gestordeautoescuelas\.cl$'
  );

-- ── 3. Seed de las casillas creadas en cPanel ───────────────────────────────────────────────
UPDATE public.branches
   SET email_sender_name = name
 WHERE email_sender_name IS NULL
   AND slug IN ('autoescuela-chillan', 'conductores-chillan');

UPDATE public.branches
   SET email_sender_address = slug || '@gestordeautoescuelas.cl'
 WHERE email_sender_address IS NULL
   AND slug IN ('autoescuela-chillan', 'conductores-chillan');

-- ── 4. Un solo correo de contacto ───────────────────────────────────────────────────────────
UPDATE public.branches b
   SET email = trim(wc.config -> 'contact' ->> 'email')
  FROM public.website_config wc
 WHERE wc.branch_id = b.id
   AND coalesce(trim(b.email), '') = ''
   AND coalesce(trim(wc.config -> 'contact' ->> 'email'), '') <> '';

-- ── 5. Un destinatario por (alumno, escuela) ────────────────────────────────────────────────
ALTER TABLE public.announcement_recipients
  ADD COLUMN IF NOT EXISTS branch_id INT REFERENCES public.branches(id);

-- Backfill por si existiera alguna fila: la escuela del comunicado; si es de todas, la del alumno.
UPDATE public.announcement_recipients r
   SET branch_id = coalesce(a.branch_id, u.branch_id)
  FROM public.announcements a, public.users u
 WHERE r.branch_id IS NULL
   AND a.id = r.announcement_id
   AND u.id = r.user_id;

ALTER TABLE public.announcement_recipients ALTER COLUMN branch_id SET NOT NULL;

COMMENT ON COLUMN public.announcement_recipients.branch_id IS
  'Escuela a cuyo nombre se envía esta copia (spec 0061-b). Un comunicado de todas las escuelas '
  'genera una fila por escuela en la que el alumno cumple el segmento (AC-E5).';

ALTER TABLE public.announcement_recipients
  DROP CONSTRAINT IF EXISTS announcement_recipients_unique_per_user;
ALTER TABLE public.announcement_recipients
  DROP CONSTRAINT IF EXISTS announcement_recipients_unique_per_user_branch;
ALTER TABLE public.announcement_recipients
  ADD CONSTRAINT announcement_recipients_unique_per_user_branch
  UNIQUE (announcement_id, user_id, branch_id);
