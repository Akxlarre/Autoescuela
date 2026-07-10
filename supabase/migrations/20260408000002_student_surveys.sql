-- Migración para encuestas de satisfacción y seguimiento de licencias
CREATE TABLE IF NOT EXISTS public.student_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id INTEGER NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    obtained_license BOOLEAN DEFAULT FALSE,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(enrollment_id)
);

-- Habilitar RLS
ALTER TABLE public.student_surveys ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (Lectura para autenticados)
CREATE POLICY "Allow authenticated read surveys" 
ON public.student_surveys FOR SELECT 
TO authenticated 
USING (true);

COMMENT ON TABLE public.student_surveys IS 'Encuestas de satisfacción y confirmación de obtención de licencia post-egreso.';
