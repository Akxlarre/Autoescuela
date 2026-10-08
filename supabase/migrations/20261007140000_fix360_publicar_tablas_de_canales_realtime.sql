-- ============================================================================
-- fix-360-m (ASG-i-056): publicar las tablas que escuchan los canales de tiempo real
-- ============================================================================
-- Contexto: un canal de Supabase Realtime con varios bindings queda mudo COMPLETO si una sola de
-- sus tablas no está en la publicación `supabase_realtime`, aunque el cliente reporte SUBSCRIBED
-- (mecanismo documentado en fix-227-m / 20260827160000 y repetido en 20260907120000).
--
-- Confirmado el 2026-10-07 contra el servidor de tiempo real de la BD de desarrollo (una
-- suscripción de prueba por tabla): 6 canales escuchan 13 tablas sin publicar.
--
--   alumnos-listado-realtime, alumnos-profesional-realtime, pagos-global-realtime
--       → enrollments
--   alumno-detalle-<id> (ficha)
--       → absence_evidence, class_b_practice_attendance, professional_theory_attendance,
--         professional_practice_attendance, professional_module_grades
--   cuadratura-hoy-realtime
--       → expenses, cash_closings, standalone_course_enrollments, special_service_sales
--   flota-realtime
--       → vehicles, vehicle_documents, vehicle_assignments
--
-- Los eventos de postgres_changes respetan la RLS de quien escucha: publicar una tabla no le
-- muestra a nadie filas que su SELECT no devuelva.
--
-- Rollback: ALTER PUBLICATION supabase_realtime DROP TABLE public.<tabla>; por cada una.
--
-- Idempotente: cada tabla se agrega solo si aún no está.
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'enrollments',
    'absence_evidence',
    'class_b_practice_attendance',
    'professional_theory_attendance',
    'professional_practice_attendance',
    'professional_module_grades',
    'expenses',
    'cash_closings',
    'standalone_course_enrollments',
    'special_service_sales',
    'vehicles',
    'vehicle_documents',
    'vehicle_assignments'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
