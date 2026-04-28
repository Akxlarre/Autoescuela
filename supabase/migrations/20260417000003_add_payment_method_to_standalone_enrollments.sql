-- Add payment_method and registered_by to standalone_course_enrollments
-- Required for the new "Inscribir Alumno" flow in Cursos Singulares.

ALTER TABLE standalone_course_enrollments
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'efectivo',
  ADD COLUMN IF NOT EXISTS registered_by INT REFERENCES users(id) ON DELETE SET NULL;
