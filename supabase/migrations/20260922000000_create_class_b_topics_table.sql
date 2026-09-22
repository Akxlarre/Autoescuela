-- Tema fijo por número de clase práctica Clase B (ASG-m-007, fix-169-b).
--
-- Los 12 temas son configuración institucional editable por admin, no texto en el
-- componente: por eso viven en tabla y no hardcodeados.
--
-- Un intento previo los guardó como array JSONB dentro de `website_config.config`.
-- Se descartó: `website_config` es la configuración del SITIO PÚBLICO (hero, precios,
-- testimonios), y la malla curricular no es contenido del landing. Además un array
-- JSONB no puede tener UNIQUE sobre el número de clase ni FK, y obliga a reescribir
-- todo el documento para editar un solo tema. El paso 1 limpia esa clave si quedó
-- escrita en algún entorno donde la migración descartada sí llegó a correr.

-- 1. Limpieza del intento anterior ──────────────────────────────────────────────
-- Se quitan las DOS variantes de nombre porque la migración descartada escribía
-- `classTopics` (camelCase) y su propio revert borraba `class_topics` (snake_case),
-- así que nunca se limpiaba a sí misma.
UPDATE public.website_config
SET config = (config - 'classTopics') - 'class_topics'
WHERE config ?| ARRAY['classTopics', 'class_topics'];

-- 2. Tabla ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.class_b_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- El número de clase es la clave natural: UNIQUE es lo que garantiza que no haya
  -- dos temas para la misma clase, y el CHECK que el curso B tiene 12 clases.
  class_number INT NOT NULL UNIQUE CHECK (class_number BETWEEN 1 AND 12),
  topic TEXT NOT NULL CHECK (btrim(topic) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.class_b_topics ENABLE ROW LEVEL SECURITY;

-- 3. RLS ────────────────────────────────────────────────────────────────────────
-- Se usa `auth_user_role()` como el resto del esquema. La versión anterior hacía
-- `EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')`,
-- que no aplica: `users.id` es INTEGER y `auth.uid()` es UUID (la columna de enlace
-- es `users.supabase_uid`), y `users.role` no existe — el rol es `users.role_id` → `roles`.
-- Postgres rechazaba la migración entera con
-- `42883: operator does not exist: integer = uuid`.

-- La malla la lee cualquier usuario autenticado: el alumno y el instructor tienen que
-- ver el tema de su clase, y no hay dato sensible ni scope de sede (es la misma malla
-- para toda la escuela).
DROP POLICY IF EXISTS select_class_b_topics ON public.class_b_topics;
CREATE POLICY select_class_b_topics ON public.class_b_topics
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Escribir es solo de admin (AC2). Secretaría tampoco: es malla curricular, no
-- operación diaria.
DROP POLICY IF EXISTS insert_class_b_topics ON public.class_b_topics;
CREATE POLICY insert_class_b_topics ON public.class_b_topics
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');

DROP POLICY IF EXISTS update_class_b_topics ON public.class_b_topics;
CREATE POLICY update_class_b_topics ON public.class_b_topics
  FOR UPDATE USING (auth_user_role() = 'admin') WITH CHECK (auth_user_role() = 'admin');

-- Sin policy DELETE a propósito: las 12 filas son fijas. Se editan, no se borran —
-- borrar una dejaría una clase sin tema y la ficha técnica sin qué mostrar.

-- 4. updated_at ─────────────────────────────────────────────────────────────────
-- `public.set_updated_at()` es el helper del proyecto (lo usan 4 migraciones).
-- La versión anterior llamaba a `update_updated_at_column()`, que NO existe en
-- `public`: solo existe en el esquema `storage` (lo crea Supabase para sus propias
-- tablas) y `search_path` no lo incluye, así que Postgres rechazaba la migración con
-- `42883: function update_updated_at_column() does not exist`.
DROP TRIGGER IF EXISTS set_class_b_topics_updated_at ON public.class_b_topics;
CREATE TRIGGER set_class_b_topics_updated_at
  BEFORE UPDATE ON public.class_b_topics
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 5. Seed de los 12 temas ───────────────────────────────────────────────────────
-- Textos exactos entregados por el dueño en ASG-m-007.
--
-- `DO NOTHING` y no `DO UPDATE`: son valores POR DEFECTO, y el admin los edita desde
-- Ajustes. Con `DO UPDATE SET topic = EXCLUDED.topic` una re-aplicación de la
-- migración pisaría en silencio lo que el admin hubiera cambiado.
INSERT INTO public.class_b_topics (class_number, topic) VALUES
  (1,  'Psicotécnico / Pre-conducción'),
  (2,  'Partidas y detenciones'),
  (3,  'Reducciones'),
  (4,  'Refuerzo reducciones'),
  (5,  'Retrocesos'),
  (6,  'Estacionamiento subida y bajada'),
  (7,  'Estacionamiento'),
  (8,  'Refuerzo estacionamiento'),
  (9,  'Tránsito urbano I'),
  (10, 'Tránsito urbano II'),
  (11, 'Tránsito urbano III'),
  (12, 'Mecánica + preparación examen')
ON CONFLICT (class_number) DO NOTHING;
