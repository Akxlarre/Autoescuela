-- ============================================================================
-- Migración: Corregir lógica del trigger de habilitación de certificado Clase B
-- RF-082.4 (revisado)
--
-- Cambio:
--   ANTES — el trigger exigía 100% de asistencia a TODAS las clases teóricas
--           completadas de la sede (sin importar si el alumno estaba inscrito).
--   AHORA  — completar la clase práctica #12 es suficiente para habilitar
--            el certificado. La asistencia teórica pasa a ser un requisito
--            flexible validado en la interfaz (modal de confirmación).
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_class_b_certificate_enablement()
RETURNS TRIGGER AS $$
BEGIN
  -- Las 12 clases prácticas completadas son el único requisito indispensable.
  -- La asistencia teórica se verifica como requisito flexible en la UI:
  -- si el alumno tiene < 100 % el secretario/admin puede confirmar igualmente.
  UPDATE public.enrollments
  SET certificate_enabled = true,
      updated_at          = NOW()
  WHERE id = NEW.enrollment_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- El trigger en sí no cambia (sigue disparándose al completar la clase #12).
-- Solo se reemplaza la función que ejecuta.
