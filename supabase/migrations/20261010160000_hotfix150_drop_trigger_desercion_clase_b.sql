-- hotfix-150-m (ASG-i-053): eliminar el trigger viejo de deserción Clase B.
--
-- trg_class_b_dropout (20260301000008) cancelaba la MATRÍCULA entera cuando las 2 asistencias
-- más recientes del alumno (por recorded_at, sin mirar matrícula ni archived_at) eran
-- ausencias. La regla vigente es otra: 2 faltas consecutivas cancelan las clases futuras
-- (penalización), no la matrícula.
--
-- En la BD de dev el trigger ya estaba deshabilitado a mano (tgenabled = 'D', 2026-10-10) y
-- ninguna matrícula cancelada tiene ausencias Clase B, pero el repo lo seguía creando
-- habilitado: cualquier entorno nuevo lo habría traído activo. La columna
-- consecutive_absences se conserva (la lee el DTO; deja de recalcularse).

DROP TRIGGER IF EXISTS trg_class_b_dropout ON public.class_b_practice_attendance;
DROP FUNCTION IF EXISTS public.verify_class_b_dropout_rule();
