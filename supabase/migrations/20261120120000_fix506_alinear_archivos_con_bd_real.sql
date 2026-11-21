-- ============================================================================
-- fix-506-m: lo que existe en la BD real (DEV y PROD) y ningún archivo creaba
-- ============================================================================
-- La BD original es anterior a los archivos base 20260301000001…11, que se reconstruyeron desde
-- ella, y después se hicieron cambios desde el SQL Editor sin archivo. Comparando el esquema real
-- (respaldo del 2026-11-20) con una BD creada solo desde supabase/migrations/, quedan estas
-- diferencias, y en todas manda la BD real: es lo que corre desde siempre y lo que la app usa.
--
-- En DEV y PROD esta migración no cambia nada (cada paso es condicional o idempotente). Existe para
-- que una BD creada desde los archivos (supabase start, un proyecto nuevo) sea igual a la real.
-- La política de student_surveys va en 20261120121000 (esa sí cambia DEV y PROD).
-- ============================================================================

-- 1. student_surveys: la real tiene id uuid y `comments`; dos migraciones de abril la crean con
--    CREATE TABLE IF NOT EXISTS y otras columnas (id integer, `comment`, municipality). La app lee
--    `comments` (ex-alumnos.facade.ts). Solo se recrea si es la versión de los archivos, que en una
--    BD recién creada está vacía.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_surveys' AND column_name = 'comment'
  ) THEN
    DROP TABLE public.student_surveys CASCADE;

    CREATE TABLE public.student_surveys (
      id                  uuid DEFAULT gen_random_uuid() NOT NULL,
      enrollment_id       integer NOT NULL,
      satisfaction_rating integer,
      obtained_license    boolean DEFAULT false,
      comments            text,
      created_at          timestamp with time zone DEFAULT now(),
      CONSTRAINT student_surveys_pkey PRIMARY KEY (id),
      CONSTRAINT student_surveys_enrollment_id_key UNIQUE (enrollment_id),
      CONSTRAINT student_surveys_enrollment_id_fkey FOREIGN KEY (enrollment_id)
        REFERENCES public.enrollments(id) ON DELETE CASCADE,
      CONSTRAINT student_surveys_satisfaction_rating_check
        CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5)
    );

    ALTER TABLE public.student_surveys ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON TABLE public.student_surveys TO anon, authenticated, service_role;
  END IF;
END $$;

-- 2. class_b_exam_scores: la real conserva student_id (20260404120000 lo quitaba) y sus dos FKs
--    borran en cascada.
ALTER TABLE public.class_b_exam_scores ADD COLUMN IF NOT EXISTS student_id integer;

ALTER TABLE public.class_b_exam_scores DROP CONSTRAINT IF EXISTS fk_class_b_exam_scores_enrollment;
ALTER TABLE public.class_b_exam_scores
  ADD CONSTRAINT fk_class_b_exam_scores_enrollment FOREIGN KEY (enrollment_id)
  REFERENCES public.enrollments(id) ON DELETE CASCADE;

ALTER TABLE public.class_b_exam_scores DROP CONSTRAINT IF EXISTS fk_class_b_exam_scores_student;
ALTER TABLE public.class_b_exam_scores
  ADD CONSTRAINT fk_class_b_exam_scores_student FOREIGN KEY (student_id)
  REFERENCES public.students(id) ON DELETE CASCADE;

-- 3. Columnas que en la real aceptan NULL.
ALTER TABLE public.absence_evidence ALTER COLUMN file_url DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN maternal_last_name DROP NOT NULL;

-- 4. Índice creado desde el SQL Editor.
CREATE INDEX IF NOT EXISTS idx_expenses_vehicle_id ON public.expenses USING btree (vehicle_id);
