-- Spec 0013: Documentar el valor 'X' (no binario) en columnas gender CHAR(1).
-- No altera la estructura de las tablas; solo actualiza metadatos.

COMMENT ON COLUMN students.gender
  IS 'Genero del usuario. Valores: M=Masculino, F=Femenino, X=Prefiero no especificar (ley REC Chile 2022). CHAR(1).';

COMMENT ON COLUMN professional_pre_registrations.gender
  IS 'Genero del pre-inscrito. Valores: M=Masculino, F=Femenino, X=Prefiero no especificar. CHAR(1).';
