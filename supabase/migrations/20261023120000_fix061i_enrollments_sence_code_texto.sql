-- fix-061-i: el código SENCE que escribe la secretaria en el paso 1 de la matrícula no se guardaba.
--
-- La pantalla pide el código como texto libre, pero enrollments solo tenía sence_code_id (FK al
-- catálogo sence_codes, que nadie mantiene). La app resolvía el texto a un id con un mapa que nunca
-- se llenaba, así que sence_code_id quedaba siempre NULL (81 matrículas SENCE de prueba, 0 con
-- código). Decisión: guardar el código tal como se escribe. sence_code_id queda sin uso por ahora.

ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS sence_code TEXT;

COMMENT ON COLUMN public.enrollments.sence_code IS
  'Código SENCE tal como lo escribe la secretaria en el paso 1 de la matrícula (fix-061-i).';
