-- 20260408000001 — Agregar birth_date y gender a professional_pre_registrations
-- El alumno los ingresa en el formulario público; el admin no necesita repetirlos.

ALTER TABLE professional_pre_registrations
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS gender     CHAR(1),
  ADD COLUMN IF NOT EXISTS address    TEXT;

COMMENT ON COLUMN professional_pre_registrations.birth_date IS 'Fecha de nacimiento ingresada por el alumno en el formulario público';
COMMENT ON COLUMN professional_pre_registrations.gender     IS 'Género ingresado por el alumno en el formulario público (M | F)';
COMMENT ON COLUMN professional_pre_registrations.address    IS 'Dirección ingresada por el alumno en el formulario público';
