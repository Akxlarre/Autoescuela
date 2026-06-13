-- Migración para hacer dinámico el máximo de clases prácticas por día
-- Añade la columna 'max_classes_per_day' a la tabla 'courses', por defecto 1 para mantener la regla de negocio original.

BEGIN;

ALTER TABLE courses
ADD COLUMN max_classes_per_day INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN courses.max_classes_per_day IS 'Límite de bloques prácticos que un alumno puede agendar en un mismo día para este curso. Por defecto 1.';

COMMIT;
