-- Spec 0024-m (ASG-i-054): funciones SQL de "día de Chile".
--
-- La sesión de la base corre en UTC: CURRENT_DATE y now()::date devuelven el día UTC, que entre
-- las 20:00/21:00 y la medianoche de Chile ya es el día siguiente. Estas tres funciones son el
-- único lugar del esquema donde un instante se convierte en día de negocio (y un día en su
-- primer instante). Espejo SQL de src/app/core/utils/chile-time.utils.ts y de
-- supabase/functions/_shared/chile-time.ts.
--
-- Idempotente: CREATE OR REPLACE + GRANT.

-- Hoy en Chile.
CREATE OR REPLACE FUNCTION public.chile_today()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT (now() AT TIME ZONE 'America/Santiago')::date;
$$;

COMMENT ON FUNCTION public.chile_today() IS
  'Spec 0024-m. Hoy en Chile (America/Santiago). Usar SIEMPRE en vez de la fecha de la sesión: '
  'la sesión corre en UTC y de noche su "hoy" ya es el día siguiente. En policies y vistas, '
  'envolver en (SELECT public.chile_today()) para que se evalúe una sola vez.';

-- Día de Chile al que pertenece un instante.
CREATE OR REPLACE FUNCTION public.chile_date(p_instant timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT (p_instant AT TIME ZONE 'America/Santiago')::date;
$$;

COMMENT ON FUNCTION public.chile_date(timestamptz) IS
  'Spec 0024-m. Día de Chile de un instante. Usar en vez de castear el instante a fecha, que da '
  'el día UTC.';

-- Primer instante de un día de Chile. El día del cambio a horario de verano la medianoche no
-- existe (00:00 pasa a 01:00): Postgres la resuelve al primer instante válido, igual que la app.
CREATE OR REPLACE FUNCTION public.chile_day_start(p_day date)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT (p_day + time '00:00') AT TIME ZONE 'America/Santiago';
$$;

COMMENT ON FUNCTION public.chile_day_start(date) IS
  'Spec 0024-m. Primer instante de un día de Chile. Un día completo es el rango semiabierto '
  '[chile_day_start(d), chile_day_start(d + 1)).';

-- Solo devuelven fechas: las usan policies y vistas security_invoker, así que quien consulta
-- necesita EXECUTE.
GRANT EXECUTE ON FUNCTION public.chile_today()            TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chile_date(timestamptz)  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chile_day_start(date)    TO anon, authenticated, service_role;
