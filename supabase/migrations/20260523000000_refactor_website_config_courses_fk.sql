-- ============================================================================
-- Spec 0004 — Refactor website_config.config.courses → FK al catálogo operacional
-- ============================================================================
-- Acopla la capa de presentación (JSONB con datos editoriales) al catálogo
-- operacional `courses` (fuente de verdad de precio/nombre/clase) vía FK
-- lógica obligatoria, eliminando divergencia silenciosa de precios entre
-- landing y operación.
--
-- Cambios:
--   1. Función + trigger validador de integridad FK del JSONB
--   2. Función + trigger bloqueante de DELETE en courses referenciados
--   3. Reset destructivo de website_config.config.courses → [] (decisión spec)
--   4. Audit log explícito del evento de reset
--   5. Notificación in-app a todos los admins (AC-E5) con idempotencia 7 días
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Función validadora de integridad referencial JSONB ↔ courses
-- ----------------------------------------------------------------------------
-- Valida en cada INSERT/UPDATE de website_config:
--   (a) course_id presente y no null
--   (b) course_id existe en courses
--   (c) courses.branch_id coincide con website_config.branch_id
--   (d) course_id único dentro del array (AC-E1)
CREATE OR REPLACE FUNCTION public.validate_website_config_courses_fk()
RETURNS TRIGGER AS $$
DECLARE
  card             jsonb;
  card_course_id   int;
  course_branch_id int;
  seen_course_ids  int[] := '{}';
BEGIN
  -- jsonb_array_elements sobre NULL retorna conjunto vacío → loop no se ejecuta
  IF NEW.config IS NULL OR NEW.config->'courses' IS NULL THEN
    RETURN NEW;
  END IF;

  FOR card IN SELECT * FROM jsonb_array_elements(NEW.config->'courses') LOOP
    card_course_id := NULLIF(card->>'course_id', '')::int;

    -- (a) course_id obligatorio
    IF card_course_id IS NULL THEN
      RAISE EXCEPTION
        'website_config.courses: cada card requiere course_id (branch %)',
        NEW.branch_id;
    END IF;

    -- (b) course_id existe y (c) pertenece al mismo branch
    SELECT branch_id INTO course_branch_id
    FROM public.courses
    WHERE id = card_course_id;

    IF course_branch_id IS NULL THEN
      RAISE EXCEPTION
        'website_config.courses: course_id % no existe en el catálogo operacional',
        card_course_id;
    END IF;

    IF course_branch_id <> NEW.branch_id THEN
      RAISE EXCEPTION
        'website_config.courses: course_id % pertenece a branch % pero website_config es de branch %',
        card_course_id, course_branch_id, NEW.branch_id;
    END IF;

    -- (d) course_id único en el array (AC-E1)
    IF card_course_id = ANY(seen_course_ids) THEN
      RAISE EXCEPTION
        'website_config.courses: course_id % aparece duplicado en la misma config',
        card_course_id;
    END IF;
    seen_course_ids := array_append(seen_course_ids, card_course_id);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_website_config_courses_fk ON public.website_config;
CREATE TRIGGER trg_validate_website_config_courses_fk
  BEFORE INSERT OR UPDATE ON public.website_config
  FOR EACH ROW EXECUTE FUNCTION public.validate_website_config_courses_fk();

-- ----------------------------------------------------------------------------
-- 2. Trigger bloqueante de DELETE en courses referenciados (AC-E2)
-- ----------------------------------------------------------------------------
-- Bloquea la eliminación de un curso del catálogo operacional si está
-- referenciado en alguna card de website_config. Forzamos al admin a quitar
-- la card desde Configuración Web antes de borrar el curso.
CREATE OR REPLACE FUNCTION public.prevent_courses_delete_when_in_website_config()
RETURNS TRIGGER AS $$
DECLARE
  ref_count int;
BEGIN
  SELECT COUNT(*) INTO ref_count
  FROM public.website_config wc,
       jsonb_array_elements(wc.config->'courses') AS card
  WHERE (card->>'course_id')::int = OLD.id;

  IF ref_count > 0 THEN
    RAISE EXCEPTION
      'No se puede eliminar: % card(s) de website_config referencian este curso. Quitá esas cards desde Configuración Web antes de eliminar el curso del catálogo.',
      ref_count;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_courses_delete_when_in_website_config ON public.courses;
CREATE TRIGGER trg_prevent_courses_delete_when_in_website_config
  BEFORE DELETE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_courses_delete_when_in_website_config();

-- ----------------------------------------------------------------------------
-- 3. Reset destructivo de website_config.config.courses → []
-- ----------------------------------------------------------------------------
-- Decisión documentada en spec 0004 sec. 9: descartamos heurística de
-- migración. Las cards editoriales legacy se vacían; el admin reconstruye
-- desde el nuevo flujo basado en course_id.
--
-- Nota: el trigger trg_audit_website_config existente (migración
-- 20260522000001) registrará automáticamente el UPDATE en audit_log con
-- el diff legible vía log_change().
UPDATE public.website_config
SET config     = jsonb_set(config, '{courses}', '[]'::jsonb),
    updated_at = NOW();

-- ----------------------------------------------------------------------------
-- 4. Audit log explícito del evento de reset
-- ----------------------------------------------------------------------------
-- Marcador semántico para distinguir el reset masivo de la migración de
-- cualquier UPDATE manual posterior.
INSERT INTO public.audit_log (user_id, action, entity, entity_id, detail, created_at)
SELECT
  NULL,
  'website_config.courses.reset_for_refactor',
  'website_config',
  wc.id,
  'Spec 0004 — branch_id=' || wc.branch_id || '. JSONB courses[] vaciado para migración a FK al catálogo operacional. Reconfigurar desde el panel admin.',
  NOW()
FROM public.website_config wc;

-- ----------------------------------------------------------------------------
-- 5. Notificación in-app a todos los admins (AC-E5)
-- ----------------------------------------------------------------------------
-- Idempotente: guard de 7 días evita duplicar si la migración se aplica
-- más de una vez en el mismo entorno.
INSERT INTO public.notifications (
  recipient_id, type, subject, message,
  reference_type, reference_id, read, created_at
)
SELECT
  u.id,
  'system',
  'Reconfigurá las cards de tu landing',
  E'El módulo Configuración Web fue actualizado: ahora cada card de curso debe referenciar un curso del catálogo operacional para mantener precios y nombres consistentes.\n\nTus cards fueron vaciadas para evitar inconsistencias. Reconstruilas desde el panel: /app/admin/configuracion-web',
  'website_config',
  NULL,
  false,
  NOW()
FROM public.users u
JOIN public.roles r ON r.id = u.role_id
WHERE r.name = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.recipient_id = u.id
      AND n.subject      = 'Reconfigurá las cards de tu landing'
      AND n.created_at   > NOW() - INTERVAL '7 days'
  );
