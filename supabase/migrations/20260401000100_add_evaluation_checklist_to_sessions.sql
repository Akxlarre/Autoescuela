-- Migración: Añadir soporte para checklist detallado de evaluación en sesiones clase B
-- Descripción: Permite guardar el estado de cada ítem evaluado (Uso de espejos, volante, etc) en formato JSON.

ALTER TABLE public.class_b_sessions 
ADD COLUMN IF NOT EXISTS evaluation_checklist jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.class_b_sessions.evaluation_checklist IS 'Lista de ítems evaluados durante la clase práctica con su estado (checked true/false)';
