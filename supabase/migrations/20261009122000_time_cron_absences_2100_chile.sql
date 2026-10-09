-- Spec 0024-m (ASG-i-054, AC12): el corte de inasistencias Clase B ocurre a las 21:00 hora de
-- Chile todo el año.
--
-- pg_cron solo entiende UTC. El job corría a las 01:00 UTC: 21:00 en invierno (UTC-4) pero
-- 22:00 en verano (UTC-3). Ahora se agenda a las 00:00 y a las 01:00 UTC y una función
-- envoltorio ejecuta el corte solo en la corrida que cae a las 21 hora Chile:
--   verano  (UTC-3): 00:00 UTC = 21:00 → corre · 01:00 UTC = 22:00 → no hace nada
--   invierno (UTC-4): 00:00 UTC = 20:00 → no hace nada · 01:00 UTC = 21:00 → corre
-- mark_end_of_day_class_b_absences() no cambia: ya compara por día de Chile y es idempotente
-- (solo toca sesiones en status = 'scheduled').
--
-- Idempotente: CREATE OR REPLACE + unschedule/schedule.

CREATE OR REPLACE FUNCTION public.run_class_b_absences_cutoff()
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXTRACT(HOUR FROM (now() AT TIME ZONE 'America/Santiago'))::int <> 21 THEN
    RETURN false;
  END IF;

  PERFORM public.mark_end_of_day_class_b_absences();
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.run_class_b_absences_cutoff() IS
  'Spec 0024-m. Envoltorio del corte de inasistencias Clase B: lo invoca pg_cron a las 00:00 y '
  '01:00 UTC y solo ejecuta mark_end_of_day_class_b_absences() cuando en Chile son las 21 '
  '(devuelve true); en la otra corrida no hace nada (false). Así el corte es a las 21:00 hora '
  'Chile en horario de invierno y de verano.';

-- La invoca solo pg_cron (lección de fix-191-b: sin EXECUTE para quien no la usa).
REVOKE ALL ON FUNCTION public.run_class_b_absences_cutoff() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_class_b_absences_cutoff() TO service_role;

COMMENT ON FUNCTION public.mark_end_of_day_class_b_absences() IS
  'RF-053. Invocada por run_class_b_absences_cutoff() (pg_cron 00:00 y 01:00 UTC; corre solo a '
  'las 21:00 hora Chile, spec 0024-m). Recorre class_b_sessions '
  'en status=''scheduled'' cuya fecha (America/Santiago) sea hoy o anterior y las marca ''no_show'', insertando '
  'class_b_practice_attendance(status=''absent'') por alumno (idempotente). Por cada matrícula afectada invoca '
  'apply_class_b_absence_penalty(). fix-028: guarda ''AND status=scheduled'' antes de marcar no_show. '
  'fix-191-m: el ON CONFLICT reactiva (archived_at = NULL) la fila histórica de un reagendamiento previo en vez '
  'de saltarla — sin esto, la inasistencia a una clase reagendada nunca quedaba registrada. '
  'Cada fila corre en su propio bloque BEGIN/EXCEPTION. SECURITY DEFINER.';

SELECT cron.unschedule('mark-end-of-day-class-b-absences')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'mark-end-of-day-class-b-absences'
  );

SELECT cron.schedule(
  'mark-end-of-day-class-b-absences',
  '0 0,1 * * *',   -- 00:00 y 01:00 UTC; el envoltorio deja pasar solo la de las 21:00 hora Chile
  $$ SELECT public.run_class_b_absences_cutoff(); $$
);
